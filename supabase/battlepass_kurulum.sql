-- ============================================================================
-- 0045 — Battle Pass (sezonlar), takım savaşları, alışveriş listesi tek kaynak
--
-- ÜÇ AYRI SORUN, TEK MIGRATION:
--
-- 1) SEZONLAR ÖLÜ. `seasons` yalnızca admin CRUD'unda duruyor, `season_rewards`
--    hiçbir yerden okunmuyor ve `user_gamification.season_xp` =
--    `total_xp` olarak yazılıyor (sync_gamification içinde) — yani sezon XP'si
--    aslında yaşam boyu XP. Battle Pass için önce bunun DOĞRU olması gerek.
--
-- 2) TAKIM SAVAŞI YOK. `leaderboard_scores` altyapısı var ama iki takımı
--    karşı karşıya getiren bir yapı yok.
--
-- 3) ALIŞVERİŞ LİSTESİ İKİ YERDE. `shopping_lists` tablosu ve
--    `dietitian_plans.shopping` jsonb'si birbirinden habersiz; kullanıcı
--    birinde işaretliyor, diğeri değişmiyor.
--
-- Additive + idempotent. Mevcut hiçbir tablo/fonksiyon bozulmaz.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Premium kontrolü (DB tarafı)
--    `lib/premium/entitlements.ts` ile aynı kural: is_premium + süre.
--    Battle Pass'in premium şeridi bunu kullanır.
-- ---------------------------------------------------------------------------
create or replace function public.is_premium_user(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.is_premium
       and (p.membership_type = 'lifetime'
            or p.premium_until is null
            or p.premium_until > now())
      from public.profiles p where p.id = p_user
  ), false);
$$;

-- ===========================================================================
-- BÖLÜM 1 — BATTLE PASS
-- ===========================================================================

-- 1.1) Aktif sezon yardımcıları ---------------------------------------------

/** Bugün geçerli olan sezon (yoksa null). */
create or replace function public.active_season()
returns table (id uuid, number int, name text, theme text, starts_on date, ends_on date)
language sql stable security definer set search_path = public as $$
  select s.id, s.number, s.name, s.theme, s.starts_on, s.ends_on
    from public.seasons s
   where s.active and current_date between s.starts_on and s.ends_on
   order by s.starts_on desc
   limit 1;
$$;

/**
 * Kullanıcının AKTİF SEZON içinde kazandığı XP.
 *
 * Kaynak `xp_logs` — sezon penceresine göre filtrelenir. Sezon yoksa 0.
 * `total_xp`'den bağımsızdır; sezon bittiğinde sıfırlanması bu sayede doğaldır.
 */
create or replace function public.season_xp_for(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((
    select sum(l.xp)::int
      from public.xp_logs l, public.active_season() s
     where l.user_id = p_user
       and l.created_at >= s.starts_on::timestamptz
       and l.created_at < (s.ends_on + 1)::timestamptz
  ), 0);
$$;

/**
 * season_xp'yi otomatik doğru tutan trigger.
 *
 * `sync_gamification()` (190 satır, üç ayrı migration'da yeniden yazılmış)
 * `season_xp = total_xp` yazıyor. O fonksiyona dokunmak yerine — 0040'taki coin
 * deseninin aynısı — BEFORE trigger ile değeri düzeltiyoruz. Böylece sync hangi
 * sürümde olursa olsun sonuç doğru kalır.
 */
create or replace function public.tg_user_gamification_season() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.season_xp := public.season_xp_for(new.user_id);
  return new;
end $$;

drop trigger if exists trg_user_gamification_season on public.user_gamification;
create trigger trg_user_gamification_season
  before insert or update on public.user_gamification
  for each row execute function public.tg_user_gamification_season();

-- 1.2) Kademe merdiveni -----------------------------------------------------
-- `season_rewards` (rank bazlı, ölü şema) yerine XP bazlı kademe sistemi.
-- Eski tablo silinmez — admin panelinde görünür ve geçmiş veriyi bozmamak için.

create table if not exists public.season_tracks (
  id             uuid primary key default uuid_generate_v4(),
  season_id      uuid not null references public.seasons(id) on delete cascade,
  tier           int  not null,                      -- 1..N
  req_xp         int  not null default 0,            -- bu kademe için gereken sezon XP'si
  free_reward    jsonb not null default '{}',        -- {type, value, label, icon}
  premium_reward jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  unique (season_id, tier)
);
create index if not exists idx_season_tracks_season on public.season_tracks (season_id, tier);

comment on column public.season_tracks.free_reward is
  'Ücretsiz şerit ödülü: {"type":"coins|xp|badge|premium_days|frame","value":...,"label":"...","icon":"🪙"}. Boş {} → bu kademede ücretsiz ödül yok.';

create table if not exists public.season_claims (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  track_id   uuid not null references public.season_tracks(id) on delete cascade,
  lane       text not null default 'free',           -- free | premium
  reward     jsonb not null default '{}',            -- talep anındaki ödülün kopyası
  claimed_at timestamptz not null default now(),
  unique (user_id, track_id, lane)
);
create index if not exists idx_season_claims_user on public.season_claims (user_id, claimed_at desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'season_claims_lane_chk') then
    alter table public.season_claims
      add constraint season_claims_lane_chk check (lane in ('free', 'premium'));
  end if;
end $$;

-- 1.3) Durum sorgusu --------------------------------------------------------

/**
 * Battle Pass durumu — tek çağrıda sezon + XP + kademeler + talep durumu.
 * `claimable` alanı UI'ın "şimdi al" düğmesini göstermesi için hazır gelir.
 */
create or replace function public.season_state(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s record; v_xp int; v_premium boolean; v_tier int; v_tracks jsonb;
begin
  select * into s from public.active_season();
  if not found then
    return jsonb_build_object('active', false);
  end if;

  v_xp := public.season_xp_for(p_user);
  v_premium := public.is_premium_user(p_user);

  select coalesce(max(t.tier), 0) into v_tier
    from public.season_tracks t
   where t.season_id = s.id and v_xp >= t.req_xp;

  select coalesce(jsonb_agg(x order by x->>'tier'), '[]'::jsonb) into v_tracks
    from (
      select jsonb_build_object(
        'id', t.id,
        'tier', t.tier,
        'req_xp', t.req_xp,
        'unlocked', v_xp >= t.req_xp,
        'free_reward', t.free_reward,
        'premium_reward', t.premium_reward,
        'free_claimed', exists (
          select 1 from public.season_claims c
           where c.user_id = p_user and c.track_id = t.id and c.lane = 'free'),
        'premium_claimed', exists (
          select 1 from public.season_claims c
           where c.user_id = p_user and c.track_id = t.id and c.lane = 'premium'),
        'free_claimable', v_xp >= t.req_xp
          and t.free_reward <> '{}'::jsonb
          and not exists (select 1 from public.season_claims c
                           where c.user_id = p_user and c.track_id = t.id and c.lane = 'free'),
        'premium_claimable', v_premium
          and v_xp >= t.req_xp
          and t.premium_reward <> '{}'::jsonb
          and not exists (select 1 from public.season_claims c
                           where c.user_id = p_user and c.track_id = t.id and c.lane = 'premium')
      ) as x
      from public.season_tracks t
      where t.season_id = s.id
    ) q;

  return jsonb_build_object(
    'active', true,
    'season', jsonb_build_object(
      'id', s.id, 'number', s.number, 'name', s.name, 'theme', s.theme,
      'starts_on', s.starts_on, 'ends_on', s.ends_on,
      'days_left', greatest(0, s.ends_on - current_date)
    ),
    'season_xp', v_xp,
    'is_premium', v_premium,
    'tier', v_tier,
    'max_tier', (select coalesce(max(t.tier), 0) from public.season_tracks t where t.season_id = s.id),
    'next_req_xp', (select min(t.req_xp) from public.season_tracks t
                     where t.season_id = s.id and t.req_xp > v_xp),
    'tracks', v_tracks
  );
end $$;

-- 1.4) Ödül talebi ----------------------------------------------------------

/**
 * Kademe ödülünü talep eder — ATOMİK.
 *
 * Çift talep `season_claims`'in unique kısıtıyla engellenir (uygulama katmanında
 * kontrol + insert yarışa açıktı). Coin/XP ödülleri anında hesaba yazılır.
 */
create or replace function public.claim_season_tier(p_track uuid, p_lane text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  t record; s record; v_xp int; v_reward jsonb; v_type text; v_value numeric;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'Oturum bulunamadı.');
  end if;
  if p_lane not in ('free', 'premium') then
    return jsonb_build_object('ok', false, 'error', 'Geçersiz şerit.');
  end if;

  select * into t from public.season_tracks where id = p_track;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Kademe bulunamadı.');
  end if;

  select * into s from public.active_season();
  if not found or s.id <> t.season_id then
    return jsonb_build_object('ok', false, 'error', 'Bu sezon artık aktif değil.');
  end if;

  if p_lane = 'premium' and not public.is_premium_user(v_user) then
    return jsonb_build_object('ok', false, 'error', 'Bu ödül Premium üyelere özel.');
  end if;

  v_xp := public.season_xp_for(v_user);
  if v_xp < t.req_xp then
    return jsonb_build_object('ok', false, 'error',
      format('Bu kademe için %s sezon XP gerekiyor (şu an %s).', t.req_xp, v_xp));
  end if;

  v_reward := case when p_lane = 'premium' then t.premium_reward else t.free_reward end;
  if v_reward is null or v_reward = '{}'::jsonb then
    return jsonb_build_object('ok', false, 'error', 'Bu kademede ödül yok.');
  end if;

  begin
    insert into public.season_claims (user_id, track_id, lane, reward)
    values (v_user, p_track, p_lane, v_reward);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'Bu ödülü zaten aldın.');
  end;

  -- Ödülü uygula
  v_type  := coalesce(v_reward->>'type', 'badge');
  v_value := coalesce((v_reward->>'value')::numeric, 0);

  if v_type = 'coins' and v_value > 0 then
    -- Coin ekonomisi (0040): coins_spent'i azaltmak bakiyeyi artırmanın
    -- tek doğru yolu — coins_earned trigger tarafından yeniden hesaplanıyor.
    update public.user_gamification
       set coins_spent = greatest(0, coins_spent - v_value::int), updated_at = now()
     where user_id = v_user;

  elsif v_type = 'xp' and v_value > 0 then
    insert into public.xp_logs (user_id, event_key, xp, ref_type, ref_id, meta)
    values (v_user, 'season_reward', v_value::int, 'season_track', p_track,
            jsonb_build_object('lane', p_lane, 'season', s.number));

  elsif v_type = 'premium_days' and v_value > 0 then
    update public.profiles
       set is_premium = true,
           membership_type = case when membership_type in ('lifetime') then membership_type
                                  else coalesce(nullif(membership_type, 'free'), 'premium') end,
           premium_until = greatest(coalesce(premium_until, now()), now()) + (v_value || ' days')::interval
     where id = v_user;
  end if;
  -- badge / frame türleri yalnızca kayıt olarak tutulur (kozmetik).

  insert into public.notifications (user_id, type, title, body, href)
  values (v_user, 'achievement',
          'Sezon ödülü alındı 🎁',
          coalesce(v_reward->>'label', 'Kademe ödülün hesabına eklendi.'),
          '/gamification');

  return jsonb_build_object('ok', true, 'reward', v_reward, 'tier', t.tier);
end $$;

-- 1.5) RLS ------------------------------------------------------------------
alter table public.season_tracks enable row level security;
alter table public.season_claims enable row level security;

drop policy if exists season_tracks_select on public.season_tracks;
create policy season_tracks_select on public.season_tracks for select using (true);

drop policy if exists season_tracks_admin on public.season_tracks;
create policy season_tracks_admin on public.season_tracks for all
  using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));

drop policy if exists season_claims_own on public.season_claims;
create policy season_claims_own on public.season_claims for select
  using (user_id = auth.uid() or public.has_admin_access(auth.uid()));

-- Yazma yalnızca `claim_season_tier()` RPC'si üzerinden (security definer);
-- doğrudan insert politikası bilerek TANIMLANMAZ.

-- ===========================================================================
-- BÖLÜM 2 — TAKIM SAVAŞLARI
-- ===========================================================================

create table if not exists public.team_battles (
  id           uuid primary key default uuid_generate_v4(),
  team_a       uuid not null references public.teams(id) on delete cascade,
  team_b       uuid not null references public.teams(id) on delete cascade,
  metric       text not null default 'xp',        -- xp | workouts | minutes | volume_kg | steps
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz not null,
  status       text not null default 'pending',   -- pending | active | finished | declined
  winner_id    uuid references public.teams(id) on delete set null,
  score_a      int not null default 0,
  score_b      int not null default 0,
  created_by   uuid references auth.users(id) on delete set null,
  finished_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_team_battles_a on public.team_battles (team_a, status, ends_at desc);
create index if not exists idx_team_battles_b on public.team_battles (team_b, status, ends_at desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'team_battles_distinct_chk') then
    alter table public.team_battles
      add constraint team_battles_distinct_chk check (team_a <> team_b);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'team_battles_window_chk') then
    alter table public.team_battles
      add constraint team_battles_window_chk check (ends_at > starts_at);
  end if;
end $$;

/**
 * Bir takımın savaş penceresi içindeki skoru.
 *
 * `xp` metriği `xp_logs`'tan, diğerleri `workouts`/`daily_metrics`'ten gelir —
 * yani `team_stats()` ile aynı kaynaklar, ama tarih aralığı savaşa göre.
 */
create or replace function public.battle_team_score(
  p_team uuid, p_metric text, p_from timestamptz, p_to timestamptz
) returns int language sql stable security definer set search_path = public as $$
  with members as (
    select tm.user_id from public.team_members tm where tm.team_id = p_team
  )
  select coalesce(case p_metric
    when 'xp' then (
      select sum(l.xp)::int from public.xp_logs l
       where l.user_id in (select user_id from members)
         and l.created_at >= p_from and l.created_at < p_to)
    when 'workouts' then (
      select count(*)::int from public.workouts w
       where w.user_id in (select user_id from members)
         and w.status = 'completed'
         and w.workout_date >= p_from::date and w.workout_date <= p_to::date)
    when 'minutes' then (
      select sum(coalesce(w.duration_min, 0))::int from public.workouts w
       where w.user_id in (select user_id from members)
         and w.status = 'completed'
         and w.workout_date >= p_from::date and w.workout_date <= p_to::date)
    when 'volume_kg' then (
      select sum(coalesce(ws.weight_kg, 0) * coalesce(ws.reps, 0))::int
        from public.workout_sets ws
        join public.workouts w on w.id = ws.workout_id
       where w.user_id in (select user_id from members)
         and w.status = 'completed'
         and w.workout_date >= p_from::date and w.workout_date <= p_to::date)
    when 'steps' then (
      select sum(coalesce(dm.steps, 0))::int from public.daily_metrics dm
       where dm.user_id in (select user_id from members)
         and dm.metric_date >= p_from::date and dm.metric_date <= p_to::date)
    else 0
  end, 0);
$$;

/**
 * Savaşın canlı durumunu döndürür ve süresi dolmuşsa kapatır.
 *
 * Kapanış burada yapılır çünkü ürünün tek cron hakkı (Vercel Hobby) etkinlik
 * hatırlatıcısında kullanılıyor; savaş sayfası her açıldığında durum kendini
 * düzeltir ("lazy finalize").
 */
create or replace function public.battle_state(p_battle uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b record; v_a int; v_b int; v_winner uuid;
begin
  select * into b from public.team_battles where id = p_battle;
  if not found then return jsonb_build_object('ok', false, 'error', 'Savaş bulunamadı.'); end if;

  v_a := public.battle_team_score(b.team_a, b.metric, b.starts_at, least(now(), b.ends_at));
  v_b := public.battle_team_score(b.team_b, b.metric, b.starts_at, least(now(), b.ends_at));

  if b.status = 'active' and now() >= b.ends_at then
    v_winner := case when v_a > v_b then b.team_a when v_b > v_a then b.team_b else null end;
    update public.team_battles
       set status = 'finished', score_a = v_a, score_b = v_b,
           winner_id = v_winner, finished_at = now()
     where id = p_battle and status = 'active';

    -- Kazanan takımın akışına düşür (beraberlikte de bilgi gönderisi)
    insert into public.team_posts (team_id, kind, body, meta, is_system, visibility)
    select t, 'quest',
           case when v_winner is null then 'Takım savaşı berabere bitti!'
                else 'Takım savaşı sonuçlandı!' end,
           jsonb_build_object('battle', p_battle, 'score_a', v_a, 'score_b', v_b,
                              'won', v_winner is not distinct from t),
           true, 'team'
      from unnest(array[b.team_a, b.team_b]) as t;

  elsif b.status = 'active' or b.status = 'pending' then
    update public.team_battles set score_a = v_a, score_b = v_b where id = p_battle;
  else
    v_a := b.score_a; v_b := b.score_b; v_winner := b.winner_id;
  end if;

  select * into b from public.team_battles where id = p_battle;
  return jsonb_build_object(
    'ok', true,
    'id', b.id, 'metric', b.metric, 'status', b.status,
    'starts_at', b.starts_at, 'ends_at', b.ends_at,
    'score_a', b.score_a, 'score_b', b.score_b,
    'winner_id', b.winner_id,
    'team_a', b.team_a, 'team_b', b.team_b
  );
end $$;

alter table public.team_battles enable row level security;

drop policy if exists team_battles_select on public.team_battles;
create policy team_battles_select on public.team_battles for select
  using (
    public.is_team_member(team_a, auth.uid())
    or public.is_team_member(team_b, auth.uid())
    or public.has_admin_access(auth.uid())
  );

drop policy if exists team_battles_write on public.team_battles;
create policy team_battles_write on public.team_battles for insert
  with check (public.team_can(team_a, auth.uid(), 'admin'));

drop policy if exists team_battles_update on public.team_battles;
create policy team_battles_update on public.team_battles for update
  using (
    public.team_can(team_a, auth.uid(), 'admin')
    or public.team_can(team_b, auth.uid(), 'admin')
    or public.has_admin_access(auth.uid())
  );

-- ===========================================================================
-- BÖLÜM 3 — ALIŞVERİŞ LİSTESİ TEK KAYNAK
-- ===========================================================================
--
-- Karar: `shopping_lists` TEK KAYNAK. `dietitian_plans.shopping` alanı plan
-- üretiminin ham çıktısı olarak kalır (geçmişi bozmamak için) ama UI artık
-- oradan OKUMAZ — plan kaydedilince buraya materyalize edilir.

alter table public.shopping_lists
  add column if not exists dietitian_plan_id uuid references public.dietitian_plans(id) on delete set null,
  add column if not exists source text not null default 'manual',   -- manual | meal_plan | dietitian
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_shopping_dietitian on public.shopping_lists (dietitian_plan_id);

comment on column public.shopping_lists.items is
  'Kalem dizisi: [{"name":"Yulaf","qty":"500 g","category":"Tahıl","checked":false}]. `checked` kullanıcı işaretlemesidir ve senkronda KORUNUR.';

/**
 * Diyetisyen planının alışveriş listesini `shopping_lists`'e materyalize eder.
 *
 * KAYNAK BİÇİMİ İKİ TÜRLÜ OLABİLİR (AI çıktısı sürümlere göre değişti):
 *   a) Kategorili:  [{"category":"Tahıl","items":["Yulaf 500 g","Bulgur 1 kg"]}]
 *   b) Düz liste:   [{"name":"Yulaf","qty":"500 g"}]  ya da  ["Yulaf","Süt"]
 * İkisi de tek biçime indirilir: [{"name":..., "category":..., "checked":...}]
 *
 * ÖNEMLİ: Kullanıcının `checked` işaretlemeleri korunur — isim eşleşmesiyle
 * eski listeden taşınır. Aksi halde plan her güncellendiğinde kullanıcı
 * markete girmişken tüm işaretleri kaybederdi.
 */
create or replace function public.sync_shopping_from_plan(p_plan uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid; v_raw jsonb; v_existing record; v_items jsonb; v_id uuid;
begin
  select user_id, shopping into v_user, v_raw from public.dietitian_plans where id = p_plan;
  if v_user is null then return null; end if;
  if v_raw is null or jsonb_typeof(v_raw) <> 'array' then v_raw := '[]'::jsonb; end if;

  select * into v_existing
    from public.shopping_lists
   where dietitian_plan_id = p_plan
   order by created_at desc limit 1;

  with flat as (
    -- (a) Kategorili girdiler: her `items` elemanı ayrı kaleme açılır
    select
      coalesce(i #>> '{}', '')                         as name,
      coalesce(e->>'category', 'Diğer')                as category
    from jsonb_array_elements(v_raw) e
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(e->'items') = 'array' then e->'items' else '[]'::jsonb end
    ) i
    union all
    -- (b) Düz girdiler: string ya da {name,...} nesnesi
    select
      case when jsonb_typeof(e) = 'string' then e #>> '{}' else coalesce(e->>'name', '') end,
      coalesce(e->>'category', 'Diğer')
    from jsonb_array_elements(v_raw) e
    where jsonb_typeof(e->'items') is distinct from 'array'
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'name', f.name,
             'category', f.category,
             'checked', coalesce((
               select (o->>'checked')::boolean
                 from jsonb_array_elements(coalesce(v_existing.items, '[]'::jsonb)) o
                where lower(coalesce(o->>'name', '')) = lower(f.name)
                limit 1
             ), false)
           )
         ), '[]'::jsonb)
    into v_items
    from flat f
   where f.name <> '';

  if v_existing.id is not null then
    update public.shopping_lists
       set items = v_items, updated_at = now()
     where id = v_existing.id
    returning id into v_id;
  else
    insert into public.shopping_lists (user_id, dietitian_plan_id, title, items, source)
    values (v_user, p_plan, 'Alışveriş Listesi', v_items, 'dietitian')
    returning id into v_id;
  end if;

  return v_id;
end $$;

/** Plan kaydedildiğinde/güncellendiğinde listeyi otomatik senkronlar. */
create or replace function public.tg_dietitian_plan_shopping() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Hata senkronu plan kaydını geri almasın
  begin
    perform public.sync_shopping_from_plan(new.id);
  exception when others then
    null;
  end;
  return new;
end $$;

drop trigger if exists trg_dietitian_plan_shopping on public.dietitian_plans;
create trigger trg_dietitian_plan_shopping
  after insert or update of shopping on public.dietitian_plans
  for each row execute function public.tg_dietitian_plan_shopping();

/** Tek bir kalemin işaretini değiştirir (indeks bazlı, atomik). */
create or replace function public.toggle_shopping_item(p_list uuid, p_index int, p_checked boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ok boolean := false;
begin
  update public.shopping_lists
     set items = jsonb_set(items, array[p_index::text, 'checked'], to_jsonb(coalesce(p_checked, false))),
         updated_at = now()
   where id = p_list
     and user_id = auth.uid()
     and jsonb_typeof(items) = 'array'
     and p_index >= 0
     and p_index < jsonb_array_length(items)
  returning true into v_ok;
  return coalesce(v_ok, false);
end $$;

-- Mevcut diyetisyen planlarını bir kez materyalize et (idempotent — trigger
-- ile aynı fonksiyon, `checked` durumu korunur).
do $$
declare r record;
begin
  for r in select id from public.dietitian_plans loop
    begin
      perform public.sync_shopping_from_plan(r.id);
    exception when others then
      null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
grant execute on function public.is_premium_user(uuid)                        to authenticated, service_role;
grant execute on function public.active_season()                              to authenticated, service_role;
grant execute on function public.season_xp_for(uuid)                          to authenticated, service_role;
grant execute on function public.season_state(uuid)                           to authenticated, service_role;
grant execute on function public.claim_season_tier(uuid, text)                to authenticated, service_role;
grant execute on function public.battle_team_score(uuid, text, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.battle_state(uuid)                           to authenticated, service_role;
grant execute on function public.sync_shopping_from_plan(uuid)                to authenticated, service_role;
grant execute on function public.toggle_shopping_item(uuid, int, boolean)     to authenticated, service_role;
