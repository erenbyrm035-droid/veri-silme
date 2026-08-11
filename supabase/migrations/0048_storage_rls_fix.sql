-- ============================================================================
-- 0048 — Storage RLS düzeltmesi: eksik UPDATE policy'leri
--
-- SORUN
-- Supabase Storage'da `upload(path, file, { upsert: true })` çağrısı,
-- `storage.objects` üzerinde şu SQL'e karşılık gelir:
--
--     insert into storage.objects (...) values (...)
--     on conflict (bucket_id, name) do update set ...
--
-- PostgreSQL'de `on conflict do update` ÇAKIŞMA OLDUĞUNDA **UPDATE policy'si**
-- arar. Policy yoksa hata:
--
--     new row violates row-level security policy (USING expression)
--
-- Bu, kullanıcının gördüğü hatanın birebir kaynağıdır. Yerel PostgreSQL 16
-- replikasında bu davranış üretilerek doğrulandı:
--   • çakışma YOKKEN  → INSERT policy yeterli, sorun yok
--   • çakışma VARKEN  → UPDATE policy yoksa yukarıdaki hata
--   • UPDATE policy eklenince → sorun kalkıyor
--
-- KAPSAM — yalnızca kodu `upsert: true` kullanan bucket'lar:
--
--   bucket            kod                                 upsert  UPDATE policy
--   ────────────────  ──────────────────────────────────  ──────  ─────────────
--   posture-photos    components/posture/PostureUploader   true    YOKTU  ← düzeltiliyor
--   meal-photos       components/nutrition/FoodScanTools   true    YOKTU  ← düzeltiliyor
--   animations        components/animation/AnimationMana…  true    YOKTU  ← düzeltiliyor
--   avatars           components/profile/AvatarUploader    true    vardı (0030)
--   exercise-media    features/admin/exercise-media/*      true    vardı (0026)
--   body-photos       components/PhotoCompare              FALSE   gerekmiyor
--   team-media        components/teams/TeamChat            FALSE   gerekmiyor
--
-- NEDEN body-photos ve team-media'ya UPDATE EKLENMİYOR:
-- O iki akış `upsert: false` kullanıyor ve bu bilinçli bir tercih — ilerleme
-- fotoğrafı ve sohbet eki DEĞİŞMEZ kayıtlardır, üzerine yazılmamalıdır.
-- İhtiyaç olmayan bir yazma iznini "her ihtimale karşı" vermek, RLS'in
-- anlamını zayıflatır. Aynı gerekçeyle `rewards` da dışarıda: o bucket'a
-- yükleme yapan hiçbir kod yok (admin arayüzü URL alanı kullanıyor).
--
-- GÜVENLİK: Eklenen her UPDATE policy, o bucket'ın MEVCUT sahiplik kuralını
-- birebir tekrar eder — yeni bir yetki açılmıyor, yalnızca "kendi dosyanı
-- değiştirebilirsin" hakkı "kendi dosyanı oluşturabilirsin" hakkıyla
-- hizalanıyor.
--
-- Additive + idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) posture-photos — kullanıcı yalnızca kendi klasörüne yazar
--    Kural kaynağı: 0009_posture_corrective.sql
-- ---------------------------------------------------------------------------
drop policy if exists "posture_photos_update_own" on storage.objects;
create policy "posture_photos_update_own" on storage.objects
  for update
  using (
    bucket_id = 'posture-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'posture-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 2) meal-photos — kullanıcı yalnızca kendi klasörüne yazar
--    Kural kaynağı: 0010_nutrition_ai.sql
-- ---------------------------------------------------------------------------
drop policy if exists "meal_photos_update_own" on storage.objects;
create policy "meal_photos_update_own" on storage.objects
  for update
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 3) animations — yalnızca admin yazar (public okuma zaten var)
--    Kural kaynağı: 0011_animations.sql
-- ---------------------------------------------------------------------------
drop policy if exists "animations_admin_update" on storage.objects;
create policy "animations_admin_update" on storage.objects
  for update
  using (
    bucket_id = 'animations' and public.has_admin_access(auth.uid())
  )
  with check (
    bucket_id = 'animations' and public.has_admin_access(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 4) avatars — WITH CHECK'i açıkça yaz
--
-- 0030'daki policy yalnızca `using` içeriyordu. PostgreSQL, UPDATE
-- policy'sinde `with check` verilmediğinde `using` ifadesini kullanır; yani
-- davranış zaten doğruydu. Yine de açıkça yazıyoruz: bu kuralı okuyan bir
-- sonraki kişi "yazma tarafı kontrolsüz mü?" diye tereddüt etmesin.
-- ---------------------------------------------------------------------------
drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update
  using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 5) Bucket'ların varlığını garanti et
--
-- Bir bucket eksikse hata "Bucket not found" olur, RLS değil — ama kurulum
-- sırası karıştığında (schema.sql + seçili migration'lar) bazı bucket'lar
-- oluşmamış olabiliyor. `on conflict do nothing`: mevcut bucket'ın
-- public/private ayarı EZİLMEZ.
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

-- ---------------------------------------------------------------------------
-- 6) storage.objects üzerinde RLS açık olduğunu doğrula
--
-- Supabase'de varsayılan olarak açıktır; kapalıysa policy'lerin hiçbiri
-- uygulanmaz ve bu sessiz bir güvenlik açığıdır.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage' and c.relname = 'objects' and not c.relrowsecurity
  ) then
    execute 'alter table storage.objects enable row level security';
    raise notice 'storage.objects üzerinde RLS KAPALIYDI, açıldı.';
  end if;
end $$;
