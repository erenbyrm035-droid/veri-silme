-- ============================================================================
-- Migration 0003 — Anatomy Explorer + AI Programlar (Sprint 3)
-- muscles (kas kütüphanesi), muscle_analyses (AI kas analizi), programs
-- (AI üretimli 8 haftalık planlar). Idempotent.
-- ============================================================================

do $$ begin
  create type body_region as enum ('front', 'back');
exception when duplicate_object then null; end $$;

-- ---- KASLAR ----
create table if not exists public.muscles (
  id              uuid primary key default uuid_generate_v4(),
  slug            text not null unique,
  name_tr         text not null,
  latin_name      text,
  muscle_group    text not null,             -- exercises.muscle_group ile eşleşir
  region          body_region not null default 'front',
  svg_region_id   text,                       -- SVG haritasındaki bölge id'si
  overview        text,
  functions       text[] not null default '{}',
  origin          text,
  insertion       text,
  innervation     text,
  common_injuries text[] not null default '{}',
  rehab_notes     text,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

-- ---- AI KAS ANALİZİ ----
create table if not exists public.muscle_analyses (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  lagging     jsonb not null default '[]',    -- [{muscle, reason}]
  summary     text,
  created_at  timestamptz not null default now()
);

-- ---- AI PROGRAMLAR (8 haftalık plan jsonb olarak) ----
create table if not exists public.programs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'AI Programı',
  goal        text,
  weeks       int not null default 8,
  plan        jsonb not null default '{}',    -- { weeks: [{ week, focus, days: [...] }] }
  created_at  timestamptz not null default now()
);

create index if not exists idx_muscles_group        on public.muscles(muscle_group);
create index if not exists idx_analyses_user         on public.muscle_analyses(user_id, created_at desc);
create index if not exists idx_programs_user         on public.programs(user_id, created_at desc);

-- ---- RLS ----
alter table public.muscles          enable row level security;
alter table public.muscle_analyses  enable row level security;
alter table public.programs         enable row level security;

drop policy if exists "muscles_select_all" on public.muscles;
create policy "muscles_select_all" on public.muscles
  for select using (auth.role() = 'authenticated');

drop policy if exists "muscles_admin_write" on public.muscles;
create policy "muscles_admin_write" on public.muscles
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "analyses_owner" on public.muscle_analyses;
create policy "analyses_owner" on public.muscle_analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "programs_owner" on public.programs;
create policy "programs_owner" on public.programs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
