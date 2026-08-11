-- ============================================================================
-- Migration 0018 — Postür Analizi (Sprint 19)
-- Mevcut posture_analyses (Sprint 8, jsonb findings/corrective) KORUNUR.
-- Normalize tablolar + gelişim takibi + çok görünümlü fotoğraf eklenir.
-- Video/canlı kamera analizi için genişletilebilir (source alanı esnek).
-- Additive + idempotent.
-- ============================================================================

-- 1) posture_analyses: yeni alanlar -------------------------------------------
alter table public.posture_analyses
  add column if not exists risk_level      text,          -- low | moderate | high
  add column if not exists region_scores   jsonb not null default '{}',   -- bölge → {status, score}
  add column if not exists muscle_analysis jsonb not null default '{}',   -- short/weak/overactive/inhibited
  add column if not exists keypoints       jsonb,          -- pose keypoints (MediaPipe/MoveNet)
  add column if not exists improvement_pct numeric(5,2),   -- önceki analize göre iyileşme
  add column if not exists program_days    int,            -- 1|3|5|7
  add column if not exists country         text,
  add column if not exists analysis_type   text not null default 'photo'; -- photo | video | live (gelecek)

create index if not exists idx_posture_user    on public.posture_analyses(user_id, created_at desc);
create index if not exists idx_posture_risk     on public.posture_analyses(risk_level);
create index if not exists idx_posture_created   on public.posture_analyses(created_at desc);

-- 2) posture_images: çok görünüm (ön/arka/sağ/sol) ----------------------------
create table if not exists public.posture_images (
  id           uuid primary key default uuid_generate_v4(),
  analysis_id  uuid not null references public.posture_analyses(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  view         text not null default 'front',   -- front | back | left | right
  storage_path text not null,
  width        int, height int,
  created_at   timestamptz not null default now()
);
create index if not exists idx_posture_images_analysis on public.posture_images(analysis_id);

-- 3) posture_results: normalize bulgular --------------------------------------
create table if not exists public.posture_results (
  id           uuid primary key default uuid_generate_v4(),
  analysis_id  uuid not null references public.posture_analyses(id) on delete cascade,
  problem      text not null,
  label        text not null,
  risk         text not null default 'moderate',   -- low | moderate | high
  confidence   int not null default 70,
  description  text,
  short_muscles      text[] not null default '{}',
  weak_muscles       text[] not null default '{}',
  overactive_muscles text[] not null default '{}',
  inhibited_muscles  text[] not null default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists idx_posture_results_analysis on public.posture_results(analysis_id);
create index if not exists idx_posture_results_problem  on public.posture_results(problem);

-- 4) posture_scores: bölge bazlı puanlar --------------------------------------
create table if not exists public.posture_scores (
  id           uuid primary key default uuid_generate_v4(),
  analysis_id  uuid not null references public.posture_analyses(id) on delete cascade,
  region       text not null,                       -- head, neck, shoulders, ...
  status       text not null default 'normal',      -- normal | attention | high_risk
  score        int not null default 100,
  created_at   timestamptz not null default now()
);
create index if not exists idx_posture_scores_analysis on public.posture_scores(analysis_id);
create index if not exists idx_posture_scores_region   on public.posture_scores(region);

-- 5) corrective_programs + corrective_exercises -------------------------------
create table if not exists public.corrective_programs (
  id            uuid primary key default uuid_generate_v4(),
  analysis_id   uuid references public.posture_analyses(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  environment   environment_type not null default 'both',
  days          int not null default 3,             -- 1 | 3 | 5 | 7
  total_minutes int not null default 0,
  plan          jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists idx_corr_programs_analysis on public.corrective_programs(analysis_id);
create index if not exists idx_corr_programs_user     on public.corrective_programs(user_id, created_at desc);

create table if not exists public.corrective_exercises (
  id           uuid primary key default uuid_generate_v4(),
  program_id   uuid not null references public.corrective_programs(id) on delete cascade,
  exercise_id  uuid references public.exercises(id) on delete set null,
  day          int not null default 1,
  section      text not null default 'mobilization',
  name         text not null,
  english_name text,
  equipment    text,
  sets         int, reps text, rest_sec int, duration_sec int,
  gif_url      text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_corr_ex_program on public.corrective_exercises(program_id, day, sort_order);

-- 6) analysis_history: gelişim takibi snapshot --------------------------------
create table if not exists public.analysis_history (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  analysis_id   uuid not null references public.posture_analyses(id) on delete cascade,
  posture_score int not null default 0,
  risk_level    text,
  program_days  int,
  improvement_pct numeric(5,2),
  created_at    timestamptz not null default now()
);
create index if not exists idx_analysis_history_user on public.analysis_history(user_id, created_at desc);

-- 7) RLS -----------------------------------------------------------------------
alter table public.posture_images      enable row level security;
alter table public.posture_results     enable row level security;
alter table public.posture_scores      enable row level security;
alter table public.corrective_programs enable row level security;
alter table public.corrective_exercises enable row level security;
alter table public.analysis_history    enable row level security;

-- Sahibi kendi verisini yönetir; adminler görür.
drop policy if exists "posture_images_owner" on public.posture_images;
create policy "posture_images_owner" on public.posture_images
  for all using (auth.uid() = user_id or public.has_admin_access(auth.uid())) with check (auth.uid() = user_id);

drop policy if exists "corr_programs_owner" on public.corrective_programs;
create policy "corr_programs_owner" on public.corrective_programs
  for all using (auth.uid() = user_id or public.has_admin_access(auth.uid())) with check (auth.uid() = user_id);

drop policy if exists "analysis_history_owner" on public.analysis_history;
create policy "analysis_history_owner" on public.analysis_history
  for all using (auth.uid() = user_id or public.has_admin_access(auth.uid())) with check (auth.uid() = user_id);

-- Analiz alt kayıtları: analizin sahibi + admin (analysis_id üzerinden).
drop policy if exists "posture_results_access" on public.posture_results;
create policy "posture_results_access" on public.posture_results
  for all using (
    public.has_admin_access(auth.uid())
    or exists (select 1 from public.posture_analyses a where a.id = analysis_id and a.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.posture_analyses a where a.id = analysis_id and a.user_id = auth.uid())
  );

drop policy if exists "posture_scores_access" on public.posture_scores;
create policy "posture_scores_access" on public.posture_scores
  for all using (
    public.has_admin_access(auth.uid())
    or exists (select 1 from public.posture_analyses a where a.id = analysis_id and a.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.posture_analyses a where a.id = analysis_id and a.user_id = auth.uid())
  );

drop policy if exists "corr_ex_access" on public.corrective_exercises;
create policy "corr_ex_access" on public.corrective_exercises
  for all using (
    public.has_admin_access(auth.uid())
    or exists (select 1 from public.corrective_programs p where p.id = program_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.corrective_programs p where p.id = program_id and p.user_id = auth.uid())
  );

-- Adminler tüm analizleri görebilsin (mevcut posture_owner politikası korunur).
drop policy if exists "posture_admin_select" on public.posture_analyses;
create policy "posture_admin_select" on public.posture_analyses
  for select using (public.has_admin_access(auth.uid()));
