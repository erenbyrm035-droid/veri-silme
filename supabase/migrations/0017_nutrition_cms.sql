-- ============================================================================
-- Migration 0017 — Nutrition CMS (Sprint 18)
-- Profesyonel besin veritabanı + tarif + diyet planı yönetimi.
-- Mevcut foods / nutrition_logs / meal_plans / shopping_lists KORUNUR.
-- Türkiye besin veritabanı (TÜRKOMP vb.) entegrasyonuna hazır: external_id +
-- external_source alanları + toplu API güncelleme için esnek şema.
-- Additive + idempotent.
-- ============================================================================

-- 1) foods: profesyonel besin alanları ----------------------------------------
alter table public.foods
  add column if not exists subcategory      text,
  add column if not exists image_url        text,
  add column if not exists external_id      text,          -- ör. TÜRKOMP kodu
  add column if not exists external_source  text,          -- ör. 'turkomp', 'usda', 'openfoodfacts'
  add column if not exists glycemic_index   int,
  add column if not exists allergens        text[] not null default '{}',
  add column if not exists cholesterol_mg   numeric(7,1) not null default 0,
  add column if not exists calcium_mg       numeric(7,1) not null default 0,
  add column if not exists iron_mg          numeric(7,2) not null default 0,
  add column if not exists magnesium_mg     numeric(7,1) not null default 0,
  add column if not exists phosphorus_mg    numeric(7,1) not null default 0,
  add column if not exists zinc_mg          numeric(7,2) not null default 0,
  add column if not exists vitamin_a_mcg    numeric(8,1) not null default 0,
  add column if not exists vitamin_b_mg     numeric(7,2) not null default 0,
  add column if not exists vitamin_c_mg     numeric(7,1) not null default 0,
  add column if not exists vitamin_d_mcg    numeric(7,1) not null default 0,
  add column if not exists vitamin_e_mg     numeric(7,1) not null default 0,
  add column if not exists vitamin_k_mcg    numeric(7,1) not null default 0,
  add column if not exists omega3_g         numeric(6,2) not null default 0,
  add column if not exists omega6_g         numeric(6,2) not null default 0,
  add column if not exists water_g          numeric(6,1) not null default 0,
  add column if not exists updated_at       timestamptz not null default now();

create index if not exists idx_foods_brand      on public.foods(brand);
create index if not exists idx_foods_external    on public.foods(external_source, external_id);
create unique index if not exists uq_foods_external on public.foods(external_source, external_id)
  where external_id is not null;
create index if not exists idx_foods_updated     on public.foods(updated_at desc);

create or replace function public.touch_food_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_foods_touch on public.foods;
create trigger trg_foods_touch before update on public.foods
  for each row execute function public.touch_food_updated_at();

-- 2) Besin kategorileri --------------------------------------------------------
create table if not exists public.food_categories (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique, name text not null, parent_slug text,
  sort_order int not null default 0, created_at timestamptz not null default now()
);
insert into public.food_categories (slug, name, sort_order) values
  ('meat','Et & Tavuk',1),('fish','Balık & Deniz',2),('dairy','Süt Ürünleri',3),
  ('vegetables','Sebzeler',4),('fruits','Meyveler',5),('grains','Tahıllar',6),
  ('legumes','Baklagiller',7),('nuts','Kuruyemiş',8),('oils','Yağlar',9),
  ('beverages','İçecekler',10),('snacks','Atıştırmalık',11),('bakery','Fırın',12),
  ('supplements','Takviyeler',13),('fastfood','Fast Food',14),('other','Diğer',15)
on conflict (slug) do nothing;

-- 3) Tarifler ------------------------------------------------------------------
create table if not exists public.recipes (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique, name text not null,
  cover_url text, video_url text, description text,
  instructions text[] not null default '{}',
  servings int not null default 1,
  prep_minutes int, cook_minutes int,
  calories numeric(7,1) not null default 0,
  protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  category text, tags text[] not null default '{}',
  status text not null default 'draft',
  favorite_count int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
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
  name text not null, grams numeric(7,1) not null default 100,
  note text, sort_order int not null default 0, created_at timestamptz not null default now()
);
create index if not exists idx_recipe_ing_recipe on public.recipe_ingredients(recipe_id, sort_order);

-- 4) Diyet planları (kütüphane) ------------------------------------------------
create table if not exists public.diet_plans (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique, name text not null,
  cover_url text, description text, goal text, category text,
  total_calories int, protein_g int, carbs_g int, fat_g int,
  days int not null default 7, tags text[] not null default '{}',
  status text not null default 'draft',
  favorite_count int not null default 0, use_count int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
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
  day int not null default 1, title text, notes text,
  sort_order int not null default 0, created_at timestamptz not null default now(),
  unique (plan_id, day)
);
create index if not exists idx_diet_days_plan on public.diet_days(plan_id, day);

create table if not exists public.meals (
  id uuid primary key default uuid_generate_v4(),
  day_id uuid not null references public.diet_days(id) on delete cascade,
  meal_type text not null default 'breakfast',
    -- breakfast|snack|lunch|pre_workout|post_workout|dinner|supper
  title text, meal_time text, sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_meals_day on public.meals(day_id, sort_order);

create table if not exists public.meal_foods (
  id uuid primary key default uuid_generate_v4(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  food_id uuid references public.foods(id) on delete set null,
  recipe_id uuid references public.recipes(id) on delete set null,
  name text not null, grams numeric(7,1) not null default 100, servings numeric(5,1),
  calories numeric(7,1) not null default 0, protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0, fat_g numeric(6,1) not null default 0,
  sort_order int not null default 0, created_at timestamptz not null default now()
);
create index if not exists idx_meal_foods_meal on public.meal_foods(meal_id, sort_order);

-- 5) Beslenme favorileri (besin / tarif / diyet) -------------------------------
create table if not exists public.nutrition_favorites (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,          -- food | recipe | diet
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);
create index if not exists idx_nfav_user on public.nutrition_favorites(user_id, kind);
create index if not exists idx_nfav_ref on public.nutrition_favorites(kind, ref_id);

-- 6) AI Diyetisyen altyapısı: profil alanları ---------------------------------
alter table public.profiles
  add column if not exists disliked_foods   text[] not null default '{}',
  add column if not exists favorite_foods   text[] not null default '{}',
  add column if not exists meals_per_day    int,
  add column if not exists target_weight_kg numeric(5,1);

-- 7) RLS -----------------------------------------------------------------------
alter table public.food_categories    enable row level security;
alter table public.recipes            enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.diet_plans         enable row level security;
alter table public.diet_days          enable row level security;
alter table public.meals              enable row level security;
alter table public.meal_foods         enable row level security;
alter table public.nutrition_favorites enable row level security;

-- Yayına bağlı içerik: yayında olanı herkes, adminler hepsini.
drop policy if exists "recipes_select" on public.recipes;
create policy "recipes_select" on public.recipes for select using (status = 'published' or public.has_admin_access(auth.uid()));
drop policy if exists "recipes_admin_write" on public.recipes;
create policy "recipes_admin_write" on public.recipes for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));

drop policy if exists "diet_select" on public.diet_plans;
create policy "diet_select" on public.diet_plans for select using (status = 'published' or public.has_admin_access(auth.uid()));
drop policy if exists "diet_admin_write" on public.diet_plans;
create policy "diet_admin_write" on public.diet_plans for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));

-- Diğer içerik: herkes okur, admin yazar.
do $$ declare t text; begin
  foreach t in array array['food_categories','recipe_ingredients','diet_days','meals','meal_foods'] loop
    execute format('drop policy if exists %I on public.%I', t||'_select', t);
    execute format('create policy %I on public.%I for select using (true)', t||'_select', t);
    execute format('drop policy if exists %I on public.%I', t||'_admin_write', t);
    execute format('create policy %I on public.%I for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()))', t||'_admin_write', t);
  end loop; end $$;

-- foods yazımı admin_role sahiplerine de açık (mevcut is_admin politikası korunur).
drop policy if exists "foods_admin_role_write" on public.foods;
create policy "foods_admin_role_write" on public.foods
  for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));

-- Favoriler: sahibi yönetir, adminler görür.
drop policy if exists "nfav_owner" on public.nutrition_favorites;
create policy "nfav_owner" on public.nutrition_favorites
  for all using (auth.uid() = user_id or public.has_admin_access(auth.uid())) with check (auth.uid() = user_id);
