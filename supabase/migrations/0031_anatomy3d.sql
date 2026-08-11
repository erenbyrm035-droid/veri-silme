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
