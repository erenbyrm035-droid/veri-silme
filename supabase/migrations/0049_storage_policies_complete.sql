-- ============================================================================
-- 0049 — Storage policy setini EKSİKSİZ yeniden kur
--
-- NEDEN GEREKLİ
-- Teşhis betiği canlı veritabanında `exercise-media` bucket'ında SELECT
-- policy'sinin (`exercise_media_public_read`) EKSİK olduğunu buldu. O policy
-- 0012'de oluşturuluyor ve 0026 ona dokunmuyor — yani bir noktada düşmüş
-- (0012 kısmi uygulanmış ya da Supabase panelinden elle silinmiş olabilir).
--
-- 0048'in HATASI: yalnızca eksik UPDATE policy'lerini ekledi ve diğerlerinin
-- yerinde olduğunu VARSAYDI. Bu varsayım yanlıştı. Storage policy'leri
-- yıllar içinde sekiz ayrı migration'a dağılmış durumda ve hangisinin hangi
-- ortamda tam uygulandığını bilmenin yolu yok.
--
-- BU MIGRATION'IN YAKLAŞIMI: varsaymak yerine, sekiz bucket'ın TAM kural
-- setini yeniden kurar. Her kural, kendi kaynak migration'ındaki ifadenin
-- birebir aynısıdır — yeni yetki açılmaz, eksik olan tamamlanır.
--
-- `drop policy if exists` + `create policy` deseni: idempotent, tekrar
-- çalıştırılabilir ve eksik olanı sessizce tamamlar.
--
-- EK DÜZELTME — animations yetki tutarsızlığı:
-- 0011 `animations` için `is_admin()` (yalnızca profiles.is_admin) kullanıyor,
-- ama 0026 `exercise-media`'yı `has_admin_access()`e (is_admin VEYA
-- admin_role) taşımıştı. 0048'de animations UPDATE'ini has_admin_access ile
-- yazdım; bu, editor rolündeki bir yöneticinin dosyayı GÜNCELLEYEBİLİP
-- EKLEYEMEDİĞİ tutarsız bir duruma yol açıyordu. Üçü de hizalanıyor.
--
-- Additive + idempotent. Hiçbir dosya silinmez, hiçbir veri değişmez.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Ön koşul: bucket'lar
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('body-photos',    'body-photos',    false),
  ('posture-photos', 'posture-photos', false),
  ('meal-photos',    'meal-photos',    false),
  ('avatars',        'avatars',        true),
  ('animations',     'animations',     true),
  ('exercise-media', 'exercise-media', true),
  ('team-media',     'team-media',     false),
  ('rewards',        'rewards',        true)
on conflict (id) do nothing;

-- RLS'i AÇMAYA ÇALIŞMIYORUZ.
--
-- `alter table storage.objects enable row level security` komutu TABLO
-- SAHİPLİĞİ ister. Supabase'de bu tablonun sahibi `supabase_storage_admin`;
-- SQL Editor ise `postgres` rolüyle çalışır. Dolayısıyla komut şu hatayı verir:
--
--     ERROR: 42501: must be owner of table objects
--
-- Supabase projelerinde storage.objects üzerinde RLS ZATEN AÇIKTIR ve
-- kapatılamaz. Policy oluşturmak/silmek için sahiplik gerekmez — o yüzden
-- aşağıdaki tüm policy tanımları sorunsuz çalışır.
--
-- Durumu yalnızca RAPORLUYORUZ; değiştirmeye çalışmıyoruz.
do $$
declare v_on boolean;
begin
  select c.relrowsecurity into v_on
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'storage' and c.relname = 'objects';

  if v_on is false then
    raise warning 'storage.objects üzerinde RLS KAPALI görünüyor. Supabase panelinden Storage > Policies bölümünden açılmalı; bu komut buradan çalıştırılamaz (tablo sahipliği gerekir).';
  end if;
end $$;

-- ===========================================================================
-- 1) body-photos — private, kullanıcının kendi klasörü
--    Kaynak: schema.sql / 0005_progress_v2.sql
--    upsert KULLANILMIYOR (PhotoCompare) → UPDATE policy bilinçli olarak YOK
-- ===========================================================================
drop policy if exists "body_photos_read_own" on storage.objects;
create policy "body_photos_read_own" on storage.objects for select
  using (bucket_id = 'body-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "body_photos_insert_own" on storage.objects;
create policy "body_photos_insert_own" on storage.objects for insert
  with check (bucket_id = 'body-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "body_photos_delete_own" on storage.objects;
create policy "body_photos_delete_own" on storage.objects for delete
  using (bucket_id = 'body-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===========================================================================
-- 2) posture-photos — private, kullanıcının kendi klasörü
--    Kaynak: 0009_posture_corrective.sql (+ UPDATE: 0048)
-- ===========================================================================
drop policy if exists "posture_photos_read_own" on storage.objects;
create policy "posture_photos_read_own" on storage.objects for select
  using (bucket_id = 'posture-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "posture_photos_insert_own" on storage.objects;
create policy "posture_photos_insert_own" on storage.objects for insert
  with check (bucket_id = 'posture-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "posture_photos_update_own" on storage.objects;
create policy "posture_photos_update_own" on storage.objects for update
  using (bucket_id = 'posture-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'posture-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "posture_photos_delete_own" on storage.objects;
create policy "posture_photos_delete_own" on storage.objects for delete
  using (bucket_id = 'posture-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===========================================================================
-- 3) meal-photos — private, kullanıcının kendi klasörü
--    Kaynak: 0010_nutrition_ai.sql (+ UPDATE: 0048)
-- ===========================================================================
drop policy if exists "meal_photos_read_own" on storage.objects;
create policy "meal_photos_read_own" on storage.objects for select
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "meal_photos_insert_own" on storage.objects;
create policy "meal_photos_insert_own" on storage.objects for insert
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "meal_photos_update_own" on storage.objects;
create policy "meal_photos_update_own" on storage.objects for update
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "meal_photos_delete_own" on storage.objects;
create policy "meal_photos_delete_own" on storage.objects for delete
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===========================================================================
-- 4) avatars — public okuma, kullanıcının kendi klasörüne yazma
--    Kaynak: 0030_profile_center.sql (+ WITH CHECK açıklaması: 0048)
-- ===========================================================================
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===========================================================================
-- 5) animations — public okuma, admin yazma
--    Kaynak: 0011_animations.sql
--    DEĞİŞİKLİK: is_admin() → has_admin_access() (0026'nın gerekçesiyle aynı;
--    admin_role ile yönetici olanlar da .glb yükleyebilmeli)
-- ===========================================================================
drop policy if exists "animations_public_read" on storage.objects;
create policy "animations_public_read" on storage.objects for select
  using (bucket_id = 'animations');

drop policy if exists "animations_admin_insert" on storage.objects;
create policy "animations_admin_insert" on storage.objects for insert
  with check (bucket_id = 'animations' and public.has_admin_access(auth.uid()));

drop policy if exists "animations_admin_update" on storage.objects;
create policy "animations_admin_update" on storage.objects for update
  using (bucket_id = 'animations' and public.has_admin_access(auth.uid()))
  with check (bucket_id = 'animations' and public.has_admin_access(auth.uid()));

drop policy if exists "animations_admin_delete" on storage.objects;
create policy "animations_admin_delete" on storage.objects for delete
  using (bucket_id = 'animations' and public.has_admin_access(auth.uid()));

-- ===========================================================================
-- 6) exercise-media — public okuma, admin yazma
--    Kaynak: 0012_media_system.sql + 0026_exercise_media_storage_policy.sql
--
--    *** EKSİK OLAN POLICY BURADAYDI ***
--    `exercise_media_public_read` canlı veritabanında yoktu. Etkisi:
--    `.list()` çağrıları boş dönüyor (admin medya yöneticisi dosyaları
--    göremiyor). Bucket public olduğu için `/object/public/...` üzerinden
--    doğrudan görsel gösterimi etkilenmiyordu — bu yüzden sorun uzun süre
--    fark edilmemiş olabilir.
-- ===========================================================================
drop policy if exists "exercise_media_public_read" on storage.objects;
create policy "exercise_media_public_read" on storage.objects for select
  using (bucket_id = 'exercise-media');

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

-- ===========================================================================
-- 7) team-media — private, takım üyeliğine bağlı
--    Kaynak: 0039_teams_social.sql
--    upsert KULLANILMIYOR (TeamChat) → UPDATE policy bilinçli olarak YOK
--    Yol deseni: takımId/kullanıcıId/dosya → foldername[2] = yükleyen
-- ===========================================================================
drop policy if exists "team_media_read" on storage.objects;
create policy "team_media_read" on storage.objects for select
  using (
    bucket_id = 'team-media'
    and public.is_team_media_member(name, auth.uid())
  );

drop policy if exists "team_media_insert" on storage.objects;
create policy "team_media_insert" on storage.objects for insert
  with check (
    bucket_id = 'team-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_team_media_member(name, auth.uid())
  );

drop policy if exists "team_media_delete" on storage.objects;
create policy "team_media_delete" on storage.objects for delete
  using (
    bucket_id = 'team-media'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ===========================================================================
-- 8) rewards — public okuma, admin yazma
--    Kaynak: 0043_reward_center.sql
--    Not: bu bucket'a yükleme yapan kod henüz yok (admin formu URL alıyor).
-- ===========================================================================
drop policy if exists "rewards_read" on storage.objects;
create policy "rewards_read" on storage.objects for select
  using (bucket_id = 'rewards');

drop policy if exists "rewards_admin_write" on storage.objects;
create policy "rewards_admin_write" on storage.objects for insert
  with check (bucket_id = 'rewards' and public.has_admin_access(auth.uid()));

drop policy if exists "rewards_admin_delete" on storage.objects;
create policy "rewards_admin_delete" on storage.objects for delete
  using (bucket_id = 'rewards' and public.has_admin_access(auth.uid()));
