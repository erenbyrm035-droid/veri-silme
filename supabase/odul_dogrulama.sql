-- ============================================================================
-- Dalga 1 + 2 (0041 · 0042 · 0043) — KURULUM DOĞRULAMA
-- Hiçbir şey değiştirmez; yalnızca okur ve rapor üretir.
-- "durum" sütununda tek bir ✗ bile olmamalı.
-- ============================================================================

with
r_tablo as (
  select 1 as sira, 'Tablo' as kategori, b.ad as nesne,
         case when t.tablename is null then '✗ EKSİK' else '✓' end as durum,
         coalesce(
           (select case when c.relrowsecurity then 'RLS açık' else '! RLS KAPALI' end
              from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = b.ad), '—') as ayrinti
  from (values ('daily_metrics'), ('reward_events')) b(ad)
  left join pg_tables t on t.schemaname = 'public' and t.tablename = b.ad
),
r_fonksiyon as (
  select 2, 'Fonksiyon', b.ad,
         case when p.proname is null then '✗ EKSİK' else '✓' end, '—'
  from (values
    ('upsert_daily_metric'), ('daily_summary'), ('recovery_score'), ('readiness_score'),
    ('weekly_steps'), ('insights_snapshot'),
    ('reward_eligibility'), ('claim_reward'), ('decide_reward_claim'), ('reward_stats')
  ) b(ad)
  left join pg_proc p on p.proname = b.ad
   and p.pronamespace = (select oid from pg_namespace where nspname = 'public')
),
r_profil as (
  select 3, 'profiles sütunu', 'daily_sleep_goal_min',
         case when c.column_name is null then '✗ EKSİK' else '✓' end,
         coalesce(c.column_default, '—')
  from (select 1) x
  left join information_schema.columns c
    on c.table_schema='public' and c.table_name='profiles' and c.column_name='daily_sleep_goal_min'
),
r_katalog as (
  select 4, 'reward_catalog sütunu', b.ad,
         case when c.column_name is null then '✗ EKSİK' else '✓' end,
         coalesce(c.data_type, '—')
  from (values
    ('image_url'), ('fulfillment_type'), ('req_xp'), ('req_level'), ('req_team_level'),
    ('stock'), ('expires_at'), ('coupon_code'), ('sponsor_name'), ('featured')
  ) b(ad)
  left join information_schema.columns c
    on c.table_schema='public' and c.table_name='reward_catalog' and c.column_name=b.ad
),
r_talep as (
  select 5, 'reward_claims sütunu', b.ad,
         case when c.column_name is null then '✗ EKSİK' else '✓' end,
         coalesce(c.data_type, '—')
  from (values ('spent_coins'), ('admin_note'), ('decided_by'), ('delivered_at'), ('coupon_issued')) b(ad)
  left join information_schema.columns c
    on c.table_schema='public' and c.table_name='reward_claims' and c.column_name=b.ad
),
r_bucket as (
  select 6, 'Storage', 'rewards bucket',
         case when b.id is null then '✗ EKSİK' else '✓' end,
         case when b.id is null then '—' when b.public then 'public (doğru)' else '! private' end
  from (select 1) x left join storage.buckets b on b.id = 'rewards'
),
r_coin as (
  select 7, 'Veri', 'coin ekonomisi',
         case when count(*) filter (where coins_earned > 0) > 0 then '✓' else '! HENÜZ YOK' end,
         'kazanan: ' || count(*) filter (where coins_earned > 0)::text || '/' || count(*)::text ||
         ' · toplam bakiye: ' || coalesce(sum(coins),0)::text
  from public.user_gamification
),
r_metrik as (
  select 8, 'Veri', 'daily_metrics kaydı',
         case when count(*) >= 0 then '✓' else '✗' end,
         count(*)::text || ' satır'
  from public.daily_metrics
),
r_odul as (
  select 9, 'Veri', 'ödül kataloğu',
         case when count(*) > 0 then '✓' else '! BOŞ' end,
         count(*) filter (where enabled)::text || ' aktif / ' || count(*)::text || ' toplam'
  from public.reward_catalog
)
select kategori, nesne, durum, ayrinti
from (
  select * from r_tablo
  union all select * from r_fonksiyon
  union all select * from r_profil
  union all select * from r_katalog
  union all select * from r_talep
  union all select * from r_bucket
  union all select * from r_coin
  union all select * from r_metrik
  union all select * from r_odul
) q(sira, kategori, nesne, durum, ayrinti)
order by sira, nesne;
