-- ===========================================================================
-- STORAGE RLS TEŞHİS + DOĞRULAMA
--
-- SALT OKUNUR — hiçbir veriyi değiştirmez.
-- Tek sonuç tablosu döner (Supabase SQL Editor son sorguyu gösterir).
--
-- "Storage: new row violates row-level security policy" hatası DÖRT farklı
-- durumda aynı mesajı verir. Bu betik hangisinde olduğunu ayırt eder.
--
-- Önce 0048_storage_rls_fix.sql'i çalıştır, sonra bunu.
-- ===========================================================================

with

-- Kodun kullandığı bucket'lar ve her birinin beklenen davranışı
beklenen(bucket, herkese_acik, upsert_kullaniyor, yazan) as (values
  ('body-photos',    false, false, 'kullanıcı (kendi klasörü)'),
  ('posture-photos', false, true,  'kullanıcı (kendi klasörü)'),
  ('meal-photos',    false, true,  'kullanıcı (kendi klasörü)'),
  ('avatars',        true,  true,  'kullanıcı (kendi klasörü)'),
  ('animations',     true,  true,  'admin'),
  ('exercise-media', true,  true,  'admin'),
  ('team-media',     false, false, 'takım üyesi'),
  ('rewards',        true,  false, 'admin (şu an yükleme kodu yok)')
),

-- storage.objects üzerindeki policy'ler, bucket ve komut bazında
pol as (
  select
    p.policyname,
    p.cmd,
    -- Policy metninden bucket adını çıkar
    (regexp_match(coalesce(p.qual, '') || ' ' || coalesce(p.with_check, ''),
                  'bucket_id = ''([a-z0-9_-]+)'''))[1] as bucket
  from pg_policies p
  where p.schemaname = 'storage' and p.tablename = 'objects'
),

-- 1) Bucket gerçekten var mı + public/private ayarı doğru mu
t_bucket as (
  select 1 as sira, 'Bucket' as grup, b.bucket as kontrol,
         exists (select 1 from storage.buckets sb where sb.id = b.bucket) as ok,
         'bucket YOK — hata "Bucket not found" olurdu, 0048 çalıştır' as hata
  from beklenen b
  union all
  select 1, 'Bucket erişim', b.bucket || ' → ' ||
         case when b.herkese_acik then 'public' else 'private' end,
         coalesce((select sb.public from storage.buckets sb where sb.id = b.bucket), null)
           is not distinct from b.herkese_acik,
         'public/private ayarı beklenenden farklı — imzalı URL akışı bozulur'
  from beklenen b
),

-- 2) RLS açık mı (kapalıysa policy'ler HİÇ uygulanmaz)
t_rls as (
  select 2, 'RLS', 'storage.objects üzerinde RLS açık',
         coalesce((select c.relrowsecurity from pg_class c
                    join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'storage' and c.relname = 'objects'), false),
         'RLS KAPALI — tüm dosyalar herkese açık! Acil müdahale gerekir.'
),

-- 3) SELECT policy (dosya okunamazsa önizleme/imzalı URL çalışmaz)
t_select as (
  select 3, 'SELECT policy', b.bucket,
         exists (select 1 from pol where pol.bucket = b.bucket and pol.cmd in ('SELECT','ALL')),
         'okuma kuralı yok — yüklenen dosya görüntülenemez'
  from beklenen b
),

-- 4) INSERT policy (yükleme)
t_insert as (
  select 4, 'INSERT policy', b.bucket,
         exists (select 1 from pol where pol.bucket = b.bucket and pol.cmd in ('INSERT','ALL')),
         'yükleme kuralı yok — İLK yükleme bile RLS hatası verir'
  from beklenen b
),

-- 5) UPDATE policy — YALNIZCA upsert kullanan bucket'larda ZORUNLU
--    Asıl hatanın kaynağı burasıydı.
t_update as (
  select 5, 'UPDATE policy (upsert için)', b.bucket,
         exists (select 1 from pol where pol.bucket = b.bucket and pol.cmd in ('UPDATE','ALL')),
         'kod upsert:true kullanıyor ama UPDATE kuralı yok — ' ||
         'aynı yola İKİNCİ yükleme "new row violates row-level security policy" verir'
  from beklenen b
  where b.upsert_kullaniyor
),

-- 6) DELETE policy (dosya silme)
t_delete as (
  select 6, 'DELETE policy', b.bucket,
         exists (select 1 from pol where pol.bucket = b.bucket and pol.cmd in ('DELETE','ALL')),
         'silme kuralı yok — kullanıcı dosyasını kaldıramaz'
  from beklenen b
  where b.bucket <> 'rewards'
),

-- 7) Yetki fonksiyonu çalışıyor mu (admin bucket'ları buna bağlı)
t_admin as (
  select 7, 'Yetki', 'has_admin_access fonksiyonu var',
         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'has_admin_access'),
         'admin bucket policy''leri bu fonksiyona bağlı — yoksa admin yükleyemez'
  union all
  select 7, 'Yetki', 'en az bir admin kullanıcı var',
         exists (select 1 from public.profiles
                  where is_admin = true or admin_role in ('super_admin','admin','editor')),
         'hiç admin yok — animations/exercise-media yüklemeleri reddedilir'
),

-- 8) storage.foldername kullanılabilir mi (klasör sahipliği kuralları buna bağlı)
t_helper as (
  select 8, 'Yardımcı', 'storage.foldername mevcut',
         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'storage' and p.proname = 'foldername'),
         'kullanıcı klasörü kuralları çalışmaz'
),

hepsi as (
  select * from t_bucket
  union all select * from t_rls
  union all select * from t_select
  union all select * from t_insert
  union all select * from t_update
  union all select * from t_delete
  union all select * from t_admin
  union all select * from t_helper
)

select
  case when h.ok then '✅ GEÇTİ' else '❌ KALDI' end as durum,
  h.grup,
  h.kontrol,
  case when h.ok then '' else h.hata end as aciklama
from hepsi h

union all

select
  case when (select bool_and(ok) from hepsi) then '🎉 TÜMÜ GEÇTİ' else '⛔ SORUN VAR' end,
  'ÖZET',
  (select count(*) filter (where ok) from hepsi)::text || ' / ' ||
  (select count(*) from hepsi)::text || ' kontrol geçti',
  case when (select bool_and(ok) from hepsi)
       then 'Storage yükleme kuralları eksiksiz. RLS hatası kalmadı.'
       else 'Yukarıdaki KALDI satırı hangi bucket''ta ne eksik olduğunu söylüyor.' end

order by 1 desc, 2, 3;
