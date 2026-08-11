-- ============================================================================
-- Migration 0007 — Exercise Library derinleştirme + Favoriler + Kas detay
-- (Anatomy Explorer / Exercise Library geliştirmesi)
-- Mevcut yapıyı bozmaz; yalnızca alan/tablo ekler. Idempotent.
-- ============================================================================

create extension if not exists unaccent;

-- ---- exercises: yeni alanlar ----
alter table public.exercises
  add column if not exists slug          text,
  add column if not exists movement_type text,      -- push/pull/hinge/squat/carry/core/isolation
  add column if not exists thumbnail_url text,
  add column if not exists primary_muscles text[] not null default '{}',
  add column if not exists calories      int;        -- set/seans başına tahmini

-- slug backfill (boş olanlar için isimden üret)
update public.exercises
set slug = trim(both '-' from regexp_replace(lower(unaccent(name)), '[^a-z0-9]+', '-', 'g'))
where slug is null or slug = '';

create unique index if not exists uq_exercises_slug on public.exercises(slug);

-- primary_muscles boşsa muscle_group ile doldur
update public.exercises
set primary_muscles = array[muscle_group]
where primary_muscles = '{}';

-- ---- muscles: kas detay sayfası alanları ----
alter table public.muscles
  add column if not exists joints      text[] not null default '{}',   -- çalıştırdığı eklemler
  add column if not exists daily_life  text,                            -- günlük hayattaki görevi
  add column if not exists growth_tips text[] not null default '{}';    -- gelişim ipuçları

-- ---- FAVORİLER ----
create table if not exists public.favorites (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, exercise_id)
);
create index if not exists idx_favorites_user on public.favorites(user_id, created_at desc);

alter table public.favorites enable row level security;
drop policy if exists "favorites_owner" on public.favorites;
create policy "favorites_owner" on public.favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
