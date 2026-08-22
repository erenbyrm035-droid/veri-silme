-- ============================================================================
-- TABAN ŞEMA — migration'ların üzerine kurulduğu, ama sürüm kontrolünde
-- OLMAYAN tablolar.
--
-- NEDEN VAR: supabase/migrations/ altındaki 53 dosya 122 tablo yaratıyor, ama
-- 10 çekirdek tablo hiçbirinde yok — bunlar Supabase panelinden elle
-- yaratılmış. Sonuç: depo tek başına veritabanını kuramıyor. Ne staging
-- ortamı kurulabiliyor, ne yeni geliştirici ortamı, ne de felaket kurtarma
-- Supabase yedeğinden bağımsız yapılabiliyor.
--
-- BU DOSYA `src/lib/database.types.ts`TEN ÇIKARILDI. Sütun adları ve
-- null'lanabilirlik oradan geliyor. DOĞRULANDI: bu taban + 53 migration
-- temiz Postgres 16 üzerinde uygulanıyor (bkz. docs/kapasite-notlari.md).
--
-- YİNE DE ÜRETİMİN BİREBİR KOPYASI DEĞİL:
--   - İndeksler yalnızca migration'larda görünenler kadar; taban tablolarda
--     panelden eklenmiş indeksler varsa burada yok.
--   - Sütun tipleri (numeric ölçek, text vs varchar) tipten türetildi.
--   - Kısıtlar (check/unique) yalnızca kodun ima ettikleri.
--
-- ÜRETİME UYGULANMAZ. Amacı yerel/staging ortamı kurmak. Üretimle farkı
-- görmek için:
--   pg_dump --schema-only --schema=public "$PROD_URL" > uretim.sql
-- ve bu dosyayla diff'leyin.
-- ============================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname='gender_type') then
    create type gender_type as enum ('male','female','other'); end if;
  if not exists (select 1 from pg_type where typname='goal_type') then
    create type goal_type as enum ('lose_weight','gain_muscle','get_fit','improve_endurance'); end if;
  if not exists (select 1 from pg_type where typname='experience_type') then
    create type experience_type as enum ('beginner','intermediate','advanced'); end if;
  if not exists (select 1 from pg_type where typname='environment_type') then
    create type environment_type as enum ('home','gym'); end if;
  if not exists (select 1 from pg_type where typname='difficulty_type') then
    create type difficulty_type as enum ('beginner','intermediate','advanced'); end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, avatar_url text,
  age int, gender gender_type,
  height_cm numeric, weight_kg numeric, starting_weight_kg numeric,
  body_fat_pct numeric, sleep_hours numeric,
  injuries text[] not null default '{}',
  available_equipment text[] not null default '{}',
  goal goal_type, experience experience_type,
  weekly_training_days int,
  training_environment environment_type,
  daily_calorie_goal int not null default 2000,
  daily_protein_goal int not null default 120,
  daily_water_goal_ml int not null default 2500,
  daily_step_goal int not null default 8000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle_group text not null,
  description text,
  difficulty difficulty_type not null default 'beginner',
  equipment text,
  secondary_muscles text[] not null default '{}',
  tempo text, rec_sets int, rec_reps text, rec_rest_sec int,
  common_mistakes text[] not null default '{}',
  correct_form text,
  tips text[] not null default '{}',
  ai_notes text,
  gif_url text, image_url text, video_url text,
  is_home boolean not null default true,
  is_gym boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  workout_date date not null default current_date,
  status text not null default 'planned',
  notes text,
  duration_min int,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text not null,
  set_order int not null default 1,
  reps int, weight_kg numeric,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric, waist_cm numeric, arm_cm numeric,
  chest_cm numeric, shoulder_cm numeric, leg_cm numeric,
  photo_url text, notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  serving_desc text,
  is_turkish boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid references public.foods(id) on delete set null,
  food_name text not null,
  meal text not null default 'breakfast',
  log_date date not null default current_date,
  grams numeric not null default 100,
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  amount_ml int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Sohbet',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'user',
  content text not null,
  created_at timestamptz not null default now()
);

-- Taban şemadaki admin sütunu ve yetki fonksiyonu.
-- 0013 bunları VAR SAYIYOR: `where is_admin = true` diyor ve
-- has_admin_access'i bunun üzerine kuruyor. is_admin() fonksiyonunu ise
-- hiçbir migration yaratmıyor — 0002/0003/0011/0012 doğrudan çağırıyor.
alter table public.profiles add column if not exists is_admin boolean not null default false;
-- 0014'ün admin_users görünümü bu sütunu okuyor ama yaratmıyor.
alter table public.profiles add column if not exists onboarding_completed boolean not null default false;

create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce((select is_admin from public.profiles where id = uid), false)
$fn$;

-- Kodun beklediği, migration'ların ima ettiği indeksler.
create index if not exists idx_workouts_user_date on public.workouts(user_id, workout_date desc);
create index if not exists idx_workout_sets_workout on public.workout_sets(workout_id);
create index if not exists idx_body_meas_user_date on public.body_measurements(user_id, measured_on desc);
create index if not exists idx_nutrition_user_date on public.nutrition_logs(user_id, log_date desc);
create index if not exists idx_water_user_date on public.water_logs(user_id, log_date desc);
create index if not exists idx_ai_msg_conv on public.ai_messages(conversation_id, created_at);
