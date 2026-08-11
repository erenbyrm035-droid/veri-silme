-- ===========================================================================
-- STORAGE — SADECE SORUNLU SATIRLAR
--
-- Salt okunur. Büyük doğrulama tablosunun okunması zor olduğu için yalnızca
-- BAŞARISIZ kontrolleri ve admin durumunu döndürür. Çıktı birkaç satır olur,
-- ekran görüntüsü net çıkar.
-- ===========================================================================

with

beklenen(bucket, herkese_acik, upsert_kullaniyor) as (values
  ('body-photos',    false, false),
  ('posture-photos', false, true),
  ('meal-photos',    false, true),
  ('avatars',        true,  true),
  ('animations',     true,  true),
  ('exercise-media', true,  true),
  ('team-media',     false, false),
  ('rewards',        true,  false)
),

pol as (
  select p.cmd,
         (regexp_match(coalesce(p.qual,'') || ' ' || coalesce(p.with_check,''),
                       'bucket_id = ''([a-z0-9_-]+)'''))[1] as bucket
  from pg_policies p
  where p.schemaname = 'storage' and p.tablename = 'objects'
),

sorunlar as (
  -- Bucket yok
  select 'BUCKET YOK' as sorun, b.bucket as nerede,
         '0048_storage_rls_fix.sql çalıştır' as ne_yapmali
  from beklenen b
  where not exists (select 1 from storage.buckets s where s.id = b.bucket)

  union all
  -- public/private yanlış
  select 'ERİŞİM AYARI YANLIŞ', b.bucket,
         'Beklenen: ' || case when b.herkese_acik then 'public' else 'private' end ||
         ' · Mevcut: ' || coalesce((select case when s.public then 'public' else 'private' end
                                     from storage.buckets s where s.id = b.bucket), '?')
  from beklenen b
  where coalesce((select s.public from storage.buckets s where s.id = b.bucket), null)
        is distinct from b.herkese_acik

  union all
  -- RLS kapalı
  select 'RLS KAPALI', 'storage.objects',
         'ACİL: tüm dosyalar herkese açık. 0048 çalıştır.'
  where not coalesce((select c.relrowsecurity from pg_class c
                       join pg_namespace n on n.oid = c.relnamespace
                      where n.nspname='storage' and c.relname='objects'), false)

  union all
  -- Eksik policy'ler
  select 'SELECT POLICY YOK', b.bucket, 'Yüklenen dosya görüntülenemez'
  from beklenen b
  where not exists (select 1 from pol where pol.bucket = b.bucket and pol.cmd in ('SELECT','ALL'))

  union all
  select 'INSERT POLICY YOK', b.bucket, 'İlk yükleme bile RLS hatası verir'
  from beklenen b
  where not exists (select 1 from pol where pol.bucket = b.bucket and pol.cmd in ('INSERT','ALL'))

  union all
  select 'UPDATE POLICY YOK', b.bucket,
         'Kod upsert:true kullanıyor → aynı yola ikinci yükleme RLS hatası verir. 0048 çalıştır.'
  from beklenen b
  where b.upsert_kullaniyor
    and not exists (select 1 from pol where pol.bucket = b.bucket and pol.cmd in ('UPDATE','ALL'))

  union all
  select 'DELETE POLICY YOK', b.bucket, 'Kullanıcı dosyasını kaldıramaz'
  from beklenen b
  where b.bucket <> 'rewards'
    and not exists (select 1 from pol where pol.bucket = b.bucket and pol.cmd in ('DELETE','ALL'))

  union all
  -- Admin yok
  select 'ADMIN KULLANICI YOK', 'public.profiles',
         'animations ve exercise-media yüklemeleri reddedilir. Aşağıdaki 2. sorguya bak.'
  where not exists (select 1 from public.profiles
                     where is_admin = true or admin_role in ('super_admin','admin','editor'))
)

select
  case when (select count(*) from sorunlar) = 0
       then '🎉 SORUN YOK' else '❌ ' || s.sorun end as durum,
  s.nerede,
  s.ne_yapmali
from sorunlar s

union all

select '🎉 SORUN YOK', 'tüm kontroller', 'Storage kuralları eksiksiz.'
where (select count(*) from sorunlar) = 0;


-- ===========================================================================
-- 2. SORGU — ADMIN DURUMU
--
-- Yukarıda "ADMIN KULLANICI YOK" çıktıysa BUNU ayrıca çalıştır.
-- Supabase editörü son sorguyu gösterdiği için yukarıdakini okuduktan sonra
-- aşağıdaki bloğu seçip ayrıca çalıştırman gerekir.
--
-- `animations` ve `exercise-media` bucket'larının policy'leri
-- `has_admin_access(auth.uid())` fonksiyonuna bağlı. Bu fonksiyon
-- `profiles.is_admin` VEYA `profiles.admin_role` alanlarına bakıyor.
-- Admin panelini açabiliyor olman yetmez — bu iki alandan biri dolu olmalı.
-- ===========================================================================
--
-- select
--   p.id,
--   u.email,
--   p.is_admin,
--   p.admin_role,
--   public.has_admin_access(p.id) as storage_yukleyebilir
-- from public.profiles p
-- join auth.users u on u.id = p.id
-- where p.is_admin = true
--    or p.admin_role is not null
--    or u.email = 'BURAYA_KENDI_EPOSTANI_YAZ'
-- order by p.is_admin desc nulls last;
--
-- Sonuç boşsa ya da `storage_yukleyebilir = false` ise, kendini admin yap:
--
-- update public.profiles
--    set is_admin = true, admin_role = 'super_admin'
--  where id = (select id from auth.users where email = 'BURAYA_KENDI_EPOSTANI_YAZ');
