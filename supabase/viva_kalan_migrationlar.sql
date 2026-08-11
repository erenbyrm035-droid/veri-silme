-- ==========================================================================
-- VIVA — Kalan tüm migration'lar (0023 → 0034), tek dosya.
-- Supabase → SQL Editor → yapıştır → Run. Hepsi idempotent (tekrar güvenli).
--
-- ⚠️ 'ALTER TYPE ... ADD VALUE cannot run inside a transaction block' hatası
--    alırsan, önce ŞU İKİ SATIRI TEK BAŞINA çalıştır, sonra bu dosyayı tekrar:
--       alter type experience_type  add value if not exists 'professional';
--       alter type environment_type add value if not exists 'outdoor';
-- ==========================================================================


-- ####################################################################
-- >>> 0023_audit_fixes.sql
-- ####################################################################

-- ============================================================================
-- Migration 0023 — Denetim düzeltmeleri
-- reward_claims: kozmetik ödüllerin tekrar alınmasını engelle (idempotent).
-- ============================================================================

-- Tüketilen ödüller (premium gün gibi) 'consumed' işaretlenir; kozmetik/kalıcı
-- ödüller 'active' kalır. Kısmi tekil index yalnızca 'active' talepleri kapsar,
-- böylece premium tekrar satın alınabilirken kozmetik ödül iki kez alınamaz.
create unique index if not exists uq_reward_claims_active
  on public.reward_claims (user_id, reward_id)
  where status = 'active';


-- ####################################################################
-- >>> 0024_ai_dietitian.sql
-- ####################################################################

-- ============================================================================
-- Migration 0024 — AI Dietitian (Profesyonel Diyetisyen)
-- Nutrition Score, tercihler, hafıza, öğün analizi, tarif geçmişi.
-- Additive + idempotent; mevcut nutrition/AI mimarisini bozmaz.
-- (nutrition_reports ve shopping_lists zaten mevcut — yeniden oluşturulmaz.)
-- ============================================================================

-- 1) nutrition_scores — günlük 0-100 beslenme skoru geçmişi -----------------
create table if not exists public.nutrition_scores (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  score_date date not null default current_date,
  score      int  not null default 0,
  breakdown  jsonb not null default '{}',   -- {protein, calorie, macros, water, variety, regularity, processed}
  ai_comment text,
  created_at timestamptz not null default now(),
  unique (user_id, score_date)
);
create index if not exists idx_nutrition_scores_user on public.nutrition_scores (user_id, score_date desc);

-- 2) nutrition_preferences — diyetisyenin kişiselleştirme profili -----------
create table if not exists public.nutrition_preferences (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  activity_level     text,
  weekly_training     int,
  daily_steps        int,
  sleep_hours        numeric(3,1),
  meals_per_day      int,
  dietary_preference text,                       -- omnivore | vegetarian | vegan | pescatarian | keto | ...
  allergies          text[] not null default '{}',
  disliked_foods     text[] not null default '{}',
  favorite_foods     text[] not null default '{}',
  supplements        text[] not null default '{}',
  digestion_issues   text[] not null default '{}',
  health_notes       text,
  budget_weekly      numeric(8,2),
  cooks_at_home      boolean,
  work_hours         text,
  target_weight_kg   numeric(5,1),
  updated_at         timestamptz not null default now()
);

-- 3) nutrition_memory — AI'ın hatırladığı serbest notlar --------------------
create table if not exists public.nutrition_memory (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  fact       text not null,
  source     text not null default 'ai',   -- ai | user
  created_at timestamptz not null default now()
);
create index if not exists idx_nutrition_memory_user on public.nutrition_memory (user_id, created_at desc);

-- 4) meal_analysis — akıllı öğün analizi sonuçları --------------------------
create table if not exists public.meal_analysis (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  input_text   text not null,
  items        jsonb not null default '[]',
  calories     numeric(7,1) not null default 0,
  protein_g    numeric(6,1) not null default 0,
  carbs_g      numeric(6,1) not null default 0,
  fat_g        numeric(6,1) not null default 0,
  fiber_g      numeric(6,1) not null default 0,
  score        int not null default 0,
  assessment   text,
  alternatives jsonb not null default '[]',
  source       text not null default 'rule',   -- ai | rule
  created_at   timestamptz not null default now()
);
create index if not exists idx_meal_analysis_user on public.meal_analysis (user_id, created_at desc);

-- 5) recipe_history — önerilen/kullanılan tarifler ---------------------------
create table if not exists public.recipe_history (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  recipe_id   uuid references public.recipes(id) on delete set null,
  title       text not null,
  source      text not null default 'cms',   -- cms | pantry | ai
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists idx_recipe_history_user on public.recipe_history (user_id, created_at desc);

-- ============================================================================
-- RLS — hepsi kullanıcıya özel (sahip yönetir, admin okur)
-- ============================================================================
alter table public.nutrition_scores      enable row level security;
alter table public.nutrition_preferences enable row level security;
alter table public.nutrition_memory      enable row level security;
alter table public.meal_analysis         enable row level security;
alter table public.recipe_history        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['nutrition_scores','nutrition_preferences','nutrition_memory','meal_analysis','recipe_history'] loop
    execute format('drop policy if exists "%1$s_own" on public.%1$s', t);
    execute format('create policy "%1$s_own" on public.%1$s for all using (auth.uid() = user_id or public.has_admin_access(auth.uid())) with check (auth.uid() = user_id or public.has_admin_access(auth.uid()))', t);
  end loop;
end $$;

-- ============================================================================
-- app_settings — AI Diyetisyen sistem promptu (admin yönetimi)
-- ============================================================================
insert into public.app_settings (key, value)
values ('nutrition_ai', jsonb_build_object(
  'system_prompt', 'Sen Viva uygulamasının profesyonel yapay zeka diyetisyenisin. Kullanıcının gerçek verilerine (profil, öğün kayıtları, su, antrenman, hedefler) göre kişiselleştirilmiş, kanıta dayalı beslenme rehberliği sunarsın. Kesin tıbbi teşhis koymaz, hastalık tedavisi/ilaç önermez, kesin kilo garantisi vermezsin. Belirsiz durumlarda açıklayıcı sorular sorarsın. Restoran isimleri için besin değeri uydurmaz, kullanıcıdan ürün seçmesini ister veya mevcut veritabanını kullanırsın. Takviyelerde yalnızca genel bilgi verir, gerektiğinde sağlık profesyoneline yönlendirirsin.',
  'temperature', 0.6,
  'max_tokens', 900
))
on conflict (key) do nothing;


-- ####################################################################
-- >>> 0025_exercise_media_set.sql
-- ####################################################################

-- ============================================================================
-- Migration 0025 — Exercise Media Set (Profesyonel Medya Yönetimi)
-- Egzersiz başına konsolide medya kaydı: thumbnail/gif/video + cinsiyet
-- varyantları + otomatik durum. Mevcut çok-satırlı exercise_media (galeri)
-- tablosu KORUNUR; bu tablo per-egzersiz ana medya kaydıdır.
-- Additive + idempotent; mevcut Exercise CMS'i bozmaz.
-- ============================================================================

create table if not exists public.exercise_media_set (
  id            uuid primary key default uuid_generate_v4(),
  exercise_id   uuid not null unique references public.exercises(id) on delete cascade,
  thumbnail_url text,
  gif_url       text,
  video_url     text,
  male_gif      text,
  female_gif    text,
  male_video    text,
  female_video  text,
  status        text not null default 'none',   -- complete | partial | none (trigger ile)
  updated_at    timestamptz not null default now()
);
create index if not exists idx_exercise_media_set_status on public.exercise_media_set (status);

-- Durum otomasyonu: her insert/update'te medya alanlarından hesaplanır.
create or replace function public.set_exercise_media_status()
returns trigger language plpgsql as $$
declare has_gif boolean; has_video boolean; has_thumb boolean; any_media boolean;
begin
  has_gif   := coalesce(new.gif_url,'') <> '' or (coalesce(new.male_gif,'') <> '' and coalesce(new.female_gif,'') <> '');
  has_video := coalesce(new.video_url,'') <> '' or (coalesce(new.male_video,'') <> '' and coalesce(new.female_video,'') <> '');
  has_thumb := coalesce(new.thumbnail_url,'') <> '';
  any_media := has_thumb or has_gif or has_video
    or coalesce(new.gif_url,'') <> '' or coalesce(new.video_url,'') <> ''
    or coalesce(new.male_gif,'') <> '' or coalesce(new.female_gif,'') <> ''
    or coalesce(new.male_video,'') <> '' or coalesce(new.female_video,'') <> '';
  if not any_media then new.status := 'none';
  elsif has_thumb and has_gif and has_video then new.status := 'complete';
  else new.status := 'partial';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_exercise_media_status on public.exercise_media_set;
create trigger trg_exercise_media_status
  before insert or update on public.exercise_media_set
  for each row execute function public.set_exercise_media_status();

-- RLS: herkes okur (uygulama medyayı gösterir), yalnızca admin yazar.
alter table public.exercise_media_set enable row level security;

drop policy if exists "exercise_media_set_read" on public.exercise_media_set;
create policy "exercise_media_set_read" on public.exercise_media_set
  for select using (auth.role() = 'authenticated');

drop policy if exists "exercise_media_set_admin_write" on public.exercise_media_set;
create policy "exercise_media_set_admin_write" on public.exercise_media_set
  for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));

-- exercise-media bucket zaten public (migration 0012). CDN URL:
--   <SUPABASE_URL>/storage/v1/object/public/exercise-media/<path>
-- İleride AI ile üretilen medya da aynı sütunlara (gif_url/video_url/...) bağlanır.


-- ####################################################################
-- >>> 0026_exercise_media_storage_policy.sql
-- ####################################################################

-- ============================================================================
-- Migration 0026 — exercise-media Storage yükleme izni düzeltmesi
-- Eski policy is_admin() (yalnızca profiles.is_admin) kullanıyordu; admin_role
-- ile admin olan kullanıcılar (super_admin/admin/editor) yükleme yapamıyordu.
-- has_admin_access() ile değiştirilir. Idempotent.
-- ============================================================================

drop policy if exists "exercise_media_admin_insert" on storage.objects;
create policy "exercise_media_admin_insert" on storage.objects for insert
  with check (bucket_id = 'exercise-media' and public.has_admin_access(auth.uid()));

drop policy if exists "exercise_media_admin_update" on storage.objects;
create policy "exercise_media_admin_update" on storage.objects for update
  using (bucket_id = 'exercise-media' and public.has_admin_access(auth.uid()))
  with check (bucket_id = 'exercise-media' and public.has_admin_access(auth.uid()));

drop policy if exists "exercise_media_admin_delete" on storage.objects;
create policy "exercise_media_admin_delete" on storage.objects for delete
  using (bucket_id = 'exercise-media' and public.has_admin_access(auth.uid()));

-- Not: upsert (dosya üzerine yazma) UPDATE gerektirir; yeni update policy bunu kapsar.


-- ####################################################################
-- >>> 0027_notifications_realtime.sql
-- ####################################################################

-- Bildirimlerin uygulama içi zilde CANLI görünmesi için realtime yayınını aç.
-- Zil bileşeni bu tabloya postgres_changes aboneliği kurar; tablo yayına ekli
-- değilse yeni bildirimler ancak yenilemede görünür. (Yedek: 45sn yoklama + odak.)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- Realtime'ın satırı iletebilmesi için REPLICA IDENTITY FULL (RLS ile birlikte).
alter table public.notifications replica identity full;


-- ####################################################################
-- >>> 0028_muscles_full.sql
-- ####################################################################

-- ============================================================================
-- Migration 0028 — Kapsamlı Kas Kütüphanesi
-- Mevcut 14 ana kas grubuna alt/detay kaslar eklenir (toplam ~42).
-- Her kas SVG haritasındaki en yakın bölgeye (svg_region_id) bağlanır; harita
-- bozulmaz, yeni kaslar "Tüm Kaslar" listesinde ve arama ile erişilir.
-- Idempotent: on conflict (slug) do update.
-- ============================================================================

insert into public.muscles
  (slug, name_tr, latin_name, muscle_group, region, svg_region_id, sort_order,
   overview, functions, origin, insertion, innervation, common_injuries, rehab_notes)
values
-- ---- GÖĞÜS ----
('pektoralis-minor', 'Pektoralis Minor', 'Pectoralis Minor', 'Göğüs', 'front', 'gogus', 21,
 'Göğüs büyük kasının altında yer alan küçük kas; skapulayı öne-aşağı çeker ve nefes almaya yardım eder.',
 array['Skapulanın öne-aşağı çekilmesi (protraksiyon/depresyon)', 'Zorlu nefeste kaburgaların kaldırılması'],
 '3-5. kaburgaların ön yüzü', 'Skapulanın korakoid çıkıntısı', 'Medial pektoral sinir',
 array['Kısalığa bağlı yuvarlak omuz duruşu'], 'Göğüs açıcı esnemeler + skapular retraksiyon çalışması kısalığı dengeler.'),

('serratus-anterior', 'Serratus Anterior', 'Serratus Anterior', 'Göğüs', 'front', 'yan-karin', 22,
 'Kaburgaların yan yüzünde parmak biçiminde uzanan kas; kolu baş üstüne kaldırmak için skapulayı döndürür.',
 array['Skapulanın öne kaydırılması (protraksiyon)', 'Kolu baş üstüne kaldırmada skapula rotasyonu', 'Skapulayı göğüs duvarına sabitleme'],
 '1-9. kaburgaların yan yüzü', 'Skapulanın iç kenarı (ön yüz)', 'Uzun torasik sinir',
 array['Kanat skapula (uzun torasik sinir zayıflığı)'], 'Şınav plus (protraksiyon) ve duvar kaydırma ile aktive et; overhead güç için kritik.'),

-- ---- OMUZ ----
('on-deltoid', 'Ön Deltoid', 'Deltoideus Anterior', 'Omuz', 'front', 'omuz', 23,
 'Deltoidin ön başı; kolu öne ve yukarı kaldırır, itme hareketlerine güç katar.',
 array['Omuz fleksiyonu (kolu öne kaldırma)', 'Kolun iç rotasyonu ve horizontal adduksiyon'],
 'Klavikula dış üçte biri', 'Humerus deltoid tüberositesi', 'Aksiller sinir',
 array['Bench press aşırı yüklenmesinde ön omuz ağrısı'], 'Ön omuz genelde çok çalışır; arka omuz ve rotator dengesi ile aşırı yükü azalt.'),

('yan-deltoid', 'Yan Deltoid', 'Deltoideus Lateralis', 'Omuz', 'front', 'omuz', 24,
 'Deltoidin orta başı; omuz genişliğini veren, kolu yana kaldıran ana kas.',
 array['Omuz abduksiyonu (kolu yana kaldırma, 15-90°)'],
 'Akromion (omuz çıkıntısı)', 'Humerus deltoid tüberositesi', 'Aksiller sinir',
 array['Sıkışma sendromu (impingement)'], 'Lateral raise ile izole et; ağrısız açıklıkta çalış, tepe noktada duraksama.'),

('arka-deltoid', 'Arka Deltoid', 'Deltoideus Posterior', 'Omuz', 'back', 'omuz', 25,
 'Deltoidin arka başı; kolu geriye çeker, duruş ve omuz sağlığı için önemli ama sık ihmal edilir.',
 array['Omuz ekstansiyonu (kolu geriye alma)', 'Horizontal abduksiyon', 'Dış rotasyona yardım'],
 'Spina skapula (omuz kemiği çıkıntısı)', 'Humerus deltoid tüberositesi', 'Aksiller sinir',
 array['Ön-arka omuz dengesizliği'], 'Face pull ve reverse fly ile güçlendir; sağlıklı omuz için ön omuzla dengele.'),

('rotator-manset', 'Rotator Manşet', 'Rotator Cuff', 'Omuz', 'back', 'omuz', 26,
 'Omuz eklemini saran 4 küçük kasın (supraspinatus, infraspinatus, teres minor, subskapularis) ortak adı; başın yuvada stabilitesini sağlar.',
 array['Omuz başının yuvada merkezlenmesi (stabilite)', 'İç ve dış rotasyon'],
 'Skapulanın çeşitli bölgeleri', 'Humerus başı (tüberküller)', 'Suprascapular, aksiller, subskapular sinirler',
 array['Rotator manşet yırtığı', 'Tendinit'], 'Hafif bant ile dış/iç rotasyon; ağır overhead öncesi ısınmada mutlaka çalıştır.'),

('supraspinatus', 'Supraspinatus', 'Supraspinatus', 'Omuz', 'back', 'omuz', 27,
 'Rotator manşetin üst kası; abduksiyonun ilk 15°''sini başlatır ve omuz başını sabitler.',
 array['Abduksiyonun başlatılması (ilk 15°)', 'Omuz başının stabilizasyonu'],
 'Skapula supraspinöz çukur', 'Humerus büyük tüberkül (üst)', 'Suprascapular sinir',
 array['Supraspinatus tendiniti/yırtığı (en sık manşet yaralanması)'], 'Ağrısız açıklıkta hafif abduksiyon; sıkışmayı önlemek için 90° üstünü zorlama.'),

('infraspinatus', 'Infraspinatus', 'Infraspinatus', 'Omuz', 'back', 'omuz', 28,
 'Rotator manşetin arka kası; kolun dış rotasyonundan sorumlu ana kas.',
 array['Omuzun dış rotasyonu', 'Omuz başının arkada stabilizasyonu'],
 'Skapula infraspinöz çukur', 'Humerus büyük tüberkül (orta)', 'Suprascapular sinir',
 array['Dış rotator zayıflığı → omuz sıkışması'], 'Yan yatarak dış rotasyon (side-lying ER) ile güçlendir.'),

-- ---- KOL ----
('brachialis', 'Brachialis', 'Brachialis', 'Kol', 'front', 'biceps', 29,
 'Bicepsin altında yer alan güçlü dirsek bükücü; kol kalınlığının önemli kısmını oluşturur.',
 array['Dirsek fleksiyonu (avuç yönünden bağımsız en güçlü bükücü)'],
 'Humerus alt yarısı (ön yüz)', 'Ulna koronoid çıkıntısı', 'Muskülokutanöz sinir',
 array['Aşırı curl hacminde dirsek ön ağrısı'], 'Hammer curl ve ters curl ile hedefle; nötr tutuş brachialisi öne çıkarır.'),

('brachioradialis', 'Brachioradialis', 'Brachioradialis', 'Kol', 'front', 'on-kol', 30,
 'Ön kolun dış yüzündeki uzun kas; nötr tutuşta dirseği büker, kavrama gücüne katkı verir.',
 array['Dirsek fleksiyonu (nötr/pronasyon tutuşta)', 'Ön kol nötral konuma getirme'],
 'Humerus dış alt kenarı', 'Radius alt ucu (stiloid çıkıntı)', 'Radial sinir',
 array['Tenisçi dirseğine eşlik eden ön kol ağrısı'], 'Hammer/ters curl ile çalış; kavrama antrenmanıyla birlikte gelişir.'),

('on-kol-fleksor', 'Ön Kol Fleksörleri', 'Flexor Grubu (Ön Kol)', 'Kol', 'front', 'on-kol', 31,
 'Ön kolun iç yüzündeki bilek/parmak bükücü kaslar; kavrama gücünün temeli.',
 array['Bilek fleksiyonu', 'Parmakların bükülmesi (kavrama)'],
 'Humerus iç epikondil', 'El bilek/parmak kemikleri', 'Median ve ulnar sinirler',
 array['Golfçü dirseği (medial epikondilit)'], 'Bilek curl ve ölü asılma (dead hang) ile kademeli yükle.'),

('on-kol-ekstansor', 'Ön Kol Ekstansörleri', 'Ekstansör Grubu (Ön Kol)', 'Kol', 'back', 'on-kol', 32,
 'Ön kolun dış yüzündeki bilek/parmak açıcı kaslar; kavrama dengesini ve bilek sağlığını sağlar.',
 array['Bilek ekstansiyonu', 'Parmakların açılması'],
 'Humerus dış epikondil', 'El bilek/parmak kemikleri', 'Radial sinir',
 array['Tenisçi dirseği (lateral epikondilit)'], 'Ters bilek curl ve eksantrik çalışma ile epikondiliti önle.'),

-- ---- SIRT ----
('romboid', 'Romboid', 'Rhomboideus Major/Minor', 'Sırt', 'back', 'sirt', 33,
 'Kürek kemiklerini omurgaya çeken kaslar; dik duruşun ve sıkı sırt hissinin anahtarı.',
 array['Skapula retraksiyonu (kürekleri birbirine yaklaştırma)', 'Skapulanın aşağı rotasyonu'],
 'C7-T5 omurga çıkıntıları', 'Skapulanın iç kenarı', 'Dorsal skapular sinir',
 array['Zayıflığa bağlı öne düşük omuz'], 'Row ve face pull''da kürekleri sık; masabaşı duruşu için kritik.'),

('teres-major', 'Teres Major', 'Teres Major', 'Sırt', 'back', 'sirt', 34,
 'Latissimusa yardımcı küçük kas ("lat''ın küçük yardımcısı"); kolu aşağı ve içe çeker.',
 array['Omuz ekstansiyonu', 'Kolun iç rotasyonu ve adduksiyonu'],
 'Skapula alt köşesi', 'Humerus (küçük tüberkül kresti)', 'Alt subskapular sinir',
 array['Çekiş hacminde arka koltuk altı gerginliği'], 'Lat çalışmalarıyla birlikte gelişir; ayrı izolasyon nadiren gerekir.'),

('levator-skapula', 'Levator Skapula', 'Levator Scapulae', 'Sırt', 'back', 'trapez', 35,
 'Boyun yanından kürek kemiğine uzanan kas; skapulayı yukarı kaldırır, stres kaynaklı gerginlikte sık tutulur.',
 array['Skapulanın yukarı kaldırılması (elevasyon)', 'Boynun yana eğilmesi'],
 'C1-C4 omurga çıkıntıları', 'Skapula üst iç köşesi', 'Dorsal skapular sinir',
 array['Boyun-omuz gerginliği ve tetik nokta'], 'Boyun yan esneme + trapez alt aktivasyonu ile gevşet.'),

-- ---- KARIN ----
('transvers-karin', 'Transvers Karın', 'Transversus Abdominis', 'Karın', 'front', 'karin', 36,
 'Karnın en derin kası; doğal korse gibi karın içi basıncı ve omurga stabilitesini sağlar.',
 array['Karın içi basıncın oluşturulması (kor stabilite)', 'Belin korunması'],
 'Kaburga kıkırdakları, kalça kemiği, torakolomber fasya', 'Linea alba, kasık', 'Alt interkostal ve lomber sinirler',
 array['Zayıflığa bağlı bel ağrısı'], 'Vakum (karın içe çekme), plank ve nefes kontrolü ile aktive et.'),

-- ---- KALÇA ----
('gluteus-medius', 'Gluteus Medius', 'Gluteus Medius', 'Kalça', 'back', 'kalca', 37,
 'Kalçanın yan üst kısmındaki kas; tek ayak dururken leğeni stabil tutar, diz sağlığı için kritik.',
 array['Kalça abduksiyonu (bacağı yana açma)', 'Yürüyüşte leğen stabilizasyonu'],
 'İliak kanat dış yüzü', 'Femur büyük trokanter', 'Superior gluteal sinir',
 array['Zayıflığa bağlı diz içe çökmesi (valgus)'], 'Yan köprü, clamshell ve bant yürüyüşü ile güçlendir.'),

('gluteus-minimus', 'Gluteus Minimus', 'Gluteus Minimus', 'Kalça', 'back', 'kalca', 38,
 'Gluteus mediusun altındaki en küçük kalça kası; abduksiyon ve leğen stabilitesine yardım eder.',
 array['Kalça abduksiyonu', 'Kalçanın iç rotasyonu', 'Leğen stabilizasyonu'],
 'İliak kanat dış yüzü (alt)', 'Femur büyük trokanter (ön)', 'Superior gluteal sinir',
 array['Kalça yan ağrısı (trokanterik)'], 'Gluteus medius ile birlikte abduksiyon çalışmalarında gelişir.'),

('kalca-fleksor', 'Kalça Fleksörleri', 'Iliopsoas', 'Kalça', 'front', 'on-bacak', 39,
 'Bel omurgasından uyluğa uzanan derin kas grubu (iliakus + psoas); dizi karına doğru çeker.',
 array['Kalça fleksiyonu (uyluğu öne-yukarı çekme)', 'Duruşta bel eğriliğine etki'],
 'Bel omurları ve iliak çukur', 'Femur küçük trokanter', 'Femoral sinir ve lomber pleksus',
 array['Uzun oturmaya bağlı kısalık ve bel ağrısı'], 'Ayakta kalça fleksör esnemesi + gluteus aktivasyonu ile dengele.'),

('adduktor', 'İç Bacak (Adduktörler)', 'Adductor Grubu', 'Bacak', 'front', 'on-bacak', 40,
 'Uyluğun iç yüzündeki kas grubu; bacakları orta hatta çeker, sprint ve yön değiştirmede önemli.',
 array['Kalça adduksiyonu (bacağı içe çekme)', 'Kalça fleksiyon/ekstansiyona yardım'],
 'Kasık kemiği (pubis) ve iskium', 'Femur iç yüzü (linea aspera)', 'Obturator sinir',
 array['Kasık zorlanması (adduktor strain)'], 'Copenhagen plank ve kontrollü adduksiyon ile kademeli güçlendir.'),

-- ---- BACAK: QUADRICEPS ----
('rektus-femoris', 'Rektus Femoris', 'Rectus Femoris', 'Bacak', 'front', 'on-bacak', 41,
 'Quadricepsin ortadaki kası; hem kalçayı büker hem dizi düzeltir (iki eklemli).',
 array['Diz ekstansiyonu', 'Kalça fleksiyonu'],
 'Kalça kemiği (AIIS)', 'Patella → tibia (patellar tendon)', 'Femoral sinir',
 array['Sprint/şut sırasında ön uyluk zorlanması'], 'Kalça açık halde diz ekstansiyonu ile hedefle; esneklikle birlikte çalış.'),

('vastus-lateralis', 'Vastus Lateralis', 'Vastus Lateralis', 'Bacak', 'front', 'on-bacak', 42,
 'Uyluğun dış yüzündeki en büyük quadriceps başı; bacak kütlesinin çoğunu verir.',
 array['Diz ekstansiyonu (bacağı düzeltme)'],
 'Femur büyük trokanter ve linea aspera (dış)', 'Patella → tibia', 'Femoral sinir',
 array['Dizde patella dış kayması (tracking)'], 'Squat ve leg press derinliği ile geliştir; vastus medialis ile dengele.'),

('vastus-medialis', 'Vastus Medialis', 'Vastus Medialis (VMO)', 'Bacak', 'front', 'on-bacak', 43,
 'Dizin iç-üst kısmındaki damla biçimli quadriceps başı; diz kapağının hizasını korur.',
 array['Diz ekstansiyonu', 'Diz kapağının iç stabilizasyonu'],
 'Femur linea aspera (iç)', 'Patella (iç) → tibia', 'Femoral sinir',
 array['Diz ön ağrısı (patellofemoral)'], 'Tam açıklıkta squat ve son 30° ekstansiyon ile aktive et.'),

-- ---- BACAK: HAMSTRING ----
('biceps-femoris', 'Biceps Femoris', 'Biceps Femoris', 'Bacak', 'back', 'arka-bacak', 44,
 'Hamstringin dış başı; dizi büker ve kalçayı geri iter, sprintte en sık zorlanan kas.',
 array['Diz fleksiyonu', 'Kalça ekstansiyonu', 'Dizin dış rotasyonu'],
 'İskium (oturak kemiği) ve femur', 'Fibula başı', 'Siyatik sinir (tibial + fibular)',
 array['Hamstring yırtığı (sprint yaralanması)'], 'Nordic curl ve Romanian deadlift ile eksantrik güç kazandır.'),

('semitendinosus', 'Semitendinozus', 'Semitendinosus', 'Bacak', 'back', 'arka-bacak', 45,
 'Hamstringin iç başlarından biri; diz bükme ve kalça ekstansiyonuna katkı verir.',
 array['Diz fleksiyonu', 'Kalça ekstansiyonu', 'Dizin iç rotasyonu'],
 'İskium (oturak kemiği)', 'Tibia iç yüzü (pes anserinus)', 'Siyatik sinir (tibial)',
 array['İç hamstring zorlanması'], 'Leg curl ve kalça menteşesi (hinge) ile dengeli çalış.'),

-- ---- BACAK: BALDIR / ÖN BALDIR ----
('soleus', 'Soleus', 'Soleus', 'Bacak', 'back', 'baldir', 46,
 'Gastroknemiusun altındaki derin baldır kası; diz bükükken devreye girer, ayakta durma dayanıklılığını sağlar.',
 array['Ayak bileği plantar fleksiyonu (diz bükükken)', 'Ayakta duruş stabilizasyonu'],
 'Tibia ve fibula (üst arka)', 'Topuk kemiği (Aşil tendonu)', 'Tibial sinir',
 array['Aşil tendinopatisi'], 'Oturarak (diz bükük) topuk kaldırma ile izole et; yüksek tekrar sever.'),

('tibialis-anterior', 'Ön Baldır (Tibialis Anterior)', 'Tibialis Anterior', 'Bacak', 'front', 'on-bacak', 47,
 'Kaval kemiğinin dış-önündeki kas; ayak ucunu yukarı kaldırır, koşuda kontrollü iniş sağlar.',
 array['Ayak bileği dorsifleksiyonu (ayak ucunu kaldırma)', 'Ayağın içe dönmesi (inversiyon)'],
 'Tibia dış yüzü (üst)', 'İç ayak tarağı (medial kuneiform)', 'Derin fibular sinir',
 array['Shin splints (kaval ağrısı)'], 'Topuk üstünde yürüme ve dorsifleksiyon ile güçlendir; koşucu sakatlığını azaltır.'),

-- ---- BOYUN ----
('boyun', 'Boyun (SCM)', 'Sternocleidomastoideus', 'Boyun', 'front', 'trapez', 48,
 'Boynun yan-önündeki belirgin kas; başı çevirir ve öne eğer, duruş dengesinde rol oynar.',
 array['Başın karşı yöne çevrilmesi', 'Boynun öne eğilmesi (fleksiyon)', 'Zorlu nefeste yardım'],
 'Sternum ve klavikula', 'Kafatası (mastoid çıkıntı)', 'Aksesuar sinir (CN XI)',
 array['Boyun tutulması (tortikolis)', 'Teknoloji boynu gerginliği'], 'Nazik boyun germe + derin boyun fleksör (çene içe çekme) çalışması ile dengele.')

on conflict (slug) do update set
  name_tr=excluded.name_tr, latin_name=excluded.latin_name, muscle_group=excluded.muscle_group,
  region=excluded.region, svg_region_id=excluded.svg_region_id, sort_order=excluded.sort_order,
  overview=excluded.overview, functions=excluded.functions, origin=excluded.origin,
  insertion=excluded.insertion, innervation=excluded.innervation,
  common_injuries=excluded.common_injuries, rehab_notes=excluded.rehab_notes;


-- ####################################################################
-- >>> 0029_onboarding_expand.sql
-- ####################################################################

-- ============================================================================
-- Migration 0029 — Onboarding Genişletme
-- Çoklu hedef + genişletilmiş kişisel bilgi alanları.
-- NOT: ALTER TYPE ... ADD VALUE bazı ortamlarda transaction içinde hata
-- verebilir. Hata alırsan önce şu iki satırı TEK BAŞINA çalıştır, sonra gerisini:
--   alter type experience_type  add value if not exists 'professional';
--   alter type environment_type add value if not exists 'outdoor';
-- ============================================================================

-- Yeni enum değerleri (deneyim: Profesyonel, ortam: Açık Alan)
alter type experience_type  add value if not exists 'professional';
alter type environment_type add value if not exists 'outdoor';

-- Yeni profil alanları (hepsi opsiyonel / güvenli varsayılan)
alter table public.profiles
  add column if not exists goals                      text[] not null default '{}',
  add column if not exists birth_date                 date,
  add column if not exists occupation                 text,
  add column if not exists daily_sitting_hours        numeric,
  add column if not exists preferred_workout_duration int,     -- dakika
  add column if not exists water_intake_ml            int,     -- günlük alışkanlık
  add column if not exists smoking_status             text,    -- none | quit | occasional | regular
  add column if not exists health_notes               text;


-- ####################################################################
-- >>> 0030_profile_center.sql
-- ####################################################################

-- ============================================================================
-- Migration 0030 — Profil Merkezi
-- Avatar yükleme için 'avatars' public bucket + RLS, profiles.bio alanı.
-- Idempotent.
-- ============================================================================

-- Bio alanı
alter table public.profiles add column if not exists bio text;

-- Avatar bucket (public okuma, kullanıcı kendi klasörüne yazar)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Politikalar: dosya yolu "<user_id>/..." biçiminde; kullanıcı yalnızca
-- kendi klasörünü yönetir. Okuma herkese açık (public bucket).
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ####################################################################
-- >>> 0031_anatomy3d.sql
-- ####################################################################

-- ============================================================================
-- Migration 0031 — 3D Anatomi Motoru
-- Kaslara admin'den düzenlenebilir renk + 3D model bölgesi eşlemesi.
-- Idempotent.
-- ============================================================================

alter table public.muscles
  add column if not exists color        text,   -- admin özel vurgu rengi (opsiyonel)
  add column if not exists model_region text;   -- 3D model bölge anahtarı (RegionKey)

-- Mevcut kasların 3D bölgesini SVG bölgesinden türet (yalnızca boş olanlar).
update public.muscles set model_region = case svg_region_id
  when 'gogus' then 'chest'
  when 'omuz' then 'shoulders'
  when 'biceps' then 'biceps'
  when 'triceps' then 'triceps'
  when 'on-kol' then 'forearms'
  when 'karin' then 'abs'
  when 'yan-karin' then 'obliques'
  when 'trapez' then 'traps'
  when 'sirt' then 'lats'
  when 'bel' then 'lowerback'
  when 'kalca' then 'glutes'
  when 'on-bacak' then 'quads'
  when 'arka-bacak' then 'hamstrings'
  when 'baldir' then 'calves'
  else model_region
end
where model_region is null;


-- ####################################################################
-- >>> 0032_gamification_hardening.sql
-- ####################################################################

-- ============================================================================
-- Migration 0032 — Oyunlaştırma (XP) sağlamlaştırma
-- Sorun: sync_gamification opsiyonel tabloları (ai_conversations,
-- posture_analyses, personal_records) doğrudan okuyordu. Bu tablolardan biri
-- kullanıcının DB'sinde yoksa fonksiyon çöküyor → XP HİÇ güncellenmiyordu.
-- Çözüm: opsiyonel okumaları to_regclass ile koru → eksik tablo = 0 sayılır,
-- XP (antrenman/su/protein/başarım) her koşulda hesaplanır. Idempotent.
-- ============================================================================

create or replace function public.sync_gamification(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_workouts int; v_volume numeric; v_pr int := 0; v_posture int := 0; v_ai int := 0;
  v_water_days int; v_protein_days int; v_active_days int; v_exercises int;
  v_water_goal int; v_protein_goal int;
  v_streak int := 0; v_longest int := 0; v_last date; v_prev date; d date;
  v_base_xp int := 0; v_ach_xp int := 0; v_total_xp int := 0;
  v_level int; v_prev_level int; v_fitness int;
  r_workout int; r_volume int; r_water int; r_protein int; r_pr int;
  r_posture int; r_ai int; r_login int;
  ach record; v_prog numeric; v_done boolean;
begin
  -- Hedefler
  select coalesce(daily_water_goal_ml, 2500), coalesce(daily_protein_goal, 120)
    into v_water_goal, v_protein_goal from public.profiles where id = p_user;
  v_water_goal := coalesce(v_water_goal, 2500);
  v_protein_goal := coalesce(v_protein_goal, 120);

  -- Aktivite sayaçları (çekirdek tablolar)
  select count(*) into v_workouts from public.workouts where user_id = p_user and status = 'completed';
  select coalesce(sum(coalesce(ws.reps,0) * coalesce(ws.weight_kg,0)), 0) into v_volume
    from public.workout_sets ws join public.workouts w on w.id = ws.workout_id
    where w.user_id = p_user and ws.completed;
  select count(*) into v_exercises from public.workout_sets ws
    join public.workouts w on w.id = ws.workout_id where w.user_id = p_user and ws.completed;

  -- Opsiyonel tablolar — yoksa 0 (fonksiyon çökmez)
  if to_regclass('public.personal_records') is not null then
    execute 'select count(*) from public.personal_records where user_id = $1' into v_pr using p_user;
  end if;
  if to_regclass('public.posture_analyses') is not null then
    execute 'select count(*) from public.posture_analyses where user_id = $1' into v_posture using p_user;
  end if;
  if to_regclass('public.ai_conversations') is not null then
    execute 'select count(*) from public.ai_conversations where user_id = $1' into v_ai using p_user;
  end if;

  select count(*) into v_water_days from (
    select log_date from public.water_logs where user_id = p_user
    group by log_date having sum(amount_ml) >= v_water_goal
  ) t;
  select count(*) into v_protein_days from (
    select log_date from public.nutrition_logs where user_id = p_user
    group by log_date having sum(protein_g) >= v_protein_goal
  ) t;

  -- Aktif gün seti (streak için). NOT: kolon adı 'dd' — döngüler bununla eşleşir.
  drop table if exists _gam_days;
  create temp table _gam_days (dd date primary key) on commit drop;
  insert into _gam_days (dd)
    select distinct dd from (
      select workout_date dd from public.workouts where user_id = p_user and status = 'completed'
      union select log_date from public.water_logs where user_id = p_user
      union select log_date from public.nutrition_logs where user_id = p_user
    ) s where dd is not null
  on conflict do nothing;

  select count(*) into v_active_days from _gam_days;

  -- Streak
  v_prev := null;
  for d in select dd from _gam_days order by dd loop
    if v_prev is null or d = v_prev + 1 then v_streak := v_streak + 1;
    elsif d <> v_prev then v_streak := 1; end if;
    if v_streak > v_longest then v_longest := v_streak; end if;
    v_last := d; v_prev := d;
  end loop;
  if v_last is null or v_last < current_date - 1 then v_streak := 0;
  else
    v_streak := 0; v_prev := null;
    for d in select dd from _gam_days order by dd loop
      if v_prev is null or d = v_prev + 1 then v_streak := v_streak + 1;
      elsif d <> v_prev then v_streak := 1; end if;
      v_prev := d;
    end loop;
  end if;

  -- XP kuralları (yoksa varsayılan)
  select coalesce((select xp from public.xp_rules where event_key='workout_completed' and enabled),20) into r_workout;
  select coalesce((select xp from public.xp_rules where event_key='volume_1000kg' and enabled),5) into r_volume;
  select coalesce((select xp from public.xp_rules where event_key='water_goal' and enabled),10) into r_water;
  select coalesce((select xp from public.xp_rules where event_key='protein_goal' and enabled),10) into r_protein;
  select coalesce((select xp from public.xp_rules where event_key='new_pr' and enabled),25) into r_pr;
  select coalesce((select xp from public.xp_rules where event_key='first_posture' and enabled),40) into r_posture;
  select coalesce((select xp from public.xp_rules where event_key='ai_coach_used' and enabled),5) into r_ai;
  select coalesce((select xp from public.xp_rules where event_key='daily_login' and enabled),5) into r_login;

  v_base_xp :=
      v_workouts * r_workout
    + floor(v_volume / 1000)::int * r_volume
    + v_water_days * r_water
    + v_protein_days * r_protein
    + v_pr * r_pr
    + (case when v_posture > 0 then r_posture else 0 end)
    + v_ai * r_ai
    + v_active_days * r_login;

  -- Başarımlar
  for ach in select * from public.achievements where enabled loop
    v_prog := case ach.metric
      when 'workouts_count' then v_workouts
      when 'total_volume'   then v_volume
      when 'exercises_count' then v_exercises
      when 'posture_count'  then v_posture
      when 'ai_count'       then v_ai
      when 'pr_count'       then v_pr
      when 'water_days'     then v_water_days
      when 'protein_days'   then v_protein_days
      when 'streak_days'    then greatest(v_longest, v_streak)
      when 'active_days'    then v_active_days
      else 0 end;
    v_done := v_prog >= ach.target;
    insert into public.achievement_progress (user_id, achievement_id, progress, target, completed, completed_at, updated_at)
    values (p_user, ach.id, v_prog, ach.target, v_done, case when v_done then now() else null end, now())
    on conflict (user_id, achievement_id) do update set
      progress = excluded.progress, target = excluded.target, completed = excluded.completed,
      completed_at = coalesce(public.achievement_progress.completed_at, excluded.completed_at), updated_at = now();
    if v_done then v_ach_xp := v_ach_xp + ach.xp_reward; end if;
  end loop;

  v_total_xp := v_base_xp + v_ach_xp;
  v_level := public.gam_level_for_xp(v_total_xp);

  v_fitness := least(100, (
      least(30, v_workouts * 2) + least(15, v_protein_days) + least(15, v_water_days)
    + least(15, v_active_days) + least(10, floor(v_volume/2000)::int)
    + (case when v_posture > 0 then 10 else 0 end) + least(5, v_ai)));

  select level into v_prev_level from public.user_gamification where user_id = p_user;

  insert into public.user_gamification
    (user_id, total_xp, level, fitness_score, current_streak, longest_streak, last_active_on, season_xp, updated_at)
  values (p_user, v_total_xp, v_level, v_fitness, v_streak, v_longest, v_last, v_total_xp, now())
  on conflict (user_id) do update set
    total_xp = excluded.total_xp, level = excluded.level, fitness_score = excluded.fitness_score,
    current_streak = excluded.current_streak, longest_streak = excluded.longest_streak,
    last_active_on = excluded.last_active_on, season_xp = excluded.season_xp, updated_at = now();

  insert into public.streaks (user_id, kind, current, longest, last_date, updated_at)
  values (p_user, 'daily', v_streak, v_longest, v_last, now())
  on conflict (user_id, kind) do update set
    current = excluded.current, longest = greatest(public.streaks.longest, excluded.longest),
    last_date = excluded.last_date, updated_at = now();

  insert into public.fitness_scores (user_id, score_date, score, breakdown)
  values (p_user, current_date, v_fitness, jsonb_build_object(
    'workouts', v_workouts, 'volume', v_volume, 'water_days', v_water_days,
    'protein_days', v_protein_days, 'active_days', v_active_days, 'posture', v_posture, 'ai', v_ai))
  on conflict (user_id, score_date) do update set score = excluded.score, breakdown = excluded.breakdown;

  return jsonb_build_object(
    'total_xp', v_total_xp, 'level', v_level, 'prev_level', coalesce(v_prev_level, 1),
    'leveled_up', coalesce(v_prev_level, 1) < v_level,
    'fitness_score', v_fitness, 'current_streak', v_streak, 'longest_streak', v_longest);
end;
$$;

grant execute on function public.sync_gamification(uuid) to authenticated, service_role;


-- ####################################################################
-- >>> 0033_weekly_challenges_auto.sql
-- ####################################################################

-- ============================================================================
-- Migration 0033 — Haftalık görevlerin otomatik dönmesi
-- Sorun: weekly_challenges yalnızca 0021'in çalıştığı hafta için seed'lenmişti;
-- yeni haftalarda Görevler sekmesi BOŞ kalıyordu.
-- Çözüm: ensure_weekly_challenges() — verilen hafta için görev yoksa bir şablon
-- havuzundan HAFTAYA GÖRE DÖNEN 4 görev ekler. Uygulama her yüklemede çağırır.
-- Idempotent.
-- ============================================================================

create or replace function public.ensure_weekly_challenges(p_week date default date_trunc('week', now())::date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_start int;
begin
  -- Zaten görev varsa hiçbir şey yapma
  if exists (select 1 from public.weekly_challenges where week_start = p_week and active) then
    return;
  end if;

  -- Hafta indeksi → dönen pencere başlangıcı (her hafta 2 kayar)
  v_start := ((floor(extract(epoch from p_week) / 604800)::int) * 2) % 8;

  insert into public.weekly_challenges (week_start, key, title, description, metric, target, xp_reward, icon, active)
  select p_week, t.key, t.title, t.description, t.metric, t.target, t.xp_reward, t.icon, true
  from (
    values
      (0, 'w_workouts_3',  '3 Antrenman',   'Bu hafta 3 antrenman tamamla.',        'workouts',  3,     150, 'dumbbell'),
      (1, 'w_water_15l',   '15 Litre Su',   'Bu hafta toplam 15 litre su iç.',      'water_ml',  15000, 120, 'droplet'),
      (2, 'w_protein_700', '700g Protein',  'Bu hafta toplam 700g protein al.',     'protein_g', 700,   120, 'beef'),
      (3, 'w_mobility_2',  '2 Mobilite',    '2 mobilite/esneme seansı yap.',        'mobility',  2,     100, 'move'),
      (4, 'w_workouts_4',  '4 Antrenman',   'Bu hafta 4 antrenman tamamla.',        'workouts',  4,     200, 'flame'),
      (5, 'w_water_20l',   '20 Litre Su',   'Bu hafta toplam 20 litre su iç.',      'water_ml',  20000, 150, 'droplet'),
      (6, 'w_protein_1000','1000g Protein', 'Bu hafta toplam 1000g protein al.',    'protein_g', 1000,  180, 'beef'),
      (7, 'w_workouts_5',  '5 Antrenman',   'Bu hafta 5 antrenman tamamla — efsane!','workouts', 5,     250, 'trophy')
  ) as t(ord, key, title, description, metric, target, xp_reward, icon)
  -- Dönen pencere: v_start'tan itibaren 4 ardışık (mod 8)
  where ((t.ord - v_start + 8) % 8) < 4
  on conflict (week_start, key) do nothing;
end;
$$;

grant execute on function public.ensure_weekly_challenges(date) to authenticated, service_role;

-- Bu haftayı hemen doldur
select public.ensure_weekly_challenges();


-- ####################################################################
-- >>> 0034_challenge_xp.sql
-- ####################################################################

-- ============================================================================
-- Migration 0034 — Görev (challenge) tamamlama XP'si
-- Haftalık görev tamamlanınca xp_reward KALICI olarak toplam XP'ye eklenir.
-- sync_gamification: bu haftanın görevlerini değerlendirir → challenge_progress'e
-- yazar (completed sticky) → TÜM tamamlanmış görevlerin XP'sini toplar.
-- (Önceki haftaların tamamlanmış görevlerinin XP'si kalıcı kalır.)
-- Idempotent CREATE OR REPLACE (0032 + 0033 gerektirir).
-- ============================================================================

create or replace function public.sync_gamification(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_workouts int; v_volume numeric; v_pr int := 0; v_posture int := 0; v_ai int := 0;
  v_water_days int; v_protein_days int; v_active_days int; v_exercises int;
  v_water_goal int; v_protein_goal int;
  v_streak int := 0; v_longest int := 0; v_last date; v_prev date; d date;
  v_base_xp int := 0; v_ach_xp int := 0; v_chal_xp int := 0; v_total_xp int := 0;
  v_level int; v_prev_level int; v_fitness int;
  r_workout int; r_volume int; r_water int; r_protein int; r_pr int;
  r_posture int; r_ai int; r_login int;
  ach record; v_prog numeric; v_done boolean;
  v_week date := date_trunc('week', now())::date;
  v_wk_workouts int; v_wk_water numeric; v_wk_protein numeric; v_wk_mobility int;
  ch record; ch_prog numeric; ch_done boolean;
begin
  select coalesce(daily_water_goal_ml, 2500), coalesce(daily_protein_goal, 120)
    into v_water_goal, v_protein_goal from public.profiles where id = p_user;
  v_water_goal := coalesce(v_water_goal, 2500);
  v_protein_goal := coalesce(v_protein_goal, 120);

  select count(*) into v_workouts from public.workouts where user_id = p_user and status = 'completed';
  select coalesce(sum(coalesce(ws.reps,0) * coalesce(ws.weight_kg,0)), 0) into v_volume
    from public.workout_sets ws join public.workouts w on w.id = ws.workout_id
    where w.user_id = p_user and ws.completed;
  select count(*) into v_exercises from public.workout_sets ws
    join public.workouts w on w.id = ws.workout_id where w.user_id = p_user and ws.completed;

  if to_regclass('public.personal_records') is not null then
    execute 'select count(*) from public.personal_records where user_id = $1' into v_pr using p_user;
  end if;
  if to_regclass('public.posture_analyses') is not null then
    execute 'select count(*) from public.posture_analyses where user_id = $1' into v_posture using p_user;
  end if;
  if to_regclass('public.ai_conversations') is not null then
    execute 'select count(*) from public.ai_conversations where user_id = $1' into v_ai using p_user;
  end if;

  select count(*) into v_water_days from (
    select log_date from public.water_logs where user_id = p_user
    group by log_date having sum(amount_ml) >= v_water_goal) t;
  select count(*) into v_protein_days from (
    select log_date from public.nutrition_logs where user_id = p_user
    group by log_date having sum(protein_g) >= v_protein_goal) t;

  drop table if exists _gam_days;
  create temp table _gam_days (dd date primary key) on commit drop;
  insert into _gam_days (dd)
    select distinct dd from (
      select workout_date dd from public.workouts where user_id = p_user and status = 'completed'
      union select log_date from public.water_logs where user_id = p_user
      union select log_date from public.nutrition_logs where user_id = p_user
    ) s where dd is not null
  on conflict do nothing;
  select count(*) into v_active_days from _gam_days;

  v_prev := null;
  for d in select dd from _gam_days order by dd loop
    if v_prev is null or d = v_prev + 1 then v_streak := v_streak + 1;
    elsif d <> v_prev then v_streak := 1; end if;
    if v_streak > v_longest then v_longest := v_streak; end if;
    v_last := d; v_prev := d;
  end loop;
  if v_last is null or v_last < current_date - 1 then v_streak := 0;
  else
    v_streak := 0; v_prev := null;
    for d in select dd from _gam_days order by dd loop
      if v_prev is null or d = v_prev + 1 then v_streak := v_streak + 1;
      elsif d <> v_prev then v_streak := 1; end if;
      v_prev := d;
    end loop;
  end if;

  select coalesce((select xp from public.xp_rules where event_key='workout_completed' and enabled),20) into r_workout;
  select coalesce((select xp from public.xp_rules where event_key='volume_1000kg' and enabled),5) into r_volume;
  select coalesce((select xp from public.xp_rules where event_key='water_goal' and enabled),10) into r_water;
  select coalesce((select xp from public.xp_rules where event_key='protein_goal' and enabled),10) into r_protein;
  select coalesce((select xp from public.xp_rules where event_key='new_pr' and enabled),25) into r_pr;
  select coalesce((select xp from public.xp_rules where event_key='first_posture' and enabled),40) into r_posture;
  select coalesce((select xp from public.xp_rules where event_key='ai_coach_used' and enabled),5) into r_ai;
  select coalesce((select xp from public.xp_rules where event_key='daily_login' and enabled),5) into r_login;

  v_base_xp :=
      v_workouts * r_workout + floor(v_volume / 1000)::int * r_volume
    + v_water_days * r_water + v_protein_days * r_protein + v_pr * r_pr
    + (case when v_posture > 0 then r_posture else 0 end) + v_ai * r_ai + v_active_days * r_login;

  -- Başarımlar
  for ach in select * from public.achievements where enabled loop
    v_prog := case ach.metric
      when 'workouts_count' then v_workouts when 'total_volume' then v_volume
      when 'exercises_count' then v_exercises when 'posture_count' then v_posture
      when 'ai_count' then v_ai when 'pr_count' then v_pr
      when 'water_days' then v_water_days when 'protein_days' then v_protein_days
      when 'streak_days' then greatest(v_longest, v_streak) when 'active_days' then v_active_days
      else 0 end;
    v_done := v_prog >= ach.target;
    insert into public.achievement_progress (user_id, achievement_id, progress, target, completed, completed_at, updated_at)
    values (p_user, ach.id, v_prog, ach.target, v_done, case when v_done then now() else null end, now())
    on conflict (user_id, achievement_id) do update set
      progress = excluded.progress, target = excluded.target, completed = excluded.completed,
      completed_at = coalesce(public.achievement_progress.completed_at, excluded.completed_at), updated_at = now();
    if v_done then v_ach_xp := v_ach_xp + ach.xp_reward; end if;
  end loop;

  -- ---- GÖREVLER (haftalık) ----
  -- Bu haftanın metrikleri
  select count(*) into v_wk_workouts from public.workouts
    where user_id = p_user and status = 'completed' and workout_date >= v_week;
  select coalesce(sum(amount_ml),0) into v_wk_water from public.water_logs
    where user_id = p_user and log_date >= v_week;
  select coalesce(sum(protein_g),0) into v_wk_protein from public.nutrition_logs
    where user_id = p_user and log_date >= v_week;
  select count(*) into v_wk_mobility from public.workouts
    where user_id = p_user and status = 'completed' and workout_date >= v_week
      and (title ~* 'mobil|esne|stretch');

  -- Bu haftanın görevlerini değerlendir → challenge_progress (completed sticky)
  for ch in select * from public.weekly_challenges where week_start = v_week and active loop
    ch_prog := case ch.metric
      when 'workouts'  then v_wk_workouts
      when 'water_ml'  then v_wk_water
      when 'protein_g' then v_wk_protein
      when 'mobility'  then v_wk_mobility
      else 0 end;
    ch_done := ch_prog >= ch.target;
    insert into public.challenge_progress (challenge_id, user_id, progress, target, completed, completed_at, updated_at)
    values (ch.id, p_user, ch_prog, ch.target, ch_done, case when ch_done then now() else null end, now())
    on conflict (challenge_id, user_id) do update set
      progress = excluded.progress, target = excluded.target,
      completed = public.challenge_progress.completed or excluded.completed,   -- sticky
      completed_at = coalesce(public.challenge_progress.completed_at, excluded.completed_at),
      updated_at = now();
  end loop;

  -- TÜM tamamlanmış görevlerin XP'si (kalıcı — geçmiş haftalar dahil)
  select coalesce(sum(wc.xp_reward), 0) into v_chal_xp
    from public.challenge_progress cp
    join public.weekly_challenges wc on wc.id = cp.challenge_id
    where cp.user_id = p_user and cp.completed;

  v_total_xp := v_base_xp + v_ach_xp + v_chal_xp;
  v_level := public.gam_level_for_xp(v_total_xp);

  v_fitness := least(100, (
      least(30, v_workouts * 2) + least(15, v_protein_days) + least(15, v_water_days)
    + least(15, v_active_days) + least(10, floor(v_volume/2000)::int)
    + (case when v_posture > 0 then 10 else 0 end) + least(5, v_ai)));

  select level into v_prev_level from public.user_gamification where user_id = p_user;

  insert into public.user_gamification
    (user_id, total_xp, level, fitness_score, current_streak, longest_streak, last_active_on, season_xp, updated_at)
  values (p_user, v_total_xp, v_level, v_fitness, v_streak, v_longest, v_last, v_total_xp, now())
  on conflict (user_id) do update set
    total_xp = excluded.total_xp, level = excluded.level, fitness_score = excluded.fitness_score,
    current_streak = excluded.current_streak, longest_streak = excluded.longest_streak,
    last_active_on = excluded.last_active_on, season_xp = excluded.season_xp, updated_at = now();

  insert into public.streaks (user_id, kind, current, longest, last_date, updated_at)
  values (p_user, 'daily', v_streak, v_longest, v_last, now())
  on conflict (user_id, kind) do update set
    current = excluded.current, longest = greatest(public.streaks.longest, excluded.longest),
    last_date = excluded.last_date, updated_at = now();

  insert into public.fitness_scores (user_id, score_date, score, breakdown)
  values (p_user, current_date, v_fitness, jsonb_build_object(
    'workouts', v_workouts, 'volume', v_volume, 'water_days', v_water_days,
    'protein_days', v_protein_days, 'active_days', v_active_days, 'posture', v_posture, 'ai', v_ai))
  on conflict (user_id, score_date) do update set score = excluded.score, breakdown = excluded.breakdown;

  return jsonb_build_object(
    'total_xp', v_total_xp, 'level', v_level, 'prev_level', coalesce(v_prev_level, 1),
    'leveled_up', coalesce(v_prev_level, 1) < v_level,
    'fitness_score', v_fitness, 'current_streak', v_streak, 'longest_streak', v_longest);
end;
$$;

grant execute on function public.sync_gamification(uuid) to authenticated, service_role;

