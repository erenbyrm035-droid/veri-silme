-- ============================================================================
-- Migration 0005 — Progress v2 (Sprint 5)
-- Ek ölçüler (omuz/bacak) + vücut fotoğrafları + private Storage bucket.
-- Idempotent.
-- ============================================================================

-- Ek ölçüler
alter table public.body_measurements
  add column if not exists shoulder_cm numeric(5,1),
  add column if not exists leg_cm      numeric(5,1);

-- Vücut fotoğrafları (metadata; dosya Storage'da)
do $$ begin
  create type photo_angle as enum ('front', 'side', 'back');
exception when duplicate_object then null; end $$;

create table if not exists public.body_photos (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  taken_on    date not null default current_date,
  storage_path text not null,
  angle       photo_angle not null default 'front',
  created_at  timestamptz not null default now()
);

create index if not exists idx_body_photos_user on public.body_photos(user_id, taken_on desc);

alter table public.body_photos enable row level security;
drop policy if exists "body_photos_owner" on public.body_photos;
create policy "body_photos_owner" on public.body_photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- Storage bucket (private) ----
insert into storage.buckets (id, name, public)
values ('body-photos', 'body-photos', false)
on conflict (id) do nothing;

-- Storage RLS: kullanıcı yalnızca kendi klasörüne (userId/...) erişir.
drop policy if exists "body_photos_read_own" on storage.objects;
create policy "body_photos_read_own" on storage.objects
  for select using (
    bucket_id = 'body-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "body_photos_insert_own" on storage.objects;
create policy "body_photos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'body-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "body_photos_delete_own" on storage.objects;
create policy "body_photos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'body-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
