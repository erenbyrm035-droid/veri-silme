-- ============================================================================
-- Migration 0011 — Exercise Animation Engine altyapısı (Sprint 12)
-- animations (yeniden kullanılabilir 3D animasyon tanımları) +
-- animation_mapping (egzersiz ↔ animasyon, cinsiyet + öncelik) + storage.
-- Gerçek .glb dosyaları YOK; placeholder kayıtlar. 2000+ egzersize ölçeklenir.
-- Mevcut yapıyı bozmaz.
-- ============================================================================

-- Yeniden kullanılabilir animasyon tanımları (bir animasyon N egzersizce kullanılır)
create table if not exists public.animations (
  id              uuid primary key default uuid_generate_v4(),
  animation_key   text not null unique,          -- ör. 'bench_press' (mapping anahtarı)
  name            text not null,                 -- görünen ad
  url             text,                          -- .glb yolu/URL (null = placeholder)
  duration_sec    numeric(6,2),                  -- animation_duration
  loop            boolean not null default true, -- animation_loop
  thumbnail_url   text,                          -- animation_thumbnail
  camera_position jsonb not null default '{"x":0,"y":1.4,"z":3.2}'::jsonb, -- camera_position
  gender_support  text not null default 'both',  -- 'male' | 'female' | 'both'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_animations_key on public.animations(animation_key);

-- Egzersiz ↔ animasyon eşlemesi (cinsiyet + öncelik)
create table if not exists public.animation_mapping (
  id           uuid primary key default uuid_generate_v4(),
  exercise_id  uuid not null references public.exercises(id) on delete cascade,
  animation_id uuid not null references public.animations(id) on delete cascade,
  gender       text not null default 'both',   -- 'male' | 'female' | 'both'
  priority     int  not null default 100,      -- düşük = yüksek öncelik
  created_at   timestamptz not null default now(),
  unique (exercise_id, animation_id, gender)
);
create index if not exists idx_anim_map_exercise on public.animation_mapping(exercise_id, priority);

-- RLS
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

-- Storage: .glb animasyonları için public bucket (tarayıcıda GLTFLoader ile yüklenir)
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

-- Placeholder animasyon tanımları (url null → placeholder karakter oynar)
insert into public.animations (animation_key, name, duration_sec, loop, gender_support) values
  ('bench_press',          'Bench Press',            3.0, true, 'both'),
  ('bench_press_machine',  'Machine Chest Press',    3.0, true, 'both'),
  ('push_up',              'Push-Up',                2.5, true, 'both'),
  ('squat',                'Squat',                  3.0, true, 'both'),
  ('deadlift',             'Deadlift',               3.5, true, 'both'),
  ('shoulder_press',       'Shoulder Press',         3.0, true, 'both'),
  ('lateral_raise',        'Lateral Raise',          2.5, true, 'both'),
  ('biceps_curl',          'Biceps Curl',            2.5, true, 'both'),
  ('triceps_extension',    'Triceps Extension',      2.5, true, 'both'),
  ('row',                  'Row',                    3.0, true, 'both'),
  ('lat_pulldown',         'Lat Pulldown',           3.0, true, 'both'),
  ('pull_up',              'Pull-Up',                3.0, true, 'both'),
  ('lunge',                'Lunge',                  3.0, true, 'both'),
  ('leg_press',            'Leg Press',              3.0, true, 'both'),
  ('plank',                'Plank',                  4.0, true, 'both'),
  ('crunch',               'Crunch',                 2.5, true, 'both'),
  ('calf_raise',           'Calf Raise',             2.0, true, 'both'),
  ('hip_thrust',           'Hip Thrust',             3.0, true, 'both'),
  ('generic_idle',         'Genel (Idle)',           4.0, true, 'both')
on conflict (animation_key) do nothing;
