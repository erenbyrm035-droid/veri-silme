-- ============================================================================
-- AI Fitness Coach — PostgreSQL / Supabase Şeması
-- ----------------------------------------------------------------------------
-- Bu dosya Supabase SQL Editor'de veya `supabase db push` ile çalıştırılabilir.
-- Tüm tablolarda Row Level Security (RLS) aktiftir.
-- ============================================================================

-- Gerekli eklentiler
create extension if not exists "uuid-ossp";

-- ============================================================================
-- ENUM TİPLERİ
-- ============================================================================
do $$ begin
  create type gender_type       as enum ('male', 'female', 'other');
  create type goal_type         as enum ('lose_weight', 'gain_muscle', 'get_fit', 'improve_endurance', 'gain_strength');
  create type experience_type   as enum ('beginner', 'intermediate', 'advanced');
  create type environment_type  as enum ('home', 'gym', 'both');
  create type difficulty_type   as enum ('beginner', 'intermediate', 'advanced');
  create type workout_status    as enum ('planned', 'in_progress', 'completed');
  create type meal_type         as enum ('breakfast', 'lunch', 'dinner', 'snack');
  create type chat_role         as enum ('user', 'assistant', 'system');
  create type exercise_category as enum ('isolation', 'compound', 'functional', 'mobility', 'stretch', 'rehab', 'activation', 'warmup', 'cooldown', 'cardio', 'plyometric', 'core', 'balance', 'stabilization');
  create type alt_relation      as enum ('alternative', 'similar', 'home', 'gym');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- PROFILES — Kullanıcı profili (auth.users'ı genişletir)
-- ============================================================================
create table if not exists public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  full_name             text,
  avatar_url            text,
  age                   int check (age between 10 and 120),
  gender                gender_type,
  height_cm             numeric(5,1) check (height_cm between 80 and 260),
  weight_kg             numeric(5,1) check (weight_kg between 25 and 400),
  starting_weight_kg    numeric(5,1),
  body_fat_pct          numeric(4,1) check (body_fat_pct between 3 and 70),
  sleep_hours           numeric(3,1) check (sleep_hours between 0 and 24),
  injuries              text[] not null default '{}',
  available_equipment   text[] not null default '{}',
  goal                  goal_type,
  experience            experience_type,
  weekly_training_days  int check (weekly_training_days between 1 and 7),
  training_environment  environment_type,
  daily_calorie_goal    int default 2000,
  daily_protein_goal    int default 120,
  daily_water_goal_ml   int default 2500,
  daily_step_goal       int default 8000,
  is_admin              boolean not null default false,
  onboarding_completed  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ============================================================================
-- EXERCISES — Egzersiz kütüphanesi (global, admin tarafından yönetilir)
-- ============================================================================
create table if not exists public.exercises (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null unique,
  muscle_group      text not null,
  description       text,
  video_url         text,
  difficulty        difficulty_type not null default 'beginner',
  equipment         text,
  category          exercise_category not null default 'compound',
  secondary_muscles text[] not null default '{}',
  tempo             text,
  rec_sets          int,
  rec_reps          text,
  rec_rest_sec      int,
  common_mistakes   text[] not null default '{}',
  correct_form      text,
  tips              text[] not null default '{}',
  ai_notes          text,
  gif_url           text,
  image_url         text,
  is_home           boolean not null default false,
  is_gym            boolean not null default true,
  created_at        timestamptz not null default now()
);

-- Egzersizler arası ilişkiler (alternatif / benzer / ev / salon)
create table if not exists public.exercise_alternatives (
  id              uuid primary key default uuid_generate_v4(),
  exercise_id     uuid not null references public.exercises(id) on delete cascade,
  alt_exercise_id uuid not null references public.exercises(id) on delete cascade,
  relation        alt_relation not null default 'alternative',
  unique (exercise_id, alt_exercise_id, relation)
);

-- ============================================================================
-- WORKOUTS — Kullanıcı antrenman oturumları
-- ============================================================================
create table if not exists public.workouts (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null default 'Antrenman',
  workout_date  date not null default current_date,
  status        workout_status not null default 'planned',
  notes         text,
  duration_min  int,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

-- Bir antrenmandaki egzersizler ve setleri (hareketler + set + tekrar + ağırlık)
create table if not exists public.workout_sets (
  id           uuid primary key default uuid_generate_v4(),
  workout_id   uuid not null references public.workouts(id) on delete cascade,
  exercise_id  uuid references public.exercises(id) on delete set null,
  exercise_name text not null,            -- egzersiz silinse bile isim korunur
  set_order    int not null default 1,
  reps         int,
  weight_kg    numeric(6,2),
  completed    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- FOODS — Yiyecek kütüphanesi (Türk mutfağı odaklı, 100g bazında)
-- ============================================================================
create table if not exists public.foods (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  calories      numeric(6,1) not null,   -- 100g başına
  protein_g     numeric(6,1) not null default 0,
  carbs_g       numeric(6,1) not null default 0,
  fat_g         numeric(6,1) not null default 0,
  serving_desc  text default '100 g',
  is_turkish    boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ============================================================================
-- NUTRITION_LOGS — Öğün / besin kayıtları
-- ============================================================================
create table if not exists public.nutrition_logs (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  food_id      uuid references public.foods(id) on delete set null,
  food_name    text not null,
  meal         meal_type not null default 'lunch',
  log_date     date not null default current_date,
  grams        numeric(7,1) not null default 100,
  calories     numeric(7,1) not null default 0,
  protein_g    numeric(6,1) not null default 0,
  carbs_g      numeric(6,1) not null default 0,
  fat_g        numeric(6,1) not null default 0,
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- WATER_LOGS — Su tüketim kayıtları
-- ============================================================================
create table if not exists public.water_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  log_date    date not null default current_date,
  amount_ml   int not null default 250,
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- BODY_MEASUREMENTS — Vücut gelişim ölçümleri
-- ============================================================================
create table if not exists public.body_measurements (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  measured_on    date not null default current_date,
  weight_kg      numeric(5,1),
  waist_cm       numeric(5,1),
  arm_cm         numeric(5,1),
  chest_cm       numeric(5,1),
  shoulder_cm    numeric(5,1),
  leg_cm         numeric(5,1),
  photo_url      text,
  notes          text,
  created_at     timestamptz not null default now()
);

-- ============================================================================
-- AI_CONVERSATIONS + AI_MESSAGES — AI Koç sohbet geçmişi
-- ============================================================================
create table if not exists public.ai_conversations (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'Yeni Sohbet',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id               uuid primary key default uuid_generate_v4(),
  conversation_id  uuid not null references public.ai_conversations(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  role             chat_role not null,
  content          text not null,
  created_at       timestamptz not null default now()
);

-- ============================================================================
-- İNDEKSLER
-- ============================================================================
create index if not exists idx_workouts_user_date       on public.workouts(user_id, workout_date desc);
create index if not exists idx_workout_sets_workout      on public.workout_sets(workout_id);
create index if not exists idx_nutrition_user_date       on public.nutrition_logs(user_id, log_date desc);
create index if not exists idx_water_user_date           on public.water_logs(user_id, log_date desc);
create index if not exists idx_measurements_user_date    on public.body_measurements(user_id, measured_on desc);
create index if not exists idx_ai_messages_conversation  on public.ai_messages(conversation_id, created_at);
create index if not exists idx_ai_conversations_user     on public.ai_conversations(user_id, updated_at desc);

-- ============================================================================
-- updated_at OTOMATİK GÜNCELLEME
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_conversations_updated on public.ai_conversations;
create trigger trg_conversations_updated before update on public.ai_conversations
  for each row execute function public.set_updated_at();

-- ============================================================================
-- YENİ KULLANICI → PROFİL OLUŞTURMA TETİKLEYİCİSİ
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles              enable row level security;
alter table public.exercises             enable row level security;
alter table public.exercise_alternatives enable row level security;
alter table public.workouts              enable row level security;
alter table public.workout_sets      enable row level security;
alter table public.foods             enable row level security;
alter table public.nutrition_logs    enable row level security;
alter table public.water_logs        enable row level security;
alter table public.body_measurements enable row level security;
alter table public.ai_conversations  enable row level security;
alter table public.ai_messages       enable row level security;

-- Admin kontrolü için yardımcı fonksiyon (RLS içinde recursion'ı önler)
create or replace function public.is_admin(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

-- ---- PROFILES ----
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- ---- EXERCISES (herkes okur, sadece admin yazar) ----
drop policy if exists "exercises_select_all" on public.exercises;
create policy "exercises_select_all" on public.exercises
  for select using (auth.role() = 'authenticated');

drop policy if exists "exercises_admin_write" on public.exercises;
create policy "exercises_admin_write" on public.exercises
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---- EXERCISE_ALTERNATIVES (herkes okur, sadece admin yazar) ----
drop policy if exists "ex_alts_select_all" on public.exercise_alternatives;
create policy "ex_alts_select_all" on public.exercise_alternatives
  for select using (auth.role() = 'authenticated');

drop policy if exists "ex_alts_admin_write" on public.exercise_alternatives;
create policy "ex_alts_admin_write" on public.exercise_alternatives
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---- FOODS (herkes okur, sadece admin yazar) ----
drop policy if exists "foods_select_all" on public.foods;
create policy "foods_select_all" on public.foods
  for select using (auth.role() = 'authenticated');

drop policy if exists "foods_admin_write" on public.foods;
create policy "foods_admin_write" on public.foods
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---- Kullanıcıya ait tablolar için jenerik sahiplik politikaları ----
-- WORKOUTS
drop policy if exists "workouts_owner" on public.workouts;
create policy "workouts_owner" on public.workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- WORKOUT_SETS (parent workout üzerinden sahiplik)
drop policy if exists "workout_sets_owner" on public.workout_sets;
create policy "workout_sets_owner" on public.workout_sets
  for all using (
    exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
  );

-- NUTRITION_LOGS
drop policy if exists "nutrition_owner" on public.nutrition_logs;
create policy "nutrition_owner" on public.nutrition_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- WATER_LOGS
drop policy if exists "water_owner" on public.water_logs;
create policy "water_owner" on public.water_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- BODY_MEASUREMENTS
drop policy if exists "measurements_owner" on public.body_measurements;
create policy "measurements_owner" on public.body_measurements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- AI_CONVERSATIONS
drop policy if exists "conversations_owner" on public.ai_conversations;
create policy "conversations_owner" on public.ai_conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- AI_MESSAGES
drop policy if exists "messages_owner" on public.ai_messages;
create policy "messages_owner" on public.ai_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- ANATOMY EXPLORER + AI PROGRAMLAR (Sprint 3) — bkz. migrations/0003
-- ============================================================================
do $$ begin
  create type body_region as enum ('front', 'back');
exception when duplicate_object then null; end $$;

create table if not exists public.muscles (
  id              uuid primary key default uuid_generate_v4(),
  slug            text not null unique,
  name_tr         text not null,
  latin_name      text,
  muscle_group    text not null,
  region          body_region not null default 'front',
  svg_region_id   text,
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

create table if not exists public.muscle_analyses (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  lagging     jsonb not null default '[]',
  summary     text,
  created_at  timestamptz not null default now()
);

create table if not exists public.programs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'AI Programı',
  goal        text,
  weeks       int not null default 8,
  plan        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists idx_muscles_group on public.muscles(muscle_group);
create index if not exists idx_analyses_user on public.muscle_analyses(user_id, created_at desc);
create index if not exists idx_programs_user on public.programs(user_id, created_at desc);

alter table public.muscles         enable row level security;
alter table public.muscle_analyses enable row level security;
alter table public.programs        enable row level security;

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

-- ============================================================================
-- KİŞİSEL REKORLAR (Sprint 4) — bkz. migrations/0004
-- ============================================================================
create table if not exists public.personal_records (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  exercise_id   uuid references public.exercises(id) on delete set null,
  exercise_name text not null,
  best_weight   numeric(6,2) not null default 0,
  best_reps     int,
  est_1rm       numeric(6,2) not null default 0,
  achieved_on   date not null default current_date,
  updated_at    timestamptz not null default now(),
  unique (user_id, exercise_name)
);
create index if not exists idx_pr_user on public.personal_records(user_id, updated_at desc);
alter table public.personal_records enable row level security;
drop policy if exists "pr_owner" on public.personal_records;
create policy "pr_owner" on public.personal_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- VÜCUT FOTOĞRAFLARI + STORAGE (Sprint 5) — bkz. migrations/0005
-- ============================================================================
do $$ begin
  create type photo_angle as enum ('front', 'side', 'back');
exception when duplicate_object then null; end $$;

create table if not exists public.body_photos (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  taken_on     date not null default current_date,
  storage_path text not null,
  angle        photo_angle not null default 'front',
  created_at   timestamptz not null default now()
);
create index if not exists idx_body_photos_user on public.body_photos(user_id, taken_on desc);
alter table public.body_photos enable row level security;
drop policy if exists "body_photos_owner" on public.body_photos;
create policy "body_photos_owner" on public.body_photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('body-photos', 'body-photos', false) on conflict (id) do nothing;

drop policy if exists "body_photos_read_own" on storage.objects;
create policy "body_photos_read_own" on storage.objects for select
  using (bucket_id = 'body-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "body_photos_insert_own" on storage.objects;
create policy "body_photos_insert_own" on storage.objects for insert
  with check (bucket_id = 'body-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "body_photos_delete_own" on storage.objects;
create policy "body_photos_delete_own" on storage.objects for delete
  using (bucket_id = 'body-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- BİLDİRİMLER (Sprint 6) — bkz. migrations/0006
-- ============================================================================
do $$ begin
  create type notification_type as enum ('info', 'workout', 'nutrition', 'achievement', 'coach');
exception when duplicate_object then null; end $$;

create table if not exists public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        notification_type not null default 'info',
  title       text not null,
  body        text,
  href        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "notifications_owner" on public.notifications;
create policy "notifications_owner" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- EXERCISE LIBRARY DERİNLEŞTİRME + FAVORİLER (Sprint 7) — bkz. migrations/0007
-- ============================================================================
create extension if not exists unaccent;

alter table public.exercises
  add column if not exists slug            text,
  add column if not exists movement_type   text,
  add column if not exists thumbnail_url   text,
  add column if not exists primary_muscles text[] not null default '{}',
  add column if not exists calories        int;

update public.exercises
set slug = trim(both '-' from regexp_replace(lower(unaccent(name)), '[^a-z0-9]+', '-', 'g'))
where slug is null or slug = '';
create unique index if not exists uq_exercises_slug on public.exercises(slug);
update public.exercises set primary_muscles = array[muscle_group] where primary_muscles = '{}';

alter table public.muscles
  add column if not exists joints      text[] not null default '{}',
  add column if not exists daily_life  text,
  add column if not exists growth_tips text[] not null default '{}';

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

-- ============================================================================
-- AI POSTURE ANALYSIS + CORRECTIVE (Sprint 8) — bkz. migrations/0009
-- ============================================================================
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
create index if not exists idx_exercises_env      on public.exercises(environment);
create index if not exists idx_exercises_category on public.exercises(category);

create table if not exists public.posture_analyses (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  environment        environment_type not null default 'both',
  source             text not null default 'self_assessment',
  photo_front_path   text,
  photo_side_path    text,
  photo_back_path    text,
  posture_score      int not null default 0,
  mobility_score     int not null default 0,
  symmetry_score     int not null default 0,
  recovery_score     int not null default 0,
  findings           jsonb not null default '[]',
  corrective_program jsonb not null default '{}',
  summary            text,
  created_at         timestamptz not null default now()
);
create index if not exists idx_posture_user on public.posture_analyses(user_id, created_at desc);
alter table public.posture_analyses enable row level security;
drop policy if exists "posture_owner" on public.posture_analyses;
create policy "posture_owner" on public.posture_analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

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

-- ============================================================================
-- AI NUTRITION COACH (Sprint 10) — bkz. migrations/0010
-- ============================================================================
alter table public.profiles
  add column if not exists muscle_mass_kg       numeric(5,1),
  add column if not exists activity_level        text,
  add column if not exists daily_step_count       int,
  add column if not exists dietary_preferences    text[] not null default '{}',
  add column if not exists allergies              text[] not null default '{}',
  add column if not exists health_conditions      text[] not null default '{}',
  add column if not exists medications            text[] not null default '{}',
  add column if not exists nutrition_goal         text,
  add column if not exists daily_carb_goal        int,
  add column if not exists daily_fat_goal         int,
  add column if not exists daily_fiber_goal       int;

alter table public.foods
  add column if not exists fiber_g        numeric(6,1) not null default 0,
  add column if not exists sugar_g        numeric(6,1) not null default 0,
  add column if not exists sodium_mg      numeric(7,1) not null default 0,
  add column if not exists potassium_mg   numeric(7,1) not null default 0,
  add column if not exists category       text,
  add column if not exists brand          text,
  add column if not exists barcode        text,
  add column if not exists serving_grams  numeric(6,1) default 100,
  add column if not exists is_verified    boolean not null default false,
  add column if not exists source         text default 'seed';
create unique index if not exists uq_foods_barcode on public.foods(barcode) where barcode is not null;
create index if not exists idx_foods_category on public.foods(category);
create index if not exists idx_foods_name on public.foods(lower(name));

create table if not exists public.meal_plans (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text not null default 'AI Beslenme Planı',
  goal            text,
  target_calories int,
  target_protein  int,
  target_carbs    int,
  target_fat      int,
  plan            jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index if not exists idx_meal_plans_user on public.meal_plans(user_id, created_at desc);
alter table public.meal_plans enable row level security;
drop policy if exists "meal_plans_owner" on public.meal_plans;
create policy "meal_plans_owner" on public.meal_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.shopping_lists (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  plan_id     uuid references public.meal_plans(id) on delete set null,
  title       text not null default 'Alışveriş Listesi',
  items       jsonb not null default '[]',
  created_at  timestamptz not null default now()
);
create index if not exists idx_shopping_user on public.shopping_lists(user_id, created_at desc);
alter table public.shopping_lists enable row level security;
drop policy if exists "shopping_owner" on public.shopping_lists;
create policy "shopping_owner" on public.shopping_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.nutrition_reports (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  week_start    date not null default current_date,
  scores        jsonb not null default '{}',
  weight_change numeric(5,1),
  advice        text,
  data          jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists idx_reports_user on public.nutrition_reports(user_id, created_at desc);
alter table public.nutrition_reports enable row level security;
drop policy if exists "reports_owner" on public.nutrition_reports;
create policy "reports_owner" on public.nutrition_reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.meal_photos (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  recognized   jsonb not null default '{}',
  logged       boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_meal_photos_user on public.meal_photos(user_id, created_at desc);
alter table public.meal_photos enable row level security;
drop policy if exists "meal_photos_owner" on public.meal_photos;
create policy "meal_photos_owner" on public.meal_photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false) on conflict (id) do nothing;
drop policy if exists "meal_photos_read_own" on storage.objects;
create policy "meal_photos_read_own" on storage.objects for select
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "meal_photos_insert_own" on storage.objects;
create policy "meal_photos_insert_own" on storage.objects for insert
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "meal_photos_delete_own" on storage.objects;
create policy "meal_photos_delete_own" on storage.objects for delete
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- EXERCISE ANIMATION ENGINE (Sprint 12) — bkz. migrations/0011
-- ============================================================================
create table if not exists public.animations (
  id              uuid primary key default uuid_generate_v4(),
  animation_key   text not null unique,
  name            text not null,
  url             text,
  duration_sec    numeric(6,2),
  loop            boolean not null default true,
  thumbnail_url   text,
  camera_position jsonb not null default '{"x":0,"y":1.4,"z":3.2}'::jsonb,
  gender_support  text not null default 'both',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_animations_key on public.animations(animation_key);

create table if not exists public.animation_mapping (
  id           uuid primary key default uuid_generate_v4(),
  exercise_id  uuid not null references public.exercises(id) on delete cascade,
  animation_id uuid not null references public.animations(id) on delete cascade,
  gender       text not null default 'both',
  priority     int  not null default 100,
  created_at   timestamptz not null default now(),
  unique (exercise_id, animation_id, gender)
);
create index if not exists idx_anim_map_exercise on public.animation_mapping(exercise_id, priority);

alter table public.animations       enable row level security;
alter table public.animation_mapping enable row level security;
drop policy if exists "animations_select" on public.animations;
create policy "animations_select" on public.animations
  for select using (auth.role() = 'authenticated');
drop policy if exists "animations_admin_write" on public.animations;
create policy "animations_admin_write" on public.animations
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists "anim_map_select" on public.animation_mapping;
create policy "anim_map_select" on public.animation_mapping
  for select using (auth.role() = 'authenticated');
drop policy if exists "anim_map_admin_write" on public.animation_mapping;
create policy "anim_map_admin_write" on public.animation_mapping
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

insert into storage.buckets (id, name, public)
values ('animations', 'animations', true) on conflict (id) do nothing;
drop policy if exists "animations_public_read" on storage.objects;
create policy "animations_public_read" on storage.objects for select
  using (bucket_id = 'animations');
drop policy if exists "animations_admin_insert" on storage.objects;
create policy "animations_admin_insert" on storage.objects for insert
  with check (bucket_id = 'animations' and public.is_admin(auth.uid()));
drop policy if exists "animations_admin_delete" on storage.objects;
create policy "animations_admin_delete" on storage.objects for delete
  using (bucket_id = 'animations' and public.is_admin(auth.uid()));

-- ============================================================================
-- KENDİ MEDYA SİSTEMİ (Sprint 13) — bkz. migrations/0012
-- ============================================================================
alter table public.exercises
  add column if not exists media_type text not null default 'gif';
insert into storage.buckets (id, name, public)
values ('exercise-media', 'exercise-media', true) on conflict (id) do nothing;
drop policy if exists "exercise_media_public_read" on storage.objects;
create policy "exercise_media_public_read" on storage.objects for select
  using (bucket_id = 'exercise-media');
drop policy if exists "exercise_media_admin_insert" on storage.objects;
create policy "exercise_media_admin_insert" on storage.objects for insert
  with check (bucket_id = 'exercise-media' and public.is_admin(auth.uid()));
drop policy if exists "exercise_media_admin_delete" on storage.objects;
create policy "exercise_media_admin_delete" on storage.objects for delete
  using (bucket_id = 'exercise-media' and public.is_admin(auth.uid()));

-- ============================================================================
-- ADMIN PANEL ROL SİSTEMİ (Sprint 14) — bkz. migrations/0013
-- ============================================================================
alter table public.profiles
  add column if not exists admin_role text;
update public.profiles set admin_role = 'super_admin' where is_admin = true and admin_role is null;
create or replace function public.has_admin_access(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_admin or admin_role in ('super_admin','admin','editor')
     from public.profiles where id = uid),
    false
  );
$$;

-- ============================================================================
-- KULLANICI YÖNETİM SİSTEMİ (Sprint 15) — bkz. migrations/0014
-- ============================================================================
alter table public.profiles
  add column if not exists is_premium      boolean     not null default false,
  add column if not exists premium_until   timestamptz,
  add column if not exists membership_type  text        not null default 'free',
  add column if not exists is_banned        boolean     not null default false,
  add column if not exists banned_at        timestamptz,
  add column if not exists ban_reason       text,
  add column if not exists is_active        boolean     not null default true,
  add column if not exists phone            text;

create or replace function public.expire_premiums()
returns void language sql security definer set search_path = public as $$
  update public.profiles
  set is_premium = false, membership_type = 'free'
  where is_premium = true and premium_until is not null and premium_until < now();
$$;

create index if not exists idx_profiles_created_at on public.profiles (created_at desc);
create index if not exists idx_profiles_is_premium on public.profiles (is_premium);
create index if not exists idx_profiles_is_banned   on public.profiles (is_banned);
create index if not exists idx_profiles_is_active   on public.profiles (is_active);
create index if not exists idx_profiles_admin_role  on public.profiles (admin_role);
create index if not exists idx_profiles_full_name   on public.profiles (lower(full_name));

create table if not exists public.admin_user_notes (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  author_name text,
  note        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_admin_notes_user on public.admin_user_notes (user_id, created_at desc);

create table if not exists public.user_login_events (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  provider    text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_login_events_user on public.user_login_events (user_id, created_at desc);

create or replace view public.admin_users
with (security_invoker = off) as
select
  p.id, p.full_name, p.avatar_url, p.phone, p.is_premium, p.premium_until,
  p.membership_type, p.admin_role, p.is_admin, p.is_banned, p.banned_at,
  p.ban_reason, p.is_active, p.onboarding_completed, p.created_at,
  u.email, u.last_sign_in_at, u.created_at as registered_at
from public.profiles p
join auth.users u on u.id = p.id;
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to service_role;

alter table public.admin_user_notes  enable row level security;
alter table public.user_login_events enable row level security;

drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all" on public.profiles
  for select using (public.has_admin_access(auth.uid()));
drop policy if exists "profiles_admin_update_all" on public.profiles;
create policy "profiles_admin_update_all" on public.profiles
  for update using (public.has_admin_access(auth.uid()))
  with check (public.has_admin_access(auth.uid()));

drop policy if exists "admin_notes_admin_all" on public.admin_user_notes;
create policy "admin_notes_admin_all" on public.admin_user_notes
  for all using (public.has_admin_access(auth.uid()))
  with check (public.has_admin_access(auth.uid()));

drop policy if exists "login_events_insert_own" on public.user_login_events;
create policy "login_events_insert_own" on public.user_login_events
  for insert with check (auth.uid() = user_id);
drop policy if exists "login_events_select_own_or_admin" on public.user_login_events;
create policy "login_events_select_own_or_admin" on public.user_login_events
  for select using (auth.uid() = user_id or public.has_admin_access(auth.uid()));

-- ============================================================================
-- EXERCISE CMS (Sprint 16) — bkz. migrations/0015
-- ============================================================================
alter table public.exercises
  add column if not exists status          text    not null default 'published',
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

create or replace function public.touch_exercise_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_exercises_touch on public.exercises;
create trigger trg_exercises_touch before update on public.exercises
  for each row execute function public.touch_exercise_updated_at();

create table if not exists public.exercise_categories (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique, name text not null, parent_slug text,
  sort_order int not null default 0, created_at timestamptz not null default now()
);
insert into public.exercise_categories (slug, name, sort_order) values
  ('isolation','İzole',1),('compound','Compound',2),('functional','Fonksiyonel',3),
  ('mobility','Mobilite',4),('stretch','Esneme',5),('rehab','Rehabilitasyon',6),
  ('activation','Aktivasyon',7),('warmup','Isınma',8),('cooldown','Soğuma',9),
  ('cardio','Kardiyo',10),('plyometric','Plyometrik',11),('core','Core',12),
  ('balance','Denge',13),('stabilization','Stabilizasyon',14)
on conflict (slug) do nothing;

create table if not exists public.exercise_tags (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique, name text not null, created_at timestamptz not null default now()
);

create table if not exists public.exercise_muscles (
  id uuid primary key default uuid_generate_v4(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  muscle_id uuid references public.muscles(id) on delete cascade,
  muscle_name text, role text not null default 'primary',
  sort_order int not null default 0, created_at timestamptz not null default now(),
  unique (exercise_id, muscle_id, role)
);
create index if not exists idx_ex_muscles_exercise on public.exercise_muscles(exercise_id);

create table if not exists public.exercise_media (
  id uuid primary key default uuid_generate_v4(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  media_type text not null default 'gif', url text not null, storage_path text,
  is_primary boolean not null default false, sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_ex_media_exercise on public.exercise_media(exercise_id);

create table if not exists public.exercise_relations (
  id uuid primary key default uuid_generate_v4(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  related_id uuid not null references public.exercises(id) on delete cascade,
  relation text not null default 'alternative', created_at timestamptz not null default now(),
  check (exercise_id <> related_id), unique (exercise_id, related_id, relation)
);
create index if not exists idx_ex_relations_exercise on public.exercise_relations(exercise_id);

create table if not exists public.exercise_versions (
  id uuid primary key default uuid_generate_v4(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  version int not null, snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_name text, change_note text, created_at timestamptz not null default now(),
  unique (exercise_id, version)
);
create index if not exists idx_ex_versions_exercise on public.exercise_versions(exercise_id, version desc);

alter table public.exercise_categories enable row level security;
alter table public.exercise_tags       enable row level security;
alter table public.exercise_muscles    enable row level security;
alter table public.exercise_media      enable row level security;
alter table public.exercise_relations  enable row level security;
alter table public.exercise_versions   enable row level security;
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
drop policy if exists "exercise_versions_admin_all" on public.exercise_versions;
create policy "exercise_versions_admin_all" on public.exercise_versions
  for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));
drop policy if exists "exercises_admin_role_write" on public.exercises;
create policy "exercises_admin_role_write" on public.exercises
  for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));

-- ============================================================================
-- PROGRAM BUILDER + WORKOUT CMS (Sprint 17) — bkz. migrations/0016
-- Mevcut public.programs (kullanıcı AI planları) korunur; kütüphane ayrıdır.
-- ============================================================================
create table if not exists public.workout_programs (
  id uuid primary key default uuid_generate_v4(), slug text not null unique, name text not null,
  cover_url text, short_description text, description text, category text,
  level text not null default 'beginner', goal text, gender text not null default 'both',
  environment text not null default 'both', weeks int not null default 4, days_per_week int not null default 3,
  est_minutes int, calories int, tags text[] not null default '{}', status text not null default 'draft',
  sort_order int not null default 0, rating_avg numeric(3,2) not null default 0, rating_count int not null default 0,
  favorite_count int not null default 0, use_count int not null default 0, completion_rate numeric(5,2) not null default 0,
  created_by uuid references auth.users(id) on delete set null, updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists idx_wprograms_status on public.workout_programs(status);
create index if not exists idx_wprograms_category on public.workout_programs(category);
create index if not exists idx_wprograms_level on public.workout_programs(level);
create index if not exists idx_wprograms_updated on public.workout_programs(updated_at desc);
create index if not exists idx_wprograms_tags on public.workout_programs using gin(tags);
create or replace function public.touch_wprogram_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_wprograms_touch on public.workout_programs;
create trigger trg_wprograms_touch before update on public.workout_programs for each row execute function public.touch_wprogram_updated_at();

create table if not exists public.workout_program_days (
  id uuid primary key default uuid_generate_v4(),
  program_id uuid not null references public.workout_programs(id) on delete cascade,
  week int not null default 1, day int not null default 1, title text, focus text, notes text,
  is_rest boolean not null default false, sort_order int not null default 0, created_at timestamptz not null default now(),
  unique (program_id, week, day));
create index if not exists idx_wpdays_program on public.workout_program_days(program_id, week, day);

create table if not exists public.workout_program_exercises (
  id uuid primary key default uuid_generate_v4(),
  day_id uuid not null references public.workout_program_days(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null, exercise_name text not null,
  block_type text not null default 'normal', block_group int not null default 0,
  sets int, reps text, duration_sec int, rest_sec int, tempo text, rpe numeric(3,1), rir int, note text,
  sort_order int not null default 0, created_at timestamptz not null default now());
create index if not exists idx_wpex_day on public.workout_program_exercises(day_id, sort_order);

create table if not exists public.program_categories (
  id uuid primary key default uuid_generate_v4(), slug text not null unique, name text not null,
  sort_order int not null default 0, created_at timestamptz not null default now());
insert into public.program_categories (slug, name, sort_order) values
  ('weight_loss','Kilo Verme',1),('muscle_gain','Kas Kazanma',2),('fat_burn','Yağ Yakımı',3),
  ('strength','Güç',4),('functional','Fonksiyonel',5),('crossfit','CrossFit',6),
  ('powerlifting','Powerlifting',7),('bodybuilding','Bodybuilding',8),('hiit','HIIT',9),
  ('calisthenics','Calisthenics',10) on conflict (slug) do nothing;

create table if not exists public.program_tags (
  id uuid primary key default uuid_generate_v4(), slug text not null unique, name text not null, created_at timestamptz not null default now());
insert into public.program_tags (slug, name) values
  ('muscle_gain','Kas Kazanma'),('weight_loss','Kilo Verme'),('strength','Güç'),('hypertrophy','Hipertrofi'),
  ('endurance','Dayanıklılık'),('mobility','Mobilite'),('functional','Fonksiyonel') on conflict (slug) do nothing;

create table if not exists public.program_favorites (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.workout_programs(id) on delete cascade,
  created_at timestamptz not null default now(), unique (user_id, program_id));
create index if not exists idx_pfav_program on public.program_favorites(program_id);

create table if not exists public.program_ratings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.workout_programs(id) on delete cascade,
  rating int not null check (rating between 1 and 5), comment text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (user_id, program_id));
create index if not exists idx_prating_program on public.program_ratings(program_id);

create table if not exists public.program_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.workout_programs(id) on delete cascade,
  status text not null default 'active', progress_pct numeric(5,2) not null default 0,
  started_at timestamptz not null default now(), completed_at timestamptz, updated_at timestamptz not null default now(),
  unique (user_id, program_id));
create index if not exists idx_pprog_program on public.program_progress(program_id);

create table if not exists public.program_relations (
  id uuid primary key default uuid_generate_v4(),
  program_id uuid not null references public.workout_programs(id) on delete cascade,
  related_id uuid not null references public.workout_programs(id) on delete cascade,
  relation text not null default 'similar', created_at timestamptz not null default now(),
  check (program_id <> related_id), unique (program_id, related_id, relation));
create index if not exists idx_prel_program on public.program_relations(program_id);

create table if not exists public.program_versions (
  id uuid primary key default uuid_generate_v4(),
  program_id uuid not null references public.workout_programs(id) on delete cascade,
  version int not null, snapshot jsonb not null, changed_by uuid references auth.users(id) on delete set null,
  changed_by_name text, change_note text, created_at timestamptz not null default now(), unique (program_id, version));
create index if not exists idx_pver_program on public.program_versions(program_id, version desc);

create or replace function public.recompute_program_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid; begin pid := coalesce(new.program_id, old.program_id);
  update public.workout_programs p set
    rating_avg = coalesce((select round(avg(rating)::numeric,2) from public.program_ratings where program_id = pid),0),
    rating_count = (select count(*) from public.program_ratings where program_id = pid) where p.id = pid;
  return null; end; $$;
drop trigger if exists trg_program_rating on public.program_ratings;
create trigger trg_program_rating after insert or update or delete on public.program_ratings for each row execute function public.recompute_program_rating();

create or replace function public.recompute_program_favorites()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid; begin pid := coalesce(new.program_id, old.program_id);
  update public.workout_programs p set favorite_count = (select count(*) from public.program_favorites where program_id = pid) where p.id = pid;
  return null; end; $$;
drop trigger if exists trg_program_favorites on public.program_favorites;
create trigger trg_program_favorites after insert or delete on public.program_favorites for each row execute function public.recompute_program_favorites();

create or replace function public.recompute_program_progress()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid; total int; begin pid := coalesce(new.program_id, old.program_id);
  select count(*) into total from public.program_progress where program_id = pid;
  update public.workout_programs p set use_count = total,
    completion_rate = case when total = 0 then 0 else round(100.0 * (select count(*) from public.program_progress where program_id = pid and status = 'completed') / total, 2) end
  where p.id = pid; return null; end; $$;
drop trigger if exists trg_program_progress on public.program_progress;
create trigger trg_program_progress after insert or update or delete on public.program_progress for each row execute function public.recompute_program_progress();

alter table public.workout_programs enable row level security;
alter table public.workout_program_days enable row level security;
alter table public.workout_program_exercises enable row level security;
alter table public.program_categories enable row level security;
alter table public.program_tags enable row level security;
alter table public.program_relations enable row level security;
alter table public.program_versions enable row level security;
alter table public.program_favorites enable row level security;
alter table public.program_ratings enable row level security;
alter table public.program_progress enable row level security;
drop policy if exists "wprograms_select" on public.workout_programs;
create policy "wprograms_select" on public.workout_programs for select using (status = 'published' or public.has_admin_access(auth.uid()));
drop policy if exists "wprograms_admin_write" on public.workout_programs;
create policy "wprograms_admin_write" on public.workout_programs for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));
do $$ declare t text; begin
  foreach t in array array['workout_program_days','workout_program_exercises','program_categories','program_tags','program_relations'] loop
    execute format('drop policy if exists %I on public.%I', t||'_select', t);
    execute format('create policy %I on public.%I for select using (true)', t||'_select', t);
    execute format('drop policy if exists %I on public.%I', t||'_admin_write', t);
    execute format('create policy %I on public.%I for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()))', t||'_admin_write', t);
  end loop; end $$;
drop policy if exists "program_versions_admin" on public.program_versions;
create policy "program_versions_admin" on public.program_versions for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));
drop policy if exists "pfav_owner" on public.program_favorites;
create policy "pfav_owner" on public.program_favorites for all using (auth.uid() = user_id or public.has_admin_access(auth.uid())) with check (auth.uid() = user_id);
drop policy if exists "prating_select" on public.program_ratings;
create policy "prating_select" on public.program_ratings for select using (true);
drop policy if exists "prating_owner_write" on public.program_ratings;
create policy "prating_owner_write" on public.program_ratings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "pprog_owner" on public.program_progress;
create policy "pprog_owner" on public.program_progress for all using (auth.uid() = user_id or public.has_admin_access(auth.uid())) with check (auth.uid() = user_id);

-- ============================================================================
-- NUTRITION CMS (Sprint 18) — bkz. migrations/0017
-- Mevcut foods/nutrition_logs/meal_plans/shopping_lists korunur.
-- TÜRKOMP vb. entegrasyona hazır: external_id + external_source.
-- ============================================================================
alter table public.foods
  add column if not exists subcategory text, add column if not exists image_url text,
  add column if not exists external_id text, add column if not exists external_source text,
  add column if not exists glycemic_index int, add column if not exists allergens text[] not null default '{}',
  add column if not exists cholesterol_mg numeric(7,1) not null default 0,
  add column if not exists calcium_mg numeric(7,1) not null default 0,
  add column if not exists iron_mg numeric(7,2) not null default 0,
  add column if not exists magnesium_mg numeric(7,1) not null default 0,
  add column if not exists phosphorus_mg numeric(7,1) not null default 0,
  add column if not exists zinc_mg numeric(7,2) not null default 0,
  add column if not exists vitamin_a_mcg numeric(8,1) not null default 0,
  add column if not exists vitamin_b_mg numeric(7,2) not null default 0,
  add column if not exists vitamin_c_mg numeric(7,1) not null default 0,
  add column if not exists vitamin_d_mcg numeric(7,1) not null default 0,
  add column if not exists vitamin_e_mg numeric(7,1) not null default 0,
  add column if not exists vitamin_k_mcg numeric(7,1) not null default 0,
  add column if not exists omega3_g numeric(6,2) not null default 0,
  add column if not exists omega6_g numeric(6,2) not null default 0,
  add column if not exists water_g numeric(6,1) not null default 0,
  add column if not exists updated_at timestamptz not null default now();
create index if not exists idx_foods_brand on public.foods(brand);
create index if not exists idx_foods_external on public.foods(external_source, external_id);
create unique index if not exists uq_foods_external on public.foods(external_source, external_id) where external_id is not null;
create index if not exists idx_foods_updated on public.foods(updated_at desc);
create or replace function public.touch_food_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_foods_touch on public.foods;
create trigger trg_foods_touch before update on public.foods for each row execute function public.touch_food_updated_at();

create table if not exists public.food_categories (
  id uuid primary key default uuid_generate_v4(), slug text not null unique, name text not null,
  parent_slug text, sort_order int not null default 0, created_at timestamptz not null default now());
insert into public.food_categories (slug, name, sort_order) values
  ('meat','Et & Tavuk',1),('fish','Balık & Deniz',2),('dairy','Süt Ürünleri',3),
  ('vegetables','Sebzeler',4),('fruits','Meyveler',5),('grains','Tahıllar',6),
  ('legumes','Baklagiller',7),('nuts','Kuruyemiş',8),('oils','Yağlar',9),
  ('beverages','İçecekler',10),('snacks','Atıştırmalık',11),('bakery','Fırın',12),
  ('supplements','Takviyeler',13),('fastfood','Fast Food',14),('other','Diğer',15)
on conflict (slug) do nothing;

create table if not exists public.recipes (
  id uuid primary key default uuid_generate_v4(), slug text not null unique, name text not null,
  cover_url text, video_url text, description text, instructions text[] not null default '{}',
  servings int not null default 1, prep_minutes int, cook_minutes int,
  calories numeric(7,1) not null default 0, protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0, fat_g numeric(6,1) not null default 0,
  category text, tags text[] not null default '{}', status text not null default 'draft',
  favorite_count int not null default 0,
  created_by uuid references auth.users(id) on delete set null, updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists idx_recipes_status on public.recipes(status);
create index if not exists idx_recipes_category on public.recipes(category);
create index if not exists idx_recipes_updated on public.recipes(updated_at desc);
create index if not exists idx_recipes_tags on public.recipes using gin(tags);
create or replace function public.touch_recipe_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_recipes_touch on public.recipes;
create trigger trg_recipes_touch before update on public.recipes for each row execute function public.touch_recipe_updated_at();

create table if not exists public.recipe_ingredients (
  id uuid primary key default uuid_generate_v4(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  food_id uuid references public.foods(id) on delete set null,
  name text not null, grams numeric(7,1) not null default 100, note text,
  sort_order int not null default 0, created_at timestamptz not null default now());
create index if not exists idx_recipe_ing_recipe on public.recipe_ingredients(recipe_id, sort_order);

create table if not exists public.diet_plans (
  id uuid primary key default uuid_generate_v4(), slug text not null unique, name text not null,
  cover_url text, description text, goal text, category text,
  total_calories int, protein_g int, carbs_g int, fat_g int,
  days int not null default 7, tags text[] not null default '{}', status text not null default 'draft',
  favorite_count int not null default 0, use_count int not null default 0,
  created_by uuid references auth.users(id) on delete set null, updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists idx_diet_status on public.diet_plans(status);
create index if not exists idx_diet_category on public.diet_plans(category);
create index if not exists idx_diet_updated on public.diet_plans(updated_at desc);
create index if not exists idx_diet_tags on public.diet_plans using gin(tags);
create or replace function public.touch_diet_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_diet_touch on public.diet_plans;
create trigger trg_diet_touch before update on public.diet_plans for each row execute function public.touch_diet_updated_at();

create table if not exists public.diet_days (
  id uuid primary key default uuid_generate_v4(),
  plan_id uuid not null references public.diet_plans(id) on delete cascade,
  day int not null default 1, title text, notes text, sort_order int not null default 0,
  created_at timestamptz not null default now(), unique (plan_id, day));
create index if not exists idx_diet_days_plan on public.diet_days(plan_id, day);

create table if not exists public.meals (
  id uuid primary key default uuid_generate_v4(),
  day_id uuid not null references public.diet_days(id) on delete cascade,
  meal_type text not null default 'breakfast', title text, meal_time text,
  sort_order int not null default 0, created_at timestamptz not null default now());
create index if not exists idx_meals_day on public.meals(day_id, sort_order);

create table if not exists public.meal_foods (
  id uuid primary key default uuid_generate_v4(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  food_id uuid references public.foods(id) on delete set null,
  recipe_id uuid references public.recipes(id) on delete set null,
  name text not null, grams numeric(7,1) not null default 100, servings numeric(5,1),
  calories numeric(7,1) not null default 0, protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0, fat_g numeric(6,1) not null default 0,
  sort_order int not null default 0, created_at timestamptz not null default now());
create index if not exists idx_meal_foods_meal on public.meal_foods(meal_id, sort_order);

create table if not exists public.nutrition_favorites (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null, ref_id uuid not null, created_at timestamptz not null default now(),
  unique (user_id, kind, ref_id));
create index if not exists idx_nfav_user on public.nutrition_favorites(user_id, kind);
create index if not exists idx_nfav_ref on public.nutrition_favorites(kind, ref_id);

alter table public.profiles
  add column if not exists disliked_foods text[] not null default '{}',
  add column if not exists favorite_foods text[] not null default '{}',
  add column if not exists meals_per_day int,
  add column if not exists target_weight_kg numeric(5,1);

alter table public.food_categories enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.diet_plans enable row level security;
alter table public.diet_days enable row level security;
alter table public.meals enable row level security;
alter table public.meal_foods enable row level security;
alter table public.nutrition_favorites enable row level security;
drop policy if exists "recipes_select" on public.recipes;
create policy "recipes_select" on public.recipes for select using (status = 'published' or public.has_admin_access(auth.uid()));
drop policy if exists "recipes_admin_write" on public.recipes;
create policy "recipes_admin_write" on public.recipes for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));
drop policy if exists "diet_select" on public.diet_plans;
create policy "diet_select" on public.diet_plans for select using (status = 'published' or public.has_admin_access(auth.uid()));
drop policy if exists "diet_admin_write" on public.diet_plans;
create policy "diet_admin_write" on public.diet_plans for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));
do $$ declare t text; begin
  foreach t in array array['food_categories','recipe_ingredients','diet_days','meals','meal_foods'] loop
    execute format('drop policy if exists %I on public.%I', t||'_select', t);
    execute format('create policy %I on public.%I for select using (true)', t||'_select', t);
    execute format('drop policy if exists %I on public.%I', t||'_admin_write', t);
    execute format('create policy %I on public.%I for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()))', t||'_admin_write', t);
  end loop; end $$;
drop policy if exists "foods_admin_role_write" on public.foods;
create policy "foods_admin_role_write" on public.foods for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));
drop policy if exists "nfav_owner" on public.nutrition_favorites;
create policy "nfav_owner" on public.nutrition_favorites for all using (auth.uid() = user_id or public.has_admin_access(auth.uid())) with check (auth.uid() = user_id);

-- ============================================================================
-- POSTÜR ANALİZİ (Sprint 19) — bkz. migrations/0018
-- Mevcut posture_analyses korunur; normalize tablolar + gelişim takibi eklenir.
-- ============================================================================
alter table public.posture_analyses
  add column if not exists risk_level text,
  add column if not exists region_scores jsonb not null default '{}',
  add column if not exists muscle_analysis jsonb not null default '{}',
  add column if not exists keypoints jsonb,
  add column if not exists improvement_pct numeric(5,2),
  add column if not exists program_days int,
  add column if not exists country text,
  add column if not exists analysis_type text not null default 'photo';
create index if not exists idx_posture_user on public.posture_analyses(user_id, created_at desc);
create index if not exists idx_posture_risk on public.posture_analyses(risk_level);
create index if not exists idx_posture_created on public.posture_analyses(created_at desc);

create table if not exists public.posture_images (
  id uuid primary key default uuid_generate_v4(),
  analysis_id uuid not null references public.posture_analyses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  view text not null default 'front', storage_path text not null, width int, height int,
  created_at timestamptz not null default now());
create index if not exists idx_posture_images_analysis on public.posture_images(analysis_id);

create table if not exists public.posture_results (
  id uuid primary key default uuid_generate_v4(),
  analysis_id uuid not null references public.posture_analyses(id) on delete cascade,
  problem text not null, label text not null, risk text not null default 'moderate',
  confidence int not null default 70, description text,
  short_muscles text[] not null default '{}', weak_muscles text[] not null default '{}',
  overactive_muscles text[] not null default '{}', inhibited_muscles text[] not null default '{}',
  created_at timestamptz not null default now());
create index if not exists idx_posture_results_analysis on public.posture_results(analysis_id);
create index if not exists idx_posture_results_problem on public.posture_results(problem);

create table if not exists public.posture_scores (
  id uuid primary key default uuid_generate_v4(),
  analysis_id uuid not null references public.posture_analyses(id) on delete cascade,
  region text not null, status text not null default 'normal', score int not null default 100,
  created_at timestamptz not null default now());
create index if not exists idx_posture_scores_analysis on public.posture_scores(analysis_id);
create index if not exists idx_posture_scores_region on public.posture_scores(region);

create table if not exists public.corrective_programs (
  id uuid primary key default uuid_generate_v4(),
  analysis_id uuid references public.posture_analyses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  environment environment_type not null default 'both', days int not null default 3,
  total_minutes int not null default 0, plan jsonb not null default '{}',
  created_at timestamptz not null default now());
create index if not exists idx_corr_programs_analysis on public.corrective_programs(analysis_id);
create index if not exists idx_corr_programs_user on public.corrective_programs(user_id, created_at desc);

create table if not exists public.corrective_exercises (
  id uuid primary key default uuid_generate_v4(),
  program_id uuid not null references public.corrective_programs(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  day int not null default 1, section text not null default 'mobilization',
  name text not null, english_name text, equipment text,
  sets int, reps text, rest_sec int, duration_sec int, gif_url text,
  sort_order int not null default 0, created_at timestamptz not null default now());
create index if not exists idx_corr_ex_program on public.corrective_exercises(program_id, day, sort_order);

create table if not exists public.analysis_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid not null references public.posture_analyses(id) on delete cascade,
  posture_score int not null default 0, risk_level text, program_days int, improvement_pct numeric(5,2),
  created_at timestamptz not null default now());
create index if not exists idx_analysis_history_user on public.analysis_history(user_id, created_at desc);

alter table public.posture_images enable row level security;
alter table public.posture_results enable row level security;
alter table public.posture_scores enable row level security;
alter table public.corrective_programs enable row level security;
alter table public.corrective_exercises enable row level security;
alter table public.analysis_history enable row level security;
drop policy if exists "posture_images_owner" on public.posture_images;
create policy "posture_images_owner" on public.posture_images for all using (auth.uid() = user_id or public.has_admin_access(auth.uid())) with check (auth.uid() = user_id);
drop policy if exists "corr_programs_owner" on public.corrective_programs;
create policy "corr_programs_owner" on public.corrective_programs for all using (auth.uid() = user_id or public.has_admin_access(auth.uid())) with check (auth.uid() = user_id);
drop policy if exists "analysis_history_owner" on public.analysis_history;
create policy "analysis_history_owner" on public.analysis_history for all using (auth.uid() = user_id or public.has_admin_access(auth.uid())) with check (auth.uid() = user_id);
drop policy if exists "posture_results_access" on public.posture_results;
create policy "posture_results_access" on public.posture_results for all using (public.has_admin_access(auth.uid()) or exists (select 1 from public.posture_analyses a where a.id = analysis_id and a.user_id = auth.uid())) with check (exists (select 1 from public.posture_analyses a where a.id = analysis_id and a.user_id = auth.uid()));
drop policy if exists "posture_scores_access" on public.posture_scores;
create policy "posture_scores_access" on public.posture_scores for all using (public.has_admin_access(auth.uid()) or exists (select 1 from public.posture_analyses a where a.id = analysis_id and a.user_id = auth.uid())) with check (exists (select 1 from public.posture_analyses a where a.id = analysis_id and a.user_id = auth.uid()));
drop policy if exists "corr_ex_access" on public.corrective_exercises;
create policy "corr_ex_access" on public.corrective_exercises for all using (public.has_admin_access(auth.uid()) or exists (select 1 from public.corrective_programs p where p.id = program_id and p.user_id = auth.uid())) with check (exists (select 1 from public.corrective_programs p where p.id = program_id and p.user_id = auth.uid()));
drop policy if exists "posture_admin_select" on public.posture_analyses;
create policy "posture_admin_select" on public.posture_analyses for select using (public.has_admin_access(auth.uid()));

-- ============================================================================
-- AI FITNESS COACH (Sprint 20) — bkz. migrations/0019
-- Mevcut ai_conversations / ai_messages korunur ve genişletilir.
-- ============================================================================
alter table public.ai_conversations
  add column if not exists archived boolean not null default false,
  add column if not exists pinned boolean not null default false,
  add column if not exists model text,
  add column if not exists last_message_at timestamptz;
create index if not exists idx_ai_conv_archived on public.ai_conversations(user_id, archived, updated_at desc);
alter table public.ai_messages
  add column if not exists edited boolean not null default false,
  add column if not exists tokens int,
  add column if not exists model text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.ai_memory (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  summary text, facts jsonb not null default '[]',
  updated_at timestamptz not null default now(), created_at timestamptz not null default now());

create table if not exists public.ai_prompt_versions (
  id uuid primary key default uuid_generate_v4(),
  key text not null default 'coach_system', version int not null default 1, content text not null,
  is_active boolean not null default false, notes text,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
  unique (key, version));
create index if not exists idx_ai_prompt_active on public.ai_prompt_versions(key, is_active);

create table if not exists public.ai_usage (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  model text, prompt_tokens int not null default 0, completion_tokens int not null default 0,
  total_tokens int not null default 0, created_at timestamptz not null default now());
create index if not exists idx_ai_usage_created on public.ai_usage(created_at desc);
create index if not exists idx_ai_usage_user on public.ai_usage(user_id, created_at desc);

create table if not exists public.ai_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  level text not null default 'info', event text not null, detail jsonb not null default '{}',
  created_at timestamptz not null default now());
create index if not exists idx_ai_logs_created on public.ai_logs(created_at desc);
create index if not exists idx_ai_logs_level on public.ai_logs(level);

alter table public.profiles
  add column if not exists ai_consent boolean not null default true,
  add column if not exists sleep_hours_last numeric(3,1);

alter table public.ai_memory enable row level security;
alter table public.ai_prompt_versions enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_logs enable row level security;
drop policy if exists "ai_memory_owner" on public.ai_memory;
create policy "ai_memory_owner" on public.ai_memory for all using (auth.uid() = user_id or public.has_admin_access(auth.uid())) with check (auth.uid() = user_id);
drop policy if exists "ai_prompt_read" on public.ai_prompt_versions;
create policy "ai_prompt_read" on public.ai_prompt_versions for select using (true);
drop policy if exists "ai_prompt_admin_write" on public.ai_prompt_versions;
create policy "ai_prompt_admin_write" on public.ai_prompt_versions for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));
drop policy if exists "ai_usage_access" on public.ai_usage;
create policy "ai_usage_access" on public.ai_usage for select using (auth.uid() = user_id or public.has_admin_access(auth.uid()));
drop policy if exists "ai_usage_insert_own" on public.ai_usage;
create policy "ai_usage_insert_own" on public.ai_usage for insert with check (auth.uid() = user_id);
drop policy if exists "ai_logs_admin_read" on public.ai_logs;
create policy "ai_logs_admin_read" on public.ai_logs for select using (public.has_admin_access(auth.uid()));
drop policy if exists "ai_logs_insert_own" on public.ai_logs;
create policy "ai_logs_insert_own" on public.ai_logs for insert with check (auth.uid() = user_id or user_id is null);
insert into public.ai_prompt_versions (key, version, content, is_active, notes)
select 'coach_system', 1, 'Sen "Viva", Türkçe konuşan, bilimsel temelli ve motive edici bir kişisel fitness ve beslenme koçusun. Önerilerini yalnızca kullanıcının profil ve uygulama verilerine dayandır. Kesin tıbbi teşhis koyma; yaralanma/ağrı durumunda kullanıcıyı bir sağlık profesyoneline yönlendir. Takviye ve ilaç konularında kesin ifadeler kullanma.', true, 'Varsayılan (seed)'
where not exists (select 1 from public.ai_prompt_versions where key = 'coach_system');

-- ============================================================================
-- UYGULAMA AYARLARI (Sprint 21) — bkz. migrations/0020
-- ============================================================================
create table if not exists public.app_settings (
  key text primary key, value jsonb not null default '{}',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now());
insert into public.app_settings (key, value) values
  ('ai', '{"provider":"openai","max_tokens":900,"temperature":0.7}'),
  ('features', '{"ai_coach":true,"posture":true,"nutrition":true,"programs":true}'),
  ('site', '{"maintenance":false,"registration_open":true,"support_email":"destek@viva.app"}')
on conflict (key) do nothing;
alter table public.app_settings enable row level security;
drop policy if exists "app_settings_read" on public.app_settings;
create policy "app_settings_read" on public.app_settings for select using (true);
drop policy if exists "app_settings_admin_write" on public.app_settings;
create policy "app_settings_admin_write" on public.app_settings for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));


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


-- ============================================================================
-- Migration 0022 — Production Hardening (Sprint 10)
-- Kullanıcı ayarları, push token, hata logları, ödeme olayları, hesap silme.
-- Additive + idempotent; mevcut yapıyı bozmaz. Yeni ürün özelliği değil, altyapı.
-- ============================================================================

-- 1) user_settings — profil dışı tercihler (tema/dil/birim/bildirim/gizlilik) --
create table if not exists public.user_settings (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  theme        text not null default 'system',   -- system | light | dark
  locale       text not null default 'tr',        -- tr | en
  units        text not null default 'metric',    -- metric | imperial
  notif_prefs  jsonb not null default '{}',        -- { workout:true, water:true, ... }
  privacy      jsonb not null default '{}',        -- { profile_public:false, leaderboard_visible:true, ... }
  updated_at   timestamptz not null default now()
);

-- 2) push_tokens — FCM cihaz token'ları -------------------------------------
create table if not exists public.push_tokens (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null,
  platform   text not null default 'web',   -- web | ios | android
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (token)
);
create index if not exists idx_push_tokens_user on public.push_tokens (user_id) where active;

-- 3) error_logs — crash reporting / log sistemi -----------------------------
create table if not exists public.error_logs (
  id         uuid primary key default uuid_generate_v4(),
  message    text not null,
  stack      text,
  where_at   text,
  severity   text not null default 'error',  -- info | warning | error | fatal
  user_id    uuid references auth.users(id) on delete set null,
  extra      jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_error_logs_created on public.error_logs (created_at desc);
create index if not exists idx_error_logs_severity on public.error_logs (severity, created_at desc);

-- 4) billing_events — ödeme webhook idempotency + denetim -------------------
create table if not exists public.billing_events (
  id         uuid primary key default uuid_generate_v4(),
  event_id   text not null unique,
  provider   text not null default 'manual',
  type       text not null,
  user_id    uuid references auth.users(id) on delete set null,
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_billing_events_user on public.billing_events (user_id, created_at desc);

-- 5) account_deletion_requests — KVKK/GDPR unutulma hakkı -------------------
create table if not exists public.account_deletion_requests (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  reason       text,
  status       text not null default 'pending',  -- pending | processed | canceled
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists idx_deletion_requests_status on public.account_deletion_requests (status, requested_at);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.user_settings              enable row level security;
alter table public.push_tokens                enable row level security;
alter table public.error_logs                 enable row level security;
alter table public.billing_events             enable row level security;
alter table public.account_deletion_requests  enable row level security;

-- user_settings: sahip tam yönetir, admin görür.
drop policy if exists "user_settings_own" on public.user_settings;
create policy "user_settings_own" on public.user_settings
  for all using (auth.uid() = user_id or public.has_admin_access(auth.uid()))
  with check (auth.uid() = user_id or public.has_admin_access(auth.uid()));

-- push_tokens: sahip tam yönetir.
drop policy if exists "push_tokens_own" on public.push_tokens;
create policy "push_tokens_own" on public.push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- error_logs: yalnızca admin okuyabilir (yazma service_role ile).
drop policy if exists "error_logs_admin_read" on public.error_logs;
create policy "error_logs_admin_read" on public.error_logs
  for select using (public.has_admin_access(auth.uid()));

-- billing_events: yalnızca admin okuyabilir (yazma service_role ile).
drop policy if exists "billing_events_admin_read" on public.billing_events;
create policy "billing_events_admin_read" on public.billing_events
  for select using (public.has_admin_access(auth.uid()));

-- account_deletion_requests: sahip oluşturur/görür, admin yönetir.
drop policy if exists "deletion_req_own" on public.account_deletion_requests;
create policy "deletion_req_own" on public.account_deletion_requests
  for select using (auth.uid() = user_id or public.has_admin_access(auth.uid()));
drop policy if exists "deletion_req_insert" on public.account_deletion_requests;
create policy "deletion_req_insert" on public.account_deletion_requests
  for insert with check (auth.uid() = user_id);
drop policy if exists "deletion_req_admin" on public.account_deletion_requests;
create policy "deletion_req_admin" on public.account_deletion_requests
  for update using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));


-- ============================================================================
-- Migration 0023 — Denetim düzeltmeleri
-- reward_claims: kozmetik ödüllerin tekrar alınmasını engelle (idempotent).
-- ============================================================================

-- Tüketilen ödüller (premium gün gibi) 'consumed' işaretlenir; kozmetik/kalıcı
-- ödüller 'active' kalır. Kısmi tekil index yalnızca 'active' talepleri kapsar,
-- böylece premium tekrar satın alınabilirken kozmetik ödül iki kez alınamaz.
create unique index if not exists uq_reward_claims_active
  on public.reward_claims (user_id, reward_id)
  where status = 'active';


-- ============================================================================
-- Migration 0024 — AI Dietitian (Profesyonel Diyetisyen)
-- Nutrition Score, tercihler, hafıza, öğün analizi, tarif geçmişi.
-- Additive + idempotent; mevcut nutrition/AI mimarisini bozmaz.
-- (nutrition_reports ve shopping_lists zaten mevcut — yeniden oluşturulmaz.)
-- ============================================================================

-- 1) nutrition_scores — günlük 0-100 beslenme skoru geçmişi -----------------
create table if not exists public.nutrition_scores (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  score_date date not null default current_date,
  score      int  not null default 0,
  breakdown  jsonb not null default '{}',   -- {protein, calorie, macros, water, variety, regularity, processed}
  ai_comment text,
  created_at timestamptz not null default now(),
  unique (user_id, score_date)
);
create index if not exists idx_nutrition_scores_user on public.nutrition_scores (user_id, score_date desc);

-- 2) nutrition_preferences — diyetisyenin kişiselleştirme profili -----------
create table if not exists public.nutrition_preferences (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  activity_level     text,
  weekly_training     int,
  daily_steps        int,
  sleep_hours        numeric(3,1),
  meals_per_day      int,
  dietary_preference text,                       -- omnivore | vegetarian | vegan | pescatarian | keto | ...
  allergies          text[] not null default '{}',
  disliked_foods     text[] not null default '{}',
  favorite_foods     text[] not null default '{}',
  supplements        text[] not null default '{}',
  digestion_issues   text[] not null default '{}',
  health_notes       text,
  budget_weekly      numeric(8,2),
  cooks_at_home      boolean,
  work_hours         text,
  target_weight_kg   numeric(5,1),
  updated_at         timestamptz not null default now()
);

-- 3) nutrition_memory — AI'ın hatırladığı serbest notlar --------------------
create table if not exists public.nutrition_memory (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  fact       text not null,
  source     text not null default 'ai',   -- ai | user
  created_at timestamptz not null default now()
);
create index if not exists idx_nutrition_memory_user on public.nutrition_memory (user_id, created_at desc);

-- 4) meal_analysis — akıllı öğün analizi sonuçları --------------------------
create table if not exists public.meal_analysis (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  input_text   text not null,
  items        jsonb not null default '[]',
  calories     numeric(7,1) not null default 0,
  protein_g    numeric(6,1) not null default 0,
  carbs_g      numeric(6,1) not null default 0,
  fat_g        numeric(6,1) not null default 0,
  fiber_g      numeric(6,1) not null default 0,
  score        int not null default 0,
  assessment   text,
  alternatives jsonb not null default '[]',
  source       text not null default 'rule',   -- ai | rule
  created_at   timestamptz not null default now()
);
create index if not exists idx_meal_analysis_user on public.meal_analysis (user_id, created_at desc);

-- 5) recipe_history — önerilen/kullanılan tarifler ---------------------------
create table if not exists public.recipe_history (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  recipe_id   uuid references public.recipes(id) on delete set null,
  title       text not null,
  source      text not null default 'cms',   -- cms | pantry | ai
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists idx_recipe_history_user on public.recipe_history (user_id, created_at desc);

-- ============================================================================
-- RLS — hepsi kullanıcıya özel (sahip yönetir, admin okur)
-- ============================================================================
alter table public.nutrition_scores      enable row level security;
alter table public.nutrition_preferences enable row level security;
alter table public.nutrition_memory      enable row level security;
alter table public.meal_analysis         enable row level security;
alter table public.recipe_history        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['nutrition_scores','nutrition_preferences','nutrition_memory','meal_analysis','recipe_history'] loop
    execute format('drop policy if exists "%1$s_own" on public.%1$s', t);
    execute format('create policy "%1$s_own" on public.%1$s for all using (auth.uid() = user_id or public.has_admin_access(auth.uid())) with check (auth.uid() = user_id or public.has_admin_access(auth.uid()))', t);
  end loop;
end $$;

-- ============================================================================
-- app_settings — AI Diyetisyen sistem promptu (admin yönetimi)
-- ============================================================================
insert into public.app_settings (key, value)
values ('nutrition_ai', jsonb_build_object(
  'system_prompt', 'Sen Viva uygulamasının profesyonel yapay zeka diyetisyenisin. Kullanıcının gerçek verilerine (profil, öğün kayıtları, su, antrenman, hedefler) göre kişiselleştirilmiş, kanıta dayalı beslenme rehberliği sunarsın. Kesin tıbbi teşhis koymaz, hastalık tedavisi/ilaç önermez, kesin kilo garantisi vermezsin. Belirsiz durumlarda açıklayıcı sorular sorarsın. Restoran isimleri için besin değeri uydurmaz, kullanıcıdan ürün seçmesini ister veya mevcut veritabanını kullanırsın. Takviyelerde yalnızca genel bilgi verir, gerektiğinde sağlık profesyoneline yönlendirirsin.',
  'temperature', 0.6,
  'max_tokens', 900
))
on conflict (key) do nothing;


-- ============================================================================
-- Migration 0025 — Exercise Media Set (Profesyonel Medya Yönetimi)
-- Egzersiz başına konsolide medya kaydı: thumbnail/gif/video + cinsiyet
-- varyantları + otomatik durum. Mevcut çok-satırlı exercise_media (galeri)
-- tablosu KORUNUR; bu tablo per-egzersiz ana medya kaydıdır.
-- Additive + idempotent; mevcut Exercise CMS'i bozmaz.
-- ============================================================================

create table if not exists public.exercise_media_set (
  id            uuid primary key default uuid_generate_v4(),
  exercise_id   uuid not null unique references public.exercises(id) on delete cascade,
  thumbnail_url text,
  gif_url       text,
  video_url     text,
  male_gif      text,
  female_gif    text,
  male_video    text,
  female_video  text,
  status        text not null default 'none',   -- complete | partial | none (trigger ile)
  updated_at    timestamptz not null default now()
);
create index if not exists idx_exercise_media_set_status on public.exercise_media_set (status);

-- Durum otomasyonu: her insert/update'te medya alanlarından hesaplanır.
create or replace function public.set_exercise_media_status()
returns trigger language plpgsql as $$
declare has_gif boolean; has_video boolean; has_thumb boolean; any_media boolean;
begin
  has_gif   := coalesce(new.gif_url,'') <> '' or (coalesce(new.male_gif,'') <> '' and coalesce(new.female_gif,'') <> '');
  has_video := coalesce(new.video_url,'') <> '' or (coalesce(new.male_video,'') <> '' and coalesce(new.female_video,'') <> '');
  has_thumb := coalesce(new.thumbnail_url,'') <> '';
  any_media := has_thumb or has_gif or has_video
    or coalesce(new.gif_url,'') <> '' or coalesce(new.video_url,'') <> ''
    or coalesce(new.male_gif,'') <> '' or coalesce(new.female_gif,'') <> ''
    or coalesce(new.male_video,'') <> '' or coalesce(new.female_video,'') <> '';
  if not any_media then new.status := 'none';
  elsif has_thumb and has_gif and has_video then new.status := 'complete';
  else new.status := 'partial';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_exercise_media_status on public.exercise_media_set;
create trigger trg_exercise_media_status
  before insert or update on public.exercise_media_set
  for each row execute function public.set_exercise_media_status();

-- RLS: herkes okur (uygulama medyayı gösterir), yalnızca admin yazar.
alter table public.exercise_media_set enable row level security;

drop policy if exists "exercise_media_set_read" on public.exercise_media_set;
create policy "exercise_media_set_read" on public.exercise_media_set
  for select using (auth.role() = 'authenticated');

drop policy if exists "exercise_media_set_admin_write" on public.exercise_media_set;
create policy "exercise_media_set_admin_write" on public.exercise_media_set
  for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));

-- exercise-media bucket zaten public (migration 0012). CDN URL:
--   <SUPABASE_URL>/storage/v1/object/public/exercise-media/<path>
-- İleride AI ile üretilen medya da aynı sütunlara (gif_url/video_url/...) bağlanır.
