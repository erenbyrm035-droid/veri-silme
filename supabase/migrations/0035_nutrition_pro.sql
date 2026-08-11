-- ============================================================================
-- Migration 0035 — Nutrition AI PRO (Sprint: Nutrition AI Pro)
-- Profesyonel diyetisyen altyapısı. Mevcut foods/recipes/diet_plans/meal_plans/
-- shopping_lists/nutrition_reports KORUNUR. Additive + idempotent.
--
-- Getirir:
--   1) Bulanık arama (pg_trgm) + search_foods() RPC  (10k+ besinde <100ms)
--   2) food_brands (marka kataloğu) + foods.brand_id
--   3) restaurant_foods (restoran/fast-food menü değerleri)
--   4) nutrition_memory (AI hafızası: sevilen/sevilmeyen/alerji/not)
--   5) food_images (besin görselleri — çoklu)
--   6) recipe_categories (tarif kategorileri) + recipes ölçek alanları
--   7) foods.tags + arama yardımcı kolonları
-- ============================================================================

-- 0) Eklentiler ---------------------------------------------------------------
create extension if not exists pg_trgm;

-- 1) foods: arama + etiket alanları ------------------------------------------
alter table public.foods
  add column if not exists tags          text[] not null default '{}',
  add column if not exists is_restaurant boolean not null default false,
  add column if not exists popularity     int not null default 0;

-- Bulanık arama için GIN trigram index'leri (lower(name) + marka).
create index if not exists idx_foods_name_trgm on public.foods using gin (lower(name) gin_trgm_ops);
create index if not exists idx_foods_brand_trgm on public.foods using gin (lower(coalesce(brand,'')) gin_trgm_ops);
create index if not exists idx_foods_tags_gin on public.foods using gin (tags);
create index if not exists idx_foods_popularity on public.foods(popularity desc);

-- 2) Marka kataloğu -----------------------------------------------------------
create table if not exists public.food_brands (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  name text not null,
  category text,                       -- supplement | supermarket | food | restaurant
  logo_url text,
  country text default 'TR',
  created_at timestamptz not null default now()
);
create index if not exists idx_food_brands_cat on public.food_brands(category);

alter table public.foods
  add column if not exists brand_id uuid references public.food_brands(id) on delete set null;
create index if not exists idx_foods_brand_id on public.foods(brand_id);

-- 3) Restoran / fast-food menü değerleri --------------------------------------
create table if not exists public.restaurant_foods (
  id uuid primary key default uuid_generate_v4(),
  restaurant text not null,            -- ör. "Burger King", "McDonald's"
  item_name text not null,
  category text,                       -- burger | tavuk | yan | tatlı | içecek
  calories numeric(7,1) not null default 0,
  protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  serving_desc text,
  serving_grams numeric(6,1),
  is_estimated boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_rest_foods_rest on public.restaurant_foods(restaurant);
create index if not exists idx_rest_foods_name_trgm on public.restaurant_foods using gin (lower(item_name) gin_trgm_ops);
create unique index if not exists uq_rest_foods on public.restaurant_foods(lower(restaurant), lower(item_name));

-- 4) AI Hafızası: nutrition_memory ZATEN 0024'te var (fact/source kolonları).
--    Etiketleme için opsiyonel 'kind' + öncelik 'weight' kolonları ekle.
alter table public.nutrition_memory
  add column if not exists kind   text not null default 'note',   -- like|dislike|allergy|goal|note|habit
  add column if not exists weight int  not null default 1;
create index if not exists idx_nmem_user_kind on public.nutrition_memory(user_id, kind);

-- 5) Besin görselleri (çoklu) -------------------------------------------------
create table if not exists public.food_images (
  id uuid primary key default uuid_generate_v4(),
  food_id uuid not null references public.foods(id) on delete cascade,
  url text not null,
  is_primary boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_food_images_food on public.food_images(food_id, sort_order);

-- 6) Tarif kategorileri -------------------------------------------------------
create table if not exists public.recipe_categories (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique, name text not null,
  sort_order int not null default 0, created_at timestamptz not null default now()
);
insert into public.recipe_categories (slug, name, sort_order) values
  ('breakfast','Kahvaltı',1),('lunch','Öğle',2),('dinner','Akşam',3),
  ('snack','Snack',4),('dessert','Tatlı',5),('smoothie','Smoothie',6),
  ('protein','Protein Tarifleri',7)
on conflict (slug) do nothing;

-- 7) Bulanık arama RPC --------------------------------------------------------
-- Sıralama: tam eşleşme > önek > içerir > trigram benzerliği; popülerlik tie-break.
-- security definer: RLS'e takılmadan hızlı okuma (foods zaten herkese açık).
create or replace function public.search_foods(q text, lim int default 20)
returns table (
  id uuid, name text, brand text, category text,
  calories numeric, protein_g numeric, carbs_g numeric, fat_g numeric,
  fiber_g numeric, serving_desc text, serving_grams numeric,
  is_turkish boolean, is_restaurant boolean, score real
)
language sql stable security definer set search_path = public as $$
  with needle as (select lower(trim(q)) as t)
  select f.id, f.name, f.brand, f.category,
         f.calories, f.protein_g, f.carbs_g, f.fat_g,
         f.fiber_g, f.serving_desc, f.serving_grams,
         f.is_turkish, f.is_restaurant,
         (
           case when lower(f.name) = (select t from needle) then 1.0
                when lower(f.name) like (select t from needle) || '%' then 0.8
                when lower(f.name) like '%' || (select t from needle) || '%' then 0.6
                else 0 end
           + similarity(lower(f.name), (select t from needle)) * 0.4
           + least(f.popularity, 100) / 1000.0
         )::real as score
  from public.foods f, needle
  where (select t from needle) = ''
     or lower(f.name) like '%' || (select t from needle) || '%'
     or lower(coalesce(f.brand,'')) like '%' || (select t from needle) || '%'
     or lower(f.name) % (select t from needle)
  order by score desc, f.popularity desc, f.name asc
  limit greatest(1, least(lim, 50));
$$;

grant execute on function public.search_foods(text, int) to anon, authenticated;

-- 8) RLS ----------------------------------------------------------------------
alter table public.food_brands       enable row level security;
alter table public.restaurant_foods  enable row level security;
alter table public.food_images       enable row level security;
alter table public.recipe_categories enable row level security;

-- Katalog içerik: herkes okur, admin yazar.
do $$ declare t text; begin
  foreach t in array array['food_brands','restaurant_foods','food_images','recipe_categories'] loop
    execute format('drop policy if exists %I on public.%I', t||'_select', t);
    execute format('create policy %I on public.%I for select using (true)', t||'_select', t);
    execute format('drop policy if exists %I on public.%I', t||'_admin_write', t);
    execute format('create policy %I on public.%I for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()))', t||'_admin_write', t);
  end loop; end $$;

