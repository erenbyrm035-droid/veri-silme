-- ============================================================================
-- Migration 0016 — Program Builder + Workout CMS (Sprint 17)
-- Mevcut public.programs (kullanıcı AI planları) KORUNUR. Admin kütüphanesi
-- ayrı "workout_programs" ailesinde tutulur. Additive + idempotent.
-- ============================================================================

-- 1) Program kütüphanesi -------------------------------------------------------
create table if not exists public.workout_programs (
  id                uuid primary key default uuid_generate_v4(),
  slug              text not null unique,
  name              text not null,
  cover_url         text,
  short_description text,
  description       text,
  category          text,                              -- program_categories.slug
  level             text not null default 'beginner',  -- beginner | intermediate | advanced
  goal              text,
  gender            text not null default 'both',      -- male | female | both
  environment       text not null default 'both',      -- home | gym | both
  weeks             int  not null default 4,
  days_per_week     int  not null default 3,
  est_minutes       int,
  calories          int,
  tags              text[] not null default '{}',
  status            text not null default 'draft',     -- published | draft
  sort_order        int  not null default 0,
  rating_avg        numeric(3,2) not null default 0,
  rating_count      int  not null default 0,
  favorite_count    int  not null default 0,
  use_count         int  not null default 0,
  completion_rate   numeric(5,2) not null default 0,
  created_by        uuid references auth.users(id) on delete set null,
  updated_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_wprograms_status   on public.workout_programs(status);
create index if not exists idx_wprograms_category on public.workout_programs(category);
create index if not exists idx_wprograms_level    on public.workout_programs(level);
create index if not exists idx_wprograms_updated  on public.workout_programs(updated_at desc);
create index if not exists idx_wprograms_tags     on public.workout_programs using gin(tags);

create or replace function public.touch_wprogram_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_wprograms_touch on public.workout_programs;
create trigger trg_wprograms_touch before update on public.workout_programs
  for each row execute function public.touch_wprogram_updated_at();

-- 2) Günler (hafta × gün) ------------------------------------------------------
create table if not exists public.workout_program_days (
  id          uuid primary key default uuid_generate_v4(),
  program_id  uuid not null references public.workout_programs(id) on delete cascade,
  week        int not null default 1,
  day         int not null default 1,
  title       text,
  focus       text,
  notes       text,
  is_rest     boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  unique (program_id, week, day)
);
create index if not exists idx_wpdays_program on public.workout_program_days(program_id, week, day);

-- 3) Gün içi egzersizler (blok tipleri: superset/dropset/circuit/emom/amrap/tabata)
create table if not exists public.workout_program_exercises (
  id           uuid primary key default uuid_generate_v4(),
  day_id       uuid not null references public.workout_program_days(id) on delete cascade,
  exercise_id  uuid references public.exercises(id) on delete set null,
  exercise_name text not null,
  block_type   text not null default 'normal',  -- normal|superset|dropset|circuit|emom|amrap|tabata
  block_group  int not null default 0,
  sets         int,
  reps         text,
  duration_sec int,
  rest_sec     int,
  tempo        text,
  rpe          numeric(3,1),
  rir          int,
  note         text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_wpex_day on public.workout_program_exercises(day_id, sort_order);

-- 4) Kategoriler + Etiketler ---------------------------------------------------
create table if not exists public.program_categories (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique, name text not null,
  sort_order int not null default 0, created_at timestamptz not null default now()
);
insert into public.program_categories (slug, name, sort_order) values
  ('weight_loss','Kilo Verme',1),('muscle_gain','Kas Kazanma',2),('fat_burn','Yağ Yakımı',3),
  ('strength','Güç',4),('functional','Fonksiyonel',5),('crossfit','CrossFit',6),
  ('powerlifting','Powerlifting',7),('bodybuilding','Bodybuilding',8),('hiit','HIIT',9),
  ('calisthenics','Calisthenics',10)
on conflict (slug) do nothing;

create table if not exists public.program_tags (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique, name text not null, created_at timestamptz not null default now()
);
insert into public.program_tags (slug, name) values
  ('muscle_gain','Kas Kazanma'),('weight_loss','Kilo Verme'),('strength','Güç'),
  ('hypertrophy','Hipertrofi'),('endurance','Dayanıklılık'),('mobility','Mobilite'),
  ('functional','Fonksiyonel')
on conflict (slug) do nothing;

-- 5) Favoriler / Puanlama / İlerleme -------------------------------------------
create table if not exists public.program_favorites (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.workout_programs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, program_id)
);
create index if not exists idx_pfav_program on public.program_favorites(program_id);

create table if not exists public.program_ratings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.workout_programs(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, program_id)
);
create index if not exists idx_prating_program on public.program_ratings(program_id);

create table if not exists public.program_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.workout_programs(id) on delete cascade,
  status text not null default 'active',      -- active | completed | abandoned
  progress_pct numeric(5,2) not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, program_id)
);
create index if not exists idx_pprog_program on public.program_progress(program_id);

-- 6) İlişkiler (benzer/alternatif/sonraki/önceki) ------------------------------
create table if not exists public.program_relations (
  id uuid primary key default uuid_generate_v4(),
  program_id uuid not null references public.workout_programs(id) on delete cascade,
  related_id uuid not null references public.workout_programs(id) on delete cascade,
  relation text not null default 'similar',   -- similar | alternative | next | previous
  created_at timestamptz not null default now(),
  check (program_id <> related_id),
  unique (program_id, related_id, relation)
);
create index if not exists idx_prel_program on public.program_relations(program_id);

-- 7) Sürümleme -----------------------------------------------------------------
create table if not exists public.program_versions (
  id uuid primary key default uuid_generate_v4(),
  program_id uuid not null references public.workout_programs(id) on delete cascade,
  version int not null, snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_name text, change_note text, created_at timestamptz not null default now(),
  unique (program_id, version)
);
create index if not exists idx_pver_program on public.program_versions(program_id, version desc);

-- 8) İstatistik yeniden hesaplama tetikleyicileri -------------------------------
create or replace function public.recompute_program_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  pid := coalesce(new.program_id, old.program_id);
  update public.workout_programs p set
    rating_avg = coalesce((select round(avg(rating)::numeric,2) from public.program_ratings where program_id = pid),0),
    rating_count = (select count(*) from public.program_ratings where program_id = pid)
  where p.id = pid;
  return null;
end; $$;
drop trigger if exists trg_program_rating on public.program_ratings;
create trigger trg_program_rating after insert or update or delete on public.program_ratings
  for each row execute function public.recompute_program_rating();

create or replace function public.recompute_program_favorites()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  pid := coalesce(new.program_id, old.program_id);
  update public.workout_programs p set
    favorite_count = (select count(*) from public.program_favorites where program_id = pid)
  where p.id = pid;
  return null;
end; $$;
drop trigger if exists trg_program_favorites on public.program_favorites;
create trigger trg_program_favorites after insert or delete on public.program_favorites
  for each row execute function public.recompute_program_favorites();

create or replace function public.recompute_program_progress()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid; total int;
begin
  pid := coalesce(new.program_id, old.program_id);
  select count(*) into total from public.program_progress where program_id = pid;
  update public.workout_programs p set
    use_count = total,
    completion_rate = case when total = 0 then 0 else round(
      100.0 * (select count(*) from public.program_progress where program_id = pid and status = 'completed') / total, 2) end
  where p.id = pid;
  return null;
end; $$;
drop trigger if exists trg_program_progress on public.program_progress;
create trigger trg_program_progress after insert or update or delete on public.program_progress
  for each row execute function public.recompute_program_progress();

-- 9) RLS -----------------------------------------------------------------------
alter table public.workout_programs          enable row level security;
alter table public.workout_program_days      enable row level security;
alter table public.workout_program_exercises enable row level security;
alter table public.program_categories        enable row level security;
alter table public.program_tags              enable row level security;
alter table public.program_relations         enable row level security;
alter table public.program_versions          enable row level security;
alter table public.program_favorites         enable row level security;
alter table public.program_ratings           enable row level security;
alter table public.program_progress          enable row level security;

-- Kütüphane: yayında olanları herkes görür, adminler hepsini.
drop policy if exists "wprograms_select" on public.workout_programs;
create policy "wprograms_select" on public.workout_programs
  for select using (status = 'published' or public.has_admin_access(auth.uid()));
drop policy if exists "wprograms_admin_write" on public.workout_programs;
create policy "wprograms_admin_write" on public.workout_programs
  for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));

-- Alt içerik + kategori/etiket/ilişki: herkes okur, admin yazar.
do $$ declare t text; begin
  foreach t in array array['workout_program_days','workout_program_exercises','program_categories','program_tags','program_relations'] loop
    execute format('drop policy if exists %I on public.%I', t||'_select', t);
    execute format('create policy %I on public.%I for select using (true)', t||'_select', t);
    execute format('drop policy if exists %I on public.%I', t||'_admin_write', t);
    execute format('create policy %I on public.%I for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()))', t||'_admin_write', t);
  end loop; end $$;

-- Sürümler: admin.
drop policy if exists "program_versions_admin" on public.program_versions;
create policy "program_versions_admin" on public.program_versions
  for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));

-- Favoriler: sahibi yönetir, adminler görür.
drop policy if exists "pfav_owner" on public.program_favorites;
create policy "pfav_owner" on public.program_favorites
  for all using (auth.uid() = user_id or public.has_admin_access(auth.uid()))
  with check (auth.uid() = user_id);

-- Puanlar: herkes okur, sahibi yazar.
drop policy if exists "prating_select" on public.program_ratings;
create policy "prating_select" on public.program_ratings for select using (true);
drop policy if exists "prating_owner_write" on public.program_ratings;
create policy "prating_owner_write" on public.program_ratings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- İlerleme: sahibi yönetir, adminler görür.
drop policy if exists "pprog_owner" on public.program_progress;
create policy "pprog_owner" on public.program_progress
  for all using (auth.uid() = user_id or public.has_admin_access(auth.uid()))
  with check (auth.uid() = user_id);
