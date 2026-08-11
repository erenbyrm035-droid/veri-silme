-- ============================================================================
-- 0046 — AI Agent altyapısı
--
-- MEVCUT SİSTEM KORUNUR: `ai_memory`, `ai_conversations`, `ai_messages`,
-- `ai_usage`, `ai_logs`, `ai_prompt_versions` tablolarına DOKUNULMAZ.
-- Bu migration onların ÜZERİNE agent katmanı ekler.
--
-- DÖRT YENİ KAVRAM:
--   ai_facts    → yapılandırılmış kalıcı hafıza (ai_memory.summary bir metin
--                 yığınıydı ve `slice(-800)` ile kırpılıyordu; yani eski bilgi
--                 sessizce siliniyordu. Artık her bilgi ayrı satır, kaynağı ve
--                 güven derecesiyle birlikte)
--   ai_goals    → kullanıcı hedefleri + otomatik ilerleme takibi
--   ai_reports  → sabah/akşam/haftalık/aylık raporlar
--   ai_actions  → agent'ın YAPTIĞI işlerin denetim kaydı (araç çağrıları)
--
-- Additive + idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) ai_facts — yapılandırılmış kalıcı hafıza
-- ---------------------------------------------------------------------------
create table if not exists public.ai_facts (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- Kanonik anahtar: aynı bilgi tek satırda tutulur, güncellenir.
  -- Örn: 'injury.knee', 'preference.dislikes_exercise', 'schedule.trains_evening'
  key         text not null,
  value       text not null,
  category    text not null default 'other',
    -- profile | goal | preference | injury | schedule | nutrition | social | other
  -- Bilgi nereden geldi: kullanıcı söyledi mi, veriden mi türetildi?
  source      text not null default 'conversation',
    -- conversation | derived | profile | admin
  confidence  numeric(3,2) not null default 0.80,   -- 0.00–1.00
  -- Geçici bilgiler (örn. "bu hafta tatilde") kendiliğinden düşsün.
  expires_at  timestamptz,
  hit_count   int not null default 1,               -- kaç kez teyit edildi
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, key)
);
create index if not exists idx_ai_facts_user on public.ai_facts (user_id, category);
create index if not exists idx_ai_facts_live on public.ai_facts (user_id)
  where expires_at is null;

comment on table public.ai_facts is
  'Agent kalıcı hafızası. ai_memory.summary (serbest metin) yerine geçer; o tablo geriye dönük uyumluluk için korunur.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ai_facts_confidence_chk') then
    alter table public.ai_facts
      add constraint ai_facts_confidence_chk check (confidence >= 0 and confidence <= 1);
  end if;
end $$;

/**
 * Bir bilgiyi kaydeder/günceller.
 *
 * Aynı anahtar tekrar gelirse: değer güncellenir, `hit_count` artar ve güven
 * yükselir (tekrar teyit edilen bilgi daha güvenilirdir). Böylece agent
 * "kullanıcı bunu üç kez söyledi" ile "bir kez geçti" arasını ayırt edebilir.
 */
create or replace function public.upsert_ai_fact(
  p_user uuid, p_key text, p_value text,
  p_category text default 'other',
  p_source text default 'conversation',
  p_confidence numeric default 0.80,
  p_expires_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_user is null or coalesce(trim(p_key), '') = '' or coalesce(trim(p_value), '') = '' then
    return null;
  end if;

  insert into public.ai_facts (user_id, key, value, category, source, confidence, expires_at)
  values (p_user, lower(trim(p_key)), trim(p_value), p_category, p_source,
          least(1.0, greatest(0.0, p_confidence)), p_expires_at)
  on conflict (user_id, key) do update
    set value      = excluded.value,
        category   = excluded.category,
        source     = excluded.source,
        -- Tekrar teyit → güven artar ama 0.99'u aşmaz (kesinlik iddiası yok).
        confidence = least(0.99, greatest(public.ai_facts.confidence, excluded.confidence) + 0.05),
        expires_at = excluded.expires_at,
        hit_count  = public.ai_facts.hit_count + 1,
        updated_at = now()
  returning id into v_id;

  return v_id;
end $$;

/** Süresi dolmuş geçici bilgileri temizler. */
create or replace function public.expire_ai_facts()
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  delete from public.ai_facts where expires_at is not null and expires_at < now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------
-- 2) ai_goals — hedef takibi
-- ---------------------------------------------------------------------------
create table if not exists public.ai_goals (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  metric        text not null,
    -- weight | body_fat | workouts_per_week | protein_daily | steps_daily
    -- | water_daily | volume_weekly | streak
  start_value   numeric,
  target_value  numeric not null,
  -- Hedef yönü: kilo vermede azalan, hacimde artan. Otomatik türetilir ama
  -- açıkça saklanır ki "5 kilo ver" ile "5 kilo al" karışmasın.
  direction     text not null default 'decrease',   -- decrease | increase | maintain
  starts_on     date not null default current_date,
  target_date   date,
  status        text not null default 'active',     -- active | achieved | missed | cancelled
  achieved_at   timestamptz,
  created_by    text not null default 'user',       -- user | agent
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_ai_goals_user on public.ai_goals (user_id, status);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ai_goals_direction_chk') then
    alter table public.ai_goals
      add constraint ai_goals_direction_chk check (direction in ('decrease','increase','maintain'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ai_goals_status_chk') then
    alter table public.ai_goals
      add constraint ai_goals_status_chk check (status in ('active','achieved','missed','cancelled'));
  end if;
end $$;

/**
 * Bir metriğin GÜNCEL değerini döndürür.
 * Hedef ilerlemesi buradan hesaplanır; her metrik kendi kaynağından okunur.
 */
create or replace function public.goal_current_value(p_user uuid, p_metric text)
returns numeric language sql stable security definer set search_path = public as $$
  select case p_metric
    -- Kilo İKİ yerde tutuluyor: `body_measurements` (İlerleme sayfasındaki
    -- ölçüm kaydı) ve `profiles.weight_kg` (onboarding'de girilen değer).
    -- Ölçüm kaydı önceliklidir çünkü daha günceldir; ama çoğu kullanıcı
    -- İlerleme sayfasına hiç girmiyor. Sadece ölçüme bakarsak kilo hedefi
    -- olan kullanıcıların çoğunda `current_value` NULL kalır, ilerleme
    -- hesaplanamaz ve SAPMA UYARISI HİÇ ÜRETİLMEZ — yani hedef takibi
    -- sessizce çalışmaz. Bu yüzden profile geri düşülüyor.
    when 'weight' then coalesce(
      (select bm.weight_kg from public.body_measurements bm
        where bm.user_id = p_user and bm.weight_kg is not null
        order by bm.measured_on desc limit 1),
      (select p.weight_kg from public.profiles p where p.id = p_user))
    -- Not: yağ oranı `body_measurements`'ta DEĞİL, `profiles`'ta tutuluyor
    -- (ölçüm tablosunda çevre ölçüleri var, vücut kompozisyonu yok).
    when 'body_fat' then (
      select p.body_fat_pct from public.profiles p where p.id = p_user)
    when 'workouts_per_week' then (
      select count(*)::numeric from public.workouts w
       where w.user_id = p_user and w.status = 'completed'
         and w.workout_date >= current_date - 7)
    when 'protein_daily' then (
      select coalesce(sum(l.protein_g), 0)::numeric from public.nutrition_logs l
       where l.user_id = p_user and l.log_date = current_date)
    when 'steps_daily' then (
      select coalesce(dm.steps, 0)::numeric from public.daily_metrics dm
       where dm.user_id = p_user and dm.metric_date = current_date)
    when 'water_daily' then (
      select coalesce(sum(wl.amount_ml), 0)::numeric from public.water_logs wl
       where wl.user_id = p_user and wl.log_date = current_date)
    when 'volume_weekly' then (
      select coalesce(sum(coalesce(ws.weight_kg,0) * coalesce(ws.reps,0)), 0)::numeric
        from public.workout_sets ws
        join public.workouts w on w.id = ws.workout_id
       where w.user_id = p_user and w.status = 'completed'
         and w.workout_date >= current_date - 7)
    when 'streak' then (
      select coalesce(g.current_streak, 0)::numeric from public.user_gamification g
       where g.user_id = p_user)
    else null
  end;
$$;

/**
 * Aktif hedeflerin ilerlemesi + SAPMA.
 *
 * `on_track`: bugüne kadar geçen sürenin oranı ile ilerleme oranı karşılaştırılır.
 * Örn. sürenin %60'ı geçmiş ama ilerleme %30 ise → sapma var, agent uyarır.
 * Tolerans %10 — küçük dalgalanmada gereksiz uyarı üretilmesin.
 */
create or replace function public.goal_progress(p_user uuid)
returns table (
  id uuid, title text, metric text, direction text,
  start_value numeric, current_value numeric, target_value numeric,
  progress_pct numeric, time_pct numeric, on_track boolean,
  days_left int, target_date date, status text
) language sql stable security definer set search_path = public as $$
  with g as (
    select ag.*, public.goal_current_value(p_user, ag.metric) as cur
      from public.ai_goals ag
     where ag.user_id = p_user and ag.status = 'active'
  ),
  calc as (
    select
      g.id, g.title, g.metric, g.direction, g.start_value, g.cur, g.target_value,
      g.target_date, g.status,
      -- İlerleme: başlangıçtan hedefe kat edilen yol (yön bağımsız, 0-100)
      case
        when g.cur is null or g.start_value is null then null
        when g.target_value = g.start_value then 100::numeric
        else greatest(0, least(100,
               round(((g.cur - g.start_value) / (g.target_value - g.start_value)) * 100, 1)))
      end as progress_pct,
      -- Zamanın ne kadarı geçti
      case
        when g.target_date is null or g.target_date <= g.starts_on then null
        else greatest(0, least(100, round(
               ((current_date - g.starts_on)::numeric / (g.target_date - g.starts_on)::numeric) * 100, 1)))
      end as time_pct,
      case when g.target_date is null then null
           else greatest(0, (g.target_date - current_date)) end as days_left
    from g
  )
  select
    c.id, c.title, c.metric, c.direction,
    c.start_value, c.cur, c.target_value,
    c.progress_pct, c.time_pct,
    -- Zaman bilgisi yoksa "yolunda" kabul edilir (yanlış alarm üretme).
    case
      when c.progress_pct is null or c.time_pct is null then true
      else c.progress_pct >= (c.time_pct - 10)
    end as on_track,
    c.days_left, c.target_date, c.status
  from calc c;
$$;

/** Hedefe ulaşıldıysa kapatır; süresi dolduysa "missed" yapar (tembel değerlendirme). */
create or replace function public.evaluate_ai_goals(p_user uuid)
returns int language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0;
begin
  for r in
    select gp.id, gp.progress_pct, gp.days_left, gp.target_date
      from public.goal_progress(p_user) gp
  loop
    if r.progress_pct is not null and r.progress_pct >= 100 then
      update public.ai_goals
         set status = 'achieved', achieved_at = now(), updated_at = now()
       where id = r.id and status = 'active';
      v_n := v_n + 1;

      insert into public.notifications (user_id, type, title, body, href)
      values (p_user, 'achievement', 'Hedefine ulaştın! 🎯',
              'Koçun belirlediğiniz hedefin tamamlandığını doğruladı.', '/coach');

    elsif r.target_date is not null and r.target_date < current_date then
      update public.ai_goals
         set status = 'missed', updated_at = now()
       where id = r.id and status = 'active';
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------
-- 3) ai_reports — sabah / akşam / haftalık / aylık
-- ---------------------------------------------------------------------------
create table if not exists public.ai_reports (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null,              -- morning | evening | weekly | monthly
  report_date  date not null default current_date,
  headline     text not null,
  body         text not null,
  -- Rapor üretilirken kullanılan sayısal bulgular (denetlenebilirlik için).
  metrics      jsonb not null default '{}',
  -- Agent'ın önerdiği eylemler: [{label, tool, args}]
  suggestions  jsonb not null default '[]',
  seen_at      timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, kind, report_date)
);
create index if not exists idx_ai_reports_user on public.ai_reports (user_id, created_at desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ai_reports_kind_chk') then
    alter table public.ai_reports
      add constraint ai_reports_kind_chk check (kind in ('morning','evening','weekly','monthly'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4) ai_actions — agent'ın yaptığı işlerin denetim kaydı
--
-- NEDEN: Agent kullanıcı adına veri değiştirdiğinde bunun izi olmalı.
-- "Kalorimi kim değiştirdi?" sorusunun cevabı burada.
-- Yüksek riskli işlemler `status='proposed'` olarak başlar, kullanıcı onaylar.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_actions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  tool            text not null,
  args            jsonb not null default '{}',
  result          jsonb not null default '{}',
  status          text not null default 'executed',
    -- executed | proposed | approved | rejected | failed
  -- Onay gerektiren işlemde kullanıcıya gösterilecek özet.
  summary         text,
  error           text,
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_ai_actions_user on public.ai_actions (user_id, created_at desc);
create index if not exists idx_ai_actions_pending on public.ai_actions (user_id)
  where status = 'proposed';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ai_actions_status_chk') then
    alter table public.ai_actions
      add constraint ai_actions_status_chk
      check (status in ('executed','proposed','approved','rejected','failed'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5) agent_snapshot — TEK ÇAĞRIDA TÜM BAĞLAM
--
-- Agent her cevaptan önce kullanıcının tüm durumunu bilmek zorunda. Bunu 15
-- ayrı sorguyla yapmak hem yavaş hem kırılgan olurdu. Tek RPC ile tek turda
-- toplanıyor.
--
-- 365 GÜNLÜK GEÇMİŞ NOTU: Ham 365 gün prompt'a sığmaz (~100k+ token). Bunun
-- yerine aylık toplamlar (`monthly`) + kayda değer olaylar döndürülür — sinyal
-- korunur, maliyet kalkar.
-- ---------------------------------------------------------------------------
create or replace function public.agent_snapshot(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
  v_profile jsonb; v_today jsonb; v_gam jsonb; v_team jsonb;
  v_social jsonb; v_goals jsonb; v_facts jsonb; v_monthly jsonb;
  v_workouts jsonb; v_challenges jsonb; v_season jsonb; v_nutrition jsonb;
begin
  -- Profil + sağlık
  select to_jsonb(x) into v_profile from (
    select p.full_name, p.age, p.gender, p.height_cm, p.weight_kg,
           p.target_weight_kg, p.body_fat_pct, p.goal, p.goals, p.experience,
           p.activity_level, p.training_environment, p.weekly_training_days,
           p.injuries, p.health_conditions, p.allergies, p.health_notes,
           p.daily_calorie_goal, p.daily_protein_goal, p.daily_carb_goal,
           p.daily_fat_goal, p.daily_water_goal_ml, p.daily_sleep_goal_min,
           p.is_premium, p.membership_type, p.premium_until,
           p.ai_consent,
           (select count(*)::int from public.favorites f where f.user_id = p_user) as favorite_count
      from public.profiles p where p.id = p_user
  ) x;

  -- Bugün (Dalga 1'deki daily_summary + skorlar)
  select to_jsonb(x) into v_today from (
    select d.*,
           public.recovery_score(p_user)  as recovery,
           public.readiness_score(p_user) as readiness
      from public.daily_summary(p_user, current_date) d
  ) x;

  -- Oyunlaştırma
  select to_jsonb(x) into v_gam from (
    select g.total_xp, g.level, g.current_streak, g.longest_streak,
           g.fitness_score, g.coins, g.season_xp
      from public.user_gamification g where g.user_id = p_user
  ) x;

  -- Sezon / Battle Pass
  select jsonb_build_object(
    'active', s.active, 'season_xp', s.season_xp, 'tier', s.tier,
    'max_tier', s.max_tier, 'next_req_xp', s.next_req_xp,
    'days_left', s.season->'days_left'
  ) into v_season
  from (select public.season_state(p_user) as s) q,
       lateral (select (q.s->>'active')::boolean as active,
                       (q.s->>'season_xp')::int as season_xp,
                       (q.s->>'tier')::int as tier,
                       (q.s->>'max_tier')::int as max_tier,
                       (q.s->>'next_req_xp')::int as next_req_xp,
                       q.s->'season' as season) s;

  -- Takım
  select to_jsonb(x) into v_team from (
    select t.name, t.slug, t.level, tm.role,
           (select count(*)::int from public.team_members m where m.team_id = t.id) as member_count,
           (select count(*)::int from public.team_battles b
             where (b.team_a = t.id or b.team_b = t.id) and b.status = 'active') as active_battles
      from public.team_members tm
      join public.teams t on t.id = tm.team_id
     where tm.user_id = p_user limit 1
  ) x;

  -- Sosyal
  select jsonb_build_object(
    'friends', (select count(*)::int from public.friendships f
                 where f.status = 'accepted'
                   and (f.requester_id = p_user or f.addressee_id = p_user)),
    'followers', (select count(*)::int from public.follows f where f.following_id = p_user),
    'pending_requests', (select count(*)::int from public.friendships f
                          where f.addressee_id = p_user and f.status = 'pending')
  ) into v_social;

  -- Haftalık görevler
  select coalesce(jsonb_agg(jsonb_build_object(
    'title', c.title, 'metric', c.metric, 'target', c.target,
    'progress', coalesce(cp.progress, 0), 'completed', coalesce(cp.completed, false)
  )), '[]'::jsonb) into v_challenges
  from public.weekly_challenges c
  left join public.challenge_progress cp
    on cp.challenge_id = c.id and cp.user_id = p_user
  where c.active;

  -- Aktif hedefler + ilerleme
  select coalesce(jsonb_agg(to_jsonb(gp)), '[]'::jsonb) into v_goals
  from public.goal_progress(p_user) gp;

  -- Kalıcı hafıza (süresi dolmamış, güven sırasına göre)
  select coalesce(jsonb_agg(jsonb_build_object(
    'key', f.key, 'value', f.value, 'category', f.category,
    'confidence', f.confidence, 'source', f.source
  ) order by f.confidence desc, f.updated_at desc), '[]'::jsonb) into v_facts
  from public.ai_facts f
  where f.user_id = p_user
    and (f.expires_at is null or f.expires_at > now());

  -- Son 10 antrenman (detay)
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', w.workout_date, 'title', w.title, 'status', w.status,
    'minutes', w.duration_min,
    'volume', (select coalesce(sum(coalesce(s.weight_kg,0) * coalesce(s.reps,0)), 0)
                 from public.workout_sets s where s.workout_id = w.id)
  ) order by w.workout_date desc), '[]'::jsonb) into v_workouts
  from (select * from public.workouts w2
         where w2.user_id = p_user
         order by w2.workout_date desc limit 10) w;

  -- 12 AYLIK ÖZET — ham 365 gün yerine aylık toplamlar
  select coalesce(jsonb_agg(jsonb_build_object(
    'month', m.ym, 'workouts', m.n, 'minutes', m.mins, 'volume', m.vol
  ) order by m.ym), '[]'::jsonb) into v_monthly
  from (
    select to_char(w.workout_date, 'YYYY-MM') as ym,
           count(*)::int as n,
           coalesce(sum(w.duration_min), 0)::int as mins,
           coalesce(sum((select sum(coalesce(s.weight_kg,0) * coalesce(s.reps,0))
                           from public.workout_sets s where s.workout_id = w.id)), 0)::bigint as vol
      from public.workouts w
     where w.user_id = p_user and w.status = 'completed'
       and w.workout_date >= current_date - 365
     group by 1
  ) m;

  -- Beslenme: son 7 günün ortalaması
  select to_jsonb(x) into v_nutrition from (
    select round(avg(d.cal))::int as avg_calories,
           round(avg(d.pro))::int as avg_protein,
           count(*)::int as logged_days
      from (
        select l.log_date,
               sum(l.calories) as cal,
               sum(l.protein_g) as pro
          from public.nutrition_logs l
         where l.user_id = p_user and l.log_date >= current_date - 7
         group by l.log_date
      ) d
  ) x;

  v := jsonb_build_object(
    'generated_at', now(),
    'profile',    coalesce(v_profile, '{}'::jsonb),
    'today',      coalesce(v_today, '{}'::jsonb),
    'gamification', coalesce(v_gam, '{}'::jsonb),
    'season',     coalesce(v_season, '{}'::jsonb),
    'team',       v_team,
    'social',     coalesce(v_social, '{}'::jsonb),
    'challenges', coalesce(v_challenges, '[]'::jsonb),
    'goals',      coalesce(v_goals, '[]'::jsonb),
    'facts',      coalesce(v_facts, '[]'::jsonb),
    'recent_workouts', coalesce(v_workouts, '[]'::jsonb),
    'monthly',    coalesce(v_monthly, '[]'::jsonb),
    'nutrition_7d', coalesce(v_nutrition, '{}'::jsonb)
  );
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 6) RLS
-- ---------------------------------------------------------------------------
alter table public.ai_facts   enable row level security;
alter table public.ai_goals   enable row level security;
alter table public.ai_reports enable row level security;
alter table public.ai_actions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['ai_facts','ai_goals','ai_reports','ai_actions'] loop
    execute format('drop policy if exists %I on public.%I', t||'_own', t);
    execute format($f$create policy %I on public.%I for all
      using (user_id = auth.uid() or public.has_admin_access(auth.uid()))
      with check (user_id = auth.uid())$f$, t||'_own', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
grant execute on function public.upsert_ai_fact(uuid, text, text, text, text, numeric, timestamptz) to authenticated, service_role;
grant execute on function public.expire_ai_facts()                to authenticated, service_role;
grant execute on function public.goal_current_value(uuid, text)   to authenticated, service_role;
grant execute on function public.goal_progress(uuid)              to authenticated, service_role;
grant execute on function public.evaluate_ai_goals(uuid)          to authenticated, service_role;
grant execute on function public.agent_snapshot(uuid)             to authenticated, service_role;
