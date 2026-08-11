-- ============================================================================
-- Migration 0010 — AI Nutrition Coach (AI Diyetisyen) (Sprint 10)
-- profiles sağlık/diyet alanları + makro hedefleri; foods zengin alanlar +
-- barkod + kategori (ölçeklenebilir Türk besin DB); meal_plans, shopping_lists,
-- nutrition_reports, meal_photos + storage. Mevcut yapıyı bozmaz.
-- ============================================================================

-- 1) Profil: sağlık, diyet tercihleri, mikro/makro hedefleri
alter table public.profiles
  add column if not exists muscle_mass_kg       numeric(5,1),
  add column if not exists activity_level        text,          -- sedentary/light/moderate/active/athlete
  add column if not exists daily_step_count       int,
  add column if not exists dietary_preferences    text[] not null default '{}',
  add column if not exists allergies              text[] not null default '{}',
  add column if not exists health_conditions      text[] not null default '{}',
  add column if not exists medications            text[] not null default '{}',
  add column if not exists nutrition_goal         text,          -- gain_muscle/lose_fat/maintain/performance/strength/endurance/healthy
  add column if not exists daily_carb_goal        int,
  add column if not exists daily_fat_goal         int,
  add column if not exists daily_fiber_goal       int;

-- 2) Foods: ölçeklenebilir Türk besin veritabanı + barkod altyapısı
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

-- 3) AI öğün planları
create table if not exists public.meal_plans (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text not null default 'AI Beslenme Planı',
  goal            text,
  target_calories int,
  target_protein  int,
  target_carbs    int,
  target_fat      int,
  plan            jsonb not null default '{}',   -- {meals:[{slot,recipe,calories,protein,...}]}
  created_at      timestamptz not null default now()
);
create index if not exists idx_meal_plans_user on public.meal_plans(user_id, created_at desc);
alter table public.meal_plans enable row level security;
drop policy if exists "meal_plans_owner" on public.meal_plans;
create policy "meal_plans_owner" on public.meal_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4) Alışveriş listeleri (kategori bazlı)
create table if not exists public.shopping_lists (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  plan_id     uuid references public.meal_plans(id) on delete set null,
  title       text not null default 'Alışveriş Listesi',
  items       jsonb not null default '[]',   -- [{category, items:[...]}]
  created_at  timestamptz not null default now()
);
create index if not exists idx_shopping_user on public.shopping_lists(user_id, created_at desc);
alter table public.shopping_lists enable row level security;
drop policy if exists "shopping_owner" on public.shopping_lists;
create policy "shopping_owner" on public.shopping_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5) Haftalık beslenme raporları
create table if not exists public.nutrition_reports (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  week_start    date not null default current_date,
  scores        jsonb not null default '{}',   -- {nutrition,protein,calorie,water,macro,training}
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

-- 6) Yemek fotoğrafları (gelecekte AI görüntü analizi) + storage
create table if not exists public.meal_photos (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  recognized   jsonb not null default '{}',   -- {name, calories, protein, carbs, fat, confidence}
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
