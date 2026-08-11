-- ============================================================================
-- Migration 0036 — AI Diyetisyen V3 (İnteraktif Görüşme)
-- AI artık doğrudan plan üretmez; önce kullanıcıyla görüşme yapar (interview),
-- cevapları hafızada tutar (smart memory), sonra kişiselleştirilmiş plan üretir.
-- Additive + idempotent.
-- ============================================================================

-- 1) dietitian_profiles — görüşme cevapları (akıllı hafıza) ------------------
--    answers jsonb: { goal, height_cm, weight_kg, age, gender, training_days,
--    training_time, wake_time, sleep_time, meals_per_day, breakfast, favorites,
--    dislikes, allergies, intolerances, conditions, supplements, budget,
--    cooking, pantry, water_l, sitting_hours, occupation, weekend_diff, cheat }
create table if not exists public.dietitian_profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  answers     jsonb not null default '{}',
  completed   boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- 2) dietitian_plans — üretilen kişiselleştirilmiş planlar -------------------
--    plan jsonb: { days:[{day, meals:[{slot,name,grams,calories,protein,carbs,
--    fat,prep_min,recipe,alternatives}]}] }
--    shopping jsonb: [{category, items:[string]}]
create table if not exists public.dietitian_plans (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  span        int  not null default 7,          -- 7 | 14 | 30
  analysis    text,                              -- diyetisyenin analizi (düz metin)
  plan        jsonb not null default '{}',
  shopping    jsonb not null default '[]',
  targets     jsonb not null default '{}',       -- {calories,protein,carbs,fat}
  created_at  timestamptz not null default now()
);
create index if not exists idx_dietitian_plans_user
  on public.dietitian_plans (user_id, created_at desc);

-- ============================================================================
-- RLS — kullanıcıya özel (sahip yönetir, admin okur)
-- ============================================================================
alter table public.dietitian_profiles enable row level security;
alter table public.dietitian_plans    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['dietitian_profiles','dietitian_plans'] loop
    execute format('drop policy if exists "%1$s_own" on public.%1$s', t);
    execute format('create policy "%1$s_own" on public.%1$s for all using (auth.uid() = user_id or public.has_admin_access(auth.uid())) with check (auth.uid() = user_id or public.has_admin_access(auth.uid()))', t);
  end loop;
end $$;
