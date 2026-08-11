-- ============================================================================
-- Migration 0012 — Kendi Medya Sistemi (GIF öncelikli) + YouTube kaldırma (Sprint 13)
-- exercises.media_type ('gif' | 'animation' | 'video') — ilk sürümde yalnız 'gif'.
-- Tüm YouTube (video_url) verisi temizlenir. GIF'ler için exercise-media bucket.
-- Mevcut yapıyı bozmaz.
-- ============================================================================

-- Medya tipi (ilk sürüm: hepsi gif). Video/animasyon altyapıda hazır, gizli.
alter table public.exercises
  add column if not exists media_type text not null default 'gif';

-- YouTube linklerini tamamen temizle.
update public.exercises set video_url = null where video_url is not null;

-- Egzersiz GIF'leri için public bucket (kendi medya sistemi).
insert into storage.buckets (id, name, public)
values ('exercise-media', 'exercise-media', true) on conflict (id) do nothing;

drop policy if exists "exercise_media_public_read" on storage.objects;
create policy "exercise_media_public_read" on storage.objects for select
  using (bucket_id = 'exercise-media');
drop policy if exists "exercise_media_admin_insert" on storage.objects;
create policy "exercise_media_admin_insert" on storage.objects for insert
  with check (bucket_id = 'exercise-media' and public.is_admin(auth.uid()));
drop policy if exists "exercise_media_admin_delete" on storage.objects;
create policy "exercise_media_admin_delete" on storage.objects for delete
  using (bucket_id = 'exercise-media' and public.is_admin(auth.uid()));
