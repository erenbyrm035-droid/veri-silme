-- ============================================================================
-- Migration 0026 — exercise-media Storage yükleme izni düzeltmesi
-- Eski policy is_admin() (yalnızca profiles.is_admin) kullanıyordu; admin_role
-- ile admin olan kullanıcılar (super_admin/admin/editor) yükleme yapamıyordu.
-- has_admin_access() ile değiştirilir. Idempotent.
-- ============================================================================

drop policy if exists "exercise_media_admin_insert" on storage.objects;
create policy "exercise_media_admin_insert" on storage.objects for insert
  with check (bucket_id = 'exercise-media' and public.has_admin_access(auth.uid()));

drop policy if exists "exercise_media_admin_update" on storage.objects;
create policy "exercise_media_admin_update" on storage.objects for update
  using (bucket_id = 'exercise-media' and public.has_admin_access(auth.uid()))
  with check (bucket_id = 'exercise-media' and public.has_admin_access(auth.uid()));

drop policy if exists "exercise_media_admin_delete" on storage.objects;
create policy "exercise_media_admin_delete" on storage.objects for delete
  using (bucket_id = 'exercise-media' and public.has_admin_access(auth.uid()));

-- Not: upsert (dosya üzerine yazma) UPDATE gerektirir; yeni update policy bunu kapsar.
