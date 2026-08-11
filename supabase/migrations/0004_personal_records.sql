-- ============================================================================
-- Migration 0004 — Kişisel Rekorlar (Sprint 4, Workout v2)
-- Egzersiz başına en iyi ağırlık / tahmini 1RM. Idempotent.
-- ============================================================================

create table if not exists public.personal_records (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  exercise_id   uuid references public.exercises(id) on delete set null,
  exercise_name text not null,
  best_weight   numeric(6,2) not null default 0,
  best_reps     int,
  est_1rm       numeric(6,2) not null default 0,   -- Epley tahmini
  achieved_on   date not null default current_date,
  updated_at    timestamptz not null default now(),
  unique (user_id, exercise_name)
);

create index if not exists idx_pr_user on public.personal_records(user_id, updated_at desc);

alter table public.personal_records enable row level security;

drop policy if exists "pr_owner" on public.personal_records;
create policy "pr_owner" on public.personal_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
