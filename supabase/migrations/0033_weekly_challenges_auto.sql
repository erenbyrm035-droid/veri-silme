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
