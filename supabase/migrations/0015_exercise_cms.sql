-- ============================================================================
-- Migration 0015 — Exercise CMS (Sprint 16)
-- Egzersiz içerik yönetimi: durum, alt kategori, etiket, SEO; medya / kas /
-- ilişki / kategori / etiket / sürüm tabloları. Additive + idempotent.
-- ============================================================================

-- 1) exercises: CMS kolonları --------------------------------------------------
alter table public.exercises
  add column if not exists status          text    not null default 'published', -- published | draft
  add column if not exists subcategory     text,
  add column if not exists tags            text[]  not null default '{}',
  add column if not exists seo_title       text,
  add column if not exists seo_description text,
  add column if not exists og_image_url    text,
  add column if not exists start_position  text,
  add column if not exists end_position    text,
  add column if not exists updated_by      uuid references auth.users(id) on delete set null;

create index if not exists idx_exercises_status     on public.exercises(status);
create index if not exists idx_exercises_updated_at on public.exercises(updated_at desc);
create index if not exists idx_exercises_tags       on public.exercises using gin(tags);
create index if not exists idx_exercises_mov        on public.exercises(movement_type);
create index if not exists idx_exercises_name_lower on public.exercises(lower(name));

-- updated_at otomatik güncelleme
create or replace function public.touch_exercise_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_exercises_touch on public.exercises;
create trigger trg_exercises_touch before update on public.exercises
  for each row execute function public.touch_exercise_updated_at();

-- 2) Kategoriler (hiyerarşik: kategori + alt kategori) -------------------------
create table if not exists public.exercise_categories (
  id          uuid primary key default uuid_generate_v4(),
  slug        text not null unique,
  name        text not null,
  parent_slug text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.exercise_categories (slug, name, sort_order) values
  ('isolation','İzole',1), ('compound','Compound',2), ('functional','Fonksiyonel',3),
  ('mobility','Mobilite',4), ('stretch','Esneme',5), ('rehab','Rehabilitasyon',6),
  ('activation','Aktivasyon',7), ('warmup','Isınma',8), ('cooldown','Soğuma',9),
  ('cardio','Kardiyo',10), ('plyometric','Plyometrik',11), ('core','Core',12),
  ('balance','Denge',13), ('stabilization','Stabilizasyon',14)
on conflict (slug) do nothing;

-- 3) Etiketler (yönetim/öneri için master; egzersiz etiketi exercises.tags[]) --
create table if not exists public.exercise_tags (
  id         uuid primary key default uuid_generate_v4(),
  slug       text not null unique,
  name       text not null,
  created_at timestamptz not null default now()
);

-- 4) Kas eşlemesi (ana/ikincil) -----------------------------------------------
create table if not exists public.exercise_muscles (
  id          uuid primary key default uuid_generate_v4(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  muscle_id   uuid references public.muscles(id) on delete cascade,
  muscle_name text,                       -- kas silinse bile ad korunur
  role        text not null default 'primary', -- primary | secondary
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  unique (exercise_id, muscle_id, role)
);
create index if not exists idx_ex_muscles_exercise on public.exercise_muscles(exercise_id);

-- 5) Medya (gif | animation | video) — ilk sürümde yalnızca gif aktif ----------
create table if not exists public.exercise_media (
  id           uuid primary key default uuid_generate_v4(),
  exercise_id  uuid not null references public.exercises(id) on delete cascade,
  media_type   text not null default 'gif',  -- gif | animation | video
  url          text not null,
  storage_path text,
  is_primary   boolean not null default false,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_ex_media_exercise on public.exercise_media(exercise_id);

-- 6) İlişkiler (öneri sistemi için) -------------------------------------------
create table if not exists public.exercise_relations (
  id          uuid primary key default uuid_generate_v4(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  related_id  uuid not null references public.exercises(id) on delete cascade,
  relation    text not null default 'alternative',
    -- alternative | easier | harder | same_muscle | same_pattern | same_equipment
  created_at  timestamptz not null default now(),
  check (exercise_id <> related_id),
  unique (exercise_id, related_id, relation)
);
create index if not exists idx_ex_relations_exercise on public.exercise_relations(exercise_id);

-- 7) Sürümleme (kim/ne zaman değiştirdi + snapshot + rollback) -----------------
create table if not exists public.exercise_versions (
  id              uuid primary key default uuid_generate_v4(),
  exercise_id     uuid not null references public.exercises(id) on delete cascade,
  version         int not null,
  snapshot        jsonb not null,
  changed_by      uuid references auth.users(id) on delete set null,
  changed_by_name text,
  change_note     text,
  created_at      timestamptz not null default now(),
  unique (exercise_id, version)
);
create index if not exists idx_ex_versions_exercise on public.exercise_versions(exercise_id, version desc);

-- 8) RLS ----------------------------------------------------------------------
alter table public.exercise_categories enable row level security;
alter table public.exercise_tags       enable row level security;
alter table public.exercise_muscles    enable row level security;
alter table public.exercise_media      enable row level security;
alter table public.exercise_relations  enable row level security;
alter table public.exercise_versions   enable row level security;

-- Genel içerik: herkes okuyabilir, yalnızca admin yazar.
do $$
declare t text;
begin
  foreach t in array array['exercise_categories','exercise_tags','exercise_muscles','exercise_media','exercise_relations']
  loop
    execute format('drop policy if exists %I on public.%I', t||'_select_all', t);
    execute format('create policy %I on public.%I for select using (true)', t||'_select_all', t);
    execute format('drop policy if exists %I on public.%I', t||'_admin_write', t);
    execute format('create policy %I on public.%I for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()))', t||'_admin_write', t);
  end loop;
end $$;

-- Sürümler: yalnızca admin görür/yazar.
drop policy if exists "exercise_versions_admin_all" on public.exercise_versions;
create policy "exercise_versions_admin_all" on public.exercise_versions
  for all using (public.has_admin_access(auth.uid()))
  with check (public.has_admin_access(auth.uid()));

-- Egzersiz yazımı admin_role sahiplerine de açık (mevcut is_admin politikası korunur).
drop policy if exists "exercises_admin_role_write" on public.exercises;
create policy "exercises_admin_role_write" on public.exercises
  for all using (public.has_admin_access(auth.uid()))
  with check (public.has_admin_access(auth.uid()));
