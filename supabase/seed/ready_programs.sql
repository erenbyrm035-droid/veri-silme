-- ============================================================================
-- VIVA — Hazır (şablon) programlar. 8 program.
-- Üretim: scripts/gen-programs.mjs · Supabase SQL Editor → Run. Idempotent.
-- Egzersizler ada göre public.exercises'e bağlanır (eşleşmezse exercise_id null,
-- ad yine görünür). ÖNCE exercises_wellness.sql çalıştırılmış olmalı.
-- ============================================================================

-- Wellness kategorileri
insert into public.program_categories (slug, name, sort_order) values
  ('pilates','Pilates',11),('yoga','Yoga',12),('mobility','Mobilite',13),
  ('flexibility','Esneklik',14),('wellness','Wellness',15)
on conflict (slug) do nothing;

insert into public.program_tags (slug, name) values
  ('core','Core'),('balance','Denge'),('flexibility','Esneklik'),('recovery','Toparlanma'),
  ('fat_burn','Yağ Yakımı'),('wellness','Wellness'),('pilates','Pilates'),('yoga','Yoga')
on conflict (slug) do nothing;


-- ===== Pilates Başlangıç · 4 Hafta =====
insert into public.workout_programs
  (slug, name, short_description, description, category, level, goal, gender, environment, weeks, days_per_week, est_minutes, calories, tags, status, sort_order)
values
  ('pilates-baslangic-4h','Pilates Başlangıç · 4 Hafta','Ekipmansız, evde mat üzerinde core ve postür temelleri.','Pilates’in temel mat hareketleriyle derin karın kaslarını, postürü ve gövde kontrolünü geliştirirsin. Haftada 3 gün, her hareketi kontrollü ve nefesle uygula.','pilates','beginner',null,'both','home',4,3,30,180,array['pilates','core','mobility'],'published',0)
on conflict (slug) do update set
  name=excluded.name, short_description=excluded.short_description, description=excluded.description,
  category=excluded.category, level=excluded.level, gender=excluded.gender, environment=excluded.environment,
  weeks=excluded.weeks, days_per_week=excluded.days_per_week, est_minutes=excluded.est_minutes,
  calories=excluded.calories, tags=excluded.tags, status='published';

delete from public.workout_program_days
  where program_id = (select id from public.workout_programs where slug='pilates-baslangic-4h');
insert into public.workout_program_days (program_id, week, day, title, focus, sort_order)
values
  ((select id from public.workout_programs where slug='pilates-baslangic-4h'), 1, 1, 'Core Temeli', 'Karın & nefes', 1),
  ((select id from public.workout_programs where slug='pilates-baslangic-4h'), 1, 2, 'Kalça & Denge', 'Kalça & stabilite', 2),
  ((select id from public.workout_programs where slug='pilates-baslangic-4h'), 1, 3, 'Uzama & Kontrol', 'Esneklik & core', 3);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='pilates-baslangic-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Pilates Hundred' limit 1), 'Pilates Hundred', 2, '100 vuruş', 30, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='pilates-baslangic-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Pelvik Kıvrılma' limit 1), 'Pelvik Kıvrılma', 2, '10', 30, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='pilates-baslangic-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Ölü Böcek' limit 1), 'Ölü Böcek', 2, '8/taraf', 30, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='pilates-baslangic-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Göğüs Kaldırma' limit 1), 'Göğüs Kaldırma', 2, '12', 30, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='pilates-baslangic-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Pilates Plank' limit 1), 'Pilates Plank', 3, '20-40 sn', 30, 4);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='pilates-baslangic-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Midye (Clam)' limit 1), 'Midye (Clam)', 3, '12/taraf', 30, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='pilates-baslangic-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Omuz Köprüsü (Pilates)' limit 1), 'Omuz Köprüsü (Pilates)', 3, '12', 30, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='pilates-baslangic-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Kuş Köpek (Pilates)' limit 1), 'Kuş Köpek (Pilates)', 2, '8/taraf', 30, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='pilates-baslangic-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Tek Bacak Germe' limit 1), 'Tek Bacak Germe', 2, '10/taraf', 30, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='pilates-baslangic-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Tek Ayak Duruşu' limit 1), 'Tek Ayak Duruşu', 2, '30 sn/taraf', 20, 4);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='pilates-baslangic-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Roll Up' limit 1), 'Roll Up', 2, '8', 30, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='pilates-baslangic-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Omurga Germe' limit 1), 'Omurga Germe', 2, '8', 30, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='pilates-baslangic-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Criss Cross' limit 1), 'Criss Cross', 2, '10/taraf', 30, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='pilates-baslangic-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Yüzme (Pilates)' limit 1), 'Yüzme (Pilates)', 2, '30 sn', 30, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='pilates-baslangic-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Çocuk Duruşu' limit 1), 'Çocuk Duruşu', 1, '60 sn', 0, 4);

-- ===== Yoga Akışı · Esneklik & Denge =====
insert into public.workout_programs
  (slug, name, short_description, description, category, level, goal, gender, environment, weeks, days_per_week, est_minutes, calories, tags, status, sort_order)
values
  ('yoga-akisi-4h','Yoga Akışı · Esneklik & Denge','Nefesle akan yoga duruşları; esneklik, denge ve rahatlama.','Klasik yoga duruşlarını akış halinde uygularsın. Her duruşu nefesinle tut, gövdeni uzat ve dengeni geliştir. Gün sonunda gevşemeyle bitir.','yoga','beginner',null,'both','home',4,3,25,150,array['yoga','mobility','flexibility'],'published',1)
on conflict (slug) do update set
  name=excluded.name, short_description=excluded.short_description, description=excluded.description,
  category=excluded.category, level=excluded.level, gender=excluded.gender, environment=excluded.environment,
  weeks=excluded.weeks, days_per_week=excluded.days_per_week, est_minutes=excluded.est_minutes,
  calories=excluded.calories, tags=excluded.tags, status='published';

delete from public.workout_program_days
  where program_id = (select id from public.workout_programs where slug='yoga-akisi-4h');
insert into public.workout_program_days (program_id, week, day, title, focus, sort_order)
values
  ((select id from public.workout_programs where slug='yoga-akisi-4h'), 1, 1, 'Isınma Akışı', 'Tüm vücut', 1),
  ((select id from public.workout_programs where slug='yoga-akisi-4h'), 1, 2, 'Denge & Güç', 'Bacak & core', 2),
  ((select id from public.workout_programs where slug='yoga-akisi-4h'), 1, 3, 'Açılma & Gevşeme', 'Kalça & sırt', 3);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='yoga-akisi-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Selamlama A' limit 1), 'Selamlama A', 2, '3 tur', 20, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='yoga-akisi-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Aşağı Bakan Köpek' limit 1), 'Aşağı Bakan Köpek', 1, '45 sn', 15, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='yoga-akisi-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Kobra' limit 1), 'Kobra', 2, '30 sn', 15, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='yoga-akisi-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Kedi-İnek' limit 1), 'Kedi-İnek', 2, '10', 15, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='yoga-akisi-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Çocuk Duruşu' limit 1), 'Çocuk Duruşu', 1, '60 sn', 0, 4);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='yoga-akisi-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Savaşçı I' limit 1), 'Savaşçı I', 1, '30 sn/taraf', 15, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='yoga-akisi-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Savaşçı II' limit 1), 'Savaşçı II', 1, '30 sn/taraf', 15, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='yoga-akisi-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Ağaç Duruşu' limit 1), 'Ağaç Duruşu', 1, '30 sn/taraf', 15, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='yoga-akisi-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Üçgen Duruşu' limit 1), 'Üçgen Duruşu', 1, '30 sn/taraf', 15, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='yoga-akisi-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Tekne Duruşu' limit 1), 'Tekne Duruşu', 2, '20 sn', 20, 4);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='yoga-akisi-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Güvercin Duruşu' limit 1), 'Güvercin Duruşu', 1, '45 sn/taraf', 15, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='yoga-akisi-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Köprü Duruşu' limit 1), 'Köprü Duruşu', 2, '30 sn', 20, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='yoga-akisi-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Oturarak Öne Eğilme' limit 1), 'Oturarak Öne Eğilme', 1, '45 sn', 15, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='yoga-akisi-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Sırtüstü Bükülme' limit 1), 'Sırtüstü Bükülme', 1, '30 sn/taraf', 10, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='yoga-akisi-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Şavasana' limit 1), 'Şavasana', 1, '3 dk', 0, 4);

-- ===== Sabah Mobilite Rutini · 10 Dakika =====
insert into public.workout_programs
  (slug, name, short_description, description, category, level, goal, gender, environment, weeks, days_per_week, est_minutes, calories, tags, status, sort_order)
values
  ('sabah-mobilite-2h','Sabah Mobilite Rutini · 10 Dakika','Her sabah 10 dakika, tüm eklemleri uyandıran mobilite akışı.','Güne enerjik başlamak için kısa bir mobilite akışı. Eklem hareket açıklığını açar, tutuklukları giderir. Her gün tekrarlanabilir.','mobility','beginner',null,'both','home',2,7,10,60,array['mobility','wellness'],'published',2)
on conflict (slug) do update set
  name=excluded.name, short_description=excluded.short_description, description=excluded.description,
  category=excluded.category, level=excluded.level, gender=excluded.gender, environment=excluded.environment,
  weeks=excluded.weeks, days_per_week=excluded.days_per_week, est_minutes=excluded.est_minutes,
  calories=excluded.calories, tags=excluded.tags, status='published';

delete from public.workout_program_days
  where program_id = (select id from public.workout_programs where slug='sabah-mobilite-2h');
insert into public.workout_program_days (program_id, week, day, title, focus, sort_order)
values
  ((select id from public.workout_programs where slug='sabah-mobilite-2h'), 1, 1, 'Tam Vücut Uyanış', 'Tüm eklemler', 1);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='sabah-mobilite-2h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Kedi-İnek' limit 1), 'Kedi-İnek', 1, '10', 10, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='sabah-mobilite-2h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Kol Daireleri' limit 1), 'Kol Daireleri', 1, '10/yön', 10, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='sabah-mobilite-2h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Kalça CARs' limit 1), 'Kalça CARs', 1, '5/taraf', 10, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='sabah-mobilite-2h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='90/90 Kalça Geçişi' limit 1), '90/90 Kalça Geçişi', 1, '8/taraf', 10, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='sabah-mobilite-2h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Dünyanın En İyi Germesi' limit 1), 'Dünyanın En İyi Germesi', 1, '5/taraf', 10, 4),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='sabah-mobilite-2h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Solucan Yürüyüşü' limit 1), 'Solucan Yürüyüşü', 1, '6', 10, 5);

-- ===== Esneklik & Toparlanma · 4 Hafta =====
insert into public.workout_programs
  (slug, name, short_description, description, category, level, goal, gender, environment, weeks, days_per_week, est_minutes, calories, tags, status, sort_order)
values
  ('esneklik-toparlanma-4h','Esneklik & Toparlanma · 4 Hafta','Antrenman sonrası ve dinlenme günleri için statik germe rutini.','Kasları uzatan, toparlanmayı hızlandıran statik germe programı. Her germeyi 20-40 sn sabit tut, nefes vererek gevşe.','flexibility','beginner',null,'both','home',4,3,20,90,array['flexibility','mobility','recovery'],'published',3)
on conflict (slug) do update set
  name=excluded.name, short_description=excluded.short_description, description=excluded.description,
  category=excluded.category, level=excluded.level, gender=excluded.gender, environment=excluded.environment,
  weeks=excluded.weeks, days_per_week=excluded.days_per_week, est_minutes=excluded.est_minutes,
  calories=excluded.calories, tags=excluded.tags, status='published';

delete from public.workout_program_days
  where program_id = (select id from public.workout_programs where slug='esneklik-toparlanma-4h');
insert into public.workout_program_days (program_id, week, day, title, focus, sort_order)
values
  ((select id from public.workout_programs where slug='esneklik-toparlanma-4h'), 1, 1, 'Alt Vücut', 'Bacak & kalça', 1),
  ((select id from public.workout_programs where slug='esneklik-toparlanma-4h'), 1, 2, 'Üst Vücut', 'Sırt & omuz', 2),
  ((select id from public.workout_programs where slug='esneklik-toparlanma-4h'), 1, 3, 'Kalça Açıcı', 'Kalça & bel', 3);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='esneklik-toparlanma-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Hamstring Germe' limit 1), 'Hamstring Germe', 1, '30 sn/taraf', 10, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='esneklik-toparlanma-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Quadriceps Germe' limit 1), 'Quadriceps Germe', 1, '30 sn/taraf', 10, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='esneklik-toparlanma-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Kalça Fleksör Germe' limit 1), 'Kalça Fleksör Germe', 1, '30 sn/taraf', 10, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='esneklik-toparlanma-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Baldır Germe' limit 1), 'Baldır Germe', 1, '30 sn/taraf', 10, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='esneklik-toparlanma-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Figür 4 Germe' limit 1), 'Figür 4 Germe', 1, '30 sn/taraf', 10, 4);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='esneklik-toparlanma-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Göğüs Germe (Kapı)' limit 1), 'Göğüs Germe (Kapı)', 1, '30 sn', 10, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='esneklik-toparlanma-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Lat Germe' limit 1), 'Lat Germe', 1, '30 sn/taraf', 10, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='esneklik-toparlanma-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Triceps Germe' limit 1), 'Triceps Germe', 1, '30 sn/taraf', 10, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='esneklik-toparlanma-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Boyun Yan Germe' limit 1), 'Boyun Yan Germe', 1, '20 sn/taraf', 10, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='esneklik-toparlanma-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='İğneden Geçirme' limit 1), 'İğneden Geçirme', 1, '30 sn/taraf', 10, 4);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='esneklik-toparlanma-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Kelebek Germe' limit 1), 'Kelebek Germe', 1, '45 sn', 10, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='esneklik-toparlanma-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Güvercin Duruşu' limit 1), 'Güvercin Duruşu', 1, '45 sn/taraf', 10, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='esneklik-toparlanma-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Piriformis Germe' limit 1), 'Piriformis Germe', 1, '30 sn/taraf', 10, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='esneklik-toparlanma-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Bel Rotasyon Germe' limit 1), 'Bel Rotasyon Germe', 1, '30 sn/taraf', 10, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='esneklik-toparlanma-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Çocuk Duruşu' limit 1), 'Çocuk Duruşu', 1, '60 sn', 0, 4);

-- ===== Core & Denge · 4 Hafta =====
insert into public.workout_programs
  (slug, name, short_description, description, category, level, goal, gender, environment, weeks, days_per_week, est_minutes, calories, tags, status, sort_order)
values
  ('core-denge-4h','Core & Denge · 4 Hafta','Güçlü bir merkez ve stabil denge için pilates + denge kombinasyonu.','Karın, bel ve kalça stabilizatörlerini güçlendirip dengeyi geliştirir. Günlük yaşam ve tüm sporlar için sağlam bir temel kurar.','functional','beginner',null,'both','home',4,3,25,160,array['core','balance','functional'],'published',4)
on conflict (slug) do update set
  name=excluded.name, short_description=excluded.short_description, description=excluded.description,
  category=excluded.category, level=excluded.level, gender=excluded.gender, environment=excluded.environment,
  weeks=excluded.weeks, days_per_week=excluded.days_per_week, est_minutes=excluded.est_minutes,
  calories=excluded.calories, tags=excluded.tags, status='published';

delete from public.workout_program_days
  where program_id = (select id from public.workout_programs where slug='core-denge-4h');
insert into public.workout_program_days (program_id, week, day, title, focus, sort_order)
values
  ((select id from public.workout_programs where slug='core-denge-4h'), 1, 1, 'Merkez Gücü', 'Karın & bel', 1),
  ((select id from public.workout_programs where slug='core-denge-4h'), 1, 2, 'Denge', 'Stabilite', 2),
  ((select id from public.workout_programs where slug='core-denge-4h'), 1, 3, 'Kombine', 'Core + kalça', 3);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='core-denge-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Pilates Plank' limit 1), 'Pilates Plank', 3, '30-45 sn', 30, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='core-denge-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Hollow Body Hold' limit 1), 'Hollow Body Hold', 3, '20-30 sn', 30, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='core-denge-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Ölü Böcek' limit 1), 'Ölü Böcek', 3, '10/taraf', 30, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='core-denge-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Superman Hold' limit 1), 'Superman Hold', 3, '20 sn', 30, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='core-denge-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Criss Cross' limit 1), 'Criss Cross', 2, '12/taraf', 30, 4);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='core-denge-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Tek Ayak Duruşu' limit 1), 'Tek Ayak Duruşu', 3, '40 sn/taraf', 20, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='core-denge-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Uçak Duruşu' limit 1), 'Uçak Duruşu', 3, '20 sn/taraf', 30, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='core-denge-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Tek Ayak Deadlift (Denge)' limit 1), 'Tek Ayak Deadlift (Denge)', 3, '8/taraf', 30, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='core-denge-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Topuk-Parmak Yürüyüş' limit 1), 'Topuk-Parmak Yürüyüş', 2, '10 adım', 20, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='core-denge-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Bosu Plank' limit 1), 'Bosu Plank', 2, '30 sn', 30, 4);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='core-denge-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Omuz Köprüsü (Pilates)' limit 1), 'Omuz Köprüsü (Pilates)', 3, '12', 30, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='core-denge-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Kuş Köpek (Pilates)' limit 1), 'Kuş Köpek (Pilates)', 3, '8/taraf', 30, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='core-denge-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Yan Plank (Yoga)' limit 1), 'Yan Plank (Yoga)', 3, '20-30 sn/taraf', 30, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='core-denge-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Midye (Clam)' limit 1), 'Midye (Clam)', 3, '12/taraf', 30, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='core-denge-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Tek Ayak Kalf' limit 1), 'Tek Ayak Kalf', 2, '12/taraf', 20, 4);

-- ===== Ev Kalisteniği · Başlangıç 6 Hafta =====
insert into public.workout_programs
  (slug, name, short_description, description, category, level, goal, gender, environment, weeks, days_per_week, est_minutes, calories, tags, status, sort_order)
values
  ('ev-kalisteni-baslangic-6h','Ev Kalisteniği · Başlangıç 6 Hafta','Ekipmansız, sadece vücut ağırlığıyla tüm vücut güç programı.','Barfiks/paralel varsa ideal; yoksa alternatifleriyle evde tüm vücudu çalıştırırsın. İtme, çekme ve bacak günleriyle dengeli gelişim.','calisthenics','beginner',null,'both','home',6,3,35,250,array['calisthenics','muscle_gain','strength'],'published',5)
on conflict (slug) do update set
  name=excluded.name, short_description=excluded.short_description, description=excluded.description,
  category=excluded.category, level=excluded.level, gender=excluded.gender, environment=excluded.environment,
  weeks=excluded.weeks, days_per_week=excluded.days_per_week, est_minutes=excluded.est_minutes,
  calories=excluded.calories, tags=excluded.tags, status='published';

delete from public.workout_program_days
  where program_id = (select id from public.workout_programs where slug='ev-kalisteni-baslangic-6h');
insert into public.workout_program_days (program_id, week, day, title, focus, sort_order)
values
  ((select id from public.workout_programs where slug='ev-kalisteni-baslangic-6h'), 1, 1, 'İtiş', 'Göğüs & omuz & triceps', 1),
  ((select id from public.workout_programs where slug='ev-kalisteni-baslangic-6h'), 1, 2, 'Çekiş', 'Sırt & biceps', 2),
  ((select id from public.workout_programs where slug='ev-kalisteni-baslangic-6h'), 1, 3, 'Bacak', 'Quadriceps & kalça', 3);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='ev-kalisteni-baslangic-6h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Pike Şınav' limit 1), 'Pike Şınav', 4, '8-12', 90, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='ev-kalisteni-baslangic-6h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Elmas Şınav' limit 1), 'Elmas Şınav', 3, '8-12', 75, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='ev-kalisteni-baslangic-6h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Dips (Paralel)' limit 1), 'Dips (Paralel)', 3, '6-10', 90, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='ev-kalisteni-baslangic-6h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Pseudo Planche Şınav' limit 1), 'Pseudo Planche Şınav', 3, '6-10', 75, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='ev-kalisteni-baslangic-6h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Pilates Plank' limit 1), 'Pilates Plank', 3, '40 sn', 45, 4);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='ev-kalisteni-baslangic-6h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Avustralya Row' limit 1), 'Avustralya Row', 4, '8-12', 90, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='ev-kalisteni-baslangic-6h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Dar Tutuş Barfiks' limit 1), 'Dar Tutuş Barfiks', 3, '5-8', 90, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='ev-kalisteni-baslangic-6h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Superman Hold' limit 1), 'Superman Hold', 3, '25 sn', 45, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='ev-kalisteni-baslangic-6h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Barfikste Bacak Kaldırma' limit 1), 'Barfikste Bacak Kaldırma', 3, '8-12', 60, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='ev-kalisteni-baslangic-6h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Hollow Body Hold' limit 1), 'Hollow Body Hold', 3, '25 sn', 45, 4);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='ev-kalisteni-baslangic-6h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Pistol Squat' limit 1), 'Pistol Squat', 4, '5-8/taraf', 90, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='ev-kalisteni-baslangic-6h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Shrimp Squat' limit 1), 'Shrimp Squat', 3, '6/taraf', 75, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='ev-kalisteni-baslangic-6h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Nordic Curl' limit 1), 'Nordic Curl', 3, '5-8', 90, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='ev-kalisteni-baslangic-6h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Tek Ayak Kalf' limit 1), 'Tek Ayak Kalf', 4, '12/taraf', 45, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='ev-kalisteni-baslangic-6h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Sissy Squat' limit 1), 'Sissy Squat', 3, '10-12', 60, 4);

-- ===== HIIT Yağ Yakım · 4 Hafta =====
insert into public.workout_programs
  (slug, name, short_description, description, category, level, goal, gender, environment, weeks, days_per_week, est_minutes, calories, tags, status, sort_order)
values
  ('hiit-yag-yakim-4h','HIIT Yağ Yakım · 4 Hafta','Kısa, yoğun aralıklarla maksimum kalori yakımı — ekipmansız.','40 sn efor / 20 sn dinlenme formatında yüksek tempolu bir devre. Kalp atışını yükseltir, yağ yakımını ve kondisyonu artırır. Her turdan sonra 1 dk dinlen, 3-4 tur yap.','hiit','intermediate',null,'both','home',4,4,20,300,array['hiit','fat_burn','endurance'],'published',6)
on conflict (slug) do update set
  name=excluded.name, short_description=excluded.short_description, description=excluded.description,
  category=excluded.category, level=excluded.level, gender=excluded.gender, environment=excluded.environment,
  weeks=excluded.weeks, days_per_week=excluded.days_per_week, est_minutes=excluded.est_minutes,
  calories=excluded.calories, tags=excluded.tags, status='published';

delete from public.workout_program_days
  where program_id = (select id from public.workout_programs where slug='hiit-yag-yakim-4h');
insert into public.workout_program_days (program_id, week, day, title, focus, sort_order)
values
  ((select id from public.workout_programs where slug='hiit-yag-yakim-4h'), 1, 1, 'Devre A', 'Tam vücut', 1),
  ((select id from public.workout_programs where slug='hiit-yag-yakim-4h'), 1, 2, 'Devre B', 'Alt vücut & core', 2),
  ((select id from public.workout_programs where slug='hiit-yag-yakim-4h'), 1, 3, 'Devre C', 'Kondisyon', 3),
  ((select id from public.workout_programs where slug='hiit-yag-yakim-4h'), 1, 4, 'Devre D', 'Yakım finali', 4);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Jumping Jack' limit 1), 'Jumping Jack', 4, '40 sn', 20, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Dağcı' limit 1), 'Dağcı', 4, '40 sn', 20, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Squat Jump' limit 1), 'Squat Jump', 4, '40 sn', 20, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Sprawl' limit 1), 'Sprawl', 4, '40 sn', 20, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Yüksek Diz Koşu' limit 1), 'Yüksek Diz Koşu', 4, '40 sn', 60, 4);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Skater Sıçrama' limit 1), 'Skater Sıçrama', 4, '40 sn', 20, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Tuck Jump' limit 1), 'Tuck Jump', 4, '30 sn', 20, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Plank Jack' limit 1), 'Plank Jack', 4, '40 sn', 20, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Lateral Bound' limit 1), 'Lateral Bound', 4, '40 sn', 20, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Dağcı' limit 1), 'Dağcı', 4, '40 sn', 60, 4);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='İp Atlama' limit 1), 'İp Atlama', 4, '60 sn', 20, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Broad Jump' limit 1), 'Broad Jump', 4, '8 tekrar', 30, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Fast Feet' limit 1), 'Fast Feet', 4, '30 sn', 20, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Jumping Jack' limit 1), 'Jumping Jack', 4, '40 sn', 20, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Hollow Body Hold' limit 1), 'Hollow Body Hold', 4, '30 sn', 45, 4);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=4), (select id from public.exercises where name='Squat Jump' limit 1), 'Squat Jump', 4, '40 sn', 20, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=4), (select id from public.exercises where name='Dağcı' limit 1), 'Dağcı', 4, '40 sn', 20, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=4), (select id from public.exercises where name='Star Jump' limit 1), 'Star Jump', 4, '30 sn', 20, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=4), (select id from public.exercises where name='Yüksek Diz Koşu' limit 1), 'Yüksek Diz Koşu', 4, '40 sn', 20, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='hiit-yag-yakim-4h') and wd.week=1 and wd.day=4), (select id from public.exercises where name='Plank Jack' limit 1), 'Plank Jack', 4, '40 sn', 60, 4);

-- ===== Fonksiyonel Kondisyon · 4 Hafta =====
insert into public.workout_programs
  (slug, name, short_description, description, category, level, goal, gender, environment, weeks, days_per_week, est_minutes, calories, tags, status, sort_order)
values
  ('fonksiyonel-kondisyon-4h','Fonksiyonel Kondisyon · 4 Hafta','Kettlebell ve vücut ağırlığıyla güç + dayanıklılık kombinasyonu.','Fonksiyonel hareket kalıplarıyla (menteşe, taşıma, itiş) gerçek hayat gücünü ve kondisyonu birlikte geliştirir. Kettlebell veya dambıl uygundur.','functional','intermediate',null,'both','both',4,3,40,320,array['functional','strength','endurance'],'published',7)
on conflict (slug) do update set
  name=excluded.name, short_description=excluded.short_description, description=excluded.description,
  category=excluded.category, level=excluded.level, gender=excluded.gender, environment=excluded.environment,
  weeks=excluded.weeks, days_per_week=excluded.days_per_week, est_minutes=excluded.est_minutes,
  calories=excluded.calories, tags=excluded.tags, status='published';

delete from public.workout_program_days
  where program_id = (select id from public.workout_programs where slug='fonksiyonel-kondisyon-4h');
insert into public.workout_program_days (program_id, week, day, title, focus, sort_order)
values
  ((select id from public.workout_programs where slug='fonksiyonel-kondisyon-4h'), 1, 1, 'Güç & Menteşe', 'Kalça & sırt', 1),
  ((select id from public.workout_programs where slug='fonksiyonel-kondisyon-4h'), 1, 2, 'Kondisyon', 'Tüm vücut', 2),
  ((select id from public.workout_programs where slug='fonksiyonel-kondisyon-4h'), 1, 3, 'Taşıma & Core', 'Stabilite', 3);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='fonksiyonel-kondisyon-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Kettlebell Swing' limit 1), 'Kettlebell Swing', 4, '15', 60, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='fonksiyonel-kondisyon-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Türk Kalkışı' limit 1), 'Türk Kalkışı', 3, '3/taraf', 90, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='fonksiyonel-kondisyon-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Farmer Carry' limit 1), 'Farmer Carry', 4, '30 m', 60, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='fonksiyonel-kondisyon-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Kutu Sıçraması' limit 1), 'Kutu Sıçraması', 4, '8', 60, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='fonksiyonel-kondisyon-4h') and wd.week=1 and wd.day=1), (select id from public.exercises where name='Pilates Plank' limit 1), 'Pilates Plank', 3, '45 sn', 45, 4);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='fonksiyonel-kondisyon-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Thruster' limit 1), 'Thruster', 4, '12', 60, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='fonksiyonel-kondisyon-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Wall Ball' limit 1), 'Wall Ball', 4, '15', 60, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='fonksiyonel-kondisyon-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Dağcı' limit 1), 'Dağcı', 4, '40 sn', 30, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='fonksiyonel-kondisyon-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Kettlebell Halo' limit 1), 'Kettlebell Halo', 3, '10/yön', 45, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='fonksiyonel-kondisyon-4h') and wd.week=1 and wd.day=2), (select id from public.exercises where name='Superman Hold' limit 1), 'Superman Hold', 3, '30 sn', 45, 4);
insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='fonksiyonel-kondisyon-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Farmer Carry' limit 1), 'Farmer Carry', 4, '40 m', 60, 0),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='fonksiyonel-kondisyon-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Türk Kalkışı' limit 1), 'Türk Kalkışı', 3, '3/taraf', 90, 1),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='fonksiyonel-kondisyon-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Hollow Body Hold' limit 1), 'Hollow Body Hold', 4, '30 sn', 45, 2),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='fonksiyonel-kondisyon-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Yan Plank (Yoga)' limit 1), 'Yan Plank (Yoga)', 3, '30 sn/taraf', 45, 3),
  ((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='fonksiyonel-kondisyon-4h') and wd.week=1 and wd.day=3), (select id from public.exercises where name='Cam Sileceği' limit 1), 'Cam Sileceği', 3, '10', 45, 4);
