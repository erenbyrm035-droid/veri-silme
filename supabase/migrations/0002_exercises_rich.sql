-- ============================================================================
-- Migration 0002 — Egzersiz kütüphanesi zenginleştirme (Sprint 2)
-- exercises tablosuna detay alanları + exercise_alternatives ilişki tablosu.
-- Idempotent.
-- ============================================================================

do $$ begin
  create type exercise_category as enum
    ('isolation', 'compound', 'functional', 'mobility', 'stretch', 'rehab');
  create type alt_relation as enum ('alternative', 'similar', 'home', 'gym');
exception when duplicate_object then null; end $$;

alter table public.exercises
  add column if not exists category          exercise_category not null default 'compound',
  add column if not exists secondary_muscles  text[] not null default '{}',
  add column if not exists tempo              text,
  add column if not exists rec_sets           int,
  add column if not exists rec_reps           text,
  add column if not exists rec_rest_sec       int,
  add column if not exists common_mistakes    text[] not null default '{}',
  add column if not exists correct_form       text,
  add column if not exists tips               text[] not null default '{}',
  add column if not exists ai_notes           text,
  add column if not exists gif_url            text,
  add column if not exists image_url          text,
  add column if not exists is_home            boolean not null default false,
  add column if not exists is_gym             boolean not null default true;

-- Egzersizler arası ilişkiler (alternatif / benzer / ev / salon)
create table if not exists public.exercise_alternatives (
  id           uuid primary key default uuid_generate_v4(),
  exercise_id  uuid not null references public.exercises(id) on delete cascade,
  alt_exercise_id uuid not null references public.exercises(id) on delete cascade,
  relation     alt_relation not null default 'alternative',
  unique (exercise_id, alt_exercise_id, relation)
);

create unique index if not exists uq_exercises_name on public.exercises(name);
create index if not exists idx_exercises_muscle    on public.exercises(muscle_group);
create index if not exists idx_exercises_category   on public.exercises(category);
create index if not exists idx_ex_alts_exercise     on public.exercise_alternatives(exercise_id);

alter table public.exercise_alternatives enable row level security;

drop policy if exists "ex_alts_select_all" on public.exercise_alternatives;
create policy "ex_alts_select_all" on public.exercise_alternatives
  for select using (auth.role() = 'authenticated');

drop policy if exists "ex_alts_admin_write" on public.exercise_alternatives;
create policy "ex_alts_admin_write" on public.exercise_alternatives
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
