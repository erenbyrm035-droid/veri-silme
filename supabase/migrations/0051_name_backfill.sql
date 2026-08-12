-- ===========================================================================
-- Migration 0051 — İsim/slug tamamlama (0050'nin atladığı kayıtlar)
--
-- NEDEN GEREKLİ:
--   0050'deki güncellemeler `where name = '...'` biçimindeydi ve liste yerel
--   replikadaki 682 egzersizden üretilmişti. Canlı veritabanında o listede
--   OLMAYAN kayıtlar varsa (admin panelinden eklenmiş, seed'ler farklı
--   yüklenmiş vb.) onlara hiçbir güncelleme dokunmadı.
--
--   Bu migration isim listesine BAĞLI DEĞİL: hangi kayıt olursa olsun
--   kuralı uygular. Aynı sorun bir daha yaşanmaz.
--
-- YAPMADIĞI ŞEY:
--   Türkçe isimli kayıtlara standart İngilizce ad TAHMİN ETMEZ. "Bacak
--   Kaldırma"ya bakıp "Leg Raise" demek kolay görünür ama barda asılı
--   yapılan varyantın adı "Hanging Leg Raise"dir — tahmin yanlış isim
--   üretir. Bu kayıtlar dokunulmadan bırakılır ve NOTICE ile listelenir.
--
-- Additive + idempotent. Tekrar çalıştırılabilir.
-- ===========================================================================

-- 0050 çalışmadıysa sütunlar yok; güvenli olsun diye tekrar ekleniyor.
alter table public.exercises
  add column if not exists aliases    text[] not null default '{}',
  add column if not exists video_slug text;

-- --- 1) english_name boş + isim ZATEN İNGİLİZCE → kopyala -----------------
-- Türkçe'ye özgü harf içermeyen isimler ("Burpee", "Goblet Squat",
-- "Dumbbell Row") zaten standart addır; kopyalamak tahmin değildir.
update public.exercises
   set english_name = name
 where coalesce(english_name, '') = ''
   and name !~ '[çğıöşüÇĞİÖŞÜ]';

-- --- 2) video_slug'ı standart isimden türet ------------------------------
-- Tamamen SQL'de: Türkçe harfler sadeleşir, alfanümerik olmayan her şey
-- tireye döner, tekrar eden tireler tekilleşir, baş/son tire kırpılır.
--   'Romanian Deadlift' → romanian-deadlift
--   'Pull-Up'           → pull-up
update public.exercises
   set video_slug = trim(both '-' from
         regexp_replace(
           regexp_replace(
             lower(translate(english_name,
                             'çğıöşüÇĞİÖŞÜ',
                             'cgiosucgiosu')),
             '[^a-z0-9]+', '-', 'g'),
           '-+', '-', 'g'))
 where video_slug is null
   and coalesce(english_name, '') <> '';

-- --- 3) Kalanları RAPORLA (dokunma) --------------------------------------
-- Türkçe isimli ve standart karşılığı belirlenmemiş kayıtlar. Bunlar elle
-- eşlenmeli; yanlış isim, kullanıcının hareketi kaynaklarda bulamaması
-- demek — boş bırakmaktan daha kötü.
do $$
declare
  v_kalan int;
  v_isimler text;
begin
  select count(*), string_agg(name, ' · ' order by name)
    into v_kalan, v_isimler
    from public.exercises
   where coalesce(english_name, '') = '';

  if v_kalan > 0 then
    raise notice '--------------------------------------------------------------';
    raise notice 'UNKNOWN_REVIEW: % kaydın standart İngilizce adı belirlenmedi.', v_kalan;
    raise notice 'Bunlara TAHMİNLE isim verilmedi. Elle eşlenmeli:';
    raise notice '%', v_isimler;
    raise notice '--------------------------------------------------------------';
  else
    raise notice 'Tüm egzersizlerin standart İngilizce adı var.';
  end if;
end $$;
