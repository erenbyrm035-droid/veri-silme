-- ============================================================================
-- AI Fitness Coach — Başlangıç Verileri (Seed)
-- Egzersiz kütüphanesi ve Türk mutfağı odaklı yiyecek veritabanı.
-- ============================================================================

-- ---- EGZERSİZLER ----
insert into public.exercises (name, muscle_group, description, difficulty, equipment, video_url) values
  ('Şınav',              'Göğüs',    'Vücut ağırlığıyla göğüs, omuz ve triceps çalıştıran temel hareket.', 'beginner',     'Ekipmansız', 'https://www.youtube.com/watch?v=IODxDxX7oi4'),
  ('Bench Press',        'Göğüs',    'Barbell ile göğüs kaslarını hedefleyen bileşik hareket.',            'intermediate', 'Barbell',    'https://www.youtube.com/watch?v=rT7DgCr-3pg'),
  ('Squat',              'Bacak',    'Bacak ve kalça kaslarını çalıştıran temel bileşik hareket.',         'beginner',     'Barbell',    'https://www.youtube.com/watch?v=ultWZbUMPL8'),
  ('Deadlift',           'Sırt',     'Tüm arka zinciri çalıştıran güç hareketi.',                          'advanced',     'Barbell',    'https://www.youtube.com/watch?v=op9kVnSso6Q'),
  ('Barfiks',            'Sırt',     'Vücut ağırlığıyla sırt ve biceps çalıştıran hareket.',               'intermediate', 'Barfiks Barı', 'https://www.youtube.com/watch?v=eGo4IYlbE5g'),
  ('Lat Pulldown',       'Sırt',     'Makine ile sırt genişliğini geliştiren hareket.',                    'beginner',     'Makine',     'https://www.youtube.com/watch?v=CAwf7n6Luuc'),
  ('Omuz Press',         'Omuz',     'Dumbbell veya barbell ile omuz kaslarını çalıştırır.',               'intermediate', 'Dumbbell',   'https://www.youtube.com/watch?v=qEwKCR5JCog'),
  ('Biceps Curl',        'Kol',      'Dumbbell ile biceps izolasyon hareketi.',                            'beginner',     'Dumbbell',   'https://www.youtube.com/watch?v=ykJmrZ5v0Oo'),
  ('Triceps Pushdown',   'Kol',      'Kablo ile triceps izolasyon hareketi.',                              'beginner',     'Makine',     'https://www.youtube.com/watch?v=2-LAMcpzODU'),
  ('Plank',              'Karın',    'İzometrik core dayanıklılık hareketi.',                              'beginner',     'Ekipmansız', 'https://www.youtube.com/watch?v=pSHjTRCQxIw'),
  ('Mekik',              'Karın',    'Karın kaslarını çalıştıran temel hareket.',                          'beginner',     'Ekipmansız', 'https://www.youtube.com/watch?v=1fbU_MkV7NE'),
  ('Lunges',             'Bacak',    'Tek bacak gücü ve dengeyi geliştiren hareket.',                      'beginner',     'Ekipmansız', 'https://www.youtube.com/watch?v=QOVaHwm-Q6U'),
  ('Leg Press',          'Bacak',    'Makine ile bacak kaslarını güvenli şekilde çalıştırır.',             'beginner',     'Makine',     'https://www.youtube.com/watch?v=IZxyjW7MPJQ'),
  ('Koşu Bandı',         'Kardiyo',  'Kondisyon ve yağ yakımı için kardiyo hareketi.',                     'beginner',     'Koşu Bandı', 'https://www.youtube.com/watch?v=kVnyY17VS9Y'),
  ('Burpee',             'Kardiyo',  'Tüm vücudu çalıştıran yüksek yoğunluklu hareket.',                   'advanced',     'Ekipmansız', 'https://www.youtube.com/watch?v=TU8QYVW0gDU')
on conflict do nothing;

-- ---- YİYECEKLER (100 g başına, Türk mutfağı odaklı) ----
insert into public.foods (name, calories, protein_g, carbs_g, fat_g, serving_desc, is_turkish) values
  ('Izgara Tavuk Göğsü', 165, 31.0, 0.0,  3.6,  '100 g',  true),
  ('Dana Kırmızı Et',    250, 26.0, 0.0,  15.0, '100 g',  true),
  ('Somon Balığı',       208, 20.0, 0.0,  13.0, '100 g',  true),
  ('Hamsi',              131, 20.0, 0.0,  5.0,  '100 g',  true),
  ('Yumurta',            155, 13.0, 1.1,  11.0, '2 adet (~100 g)', true),
  ('Yoğurt (Tam Yağlı)', 61,  3.5,  4.7,  3.3,  '100 g',  true),
  ('Süzme Peynir',       98,  11.0, 3.4,  4.3,  '100 g',  true),
  ('Beyaz Pilav',        130, 2.7,  28.0, 0.3,  '100 g',  true),
  ('Bulgur Pilavı',      83,  3.0,  18.6, 0.2,  '100 g',  true),
  ('Mercimek Çorbası',   85,  4.5,  12.0, 2.0,  '1 kase (~250 ml)', true),
  ('Tam Buğday Ekmek',   247, 13.0, 41.0, 3.4,  '100 g',  true),
  ('Kuru Fasulye',       127, 8.7,  22.8, 0.5,  '100 g',  true),
  ('Nohut',              164, 8.9,  27.4, 2.6,  '100 g',  true),
  ('Muz',                89,  1.1,  22.8, 0.3,  '1 orta boy', true),
  ('Elma',               52,  0.3,  14.0, 0.2,  '1 orta boy', true),
  ('Yulaf Ezmesi',       389, 16.9, 66.3, 6.9,  '100 g',  true),
  ('Zeytinyağı',         884, 0.0,  0.0,  100.0,'100 ml', true),
  ('Ceviz',              654, 15.0, 14.0, 65.0, '100 g',  true),
  ('Protein Tozu (Whey)',400, 80.0, 8.0,  6.0,  '100 g',  false),
  ('Ayran',              38,  1.7,  2.9,  2.0,  '1 bardak (~200 ml)', true)
on conflict do nothing;
