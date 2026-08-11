-- ============================================================================
-- Migration 0030 — Profil Merkezi
-- Avatar yükleme için 'avatars' public bucket + RLS, profiles.bio alanı.
-- Idempotent.
-- ============================================================================

-- Bio alanı
alter table public.profiles add column if not exists bio text;

-- Avatar bucket (public okuma, kullanıcı kendi klasörüne yazar)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Politikalar: dosya yolu "<user_id>/..." biçiminde; kullanıcı yalnızca
-- kendi klasörünü yönetir. Okuma herkese açık (public bucket).
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
