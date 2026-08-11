-- ===========================================================================
-- TÜM EGZERSİZ VİDEOLARINI SİL
--
-- Admin panelindeki "Tüm Videoları Sil" düğmesinin SQL karşılığı.
-- Panel tercih edilmeli: o, Storage'daki DOSYALARI da siler. Bu betik
-- yalnızca VERİTABANI kayıtlarını temizler — dosyalar bucket'ta kalır.
--
-- SİLİNENLER
--   · exercise_media_set.video_url / male_video / female_video
--   · exercises.video_url            (eski sütun; admin listesi hâlâ yedek okuyor)
--   · exercise_media satırları, media_type = 'video'
--
-- KORUNANLAR (kasıtlı — bunlara DOKUNULMAZ)
--   · GIF'ler: gif_url, male_gif, female_gif
--   · Thumbnail'ler: thumbnail_url, exercises.image_url
--   · 3D animasyonlar: exercise_animations + animations bucket
--
-- Geri alınamaz. Tek işlem (transaction) — hata olursa hiçbiri uygulanmaz.
-- Sonuçta ne silindiğini gösteren tek bir tablo döner.
-- ===========================================================================

begin;

-- Silmeden ÖNCEKİ sayımları sakla: silindikten sonra sayılamazlar.
create temp table _video_rapor on commit drop as
select
  (select count(*) from public.exercise_media_set
    where coalesce(video_url,'') <> '' or coalesce(male_video,'') <> ''
       or coalesce(female_video,'') <> '')                        as medya_seti,
  (select count(*) from public.exercises where video_url is not null) as eski_sutun,
  (select count(*) from public.exercise_media where media_type = 'video') as galeri;

-- 1) Güncel sistem: egzersiz başına medya seti.
--    Trigger `status`'u otomatik yeniden hesaplar (video gitti → complete değil, partial).
update public.exercise_media_set
   set video_url = null, male_video = null, female_video = null
 where coalesce(video_url,'') <> ''
    or coalesce(male_video,'') <> ''
    or coalesce(female_video,'') <> '';

-- 2) Eski sütun. 0012'de bir kez temizlenmişti ama seed dosyaları bu sütunu
--    hâlâ dolduruyor; seed yeniden çalıştırıldıysa değer geri gelmiş olabilir.
update public.exercises
   set video_url = null
 where video_url is not null;

-- 3) Galeri tablosundaki video satırları.
delete from public.exercise_media where media_type = 'video';

select
  medya_seti  as "medya seti temizlendi",
  eski_sutun  as "eski video_url temizlendi",
  galeri      as "galeri satırı silindi",
  (select count(*) from public.exercise_media_set
    where coalesce(video_url,'') <> '' or coalesce(male_video,'') <> ''
       or coalesce(female_video,'') <> '')
  + (select count(*) from public.exercises where video_url is not null)
  + (select count(*) from public.exercise_media where media_type = 'video')
              as "kalan video (0 olmalı)"
from _video_rapor;

commit;
