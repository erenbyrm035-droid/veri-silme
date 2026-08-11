-- ============================================================================
-- Migration 0041 — Günlük metrikler + özet/skor motoru
--
-- SORUN: Su (`water_logs`), beslenme (`nutrition_logs`) ve antrenman
-- (`workouts`) için zaman serisi var; ADIM ve UYKU için yok.
-- `profiles.daily_step_count` ve `profiles.sleep_hours` tek bir statik değer.
-- Bu yüzden:
--   • Dashboard'da adım `0`, uyku `—` olarak SABİT KODLANMIŞ durumda
--   • "Bugünkü Plan" checklist'i ve Recovery/Readiness skoru hesaplanamıyor
--   • `team_stats()` adım toplamı `sum(profiles.daily_step_count)` ile yanlış
--   • Haftalık `steps` görevi her zaman 0 dönüyor
--
-- ÇÖZÜM: `daily_metrics` zaman serisi + tek çağrılık özet ve skor RPC'leri.
--
-- Additive + idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Günlük metrik zaman serisi
-- ---------------------------------------------------------------------------
create table if not exists public.daily_metrics (
  user_id       uuid not null references auth.users(id) on delete cascade,
  metric_date   date not null default current_date,
  steps         int,
  sleep_minutes int,
  resting_hr    int,
  hrv           int,
  mood          smallint check (mood between 1 and 5),
  soreness      smallint check (soreness between 1 and 5),
  note          text,
  source        text not null default 'manual',   -- manual | healthkit | googlefit | wearable
  updated_at    timestamptz not null default now(),
  primary key (user_id, metric_date)
);
create index if not exists idx_daily_metrics_date on public.daily_metrics (metric_date desc);

alter table public.daily_metrics enable row level security;
drop policy if exists daily_metrics_owner on public.daily_metrics;
create policy daily_metrics_owner on public.daily_metrics for all
  using (user_id = auth.uid() or public.has_admin_access(auth.uid()))
  with check (user_id = auth.uid());

-- Uyku hedefi (dakika). `sleep_hours` onboarding'de bildirilen tipik değer;
-- hedef ayrı tutulur ki kullanıcı ikisini karıştırmasın.
alter table public.profiles
  add column if not exists daily_sleep_goal_min int default 450;  -- 7,5 saat

-- ---------------------------------------------------------------------------
-- 2) Tek alan güncelleme — çağıran yalnızca değiştirmek istediğini gönderir
-- ---------------------------------------------------------------------------
create or replace function public.upsert_daily_metric(
  p_date          date    default current_date,
  p_steps         int     default null,
  p_sleep_minutes int     default null,
  p_resting_hr    int     default null,
  p_hrv           int     default null,
  p_mood          smallint default null,
  p_soreness      smallint default null,
  p_note          text    default null,
  p_source        text    default 'manual'
) returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return; end if;

  insert into public.daily_metrics as d
    (user_id, metric_date, steps, sleep_minutes, resting_hr, hrv, mood, soreness, note, source, updated_at)
  values
    (v_user, coalesce(p_date, current_date), p_steps, p_sleep_minutes, p_resting_hr,
     p_hrv, p_mood, p_soreness, p_note, coalesce(p_source, 'manual'), now())
  on conflict (user_id, metric_date) do update set
    steps         = coalesce(excluded.steps,         d.steps),
    sleep_minutes = coalesce(excluded.sleep_minutes, d.sleep_minutes),
    resting_hr    = coalesce(excluded.resting_hr,    d.resting_hr),
    hrv           = coalesce(excluded.hrv,           d.hrv),
    mood          = coalesce(excluded.mood,          d.mood),
    soreness      = coalesce(excluded.soreness,      d.soreness),
    note          = coalesce(excluded.note,          d.note),
    source        = excluded.source,
    updated_at    = now();
end $$;

-- ---------------------------------------------------------------------------
-- 3) Günün özeti — Dashboard "Bugünkü Plan" kartının tek veri kaynağı
--    Beş hedef: su · protein · antrenman · adım · uyku
-- ---------------------------------------------------------------------------
create or replace function public.daily_summary(
  p_user uuid, p_date date default current_date
)
returns table (
  water_ml int, water_goal int,
  protein_g int, protein_goal int,
  calories int, calorie_goal int,
  steps int, step_goal int,
  sleep_minutes int, sleep_goal int,
  workout_done boolean, workout_planned boolean, workout_title text,
  done_count int, total_count int, completion_pct int
)
-- Not: OUT parametreleri (steps, calories, …) tablo kolonlarıyla aynı adı taşıdığı
-- için sorgu içinde bu isimler KULLANILMAZ; tüm ara değerler v_ önekli değişkenlerde
-- tutulur ve tek bir `return query select` ile döndürülür. Böylece
-- "column reference is ambiguous" hatası yapısal olarak imkânsız hale gelir.
language plpgsql stable security definer set search_path = public as $$
declare
  v_water_goal   int := 2500;
  v_protein_goal int := 120;
  v_calorie_goal int := 2000;
  v_step_goal    int := 8000;
  v_sleep_goal   int := 450;
  v_water   int := 0;
  v_protein int := 0;
  v_cal     int := 0;
  v_steps   int := 0;
  v_sleep   int := 0;
  v_status  text;
  v_title   text;
  v_planned boolean := false;
  v_done    int := 0;
  v_total   int := 5;
begin
  select coalesce(p.daily_water_goal_ml, 2500),
         coalesce(p.daily_protein_goal, 120),
         coalesce(p.daily_calorie_goal, 2000),
         coalesce(p.daily_step_goal, 8000),
         coalesce(p.daily_sleep_goal_min, 450)
    into v_water_goal, v_protein_goal, v_calorie_goal, v_step_goal, v_sleep_goal
    from public.profiles p where p.id = p_user;

  select coalesce(sum(l.amount_ml), 0)::int into v_water
    from public.water_logs l where l.user_id = p_user and l.log_date = p_date;

  select coalesce(sum(l.protein_g), 0)::int, coalesce(sum(l.calories), 0)::int
    into v_protein, v_cal
    from public.nutrition_logs l where l.user_id = p_user and l.log_date = p_date;

  select coalesce(m.steps, 0), coalesce(m.sleep_minutes, 0)
    into v_steps, v_sleep
    from public.daily_metrics m
   where m.user_id = p_user and m.metric_date = p_date;
  v_steps := coalesce(v_steps, 0);
  v_sleep := coalesce(v_sleep, 0);

  select o.status, o.title into v_status, v_title
    from public.workouts o
   where o.user_id = p_user and o.workout_date = p_date
   order by (o.status = 'completed') desc, o.created_at desc
   limit 1;
  v_planned := v_status is not null;

  v_done :=
      (case when v_water   >= v_water_goal   then 1 else 0 end)
    + (case when v_protein >= v_protein_goal then 1 else 0 end)
    + (case when v_status = 'completed'      then 1 else 0 end)
    + (case when v_steps   >= v_step_goal    then 1 else 0 end)
    + (case when v_sleep   >= v_sleep_goal   then 1 else 0 end);

  return query select
    v_water, v_water_goal,
    v_protein, v_protein_goal,
    v_cal, v_calorie_goal,
    v_steps, v_step_goal,
    v_sleep, v_sleep_goal,
    coalesce(v_status = 'completed', false), v_planned, v_title,
    v_done, v_total, (v_done * 100 / v_total)::int;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Toparlanma skoru (0-100)
--    Uyku + dinlenme günü + son 7 gün yükü + kas ağrısı.
--    Yüksek = dinlenmiş, düşük = yorgun/aşırı yüklenmiş.
-- ---------------------------------------------------------------------------
create or replace function public.recovery_score(p_user uuid)
returns table (score int, label text, sleep_avg_min int, load_7d numeric, rest_days int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_sleep_goal int;
  v_sleep numeric; v_load numeric; v_prev_load numeric;
  v_rest int; v_sore numeric; v_score int;
begin
  select coalesce(daily_sleep_goal_min, 450) into v_sleep_goal
    from public.profiles where id = p_user;
  v_sleep_goal := coalesce(v_sleep_goal, 450);

  -- Son 7 günün ortalama uykusu (kayıt olan günler)
  select avg(m.sleep_minutes) into v_sleep
    from public.daily_metrics m
   where m.user_id = p_user and m.sleep_minutes is not null
     and m.metric_date >= current_date - 6;

  -- Son 7 gün ve önceki 7 gün antrenman yükü (dakika)
  select coalesce(sum(o.duration_min), 0) into v_load
    from public.workouts o
   where o.user_id = p_user and o.status = 'completed'
     and o.workout_date >= current_date - 6;
  select coalesce(sum(o.duration_min), 0) into v_prev_load
    from public.workouts o
   where o.user_id = p_user and o.status = 'completed'
     and o.workout_date between current_date - 13 and current_date - 7;

  -- Son 7 günde antrenman yapılmayan gün sayısı
  select 7 - count(distinct o.workout_date)::int into v_rest
    from public.workouts o
   where o.user_id = p_user and o.status = 'completed'
     and o.workout_date >= current_date - 6;
  v_rest := greatest(0, coalesce(v_rest, 7));

  select avg(m.soreness) into v_sore
    from public.daily_metrics m
   where m.user_id = p_user and m.soreness is not null
     and m.metric_date >= current_date - 2;

  -- Taban 60. Uyku hedefe göre ±25, dinlenme günü ±15, yük artışı −15, ağrı −10.
  v_score := 60
    + case when v_sleep is null then 0
           else greatest(-25, least(25, round(((v_sleep - v_sleep_goal) / 60.0) * 12)::int)) end
    + case when v_rest = 0 then -15 when v_rest = 1 then -5 when v_rest >= 4 then 12 else 6 end
    + case when v_prev_load > 0 and v_load > v_prev_load * 1.5 then -15
           when v_prev_load > 0 and v_load > v_prev_load * 1.2 then -7
           else 0 end
    + case when v_sore is null then 0 else round((3 - v_sore) * 5)::int end;

  v_score := greatest(0, least(100, v_score));

  return query select
    v_score,
    case when v_score >= 80 then 'Dinlenmiş'
         when v_score >= 60 then 'İyi'
         when v_score >= 40 then 'Orta'
         else 'Yorgun' end,
    round(coalesce(v_sleep, 0))::int,
    coalesce(v_load, 0),
    v_rest;
end $$;

-- ---------------------------------------------------------------------------
-- 5) Hazır olma skoru (0-100) — bugün antrenmana ne kadar hazırsın
--    Toparlanma + dünkü uyku + bugünkü ruh hali + seri.
-- ---------------------------------------------------------------------------
create or replace function public.readiness_score(p_user uuid)
returns table (score int, label text, hint text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_rec int; v_sleep_goal int; v_last_sleep int; v_mood int; v_streak int; v_score int;
begin
  select r.score into v_rec from public.recovery_score(p_user) r;
  select coalesce(daily_sleep_goal_min, 450) into v_sleep_goal from public.profiles where id = p_user;
  v_sleep_goal := coalesce(v_sleep_goal, 450);

  select m.sleep_minutes, m.mood into v_last_sleep, v_mood
    from public.daily_metrics m
   where m.user_id = p_user and m.metric_date = current_date;

  select current_streak into v_streak from public.user_gamification where user_id = p_user;

  v_score := coalesce(v_rec, 60)
    + case when v_last_sleep is null then 0
           when v_last_sleep >= v_sleep_goal then 8
           when v_last_sleep >= v_sleep_goal - 60 then 2
           else -10 end
    + case when v_mood is null then 0 else (v_mood - 3) * 4 end
    + case when coalesce(v_streak, 0) >= 7 then 5
           when coalesce(v_streak, 0) >= 3 then 2 else 0 end;

  v_score := greatest(0, least(100, v_score));

  return query select
    v_score,
    case when v_score >= 80 then 'Zirvede'
         when v_score >= 60 then 'Hazır'
         when v_score >= 40 then 'İdareli'
         else 'Dinlen' end,
    case when v_score >= 80 then 'Ağır bir seans için harika bir gün.'
         when v_score >= 60 then 'Planladığın antrenmanı rahatlıkla yapabilirsin.'
         when v_score >= 40 then 'Hacmi biraz düşür, tekniğe odaklan.'
         else 'Bugün hafif kardiyo veya mobilite daha iyi olur.' end;
end $$;

-- ---------------------------------------------------------------------------
-- 6) team_stats() adım toplamını gerçek veriye bağla
--    Eskiden `sum(profiles.daily_step_count)` idi — tek statik değerin toplamı.
--    Artık son 30 günün günlük ortalaması kullanılır.
-- ---------------------------------------------------------------------------
create or replace function public.team_stats(p_team uuid)
returns table (
  member_count int, total_xp bigint, weekly_xp bigint,
  workouts bigint, minutes bigint, calories bigint, steps bigint,
  active_days_avg numeric, level int
)
language plpgsql stable security definer set search_path = public as $$
declare v_ids uuid[]; v_week date := current_date - 6;
begin
  select array_agg(user_id) into v_ids from public.team_members where team_id = p_team;
  if v_ids is null then
    return query select 0, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::numeric, 1;
    return;
  end if;

  return query
  with
  tot as (select coalesce(sum(g.total_xp),0)::bigint x from public.user_gamification g where g.user_id = any(v_ids)),
  wk  as (select coalesce(sum(s.score),0)::bigint x from public.leaderboard_scores(v_week, current_date) s where s.user_id = any(v_ids)),
  w   as (
    select count(*)::bigint n, coalesce(sum(o.duration_min),0)::bigint mins
    from public.workouts o where o.user_id = any(v_ids) and o.status='completed'
  ),
  cal as (select coalesce(sum(l.calories),0)::bigint c from public.nutrition_logs l where l.user_id = any(v_ids)),
  stp as (
    select coalesce(sum(m.steps),0)::bigint s
    from public.daily_metrics m
    where m.user_id = any(v_ids) and m.metric_date >= current_date - 29
  ),
  act as (
    select coalesce(avg(cnt),0)::numeric a from (
      select o.user_id, count(distinct o.workout_date) cnt
      from public.workouts o
      where o.user_id = any(v_ids) and o.status='completed' and o.workout_date >= current_date - 29
      group by o.user_id
    ) q
  )
  select array_length(v_ids,1),
         (select x from tot), (select x from wk),
         (select n from w), (select mins from w),
         (select c from cal), (select s from stp),
         round((select a from act) / 30.0, 2),
         greatest(1, floor(sqrt((select x from tot)::numeric / 500))::int + 1);
end $$;

-- ---------------------------------------------------------------------------
-- 7) Haftalık "steps" görevi artık gerçek adımı okusun
-- ---------------------------------------------------------------------------
create or replace function public.weekly_steps(p_user uuid, p_from date default null)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(m.steps), 0)::bigint
    from public.daily_metrics m
   where m.user_id = p_user
     and m.metric_date >= coalesce(p_from, date_trunc('week', current_date)::date);
$$;

-- ---------------------------------------------------------------------------
-- 8) Yetkiler
-- ---------------------------------------------------------------------------
grant execute on function public.upsert_daily_metric(date, int, int, int, int, smallint, smallint, text, text)
  to authenticated, service_role;
grant execute on function public.daily_summary(uuid, date)   to authenticated, service_role;
grant execute on function public.recovery_score(uuid)        to authenticated, service_role;
grant execute on function public.readiness_score(uuid)       to authenticated, service_role;
grant execute on function public.weekly_steps(uuid, date)    to authenticated, service_role;
