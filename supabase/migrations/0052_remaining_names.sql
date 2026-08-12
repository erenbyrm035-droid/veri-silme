-- ===========================================================================
-- Migration 0052 — Kalan 8 egzersizin standart İngilizce adı
--
-- 0051 kurala dayalı doldurmayı yaptı; geriye Türkçe isimli ve standart
-- karşılığı elle belirlenmesi gereken kayıtlar kaldı. Bunların hepsi
-- mobilite / esneme / rehabilitasyon hareketleri.
--
-- HER BİRİ TEK TEK BELİRLENDİ, kelime çevirisi YAPILMADI:
--   "Kalça Açıcı (90/90)" kelime kelime "Hip Opener (90/90)" olurdu; oysa
--   bu drill'in uluslararası adı "90/90 Hip Stretch"tir. Kullanıcı ancak
--   bu isimle YouTube/NASM/ExRx'te bulabilir.
--
-- İKİSİ KULLANICIYA SORULARAK NETLEŞTİRİLDİ (tahmin edilmedi):
--   · "Omuz Çemberi (Band)"  → Band Shoulder Dislocate
--   · "Rotator Manşet (Band)" → Band Rotator Cuff Series
--
-- Additive + idempotent.
-- ===========================================================================

alter table public.exercises
  add column if not exists aliases    text[] not null default '{}',
  add column if not exists video_slug text;

-- --- Standart isimler ------------------------------------------------------
-- `name` sütununa DOKUNULMAZ (workout_sets / personal_records ona bağlı).

-- Zaten İngilizce, ama tireli yazım veritabanındaki diğer kayıtla
-- ("Bird Dog") tutarsızdı; tek yazıma çekiliyor.
update public.exercises set english_name = 'Bird Dog'
 where name = 'Bird-Dog';

-- Dinamik kalça/hamstring mobilite salınımı. Standart ad: Leg Swing.
update public.exercises set english_name = 'Leg Swing'
 where name = 'Dinamik Bacak Salınımı';

-- Sırt üstü foam roller ile torakal omurga açma.
update public.exercises set english_name = 'Thoracic Spine Foam Rolling'
 where name = 'Foam Roller Sırt';

-- Kapı kasasına yaslanarak göğüs/pektoral esnetme.
update public.exercises set english_name = 'Doorway Chest Stretch'
 where name = 'Göğüs Esnetme (Kapı)';

-- Ön bacak 90°, arka bacak 90° oturuş — kalça iç/dış rotasyon mobilitesi.
update public.exercises set english_name = '90/90 Hip Stretch'
 where name = 'Kalça Açıcı (90/90)';

-- Yardımlı (partner/bant destekli) nordic hamstring eksantriği.
update public.exercises set english_name = 'Assisted Nordic Hamstring Curl'
 where name = 'Nordic Hamstring (Yardımlı)';

-- Bant iki elle geniş tutulup kollar gergin halde baştan arkaya geçirilir.
update public.exercises set english_name = 'Band Shoulder Dislocate'
 where name = 'Omuz Çemberi (Band)';

-- İç + dış rotasyonu kapsayan rotator cuff çalışması. Mevcut
-- "Resistance Band External Rotation" kaydından FARKLI bir kayıttır.
update public.exercises set english_name = 'Band Rotator Cuff Series'
 where name = 'Rotator Manşet (Band)';

-- --- Alias'lar — bu hareketler birden çok adla biliniyor -------------------
update public.exercises set aliases = array['Shoulder Pass-Through','Band Dislocates']::text[]
 where english_name = 'Band Shoulder Dislocate';
update public.exercises set aliases = array['90/90 Hip Switch','Hip 90/90']::text[]
 where english_name = '90/90 Hip Stretch';
update public.exercises set aliases = array['Nordic Curl','Assisted Nordic Curl']::text[]
 where english_name = 'Assisted Nordic Hamstring Curl';
update public.exercises set aliases = array['Leg Swings','Dynamic Leg Swing']::text[]
 where english_name = 'Leg Swing';
update public.exercises set aliases = array['Upper Back Foam Rolling','T-Spine Foam Rolling']::text[]
 where english_name = 'Thoracic Spine Foam Rolling';
update public.exercises set aliases = array['Pec Stretch','Door Frame Chest Stretch']::text[]
 where english_name = 'Doorway Chest Stretch';

-- --- video_slug: yeni isimlerden türet ------------------------------------
-- 0051'deki kuralın aynısı; bu kayıtlar o an isimsiz olduğu için atlanmıştı.
update public.exercises
   set video_slug = trim(both '-' from
         regexp_replace(
           regexp_replace(
             lower(translate(english_name, 'çğıöşüÇĞİÖŞÜ', 'cgiosucgiosu')),
             '[^a-z0-9]+', '-', 'g'),
           '-+', '-', 'g'))
 where video_slug is null
   and coalesce(english_name, '') <> '';

-- --- Sonuç raporu ---------------------------------------------------------
do $$
declare v_kalan int; v_isimler text;
begin
  select count(*), string_agg(name, ' · ' order by name)
    into v_kalan, v_isimler
    from public.exercises where coalesce(english_name, '') = '';
  if v_kalan > 0 then
    raise notice 'UNKNOWN_REVIEW: hâlâ % kayıt isimsiz → %', v_kalan, v_isimler;
  else
    raise notice 'TAMAM: tüm egzersizlerin standart İngilizce adı var.';
  end if;
end $$;
