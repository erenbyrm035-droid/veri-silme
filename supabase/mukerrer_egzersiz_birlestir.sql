-- ============================================================================
-- MÜKERRER EGZERSİZ BİRLEŞTİRME — ŞABLON
--
-- ⚠️  BU DOSYA OLDUĞU GİBİ ÇALIŞTIRILMAZ.
--     Aşağıdaki `secimler` listesini `mukerrer_egzersiz_teshis.sql` çıktısına
--     bakarak KENDİN doldurmalısın. Hangi kaydın kalacağı bir veri kararıdır;
--     kod bunu güvenle tahmin edemez.
--
-- ÖN KOŞULLAR (sırayla):
--   1. `mukerrer_egzersiz_teshis.sql` çalıştırıldı ve çıktısı incelendi.
--   2. Teşhisin 4. sorgusu (rekor çakışması) BOŞ döndü. Satır döndüyse önce
--      o kullanıcıların fazla rekorları temizlenmeli — yoksa bu betik
--      unique (user_id, exercise_name) kısıtında patlar.
--   3. Veritabanının yedeği alındı (Supabase → Database → Backups).
--
-- Betik TEK TRANSACTION içinde çalışır: bir adım patlarsa hiçbir şey
-- değişmez. Sonunda `rollback` var — çıktıyı görüp ikna olduktan sonra onu
-- `commit` ile değiştir.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) SEÇİMLER — BURAYI DOLDUR
--
--    kalan_id  : korunacak egzersiz (referansı çok olan / içeriği zengin olan)
--    silinen_id: kaldırılacak egzersiz; tüm referansları kalan_id'ye taşınır
--
--    Teşhisin 2. sorgusundaki workout_sets / personal_records sütunlarına bak:
--    kullanıcı verisi çok olan taraf KALMALI.
-- ---------------------------------------------------------------------------
create temporary table secimler (kalan_id uuid, silinen_id uuid) on commit drop;

insert into secimler (kalan_id, silinen_id) values
  -- ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111'),
  -- ('...kalan...', '...silinen...'),
  (null, null);            -- ← bu satırı sil; sadece şablon geçerli kalsın diye var

delete from secimler where kalan_id is null or silinen_id is null;

-- Güvenlik: kendi kendini birleştirme ve olmayan id kontrolü.
do $$
declare v_hata int;
begin
  select count(*) into v_hata from secimler where kalan_id = silinen_id;
  if v_hata > 0 then raise exception 'kalan_id ile silinen_id aynı olamaz (% satır)', v_hata; end if;

  select count(*) into v_hata
  from secimler s
  where not exists (select 1 from public.exercises e where e.id = s.kalan_id)
     or not exists (select 1 from public.exercises e where e.id = s.silinen_id);
  if v_hata > 0 then raise exception 'secimler tablosunda olmayan exercise_id var (% satır)', v_hata; end if;

  if (select count(*) from secimler) = 0 then
    raise exception 'secimler boş — şablonu doldurmadan çalıştırdın';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) KULLANICI VERİSİ — id VE isim kopyası birlikte taşınır
--
--    Yalnızca exercise_id'yi taşımak yetmez: bu tablolar ismin KOPYASINI da
--    saklıyor. İsim güncellenmezse kullanıcı geçmişinde eski ad görünmeye
--    devam eder.
-- ---------------------------------------------------------------------------
update public.workout_sets ws
set exercise_id   = s.kalan_id,
    exercise_name = coalesce(nullif(btrim(e.english_name), ''), e.name)
from secimler s
join public.exercises e on e.id = s.kalan_id
where ws.exercise_id = s.silinen_id;

-- personal_records: unique (user_id, exercise_name) yüzünden iki aşamalı.
-- Önce ÇAKIŞANLARI ele: aynı kullanıcıda hem kalan hem silinen için rekor
-- varsa, yalnızca daha iyi olanı (est_1rm yüksek) korunur.
delete from public.personal_records zayif
using public.personal_records guclu, secimler s
where zayif.exercise_id = s.silinen_id
  and guclu.exercise_id = s.kalan_id
  and guclu.user_id = zayif.user_id
  and guclu.est_1rm >= zayif.est_1rm;

-- Ters durum: silinen taraftaki rekor DAHA İYİ ise kalan taraftaki silinir,
-- böylece taşıma sonrası çakışma kalmaz ve kullanıcı daha iyi rekorunu
-- kaybetmez.
delete from public.personal_records zayif
using public.personal_records guclu, secimler s
where zayif.exercise_id = s.kalan_id
  and guclu.exercise_id = s.silinen_id
  and guclu.user_id = zayif.user_id
  and guclu.est_1rm > zayif.est_1rm;

update public.personal_records pr
set exercise_id   = s.kalan_id,
    exercise_name = coalesce(nullif(btrim(e.english_name), ''), e.name)
from secimler s
join public.exercises e on e.id = s.kalan_id
where pr.exercise_id = s.silinen_id;

-- Analitik olaylar — isim kopyası yok, sadece id.
update public.workout_events we
set exercise_id = s.kalan_id
from secimler s
where we.exercise_id = s.silinen_id;

-- Favoriler: unique (user_id, exercise_id). Kullanıcı ikisini de favorilemişse
-- taşıma çakışır; önce fazlalığı sil.
delete from public.favorites f
using secimler s
where f.exercise_id = s.silinen_id
  and exists (
    select 1 from public.favorites f2
    where f2.user_id = f.user_id and f2.exercise_id = s.kalan_id
  );

update public.favorites f
set exercise_id = s.kalan_id
from secimler s
where f.exercise_id = s.silinen_id;

-- ---------------------------------------------------------------------------
-- 3) KATALOG/İÇERİK VERİSİ
--
--    Program egzersizleri de isim kopyası tutuyor.
-- ---------------------------------------------------------------------------
update public.workout_program_exercises wpe
set exercise_id   = s.kalan_id,
    exercise_name = coalesce(nullif(btrim(e.english_name), ''), e.name)
from secimler s
join public.exercises e on e.id = s.kalan_id
where wpe.exercise_id = s.silinen_id;

update public.corrective_exercises ce
set exercise_id = s.kalan_id
from secimler s
where ce.exercise_id = s.silinen_id;

-- Aşağıdakiler kalan kayıtta zaten mevcut olabileceği için TAŞINMAZ, SİLİNİR:
-- kas eşleşmesi, medya ve ilişkiler kalan kayıtta kendi hâliyle doğru.
-- (Kalan kaydın içeriği eksikse birleştirmeden ÖNCE admin panelinden
-- tamamlanmalı — teşhisin 2. sorgusu hangi tarafın zengin olduğunu gösterir.)
delete from public.exercise_muscles      where exercise_id in (select silinen_id from secimler);
delete from public.exercise_media        where exercise_id in (select silinen_id from secimler);
delete from public.exercise_media_set    where exercise_id in (select silinen_id from secimler);
delete from public.animation_mapping     where exercise_id in (select silinen_id from secimler);
delete from public.exercise_versions     where exercise_id in (select silinen_id from secimler);
delete from public.exercise_relations
  where exercise_id in (select silinen_id from secimler)
     or related_id  in (select silinen_id from secimler);
delete from public.exercise_alternatives
  where exercise_id     in (select silinen_id from secimler)
     or alt_exercise_id in (select silinen_id from secimler);

-- ---------------------------------------------------------------------------
-- 4) MÜKERRER KAYITLARI SİL
-- ---------------------------------------------------------------------------
delete from public.exercises where id in (select silinen_id from secimler);

-- ---------------------------------------------------------------------------
-- 5) DOĞRULAMA — commit'ten ÖNCE bu çıktıya bak
-- ---------------------------------------------------------------------------
select 'birlestirilen_cift'  as olcum, count(*) as deger from secimler
union all
select 'kalan_egzersiz',       count(*) from public.exercises
union all
-- Aşağıdaki üçü SIFIR olmalı: hiçbir yerde silinen id'ye referans kalmamalı.
select 'artik_referans_sets',  count(*) from public.workout_sets     where exercise_id in (select silinen_id from secimler)
union all
select 'artik_referans_pr',    count(*) from public.personal_records where exercise_id in (select silinen_id from secimler)
union all
select 'artik_referans_olay',  count(*) from public.workout_events   where exercise_id in (select silinen_id from secimler);

-- ---------------------------------------------------------------------------
-- Çıktı beklendiği gibiyse aşağıdaki satırı `commit;` yap.
-- Şu hâliyle betik hiçbir kalıcı değişiklik BIRAKMAZ.
-- ---------------------------------------------------------------------------
rollback;
-- commit;
