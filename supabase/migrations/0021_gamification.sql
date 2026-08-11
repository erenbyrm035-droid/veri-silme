-- ============================================================================
-- Migration 0021 — Gamification System (Sprint 9)
-- XP, Level, Fitness Score, Streak, Achievement, Badge, Leaderboard, Weekly
-- Challenge, Season, Team, Reward. Mevcut sistemle tam entegre; additive +
-- idempotent; mevcut mimariyi/tabloları bozmaz.
-- ============================================================================

-- 0) profiles: liderlik filtreleri için lokasyon/salon alanları --------------
alter table public.profiles
  add column if not exists country text,
  add column if not exists city    text,
  add column if not exists gym      text;

create index if not exists idx_profiles_country on public.profiles (lower(country));
create index if not exists idx_profiles_city    on public.profiles (lower(city));
create index if not exists idx_profiles_gym      on public.profiles (lower(gym));

-- 1) xp_rules — admin panelinden düzenlenebilir XP kuralları -----------------
create table if not exists public.xp_rules (
  event_key   text primary key,
  label       text not null,
  xp          int  not null default 10,
  category    text not null default 'activity',   -- activity | streak | milestone | social
  cooldown    text not null default 'none',        -- none | daily | once
  enabled     boolean not null default true,
  sort_order  int not null default 0,
  updated_at  timestamptz not null default now()
);

-- 2) xp_logs — kazanılan XP denetim kaydı -----------------------------------
create table if not exists public.xp_logs (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  event_key  text not null,
  xp         int  not null default 0,
  ref_type   text,
  ref_id     uuid,
  meta       jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_xp_logs_user on public.xp_logs (user_id, created_at desc);
create index if not exists idx_xp_logs_event on public.xp_logs (user_id, event_key);

-- 3) levels — dinamik seviye sistemi ----------------------------------------
create table if not exists public.levels (
  level      int primary key,
  title      text not null,
  min_xp     int  not null,
  color      text not null default '#A3E635',
  icon       text,
  perks      jsonb not null default '[]',
  sort_order int not null default 0
);

-- 4) user_gamification — hızlı okuma için özet (türetilmiş) ------------------
create table if not exists public.user_gamification (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  total_xp       int  not null default 0,
  level          int  not null default 1,
  fitness_score  int  not null default 0,
  coins          int  not null default 0,
  current_streak int  not null default 0,
  longest_streak int  not null default 0,
  last_active_on date,
  season_xp      int  not null default 0,
  updated_at     timestamptz not null default now()
);

-- 5) badges — rozetler -------------------------------------------------------
create table if not exists public.badges (
  id          uuid primary key default uuid_generate_v4(),
  key         text unique not null,
  name        text not null,
  tier        text not null default 'bronze',   -- bronze | silver | gold | platinum | diamond | legend
  description text,
  icon        text,
  color       text,
  sort_order  int not null default 0,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 6) achievements — başarımlar ----------------------------------------------
create table if not exists public.achievements (
  id          uuid primary key default uuid_generate_v4(),
  key         text unique not null,
  name        text not null,
  description text,
  category    text not null default 'workout',   -- workout | nutrition | posture | ai | streak | volume
  metric      text not null,                       -- workouts_count | total_volume | ...
  target      numeric not null default 1,
  icon        text,
  badge_id    uuid references public.badges(id) on delete set null,
  xp_reward   int  not null default 50,
  enabled     boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- 7) achievement_progress — kullanıcı başarım ilerlemesi ---------------------
create table if not exists public.achievement_progress (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  progress       numeric not null default 0,
  target         numeric not null default 1,
  completed      boolean not null default false,
  completed_at   timestamptz,
  updated_at     timestamptz not null default now(),
  unique (user_id, achievement_id)
);
create index if not exists idx_ach_prog_user on public.achievement_progress (user_id);

-- 8) streaks — günlük seri ---------------------------------------------------
create table if not exists public.streaks (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null default 'daily',   -- daily
  current    int not null default 0,
  longest    int not null default 0,
  last_date  date,
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);

-- 9) leaderboards — sıralama tanımları --------------------------------------
create table if not exists public.leaderboards (
  id         uuid primary key default uuid_generate_v4(),
  key        text unique not null,
  name       text not null,
  period     text not null default 'weekly',  -- weekly | monthly | yearly | all_time
  scope      text not null default 'global',  -- global | country | city | gym | team | friends
  metric     text not null default 'xp',       -- xp | volume | workouts
  enabled    boolean not null default true,
  sort_order int not null default 0
);

-- 10) leaderboard_entries — hesaplanmış sıralama satırları -------------------
create table if not exists public.leaderboard_entries (
  id             uuid primary key default uuid_generate_v4(),
  leaderboard_id uuid not null references public.leaderboards(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  period_key     text not null default 'all',      -- 2026-W28 | 2026-07 | 2026 | all
  scope_value    text not null default 'global',   -- country/city/gym/team değeri
  score          int  not null default 0,
  rank           int  not null default 0,
  updated_at     timestamptz not null default now(),
  unique (leaderboard_id, user_id, period_key, scope_value)
);
create index if not exists idx_lb_entries_lookup on public.leaderboard_entries (leaderboard_id, period_key, scope_value, rank);

-- 11) weekly_challenges — haftalık görevler ---------------------------------
create table if not exists public.weekly_challenges (
  id          uuid primary key default uuid_generate_v4(),
  week_start  date not null default date_trunc('week', now())::date,
  key         text not null,
  title       text not null,
  description text,
  metric      text not null,                    -- workouts | water_ml | steps | protein_g | mobility
  target      numeric not null default 1,
  xp_reward   int  not null default 100,
  icon        text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (week_start, key)
);

-- 12) challenge_progress ----------------------------------------------------
create table if not exists public.challenge_progress (
  id           uuid primary key default uuid_generate_v4(),
  challenge_id uuid not null references public.weekly_challenges(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  progress     numeric not null default 0,
  target       numeric not null default 1,
  completed    boolean not null default false,
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  unique (challenge_id, user_id)
);
create index if not exists idx_chal_prog_user on public.challenge_progress (user_id);

-- 13) teams -----------------------------------------------------------------
create table if not exists public.teams (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text unique not null,
  description text,
  badge       text,
  color       text default '#A3E635',
  owner_id    uuid references auth.users(id) on delete set null,
  points      int not null default 0,
  created_at  timestamptz not null default now()
);

-- 14) team_members ----------------------------------------------------------
create table if not exists public.team_members (
  id        uuid primary key default uuid_generate_v4(),
  team_id   uuid not null references public.teams(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'member',   -- owner | admin | member
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)
);
create index if not exists idx_team_members_user on public.team_members (user_id);

-- 15) team_scores -----------------------------------------------------------
create table if not exists public.team_scores (
  id         uuid primary key default uuid_generate_v4(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  period_key text not null default 'all',
  points     int not null default 0,
  updated_at timestamptz not null default now(),
  unique (team_id, period_key)
);

-- 16) seasons ---------------------------------------------------------------
create table if not exists public.seasons (
  id         uuid primary key default uuid_generate_v4(),
  number     int not null,
  name       text not null,
  theme      text,
  starts_on  date not null,
  ends_on    date not null,
  active     boolean not null default false,
  created_at timestamptz not null default now()
);

-- 17) season_rewards --------------------------------------------------------
create table if not exists public.season_rewards (
  id           uuid primary key default uuid_generate_v4(),
  season_id    uuid not null references public.seasons(id) on delete cascade,
  rank_min     int not null default 1,
  rank_max     int not null default 1,
  title        text not null,
  reward_type  text not null default 'badge',   -- badge | premium_days | coins | frame
  reward_value jsonb not null default '{}',
  sort_order   int not null default 0
);

-- 18) fitness_scores — günlük fitness skoru geçmişi -------------------------
create table if not exists public.fitness_scores (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  score_date date not null default current_date,
  score      int  not null default 0,
  breakdown  jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, score_date)
);
create index if not exists idx_fitness_scores_user on public.fitness_scores (user_id, score_date desc);

-- 19) reward_catalog — dijital ödül kataloğu --------------------------------
create table if not exists public.reward_catalog (
  id          uuid primary key default uuid_generate_v4(),
  key         text unique not null,
  name        text not null,
  description text,
  type        text not null,   -- premium_days | profile_frame | theme | ai_avatar | badge | exercise_pack | program | diet_pack
  value       jsonb not null default '{}',
  cost_coins  int  not null default 100,
  icon        text,
  enabled     boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- 20) reward_claims ---------------------------------------------------------
create table if not exists public.reward_claims (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  reward_id  uuid not null references public.reward_catalog(id) on delete cascade,
  status     text not null default 'active',   -- active | expired
  meta       jsonb not null default '{}',
  claimed_at timestamptz not null default now()
);
create index if not exists idx_reward_claims_user on public.reward_claims (user_id, claimed_at desc);

-- ============================================================================
-- FONKSİYONLAR
-- ============================================================================

-- XP → seviye çözümü.
create or replace function public.gam_level_for_xp(p_xp int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(max(level), 1) from public.levels where min_xp <= p_xp;
$$;

-- Tek bir olay için XP ekler (cooldown farkında). Real-time olaylar için.
create or replace function public.award_xp(
  p_user uuid, p_event text, p_ref_type text default null,
  p_ref_id uuid default null, p_meta jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.xp_rules;
  prev_level int; new_total int; new_level int;
begin
  select * into r from public.xp_rules where event_key = p_event and enabled;
  if not found then return jsonb_build_object('awarded', false, 'reason', 'no_rule'); end if;

  if r.cooldown = 'daily' and exists (
    select 1 from public.xp_logs
    where user_id = p_user and event_key = p_event and created_at::date = current_date
  ) then return jsonb_build_object('awarded', false, 'reason', 'cooldown'); end if;

  if r.cooldown = 'once' and exists (
    select 1 from public.xp_logs where user_id = p_user and event_key = p_event
  ) then return jsonb_build_object('awarded', false, 'reason', 'once'); end if;

  insert into public.xp_logs (user_id, event_key, xp, ref_type, ref_id, meta)
  values (p_user, p_event, r.xp, p_ref_type, p_ref_id, coalesce(p_meta, '{}'));

  select coalesce(sum(xp), 0) into new_total from public.xp_logs where user_id = p_user;

  select level into prev_level from public.user_gamification where user_id = p_user;
  new_level := public.gam_level_for_xp(new_total);

  insert into public.user_gamification (user_id, total_xp, level, updated_at)
  values (p_user, new_total, new_level, now())
  on conflict (user_id) do update set total_xp = excluded.total_xp, level = excluded.level, updated_at = now();

  return jsonb_build_object(
    'awarded', true, 'xp', r.xp, 'total_xp', new_total, 'level', new_level,
    'leveled_up', coalesce(prev_level, 1) < new_level, 'prev_level', coalesce(prev_level, 1)
  );
end;
$$;

-- Kullanıcının tüm oyunlaştırma durumunu mevcut aktivite verilerinden yeniden
-- hesaplar (idempotent + geriye dönük). Ağır işlem; sayfa yüklemede çağrılır.
create or replace function public.sync_gamification(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_workouts int; v_volume numeric; v_pr int; v_posture int; v_ai int;
  v_water_days int; v_protein_days int; v_active_days int; v_exercises int;
  v_water_goal int; v_protein_goal int;
  v_streak int := 0; v_longest int := 0; v_last date; v_prev date; d date;
  v_base_xp int := 0; v_ach_xp int := 0; v_total_xp int := 0;
  v_level int; v_prev_level int; v_fitness int;
  r_workout int; r_volume int; r_water int; r_protein int; r_pr int;
  r_posture int; r_ai int; r_login int;
  ach record; v_prog numeric; v_done boolean;
begin
  -- Hedefler
  select coalesce(daily_water_goal_ml, 2500), coalesce(daily_protein_goal, 120)
    into v_water_goal, v_protein_goal from public.profiles where id = p_user;
  v_water_goal := coalesce(v_water_goal, 2500);
  v_protein_goal := coalesce(v_protein_goal, 120);

  -- Aktivite sayaçları
  select count(*) into v_workouts from public.workouts where user_id = p_user and status = 'completed';
  select coalesce(sum(coalesce(ws.reps,0) * coalesce(ws.weight_kg,0)), 0) into v_volume
    from public.workout_sets ws join public.workouts w on w.id = ws.workout_id
    where w.user_id = p_user and ws.completed;
  select count(*) into v_exercises from public.workout_sets ws
    join public.workouts w on w.id = ws.workout_id where w.user_id = p_user and ws.completed;
  select count(*) into v_pr from public.personal_records where user_id = p_user;
  select count(*) into v_posture from public.posture_analyses where user_id = p_user;
  select count(*) into v_ai from public.ai_conversations where user_id = p_user;

  select count(*) into v_water_days from (
    select log_date from public.water_logs where user_id = p_user
    group by log_date having sum(amount_ml) >= v_water_goal
  ) t;
  select count(*) into v_protein_days from (
    select log_date from public.nutrition_logs where user_id = p_user
    group by log_date having sum(protein_g) >= v_protein_goal
  ) t;

  -- Aktif gün seti (streak için): antrenman + su + beslenme günleri
  create temp table if not exists _gam_days (d date primary key) on commit drop;
  delete from _gam_days;
  insert into _gam_days (d)
    select distinct dd from (
      select workout_date dd from public.workouts where user_id = p_user and status = 'completed'
      union select log_date from public.water_logs where user_id = p_user
      union select log_date from public.nutrition_logs where user_id = p_user
    ) s where dd is not null
  on conflict do nothing;

  select count(*) into v_active_days from _gam_days;

  -- Streak hesabı (en uzun ve güncel)
  v_prev := null;
  for d in select dd from _gam_days order by dd loop
    if v_prev is null or d = v_prev + 1 then
      v_streak := v_streak + 1;
    elsif d <> v_prev then
      v_streak := 1;
    end if;
    if v_streak > v_longest then v_longest := v_streak; end if;
    v_last := d; v_prev := d;
  end loop;
  -- Güncel streak yalnızca son gün bugün ya da dün ise geçerli
  if v_last is null or v_last < current_date - 1 then v_streak := 0;
  else
    -- son ardışık dizinin uzunluğunu yeniden say
    v_streak := 0; v_prev := null;
    for d in select dd from _gam_days order by dd loop
      if v_prev is null or d = v_prev + 1 then v_streak := v_streak + 1;
      elsif d <> v_prev then v_streak := 1; end if;
      v_prev := d;
    end loop;
  end if;

  -- XP kuralları (yoksa varsayılan)
  select coalesce((select xp from public.xp_rules where event_key='workout_completed' and enabled),20) into r_workout;
  select coalesce((select xp from public.xp_rules where event_key='volume_1000kg' and enabled),5) into r_volume;
  select coalesce((select xp from public.xp_rules where event_key='water_goal' and enabled),10) into r_water;
  select coalesce((select xp from public.xp_rules where event_key='protein_goal' and enabled),10) into r_protein;
  select coalesce((select xp from public.xp_rules where event_key='new_pr' and enabled),25) into r_pr;
  select coalesce((select xp from public.xp_rules where event_key='first_posture' and enabled),40) into r_posture;
  select coalesce((select xp from public.xp_rules where event_key='ai_coach_used' and enabled),5) into r_ai;
  select coalesce((select xp from public.xp_rules where event_key='daily_login' and enabled),5) into r_login;

  v_base_xp :=
      v_workouts * r_workout
    + floor(v_volume / 1000)::int * r_volume
    + v_water_days * r_water
    + v_protein_days * r_protein
    + v_pr * r_pr
    + (case when v_posture > 0 then r_posture else 0 end)
    + v_ai * r_ai
    + v_active_days * r_login;

  -- Başarım ilerlemesi (metric bazlı) + tamamlanan başarım XP'si
  for ach in select * from public.achievements where enabled loop
    v_prog := case ach.metric
      when 'workouts_count' then v_workouts
      when 'total_volume'   then v_volume
      when 'exercises_count' then v_exercises
      when 'posture_count'  then v_posture
      when 'ai_count'       then v_ai
      when 'pr_count'       then v_pr
      when 'water_days'     then v_water_days
      when 'protein_days'   then v_protein_days
      when 'streak_days'    then greatest(v_longest, v_streak)
      when 'active_days'    then v_active_days
      else 0 end;
    v_done := v_prog >= ach.target;
    insert into public.achievement_progress (user_id, achievement_id, progress, target, completed, completed_at, updated_at)
    values (p_user, ach.id, v_prog, ach.target, v_done, case when v_done then now() else null end, now())
    on conflict (user_id, achievement_id) do update set
      progress = excluded.progress, target = excluded.target,
      completed = excluded.completed,
      completed_at = coalesce(public.achievement_progress.completed_at, excluded.completed_at),
      updated_at = now();
    if v_done then v_ach_xp := v_ach_xp + ach.xp_reward; end if;
  end loop;

  v_total_xp := v_base_xp + v_ach_xp;
  v_level := public.gam_level_for_xp(v_total_xp);

  -- Fitness Score (0-100) — ağırlıklı bileşenler
  v_fitness := least(100, (
      least(30, v_workouts * 2)                                   -- antrenman düzeni
    + least(15, v_protein_days)                                    -- protein
    + least(15, v_water_days)                                      -- su
    + least(15, (v_active_days))                                   -- genel aktiflik
    + least(10, floor(v_volume/2000)::int)                         -- hacim
    + (case when v_posture > 0 then 10 else 0 end)                 -- postür
    + least(5, v_ai)                                               -- AI uyumu
  ));

  select level into v_prev_level from public.user_gamification where user_id = p_user;

  insert into public.user_gamification
    (user_id, total_xp, level, fitness_score, current_streak, longest_streak, last_active_on, season_xp, updated_at)
  values (p_user, v_total_xp, v_level, v_fitness, v_streak, v_longest, v_last, v_total_xp, now())
  on conflict (user_id) do update set
    total_xp = excluded.total_xp, level = excluded.level, fitness_score = excluded.fitness_score,
    current_streak = excluded.current_streak, longest_streak = excluded.longest_streak,
    last_active_on = excluded.last_active_on, season_xp = excluded.season_xp, updated_at = now();

  insert into public.streaks (user_id, kind, current, longest, last_date, updated_at)
  values (p_user, 'daily', v_streak, v_longest, v_last, now())
  on conflict (user_id, kind) do update set
    current = excluded.current, longest = greatest(public.streaks.longest, excluded.longest),
    last_date = excluded.last_date, updated_at = now();

  insert into public.fitness_scores (user_id, score_date, score, breakdown)
  values (p_user, current_date, v_fitness, jsonb_build_object(
    'workouts', v_workouts, 'volume', v_volume, 'water_days', v_water_days,
    'protein_days', v_protein_days, 'active_days', v_active_days, 'posture', v_posture, 'ai', v_ai))
  on conflict (user_id, score_date) do update set score = excluded.score, breakdown = excluded.breakdown;

  return jsonb_build_object(
    'total_xp', v_total_xp, 'level', v_level, 'prev_level', coalesce(v_prev_level, 1),
    'leveled_up', coalesce(v_prev_level, 1) < v_level,
    'fitness_score', v_fitness, 'current_streak', v_streak, 'longest_streak', v_longest
  );
end;
$$;

grant execute on function public.gam_level_for_xp(int) to authenticated, service_role;
grant execute on function public.award_xp(uuid, text, text, uuid, jsonb) to authenticated, service_role;
grant execute on function public.sync_gamification(uuid) to authenticated, service_role;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.xp_rules             enable row level security;
alter table public.xp_logs              enable row level security;
alter table public.levels               enable row level security;
alter table public.user_gamification    enable row level security;
alter table public.badges               enable row level security;
alter table public.achievements         enable row level security;
alter table public.achievement_progress enable row level security;
alter table public.streaks              enable row level security;
alter table public.leaderboards         enable row level security;
alter table public.leaderboard_entries  enable row level security;
alter table public.weekly_challenges    enable row level security;
alter table public.challenge_progress   enable row level security;
alter table public.teams                enable row level security;
alter table public.team_members         enable row level security;
alter table public.team_scores          enable row level security;
alter table public.seasons              enable row level security;
alter table public.season_rewards       enable row level security;
alter table public.fitness_scores       enable row level security;
alter table public.reward_catalog       enable row level security;
alter table public.reward_claims        enable row level security;

-- Yardımcı: herkese-okuma + admin-yazma politikası kur.
-- Config tabloları: tüm authenticated okur, admin yazar.
do $$
declare t text;
begin
  foreach t in array array['xp_rules','levels','badges','achievements','leaderboards',
    'weekly_challenges','seasons','season_rewards','reward_catalog','teams','team_scores',
    'leaderboard_entries','user_gamification','streaks'] loop
    execute format('drop policy if exists "%1$s_read_all" on public.%1$s', t);
    execute format('create policy "%1$s_read_all" on public.%1$s for select using (auth.role() = ''authenticated'')', t);
    execute format('drop policy if exists "%1$s_admin_write" on public.%1$s', t);
    execute format('create policy "%1$s_admin_write" on public.%1$s for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()))', t);
  end loop;
end $$;

-- Kullanıcıya özel tablolar: sahip okur, admin okur; yazma service_role/admin.
do $$
declare t text;
begin
  foreach t in array array['xp_logs','achievement_progress','challenge_progress',
    'fitness_scores','reward_claims'] loop
    execute format('drop policy if exists "%1$s_select_own" on public.%1$s', t);
    execute format('create policy "%1$s_select_own" on public.%1$s for select using (auth.uid() = user_id or public.has_admin_access(auth.uid()))', t);
    execute format('drop policy if exists "%1$s_admin_write" on public.%1$s', t);
    execute format('create policy "%1$s_admin_write" on public.%1$s for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()))', t);
  end loop;
end $$;

-- team_members: herkes okur (takım listesi), kullanıcı kendini ekler/çıkarır, admin yönetir.
drop policy if exists "team_members_read_all" on public.team_members;
create policy "team_members_read_all" on public.team_members for select using (auth.role() = 'authenticated');
drop policy if exists "team_members_join" on public.team_members;
create policy "team_members_join" on public.team_members for insert with check (auth.uid() = user_id);
drop policy if exists "team_members_leave" on public.team_members;
create policy "team_members_leave" on public.team_members for delete using (auth.uid() = user_id or public.has_admin_access(auth.uid()));

-- reward_claims: kullanıcı kendi talebini oluşturur.
drop policy if exists "reward_claims_insert_own" on public.reward_claims;
create policy "reward_claims_insert_own" on public.reward_claims for insert with check (auth.uid() = user_id);

-- teams: kullanıcı takım oluşturabilir (owner kendisi).
drop policy if exists "teams_create" on public.teams;
create policy "teams_create" on public.teams for insert with check (auth.uid() = owner_id);
drop policy if exists "teams_owner_update" on public.teams;
create policy "teams_owner_update" on public.teams for update using (auth.uid() = owner_id or public.has_admin_access(auth.uid()));

-- ============================================================================
-- SEED — varsayılan yapılandırma (idempotent)
-- ============================================================================

-- XP kuralları
insert into public.xp_rules (event_key, label, xp, category, cooldown, sort_order) values
  ('workout_completed', 'Antrenman Tamamlandı', 20, 'activity', 'none', 1),
  ('program_completed', 'Program Tamamlandı', 150, 'milestone', 'none', 2),
  ('water_goal', 'Su Hedefi', 10, 'activity', 'daily', 3),
  ('protein_goal', 'Protein Hedefi', 10, 'activity', 'daily', 4),
  ('calorie_goal', 'Kalori Hedefi', 10, 'activity', 'daily', 5),
  ('step_goal', 'Adım Hedefi', 10, 'activity', 'daily', 6),
  ('first_posture', 'İlk Postür Analizi', 40, 'milestone', 'once', 7),
  ('new_pr', 'Yeni Rekor (PR)', 25, 'activity', 'none', 8),
  ('ai_coach_used', 'AI Koç Kullanımı', 5, 'activity', 'daily', 9),
  ('daily_login', 'Günlük Giriş', 5, 'activity', 'daily', 10),
  ('streak_7', '7 Günlük Seri', 50, 'streak', 'none', 11),
  ('streak_30', '30 Günlük Seri', 200, 'streak', 'none', 12),
  ('streak_100', '100 Günlük Seri', 750, 'streak', 'none', 13),
  ('task_completed', 'Görev Tamamlama', 30, 'activity', 'none', 14),
  ('volume_1000kg', 'Her 1000kg Hacim', 5, 'activity', 'none', 15)
on conflict (event_key) do nothing;

-- Seviyeler
insert into public.levels (level, title, min_xp, color, icon, sort_order) values
  (1,  'Rookie',      0,     '#94A3B8', 'sprout',   1),
  (5,  'Explorer',    500,   '#38BDF8', 'compass',  2),
  (10, 'Athlete',     1500,  '#34D399', 'activity', 3),
  (20, 'Warrior',     4000,  '#A3E635', 'swords',   4),
  (35, 'Elite',       9000,  '#FBBF24', 'flame',    5),
  (50, 'Champion',    18000, '#FB7185', 'trophy',   6),
  (75, 'Legend',      40000, '#C084FC', 'crown',    7),
  (100,'Viva Master', 80000, '#F472B6', 'sparkles', 8)
on conflict (level) do nothing;

-- Rozetler
insert into public.badges (key, name, tier, description, icon, color, sort_order) values
  ('bronze',   'Bronz Rozet',   'bronze',   'İlk adımlar', 'medal', '#CD7F32', 1),
  ('silver',   'Gümüş Rozet',   'silver',   'İstikrar',    'medal', '#C0C0C0', 2),
  ('gold',     'Altın Rozet',   'gold',     'Ustalık',      'medal', '#FFD700', 3),
  ('platinum', 'Platin Rozet',  'platinum', 'Elit performans', 'medal', '#67E8F9', 4),
  ('diamond',  'Elmas Rozet',   'diamond',  'Olağanüstü',   'gem',   '#A5F3FC', 5),
  ('legend',   'Efsane Rozet',  'legend',   'Efsanevi',     'crown', '#C084FC', 6)
on conflict (key) do nothing;

-- Başarımlar
insert into public.achievements (key, name, description, category, metric, target, icon, xp_reward, badge_id, sort_order)
select v.key, v.name, v.description, v.category, v.metric, v.target, v.icon, v.xp_reward,
       (select id from public.badges where key = v.badge_key), v.sort_order
from (values
  ('first_workout',   'İlk Antrenman',    'İlk antrenmanını tamamla',        'workout',  'workouts_count', 1,     'dumbbell', 50,  'bronze',   1),
  ('workouts_10',     '10 Antrenman',     '10 antrenman tamamla',            'workout',  'workouts_count', 10,    'dumbbell', 100, 'silver',   2),
  ('workouts_100',    '100 Antrenman',    '100 antrenman tamamla',           'workout',  'workouts_count', 100,   'dumbbell', 500, 'gold',     3),
  ('volume_10000',    'İlk 10.000 Kg',    'Toplam 10.000 kg kaldır',         'volume',   'total_volume',  10000,  'weight',   150, 'silver',   4),
  ('first_posture',   'İlk Postür Analizi','İlk postür analizini yap',       'posture',  'posture_count',  1,     'scan',     60,  'bronze',   5),
  ('first_ai',        'İlk AI Programı',  'AI koçu ilk kez kullan',          'ai',       'ai_count',       1,     'bot',      50,  'bronze',   6),
  ('water_30',        '30 Gün Su',        '30 gün su hedefini tuttur',       'nutrition','water_days',     30,    'droplet',  200, 'gold',     7),
  ('protein_30',      '30 Gün Protein',   '30 gün protein hedefini tuttur',  'nutrition','protein_days',   30,    'egg',      200, 'gold',     8),
  ('streak_100',      '100 Gün Seri',     '100 günlük seri yakala',          'streak',   'streak_days',    100,   'flame',    750, 'diamond',  9),
  ('exercises_1000',  '1000 Egzersiz',    '1000 egzersiz seti tamamla',      'workout',  'exercises_count',1000,  'list',     500, 'platinum', 10)
) as v(key, name, description, category, metric, target, icon, xp_reward, badge_key, sort_order)
on conflict (key) do nothing;

-- Liderlik tabloları
insert into public.leaderboards (key, name, period, scope, metric, sort_order) values
  ('weekly_xp',   'Haftalık XP', 'weekly',   'global', 'xp', 1),
  ('monthly_xp',  'Aylık XP',    'monthly',  'global', 'xp', 2),
  ('yearly_xp',   'Yıllık XP',   'yearly',   'global', 'xp', 3),
  ('alltime_xp',  'Tüm Zamanlar','all_time', 'global', 'xp', 4)
on conflict (key) do nothing;

-- Haftalık görevler (bu haftanın)
insert into public.weekly_challenges (week_start, key, title, description, metric, target, xp_reward, icon)
values
  (date_trunc('week', now())::date, 'workouts_4',  '4 Antrenman',  'Bu hafta 4 antrenman tamamla', 'workouts', 4,      150, 'dumbbell'),
  (date_trunc('week', now())::date, 'water_12l',   '12 Litre Su',  'Bu hafta 12 litre su iç',      'water_ml', 12000,  120, 'droplet'),
  (date_trunc('week', now())::date, 'steps_70k',   '70.000 Adım',  'Bu hafta 70.000 adım at',      'steps',    70000,  120, 'footprints'),
  (date_trunc('week', now())::date, 'protein_800', '800g Protein', 'Bu hafta 800g protein al',     'protein_g',800,    120, 'egg'),
  (date_trunc('week', now())::date, 'mobility_3',  '3 Mobilite',   'Bu hafta 3 mobilite seansı yap','mobility', 3,      100, 'move')
on conflict (week_start, key) do nothing;

-- Aktif sezon
insert into public.seasons (number, name, theme, starts_on, ends_on, active)
select 1, 'Sezon 1 — Başlangıç', 'launch', date_trunc('month', now())::date,
       (date_trunc('month', now()) + interval '3 months' - interval '1 day')::date, true
where not exists (select 1 from public.seasons where number = 1);

-- Ödül kataloğu
insert into public.reward_catalog (key, name, description, type, value, cost_coins, icon, sort_order) values
  ('premium_7',    '7 Gün Premium',      '7 günlük premium erişim',        'premium_days',  '{"days":7}',        700,  'crown', 1),
  ('premium_30',   '30 Gün Premium',     '30 günlük premium erişim',       'premium_days',  '{"days":30}',       2500, 'crown', 2),
  ('frame_gold',   'Altın Profil Çerçevesi','Profiline altın çerçeve',     'profile_frame', '{"frame":"gold"}',  500,  'frame', 3),
  ('theme_neon',   'Neon Tema',          'Özel neon arayüz teması',        'theme',         '{"theme":"neon"}',  400,  'palette', 4),
  ('avatar_pro',   'Pro AI Avatarı',     'Özel AI koç avatarı',            'ai_avatar',     '{"avatar":"pro"}',  600,  'bot',   5),
  ('badge_special','Özel Rozet',         'Koleksiyon rozeti',              'badge',         '{"badge":"special"}',300, 'medal', 6),
  ('pack_home',    'Ev Egzersiz Paketi', 'Özel ev antrenman paketi',       'exercise_pack', '{"pack":"home"}',   350,  'dumbbell', 7),
  ('program_hyper','Hipertrofi Programı','Özel 8 haftalık program',        'program',       '{"program":"hyper"}',900, 'calendar', 8),
  ('diet_cut',     'Cutting Diyet Paketi','Özel yağ yakım diyeti',         'diet_pack',     '{"diet":"cut"}',    800,  'apple', 9)
on conflict (key) do nothing;
