-- ============================================================================
-- Viva AI Coach — Türk Mutfağı Besin Veritabanı (Sprint 10)
-- 62 besin; makro + mikro (lif/şeker/sodyum/potasyum) + kategori.
-- Ölçeklenebilir: on binlerce besin aynı yapıyla eklenebilir.
-- Idempotent: yinelenen isimler temizlenir, lower(name) benzersizdir, upsert.
-- migration 0010 SONRASI çalıştırılır.
-- ============================================================================

-- Yinelenen isimleri temizle (birini tut) ve benzersiz index kur.
delete from public.foods a using public.foods b
  where a.ctid < b.ctid and lower(a.name) = lower(b.name);
create unique index if not exists uq_foods_name_lower on public.foods (lower(name));

insert into public.foods
  (name, category, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, potassium_mg, serving_desc, serving_grams, is_turkish, is_verified, source)
values
  ('Yumurta', 'Yumurta', 155, 13, 1.1, 11, 0, 1.1, 124, 126, '1 adet (~50 g)', 100, true, true, 'seed_tr'),
  ('Tavuk Göğsü (haşlanmış)', 'Et & Tavuk', 165, 31, 0, 3.6, 0, 0, 74, 256, '100 g', 100, true, true, 'seed_tr'),
  ('Hindi Göğsü', 'Et & Tavuk', 135, 30, 0, 1, 0, 0, 103, 239, '100 g', 100, true, true, 'seed_tr'),
  ('Kırmızı Et (dana, yağsız)', 'Et & Tavuk', 217, 26, 0, 12, 0, 0, 55, 330, '100 g', 100, true, true, 'seed_tr'),
  ('Kıyma (dana, %15 yağ)', 'Et & Tavuk', 250, 26, 0, 17, 0, 0, 75, 318, '100 g', 100, true, true, 'seed_tr'),
  ('Köfte (ızgara)', 'Yemekler', 240, 18, 6, 16, 0.5, 1, 480, 300, '100 g', 100, true, true, 'seed_tr'),
  ('Sucuk', 'Türk Kahvaltısı', 400, 22, 2, 34, 0, 0, 1200, 260, '100 g', 100, true, true, 'seed_tr'),
  ('Döner (et)', 'Yemekler', 280, 20, 8, 19, 0.5, 1, 690, 290, '100 g', 100, true, true, 'seed_tr'),
  ('Somon', 'Balık', 208, 20, 0, 13, 0, 0, 59, 363, '100 g', 100, true, true, 'seed_tr'),
  ('Ton Balığı (suda)', 'Balık', 116, 26, 0, 1, 0, 0, 247, 237, '100 g', 100, true, true, 'seed_tr'),
  ('Hamsi', 'Balık', 131, 20, 0, 5, 0, 0, 104, 383, '100 g', 100, true, true, 'seed_tr'),
  ('Levrek', 'Balık', 124, 24, 0, 2.5, 0, 0, 68, 328, '100 g', 100, true, true, 'seed_tr'),
  ('Yoğurt (tam yağlı)', 'Süt Ürünleri', 61, 3.5, 4.7, 3.3, 0, 4.7, 46, 155, '100 g', 100, true, true, 'seed_tr'),
  ('Süzme Yoğurt', 'Süt Ürünleri', 97, 10, 3.6, 5, 0, 3.6, 36, 141, '100 g', 100, true, true, 'seed_tr'),
  ('Kefir', 'Süt Ürünleri', 55, 3.3, 4.5, 3, 0, 4.5, 40, 164, '100 g', 100, true, true, 'seed_tr'),
  ('Ayran', 'Süt Ürünleri', 38, 1.8, 3, 2, 0, 3, 250, 90, '100 g', 100, true, true, 'seed_tr'),
  ('Beyaz Peynir', 'Süt Ürünleri', 264, 14, 4, 21, 0, 1, 900, 62, '100 g', 100, true, true, 'seed_tr'),
  ('Lor Peyniri', 'Süt Ürünleri', 98, 11, 3.4, 4.3, 0, 2.7, 330, 104, '100 g', 100, true, true, 'seed_tr'),
  ('Kaşar Peyniri', 'Süt Ürünleri', 350, 25, 2, 27, 0, 0.5, 620, 95, '100 g', 100, true, true, 'seed_tr'),
  ('Süt (yarım yağlı)', 'Süt Ürünleri', 50, 3.4, 4.8, 1.8, 0, 4.8, 44, 150, '100 g', 100, true, true, 'seed_tr'),
  ('Yulaf', 'Tahıllar', 389, 17, 66, 7, 10, 1, 2, 429, '100 g', 100, true, true, 'seed_tr'),
  ('Pirinç (pişmiş)', 'Tahıllar', 130, 2.7, 28, 0.3, 0.4, 0.1, 1, 35, '100 g', 100, true, true, 'seed_tr'),
  ('Bulgur (pişmiş)', 'Tahıllar', 83, 3, 19, 0.2, 4.5, 0.1, 5, 68, '100 g', 100, true, true, 'seed_tr'),
  ('Makarna (pişmiş)', 'Tahıllar', 131, 5, 25, 1.1, 1.8, 0.6, 6, 44, '100 g', 100, true, true, 'seed_tr'),
  ('Tam Buğday Ekmek', 'Tahıllar', 247, 13, 41, 3.4, 7, 6, 400, 250, '100 g', 100, true, true, 'seed_tr'),
  ('Kinoa (pişmiş)', 'Tahıllar', 120, 4.4, 21, 1.9, 2.8, 0.9, 7, 172, '100 g', 100, true, true, 'seed_tr'),
  ('Mercimek (pişmiş)', 'Bakliyat', 116, 9, 20, 0.4, 8, 1.8, 2, 369, '100 g', 100, true, true, 'seed_tr'),
  ('Nohut (pişmiş)', 'Bakliyat', 164, 9, 27, 2.6, 8, 5, 7, 291, '100 g', 100, true, true, 'seed_tr'),
  ('Kuru Fasulye (pişmiş)', 'Bakliyat', 127, 9, 23, 0.5, 6, 0.3, 1, 405, '100 g', 100, true, true, 'seed_tr'),
  ('Barbunya (pişmiş)', 'Bakliyat', 127, 9, 22, 0.5, 6, 0.3, 1, 403, '100 g', 100, true, true, 'seed_tr'),
  ('Domates', 'Sebze', 18, 0.9, 3.9, 0.2, 1.2, 2.6, 5, 237, '100 g', 100, true, true, 'seed_tr'),
  ('Salatalık', 'Sebze', 15, 0.7, 3.6, 0.1, 0.5, 1.7, 2, 147, '100 g', 100, true, true, 'seed_tr'),
  ('Brokoli', 'Sebze', 34, 2.8, 7, 0.4, 2.6, 1.7, 33, 316, '100 g', 100, true, true, 'seed_tr'),
  ('Ispanak', 'Sebze', 23, 2.9, 3.6, 0.4, 2.2, 0.4, 79, 558, '100 g', 100, true, true, 'seed_tr'),
  ('Patates (haşlanmış)', 'Sebze', 87, 1.9, 20, 0.1, 1.8, 0.9, 4, 379, '100 g', 100, true, true, 'seed_tr'),
  ('Biber (yeşil)', 'Sebze', 20, 0.9, 4.6, 0.2, 1.7, 2.4, 3, 175, '100 g', 100, true, true, 'seed_tr'),
  ('Patlıcan', 'Sebze', 25, 1, 6, 0.2, 3, 3.5, 2, 229, '100 g', 100, true, true, 'seed_tr'),
  ('Havuç', 'Sebze', 41, 0.9, 10, 0.2, 2.8, 4.7, 69, 320, '100 g', 100, true, true, 'seed_tr'),
  ('Muz', 'Meyve', 89, 1.1, 23, 0.3, 2.6, 12, 1, 358, '100 g', 100, true, true, 'seed_tr'),
  ('Elma', 'Meyve', 52, 0.3, 14, 0.2, 2.4, 10, 1, 107, '100 g', 100, true, true, 'seed_tr'),
  ('Portakal', 'Meyve', 47, 0.9, 12, 0.1, 2.4, 9, 0, 181, '100 g', 100, true, true, 'seed_tr'),
  ('Çilek', 'Meyve', 32, 0.7, 8, 0.3, 2, 4.9, 1, 153, '100 g', 100, true, true, 'seed_tr'),
  ('Üzüm', 'Meyve', 69, 0.7, 18, 0.2, 0.9, 16, 2, 191, '100 g', 100, true, true, 'seed_tr'),
  ('Karpuz', 'Meyve', 30, 0.6, 8, 0.2, 0.4, 6, 1, 112, '100 g', 100, true, true, 'seed_tr'),
  ('Ceviz', 'Kuruyemiş', 654, 15, 14, 65, 6.7, 2.6, 2, 441, '100 g', 100, true, true, 'seed_tr'),
  ('Badem', 'Kuruyemiş', 579, 21, 22, 50, 12.5, 4.4, 1, 733, '100 g', 100, true, true, 'seed_tr'),
  ('Fındık', 'Kuruyemiş', 628, 15, 17, 61, 9.7, 4.3, 0, 680, '100 g', 100, true, true, 'seed_tr'),
  ('Fıstık (yer)', 'Kuruyemiş', 567, 26, 16, 49, 8.5, 4, 18, 705, '100 g', 100, true, true, 'seed_tr'),
  ('Menemen', 'Türk Kahvaltısı', 150, 8, 6, 11, 1.5, 3, 380, 260, '100 g', 100, true, true, 'seed_tr'),
  ('Zeytin (siyah)', 'Türk Kahvaltısı', 115, 0.8, 6, 11, 3.2, 0, 735, 8, '100 g', 100, true, true, 'seed_tr'),
  ('Bal', 'Türk Kahvaltısı', 304, 0.3, 82, 0, 0.2, 82, 4, 52, '100 g', 100, true, true, 'seed_tr'),
  ('Tereyağı', 'Türk Kahvaltısı', 717, 0.9, 0.1, 81, 0, 0.1, 11, 24, '100 g', 100, true, true, 'seed_tr'),
  ('Lahmacun', 'Yemekler', 220, 10, 30, 7, 2, 2, 430, 180, '100 g', 100, true, true, 'seed_tr'),
  ('Pide (kıymalı)', 'Yemekler', 270, 12, 33, 10, 1.8, 2, 500, 190, '100 g', 100, true, true, 'seed_tr'),
  ('Mercimek Çorbası', 'Yemekler', 60, 3.5, 9, 1.2, 2, 1, 320, 180, '100 g', 100, true, true, 'seed_tr'),
  ('Pilav (tereyağlı)', 'Yemekler', 150, 3, 28, 3, 0.5, 0.1, 210, 40, '100 g', 100, true, true, 'seed_tr'),
  ('Protein Tozu (whey)', 'Atıştırmalık', 400, 80, 8, 6, 1, 4, 300, 400, '1 ölçek (~30 g)', 100, true, true, 'seed_tr'),
  ('Zeytinyağı', 'Atıştırmalık', 884, 0, 0, 100, 0, 0, 2, 1, '100 g', 100, true, true, 'seed_tr'),
  ('Hurma', 'Atıştırmalık', 282, 2.5, 75, 0.4, 8, 63, 2, 656, '100 g', 100, true, true, 'seed_tr'),
  ('Kuru Kayısı', 'Atıştırmalık', 241, 3.4, 63, 0.5, 7.3, 53, 10, 1162, '100 g', 100, true, true, 'seed_tr'),
  ('Türk Kahvesi (sade)', 'İçecek', 2, 0.1, 0, 0, 0, 0, 1, 49, '1 fincan', 100, true, true, 'seed_tr'),
  ('Yeşil Çay', 'İçecek', 1, 0, 0, 0, 0, 0, 1, 8, '1 bardak', 100, true, true, 'seed_tr')
on conflict (lower(name)) do update set
  category = excluded.category,
  calories = excluded.calories,
  protein_g = excluded.protein_g,
  carbs_g = excluded.carbs_g,
  fat_g = excluded.fat_g,
  fiber_g = excluded.fiber_g,
  sugar_g = excluded.sugar_g,
  sodium_mg = excluded.sodium_mg,
  potassium_mg = excluded.potassium_mg,
  serving_desc = excluded.serving_desc,
  serving_grams = excluded.serving_grams,
  is_turkish = excluded.is_turkish,
  is_verified = excluded.is_verified,
  source = excluded.source;
