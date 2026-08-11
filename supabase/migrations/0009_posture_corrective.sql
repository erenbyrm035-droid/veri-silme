-- ============================================================================
-- Migration 0009 — AI Posture Analysis + Corrective Exercise System (Sprint 8)
-- Yeni: posture_analyses tablosu, posture-photos Storage bucket,
--       exercise_category enum genişletme, exercises tablosu profesyonel alanlar.
-- Mevcut yapıyı bozmaz. Not: ALTER TYPE ADD VALUE ayrı çalıştırılır; bu dosya
-- bunları en başta, kullanımdan önce ekler (idempotent).
-- ============================================================================

-- 1) Egzersiz kategorileri — 8 yeni değer (idempotent)
alter type exercise_category add value if not exists 'activation';
alter type exercise_category add value if not exists 'warmup';
alter type exercise_category add value if not exists 'cooldown';
alter type exercise_category add value if not exists 'cardio';
alter type exercise_category add value if not exists 'plyometric';
alter type exercise_category add value if not exists 'core';
alter type exercise_category add value if not exists 'balance';
alter type exercise_category add value if not exists 'stabilization';

-- 2) Exercise Library — profesyonel alanlar (1000+ egzersiz ölçeklenebilir)
alter table public.exercises
  add column if not exists english_name         text,
  add column if not exists body_region          text,
  add column if not exists stabilizer_muscles   text[] not null default '{}',
  add column if not exists mobility_focus        text[] not null default '{}',
  add column if not exists rehabilitation_focus  text[] not null default '{}',
  add column if not exists exercise_goal         text[] not null default '{}',
  add column if not exists environment           environment_type not null default 'both',
  add column if not exists instructions          text[] not null default '{}',
  add column if not exists breathing             text,
  add column if not exists range_of_motion       text,
  add column if not exists regressions           text[] not null default '{}',
  add column if not exists progressions          text[] not null default '{}',
  add column if not exists average_duration_sec  int,
  add column if not exists updated_at            timestamptz not null default now();

-- Mevcut is_home/is_gym bayraklarından environment'i türet (yalnız varsayılan kalanlar için)
update public.exercises
set environment = case
  when is_home and is_gym then 'both'::environment_type
  when is_home then 'home'::environment_type
  else 'gym'::environment_type
end
where environment = 'both';

create index if not exists idx_exercises_env      on public.exercises(environment);
create index if not exists idx_exercises_category on public.exercises(category);

-- 3) Postür analizleri
create table if not exists public.posture_analyses (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  environment        environment_type not null default 'both',
  source             text not null default 'self_assessment', -- 'ai_vision' | 'self_assessment'
  photo_front_path   text,
  photo_side_path    text,
  photo_back_path    text,
  posture_score      int not null default 0,   -- 0-100
  mobility_score     int not null default 0,
  symmetry_score     int not null default 0,
  recovery_score     int not null default 0,
  findings           jsonb not null default '[]',   -- [{problem, confidence, risk, ...}]
  corrective_program jsonb not null default '{}',   -- {sections:[...], total_minutes}
  summary            text,
  created_at         timestamptz not null default now()
);
create index if not exists idx_posture_user on public.posture_analyses(user_id, created_at desc);
alter table public.posture_analyses enable row level security;
drop policy if exists "posture_owner" on public.posture_analyses;
create policy "posture_owner" on public.posture_analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4) Postür fotoğrafları için private Storage bucket (body-photos deseniyle)
insert into storage.buckets (id, name, public)
values ('posture-photos', 'posture-photos', false) on conflict (id) do nothing;

drop policy if exists "posture_photos_read_own" on storage.objects;
create policy "posture_photos_read_own" on storage.objects for select
  using (bucket_id = 'posture-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "posture_photos_insert_own" on storage.objects;
create policy "posture_photos_insert_own" on storage.objects for insert
  with check (bucket_id = 'posture-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "posture_photos_delete_own" on storage.objects;
create policy "posture_photos_delete_own" on storage.objects for delete
  using (bucket_id = 'posture-photos' and (storage.foldername(name))[1] = auth.uid()::text);
