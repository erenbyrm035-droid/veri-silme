-- ============================================================================
-- TABAN ŞEMA — migration'ların üzerine kurulduğu, ama sürüm kontrolünde
-- OLMAYAN 10 tablo.
--
-- NEDEN VAR: supabase/migrations/ altındaki 54 dosya 122 tablo yaratıyor, ama
-- bu 10 tablo hiçbirinde yok — Supabase panelinden elle yaratılmışlar.
-- Sonuç: depo tek başına veritabanını kuramıyordu. Ne staging ortamı, ne yeni
-- geliştirici ortamı, ne de Supabase yedeğinden bağımsız felaket kurtarma.
--
-- KAYNAK: ÜRETİM VERİTABANINDAN alındı (pg_catalog sorgusuyla, 2026-08-22).
-- Tahmin değil — sütun tipleri, ölçekler (numeric(5,1)), varsayılanlar,
-- kısıtlar ve indeksler üretimde ne ise o.
--
-- DOĞRULANDI: bu taban + 54 migration temiz PostgreSQL 16 üzerinde 54/54
-- uygulanıyor (bkz. docs/kapasite-notlari.md).
-- ============================================================================

-- --- Enum tipleri ----------------------------------------------------------
-- Bunlar da taban şemada; migration'lar yalnızca değer EKLİYOR
-- (0008: gain_strength/both · 0029: professional/outdoor). Buradaki listeler
-- üretimdeki NİHAİ hâli, çünkü tablo varsayılanları o değerlere atıf yapıyor
-- (ör. exercises.environment default 'both').
--
-- exercise_category'yi 0002 de yaratıyor ama `exception when duplicate_object`
-- ile korumalı — burada yaratılmış olması sorun değil.
do $$ begin
  create type gender_type      as enum ('male','female','other');
exception when duplicate_object then null; end $$;
do $$ begin
  create type goal_type        as enum ('lose_weight','gain_muscle','get_fit','improve_endurance','gain_strength');
exception when duplicate_object then null; end $$;
do $$ begin
  create type experience_type  as enum ('beginner','intermediate','advanced','professional');
exception when duplicate_object then null; end $$;
do $$ begin
  create type environment_type as enum ('home','gym','both','outdoor');
exception when duplicate_object then null; end $$;
do $$ begin
  create type difficulty_type  as enum ('beginner','intermediate','advanced');
exception when duplicate_object then null; end $$;
do $$ begin
  create type workout_status   as enum ('planned','in_progress','completed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type meal_type        as enum ('breakfast','lunch','dinner','snack');
exception when duplicate_object then null; end $$;
do $$ begin
  create type chat_role        as enum ('user','assistant','system');
exception when duplicate_object then null; end $$;
do $$ begin
  create type exercise_category as enum ('isolation','compound','functional','mobility','stretch','rehab');
exception when duplicate_object then null; end $$;

-- --- Tablolar --------------------------------------------------------------

create table if not exists public.profiles (
  id uuid not null,
  full_name text,
  age integer,
  gender gender_type,
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  starting_weight_kg numeric(5,1),
  body_fat_pct numeric(4,1),
  sleep_hours numeric(3,1),
  injuries text[] not null default '{}'::text[],
  available_equipment text[] not null default '{}'::text[],
  goal goal_type,
  experience experience_type,
  weekly_training_days integer,
  training_environment environment_type,
  daily_calorie_goal integer default 2000,
  daily_protein_goal integer default 120,
  daily_water_goal_ml integer default 2500,
  daily_step_goal integer default 8000,
  is_admin boolean not null default false,
  onboarding_completed boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  avatar_url text,
  muscle_mass_kg numeric(5,1),
  activity_level text,
  daily_step_count integer,
  dietary_preferences text[] not null default '{}'::text[],
  allergies text[] not null default '{}'::text[],
  health_conditions text[] not null default '{}'::text[],
  medications text[] not null default '{}'::text[],
  nutrition_goal text,
  daily_carb_goal integer,
  daily_fat_goal integer,
  daily_fiber_goal integer,
  admin_role text,
  is_premium boolean not null default false,
  premium_until timestamp with time zone,
  membership_type text not null default 'free'::text,
  is_banned boolean not null default false,
  banned_at timestamp with time zone,
  ban_reason text,
  is_active boolean not null default true,
  phone text,
  disliked_foods text[] not null default '{}'::text[],
  favorite_foods text[] not null default '{}'::text[],
  meals_per_day integer,
  target_weight_kg numeric(5,1),
  ai_consent boolean not null default true,
  sleep_hours_last numeric(3,1),
  country text,
  city text,
  gym text,
  goals text[] not null default '{}'::text[],
  birth_date date,
  occupation text,
  daily_sitting_hours numeric,
  preferred_workout_duration integer,
  water_intake_ml integer,
  smoking_status text,
  health_notes text,
  bio text,
  daily_sleep_goal_min integer default 450
);

create table if not exists public.exercises (
  id uuid not null default uuid_generate_v4(),
  name text not null,
  muscle_group text not null,
  description text,
  video_url text,
  difficulty difficulty_type not null default 'beginner'::difficulty_type,
  equipment text,
  category exercise_category not null default 'compound'::exercise_category,
  secondary_muscles text[] not null default '{}'::text[],
  tempo text,
  rec_sets integer,
  rec_reps text,
  rec_rest_sec integer,
  common_mistakes text[] not null default '{}'::text[],
  correct_form text,
  tips text[] not null default '{}'::text[],
  ai_notes text,
  gif_url text,
  image_url text,
  is_home boolean not null default false,
  is_gym boolean not null default true,
  created_at timestamp with time zone not null default now(),
  slug text,
  movement_type text,
  thumbnail_url text,
  primary_muscles text[] not null default '{}'::text[],
  calories integer,
  english_name text,
  body_region text,
  stabilizer_muscles text[] not null default '{}'::text[],
  mobility_focus text[] not null default '{}'::text[],
  rehabilitation_focus text[] not null default '{}'::text[],
  exercise_goal text[] not null default '{}'::text[],
  environment environment_type not null default 'both'::environment_type,
  instructions text[] not null default '{}'::text[],
  breathing text,
  range_of_motion text,
  regressions text[] not null default '{}'::text[],
  progressions text[] not null default '{}'::text[],
  average_duration_sec integer,
  updated_at timestamp with time zone not null default now(),
  media_type text not null default 'gif'::text,
  status text not null default 'published'::text,
  subcategory text,
  tags text[] not null default '{}'::text[],
  seo_title text,
  seo_description text,
  og_image_url text,
  start_position text,
  end_position text,
  updated_by uuid,
  aliases text[] not null default '{}'::text[],
  video_slug text
);

create table if not exists public.workouts (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null,
  title text not null default 'Antrenman'::text,
  workout_date date not null default CURRENT_DATE,
  status workout_status not null default 'planned'::workout_status,
  notes text,
  duration_min integer,
  created_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone
);

create table if not exists public.workout_sets (
  id uuid not null default uuid_generate_v4(),
  workout_id uuid not null,
  exercise_id uuid,
  exercise_name text not null,
  set_order integer not null default 1,
  reps integer,
  weight_kg numeric(6,2),
  completed boolean not null default false,
  created_at timestamp with time zone not null default now(),
  target_reps integer,
  rir integer,
  rpe numeric(3,1),
  rest_sec integer,
  notes text
);

create table if not exists public.body_measurements (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null,
  measured_on date not null default CURRENT_DATE,
  weight_kg numeric(5,1),
  waist_cm numeric(5,1),
  arm_cm numeric(5,1),
  chest_cm numeric(5,1),
  shoulder_cm numeric(5,1),
  leg_cm numeric(5,1),
  photo_url text,
  notes text,
  created_at timestamp with time zone not null default now()
);

-- NOT: `brand_id` sütunu ve food_brands'e giden FK burada YOK — onları
-- 0035_nutrition_pro.sql ekliyor (food_brands tablosunu da o yaratıyor).
-- Burada tanımlansaydı, henüz var olmayan bir tabloya referans verirdi.
create table if not exists public.foods (
  id uuid not null default uuid_generate_v4(),
  name text not null,
  calories numeric(6,1) not null,
  protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  serving_desc text default '100 g'::text,
  is_turkish boolean not null default true,
  created_at timestamp with time zone not null default now(),
  fiber_g numeric(6,1) not null default 0,
  sugar_g numeric(6,1) not null default 0,
  sodium_mg numeric(7,1) not null default 0,
  potassium_mg numeric(7,1) not null default 0,
  category text,
  brand text,
  barcode text,
  serving_grams numeric(6,1) default 100,
  is_verified boolean not null default false,
  source text default 'seed'::text,
  subcategory text,
  image_url text,
  external_id text,
  external_source text,
  glycemic_index integer,
  allergens text[] not null default '{}'::text[],
  cholesterol_mg numeric(7,1) not null default 0,
  calcium_mg numeric(7,1) not null default 0,
  iron_mg numeric(7,2) not null default 0,
  magnesium_mg numeric(7,1) not null default 0,
  phosphorus_mg numeric(7,1) not null default 0,
  zinc_mg numeric(7,2) not null default 0,
  vitamin_a_mcg numeric(8,1) not null default 0,
  vitamin_b_mg numeric(7,2) not null default 0,
  vitamin_c_mg numeric(7,1) not null default 0,
  vitamin_d_mcg numeric(7,1) not null default 0,
  vitamin_e_mg numeric(7,1) not null default 0,
  vitamin_k_mcg numeric(7,1) not null default 0,
  omega3_g numeric(6,2) not null default 0,
  omega6_g numeric(6,2) not null default 0,
  water_g numeric(6,1) not null default 0,
  updated_at timestamp with time zone not null default now(),
  tags text[] not null default '{}'::text[],
  is_restaurant boolean not null default false,
  popularity integer not null default 0
);

create table if not exists public.nutrition_logs (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null,
  food_id uuid,
  food_name text not null,
  meal meal_type not null default 'lunch'::meal_type,
  log_date date not null default CURRENT_DATE,
  grams numeric(7,1) not null default 100,
  calories numeric(7,1) not null default 0,
  protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.water_logs (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null,
  log_date date not null default CURRENT_DATE,
  amount_ml integer not null default 250,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.ai_conversations (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null,
  title text not null default 'Yeni Sohbet'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  archived boolean not null default false,
  pinned boolean not null default false,
  model text,
  last_message_at timestamp with time zone
);

create table if not exists public.ai_messages (
  id uuid not null default uuid_generate_v4(),
  conversation_id uuid not null,
  user_id uuid not null,
  role chat_role not null,
  content text not null,
  created_at timestamp with time zone not null default now(),
  edited boolean not null default false,
  tokens integer,
  model text,
  updated_at timestamp with time zone not null default now()
);

-- --- Kısıtlar --------------------------------------------------------------
-- `add constraint`in IF NOT EXISTS'i yok; tekrar çalıştırılabilsin diye
-- duplicate_object yakalanıyor.
do $$ begin
  alter table public.profiles add constraint profiles_pkey primary key (id);
  alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
  alter table public.profiles add constraint profiles_age_check check (((age >= 10) and (age <= 120)));
  alter table public.profiles add constraint profiles_body_fat_pct_check check (((body_fat_pct >= (3)::numeric) and (body_fat_pct <= (70)::numeric)));
  alter table public.profiles add constraint profiles_height_cm_check check (((height_cm >= (80)::numeric) and (height_cm <= (260)::numeric)));
  alter table public.profiles add constraint profiles_sleep_hours_check check (((sleep_hours >= (0)::numeric) and (sleep_hours <= (24)::numeric)));
  alter table public.profiles add constraint profiles_weekly_training_days_check check (((weekly_training_days >= 1) and (weekly_training_days <= 7)));
  alter table public.profiles add constraint profiles_weight_kg_check check (((weight_kg >= (25)::numeric) and (weight_kg <= (400)::numeric)));
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  alter table public.exercises add constraint exercises_pkey primary key (id);
  alter table public.exercises add constraint exercises_name_key unique (name);
  alter table public.exercises add constraint exercises_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  alter table public.workouts add constraint workouts_pkey primary key (id);
  alter table public.workouts add constraint workouts_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  alter table public.workout_sets add constraint workout_sets_pkey primary key (id);
  alter table public.workout_sets add constraint workout_sets_workout_id_fkey foreign key (workout_id) references public.workouts(id) on delete cascade;
  alter table public.workout_sets add constraint workout_sets_exercise_id_fkey foreign key (exercise_id) references public.exercises(id) on delete set null;
  alter table public.workout_sets add constraint workout_sets_rir_range check (((rir is null) or ((rir >= 0) and (rir <= 10))));
  alter table public.workout_sets add constraint workout_sets_rpe_range check (((rpe is null) or ((rpe >= (1)::numeric) and (rpe <= (10)::numeric))));
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  alter table public.body_measurements add constraint body_measurements_pkey primary key (id);
  alter table public.body_measurements add constraint body_measurements_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  alter table public.foods add constraint foods_pkey primary key (id);
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  alter table public.nutrition_logs add constraint nutrition_logs_pkey primary key (id);
  alter table public.nutrition_logs add constraint nutrition_logs_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
  alter table public.nutrition_logs add constraint nutrition_logs_food_id_fkey foreign key (food_id) references public.foods(id) on delete set null;
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  alter table public.water_logs add constraint water_logs_pkey primary key (id);
  alter table public.water_logs add constraint water_logs_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  alter table public.ai_conversations add constraint ai_conversations_pkey primary key (id);
  alter table public.ai_conversations add constraint ai_conversations_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  alter table public.ai_messages add constraint ai_messages_pkey primary key (id);
  alter table public.ai_messages add constraint ai_messages_conversation_id_fkey foreign key (conversation_id) references public.ai_conversations(id) on delete cascade;
  alter table public.ai_messages add constraint ai_messages_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
exception when duplicate_object or duplicate_table then null; end $$;

-- --- İndeksler -------------------------------------------------------------
create index if not exists idx_profiles_admin_role   on public.profiles (admin_role);
create index if not exists idx_profiles_city         on public.profiles (lower(city));
create index if not exists idx_profiles_country      on public.profiles (lower(country));
create index if not exists idx_profiles_created_at   on public.profiles (created_at desc);
create index if not exists idx_profiles_full_name    on public.profiles (lower(full_name));
create index if not exists idx_profiles_gym          on public.profiles (lower(gym));
create index if not exists idx_profiles_is_active    on public.profiles (is_active);
create index if not exists idx_profiles_is_banned    on public.profiles (is_banned);
create index if not exists idx_profiles_is_premium   on public.profiles (is_premium);

create index if not exists idx_exercises_aliases      on public.exercises using gin (aliases);
create index if not exists idx_exercises_category     on public.exercises (category);
create index if not exists idx_exercises_english_name on public.exercises (lower(english_name));
create index if not exists idx_exercises_env          on public.exercises (environment);
create index if not exists idx_exercises_mov          on public.exercises (movement_type);
create index if not exists idx_exercises_name_lower   on public.exercises (lower(name));
create index if not exists idx_exercises_status       on public.exercises (status);
create index if not exists idx_exercises_tags         on public.exercises using gin (tags);
create index if not exists idx_exercises_updated_at   on public.exercises (updated_at desc);
create index if not exists idx_exercises_video_slug   on public.exercises (video_slug);
create unique index if not exists uq_exercises_slug   on public.exercises (slug);

create index if not exists idx_workouts_user_date        on public.workouts (user_id, workout_date desc);
create index if not exists idx_workouts_user_date_status on public.workouts (user_id, workout_date) where (status = 'completed'::workout_status);

create index if not exists idx_workout_sets_workout on public.workout_sets (workout_id);

create index if not exists idx_measurements_user_date on public.body_measurements (user_id, measured_on desc);

create index if not exists idx_foods_brand       on public.foods (brand);
create index if not exists idx_foods_brand_trgm  on public.foods using gin (lower(coalesce(brand, ''::text)) gin_trgm_ops);
create index if not exists idx_foods_category    on public.foods (category);
create index if not exists idx_foods_external    on public.foods (external_source, external_id);
create index if not exists idx_foods_name        on public.foods (lower(name));
create index if not exists idx_foods_name_trgm   on public.foods using gin (lower(name) gin_trgm_ops);
create index if not exists idx_foods_popularity  on public.foods (popularity desc);
create index if not exists idx_foods_tags_gin    on public.foods using gin (tags);
create index if not exists idx_foods_updated     on public.foods (updated_at desc);
create unique index if not exists uq_foods_barcode    on public.foods (barcode) where (barcode is not null);
create unique index if not exists uq_foods_external   on public.foods (external_source, external_id) where (external_id is not null);
create unique index if not exists uq_foods_name_lower on public.foods (lower(name));

create index if not exists idx_nutrition_logs_user_date on public.nutrition_logs (user_id, log_date);
create index if not exists idx_nutrition_user_date      on public.nutrition_logs (user_id, log_date desc);

create index if not exists idx_water_logs_user_date on public.water_logs (user_id, log_date);
create index if not exists idx_water_user_date      on public.water_logs (user_id, log_date desc);

create index if not exists idx_ai_conv_archived      on public.ai_conversations (user_id, archived, updated_at desc);
create index if not exists idx_ai_conversations_user on public.ai_conversations (user_id, updated_at desc);
create index if not exists idx_ai_messages_conversation on public.ai_messages (conversation_id, created_at);

-- --- Eksik yardımcı fonksiyon ----------------------------------------------
-- `public.is_admin(uuid)` hiçbir migration'da yaratılmıyor ama 0002, 0003,
-- 0011 ve 0012 doğrudan çağırıyor. Üretimde var; gövdesi buraya
-- YENİDEN YAZILDI (fonksiyon gövdeleri şema sorgusuna dahil değildi).
-- Davranışı: profiles.is_admin sütununu okur.
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce((select p.is_admin from public.profiles p where p.id = uid), false)
$fn$;
