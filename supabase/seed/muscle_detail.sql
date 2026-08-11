-- ============================================================================
-- Viva AI Coach — Kas Detay Zenginleştirme + Mobilizasyon/Stretch/Rehab (Sprint 7)
-- muscles: joints / daily_life / growth_tips; ek egzersizler (mobility/stretch/rehab).
-- schema.sql + migration 0007 sonrası çalıştırılır. İdempotent.
-- ============================================================================

-- ---- Kas detay alanları (slug ile eşleştir) ----
update public.muscles m set
  joints = v.joints, daily_life = v.daily_life, growth_tips = v.growth_tips
from (values
  ('gogus', array['Omuz eklemi'], 'Kapıyı itme, ağır kutu taşıma, şınav gibi itme hareketlerinde devrede.', array['Haftada 10-16 set hedefle','Farklı açılar çalış (eğimli/düz)','Tam açıklıkta ve kontrollü in']),
  ('omuz', array['Omuz eklemi'], 'Rafa uzanma, çanta taşıma, saç tarama gibi kol kaldırma hareketlerinde.', array['Üç başı da (ön/yan/arka) çalış','Yan omuz için lateral raise ihmal etme','Ağırlıktan çok form ve tam açıklık']),
  ('biceps', array['Dirsek eklemi','Omuz eklemi'], 'Bir şey kaldırma, kapı kolu çevirme, çanta taşıma.', array['Eksantrik (yavaş iniş) fazına odaklan','Farklı kavrama açıları dene','Dirseği sabit tut']),
  ('triceps', array['Dirsek eklemi'], 'İtme, kapı itme, otururken kalkma desteği.', array['Kol kütlesinin çoğu triceps''tir — ihmal etme','Uzun başı da (overhead) çalış','Tam uzatma yap']),
  ('on-kol', array['El bileği','Dirsek eklemi'], 'Kavrama, taşıma, açma-kapama; günlük hayatta sürekli devrede.', array['Kavrama (grip) çalışmaları ekle','Hem fleksör hem ekstansör çalış','Yüksek tekrar iyi yanıt verir']),
  ('karin', array['Omurga (bel)'], 'Ayakta durma, eğilme, öksürme; core her harekette stabilizatör.', array['Sadece mekik değil, izometrik (plank) da yap','Direnç ekleyerek zorla','Beslenme olmadan görünmez']),
  ('yan-karin', array['Omurga'], 'Dönme, yana eğilme, ağırlık taşıma dengesinde.', array['Rotasyonel hareketler ekle','Yana plank etkili','Kontrollü tempo, ani dönüş yok']),
  ('trapez', array['Skapula','Omuz'], 'Çanta/omuz askısı taşıma, postürü dik tutma.', array['Shrug ve face pull dengesi kur','Üst/orta/alt lifleri ayrı düşün','Postür için orta trapez önemli']),
  ('sirt', array['Omuz eklemi'], 'Çekme, kürek çekme, yukarı asılma; postürün temeli.', array['Barfiks ilerlemesi kur','Hem dikey hem yatay çekiş yap','Kürek kemiğini sıkmayı öğren']),
  ('bel', array['Omurga'], 'Dik durma, eğilip kalkma, ağırlık kaldırma stabilizasyonu.', array['Nötr omurgayı koru','Hip hinge tekniğini öğren','Ağırlığı çok kademeli artır']),
  ('kalca', array['Kalça eklemi'], 'Yürüme, koşma, merdiven çıkma, oturup kalkma gücü.', array['Hip thrust ve köprü ile aktive et','Masa başı çalışan için kritik','Zirvede bilinçli sık']),
  ('on-bacak', array['Diz eklemi','Kalça eklemi'], 'Yürüme, çömelme, zıplama, merdiven; alt beden motoru.', array['Squat derinliğini kademeli artır','Tek bacak çalışmaları ekle','Diz sağlığı için form önce']),
  ('arka-bacak', array['Diz eklemi','Kalça eklemi'], 'Koşuda frenleme, eğilme, sprint gücü.', array['Isınmadan çalışma','Romanian deadlift + Nordic curl','Esneklik + güç birlikte']),
  ('baldir', array['Ayak bileği'], 'Yürüme, koşu, zıplama itişi; her adımda devrede.', array['Yüksek tekrar + tam açıklık','Hem düz hem bükük diz çalış','Aşil sağlığı için eksantrik'])
) as v(slug, joints, daily_life, growth_tips)
where m.slug = v.slug;

-- ---- Ek egzersizler: Mobilizasyon / Stretching / Rehabilitasyon ----
insert into public.exercises
  (name, muscle_group, category, difficulty, equipment, secondary_muscles,
   description, correct_form, tempo, rec_sets, rec_reps, rec_rest_sec,
   common_mistakes, tips, ai_notes, video_url, is_home, is_gym, movement_type)
values
  ('Foam Roller Sırt', 'Sırt', 'mobility', 'beginner', 'bodyweight', array['Trapez'],
   'Üst sırt mobilitesi için foam roller çalışması.',
   'Roller''ı kürek kemiği hizasına al, elleri başın arkasında; yavaşça yuvarlan.',
   'yavaş', 2, '8-10', 30, array['Beli aşırı yaylandırmak'], array['Ağrı noktasında birkaç saniye dur'],
   'Antrenman öncesi üst sırt açmak için ideal.', 'https://www.youtube.com/watch?v=oLnkFVLTZ1I', true, true, 'mobility'),
  ('Omuz Çemberi (Band)', 'Omuz', 'mobility', 'beginner', 'band', array[]::text[],
   'Direnç bandıyla omuz mobilizasyonu (dislocates).',
   'Bandı geniş kavra, kolları gergin tutarak öne-arkaya çember çiz.',
   'yavaş', 2, '10', 30, array['Dirsek bükmek','Ani hareket'], array['Kavramayı zorlandıkça daralt'],
   'Üst beden antrenmanı öncesi omuz ısıtma.', 'https://www.youtube.com/watch?v=Wth0P7wCTZM', true, true, 'mobility'),
  ('Kalça Açıcı (90/90)', 'Kalça', 'mobility', 'beginner', 'bodyweight', array['Bacak'],
   'Kalça iç/dış rotasyon mobilitesi için 90/90 çalışması.',
   'İki bacağı 90 derece konumla, gövdeyi öne eğerek kalçayı aç.',
   'yavaş', 2, '8/taraf', 30, array['Beli yuvarlamak'], array['Nefesle derinleş'],
   'Squat derinliğini artırmak için faydalı.', 'https://www.youtube.com/watch?v=nQz0Kdvmk3Q', true, true, 'mobility'),
  ('Göğüs Esnetme (Kapı)', 'Göğüs', 'stretch', 'beginner', 'bodyweight', array['Omuz'],
   'Kapı çerçevesinde statik göğüs esnetme.',
   'Kolu çerçeveye yasla, gövdeyi hafif öne al; gerginliği göğüste hisset. 20-30 sn.',
   'statik', 2, '20-30 sn', 20, array['Zıplayarak esnetmek'], array['Antrenman sonrası uygula'],
   'Masa başı postürü için rahatlatıcı.', 'https://www.youtube.com/watch?v=SV7--3ce2XM', true, true, 'stretch'),
  ('Dinamik Bacak Salınımı', 'Bacak', 'stretch', 'beginner', 'bodyweight', array['Kalça'],
   'Antrenman öncesi dinamik hamstring/kalça esnetme.',
   'Bir yere tutun, bacağı öne-arkaya kontrollü salla; açıyı kademeli artır.',
   'dinamik', 2, '10/taraf', 20, array['Kontrolsüz savurmak'], array['Isınma için ideal'],
   'Alt beden antrenmanı öncesi hazırlık.', 'https://www.youtube.com/watch?v=1LqLTaJZKvE', true, true, 'stretch'),
  ('Rotator Manşet (Band)', 'Omuz', 'rehab', 'beginner', 'band', array[]::text[],
   'Omuz dış rotasyonu ile rotator manşet güçlendirme.',
   'Dirsek gövdeye yapışık, bandı dışa doğru kontrollü çek.',
   '3-1-3', 3, '12-15', 45, array['Dirseği gövdeden ayırmak','Ağır direnç'],
   array['Hafif direnç, yüksek tekrar','Ağrısız açıklıkta kal'],
   'Omuz sıkışması/hassasiyetinde koruyucu.', 'https://www.youtube.com/watch?v=P5Y2Gcx4Vqk', true, true, 'rehab'),
  ('Nordic Hamstring (Yardımlı)', 'Bacak', 'rehab', 'intermediate', 'bodyweight', array['Kalça'],
   'Hamstring eksantrik güçlendirme (sakatlık önleme).',
   'Diz üstünde, ayakları sabitle; gövdeyi kontrollü öne indir, ellerle yakala.',
   'eksantrik', 3, '5-8', 60, array['Kontrolsüz düşüş'], array['Çok yavaş in','Kademeli ilerle'],
   'Hamstring yırtığı geçmişi olanlar için değerli.', 'https://www.youtube.com/watch?v=1oel_JHknR0', true, true, 'rehab'),
  ('Bird-Dog', 'Sırt', 'rehab', 'beginner', 'bodyweight', array['Karın','Kalça'],
   'Bel stabilizasyonu için karşı kol-bacak uzatma.',
   'Dört ayak üstünde, karşı kol ve bacağı düz uzat; beli nötr tut.',
   '2-2-2', 3, '8/taraf', 30, array['Beli çökertmek','Kalçayı döndürmek'],
   array['Yavaş ve kontrollü','Core''u sık'],
   'Bel ağrısı rehabında temel core hareketi.', 'https://www.youtube.com/watch?v=wiFNA3sqjCA', true, true, 'core')

on conflict (name) do update set
  category = excluded.category, movement_type = excluded.movement_type,
  correct_form = excluded.correct_form, ai_notes = excluded.ai_notes;

-- Yeni eklenen egzersizler için slug/primary_muscles doldur (0007 sonrası)
update public.exercises
set slug = trim(both '-' from regexp_replace(lower(unaccent(name)), '[^a-z0-9]+', '-', 'g'))
where slug is null or slug = '';
update public.exercises set primary_muscles = array[muscle_group] where primary_muscles = '{}';
