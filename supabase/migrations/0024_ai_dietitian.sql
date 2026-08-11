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
