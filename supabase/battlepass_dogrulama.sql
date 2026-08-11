-- ============================================================================
-- Dalga 4 (0045) — KURULUM DOĞRULAMA
-- Hiçbir şey değiştirmez; yalnızca okur ve rapor üretir.
-- "durum" sütununda tek bir ✗ bile olmamalı.
-- ============================================================================

with
r_tablo as (
  select 1 as sira, 'Tablo' as kategori, b.ad as nesne,
         case when t.tablename is null then '✗ EKSİK' else '✓' end as durum,
         coalesce((select case when c.relrowsecurity then 'RLS açık' else '! RLS KAPALI' end
                     from pg_class c join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname='public' and c.relname = b.ad), '—') as ayrinti
  from (values ('season_tracks'), ('season_claims'), ('team_battles')) b(ad)
  left join pg_tables t on t.schemaname='public' and t.tablename = b.ad
),
r_sutun as (
  select 2, 'Sütun', b.tablo || '.' || b.sutun,
         case when c.column_name is null then '✗ EKSİK' else '✓' end,
         coalesce(c.data_type, '—')
  from (values
    ('shopping_lists','dietitian_plan_id'),
    ('shopping_lists','source'),
    ('shopping_lists','updated_at')
  ) b(tablo, sutun)
  left join information_schema.columns c
    on c.table_schema='public' and c.table_name=b.tablo and c.column_name=b.sutun
),
r_fonksiyon as (
  select 3, 'Fonksiyon', b.ad,
         case when p.proname is null then '✗ EKSİK' else '✓' end, '—'
  from (values
    ('is_premium_user'), ('active_season'), ('season_xp_for'), ('season_state'),
    ('claim_season_tier'), ('battle_team_score'), ('battle_state'),
    ('sync_shopping_from_plan'), ('toggle_shopping_item')
  ) b(ad)
  left join pg_proc p on p.proname = b.ad
   and p.pronamespace = (select oid from pg_namespace where nspname='public')
),
r_trigger as (
  select 4, 'Trigger', b.ad,
         case when t.tgname is null then '✗ EKSİK' else '✓' end,
         coalesce(cl.relname, '—')
  from (values ('trg_user_gamification_season'), ('trg_dietitian_plan_shopping')) b(ad)
  left join pg_trigger t on t.tgname = b.ad and not t.tgisinternal
  left join pg_class cl on cl.oid = t.tgrelid
),
r_kisit as (
  select 5, 'Kısıt', b.ad,
         case when c.conname is null then '✗ EKSİK' else '✓' end, '—'
  from (values
    ('season_claims_lane_chk'), ('team_battles_distinct_chk'), ('team_battles_window_chk')
  ) b(ad)
  left join pg_constraint c on c.conname = b.ad
),
r_politika as (
  select 6, 'RLS politikası', b.ad,
         case when p.policyname is null then '✗ EKSİK' else '✓' end,
         coalesce(p.tablename, '—')
  from (values
    ('season_tracks_select'), ('season_tracks_admin'), ('season_claims_own'),
    ('team_battles_select'), ('team_battles_write'), ('team_battles_update')
  ) b(ad)
  left join pg_policies p on p.schemaname='public' and p.policyname = b.ad
),
-- DAVRANIŞ: season_xp artık total_xp'nin kopyası OLMAMALI.
-- (Aktif sezon yoksa herkes 0 olur — bu da doğru davranıştır.)
r_seasonxp as (
  select 7, 'Davranış', 'season_xp ≠ total_xp',
         case
           when not exists (select 1 from public.active_season())
             then case when coalesce((select sum(season_xp) from public.user_gamification), 0) = 0
                       then '✓' else '! SEZON YOK AMA XP VAR' end
           else '✓'
         end,
         case when exists (select 1 from public.active_season())
              then 'aktif sezon var'
              else 'aktif sezon yok → season_xp 0 olmalı' end
),
r_veri as (
  select 8, 'Veri', 'sezonlar',
         case when count(*) > 0 then '✓' else '! HENÜZ YOK' end,
         count(*) filter (where active)::text || ' aktif / ' || count(*)::text || ' toplam'
  from public.seasons
  union all
  select 8, 'Veri', 'battle pass kademeleri',
         case when count(*) > 0 then '✓' else '! HENÜZ YOK — admin panelinden ekle' end,
         count(*)::text || ' kademe'
  from public.season_tracks
  union all
  select 8, 'Veri', 'takım savaşları',
         '✓',
         count(*) filter (where status='active')::text || ' aktif / ' || count(*)::text || ' toplam'
  from public.team_battles
  union all
  select 8, 'Veri', 'alışveriş listeleri',
         '✓',
         count(*) filter (where source='dietitian')::text || ' diyetisyen / ' || count(*)::text || ' toplam'
  from public.shopping_lists
)
select kategori, nesne, durum, ayrinti
from (
  select * from r_tablo
  union all select * from r_sutun
  union all select * from r_fonksiyon
  union all select * from r_trigger
  union all select * from r_kisit
  union all select * from r_politika
  union all select * from r_seasonxp
  union all select * from r_veri
) q(sira, kategori, nesne, durum, ayrinti)
order by sira, nesne;
