-- ============================================================================
-- Coin ekonomisi (0040) — KURULUM DOĞRULAMA
-- Hiçbir şey değiştirmez; yalnızca okur ve rapor üretir.
-- ============================================================================

with
r_sutun as (
  select 1 as sira, 'Sütun' as kategori, b.ad as nesne,
         case when c.column_name is null then '✗ EKSİK' else '✓' end as durum,
         coalesce(c.data_type, '—') as ayrinti
  from (values ('coins'), ('coins_earned'), ('coins_spent')) b(ad)
  left join information_schema.columns c
    on c.table_schema = 'public' and c.table_name = 'user_gamification'
   and c.column_name = b.ad
),
r_fonksiyon as (
  select 2, 'Fonksiyon', b.ad,
         case when p.proname is null then '✗ EKSİK' else '✓' end, '—'
  from (values ('coins_earned_for'), ('spend_coins'), ('refund_coins'),
               ('my_weekly_challenges'), ('tg_user_gamification_coins')) b(ad)
  left join pg_proc p on p.proname = b.ad
   and p.pronamespace = (select oid from pg_namespace where nspname = 'public')
),
r_tetik as (
  select 3, 'Tetikleyici', 'trg_user_gamification_coins',
         case when t.tgname is null then '✗ EKSİK' else '✓' end,
         coalesce((select cl.relname from pg_class cl where cl.oid = t.tgrelid), '—')
  from (select 1) x
  left join pg_trigger t
    on t.tgname = 'trg_user_gamification_coins' and not t.tgisinternal
),
-- Bakiye tutarlılığı: coins = coins_earned - coins_spent olmalı
r_tutarlilik as (
  select 4, 'Veri', 'bakiye tutarlılığı',
         case when count(*) = 0 then '✓' else '✗ TUTARSIZ' end,
         case when count(*) = 0 then 'tüm satırlar doğru'
              else count(*)::text || ' satırda sapma' end
  from public.user_gamification
  where coins <> greatest(0, coins_earned - coins_spent)
),
-- Coin gerçekten kazanılıyor mu?
r_kazanim as (
  select 5, 'Veri', 'coin kazanan kullanıcı',
         case when count(*) filter (where coins_earned > 0) > 0 then '✓' else '! HENÜZ YOK' end,
         count(*) filter (where coins_earned > 0)::text || ' / ' || count(*)::text || ' kullanıcı'
  from public.user_gamification
),
r_toplam as (
  select 6, 'Veri', 'toplam coin',
         '✓',
         'kazanılan: ' || coalesce(sum(coins_earned), 0)::text ||
         ' · harcanan: ' || coalesce(sum(coins_spent), 0)::text ||
         ' · bakiye: '  || coalesce(sum(coins), 0)::text
  from public.user_gamification
)
select kategori, nesne, durum, ayrinti
from (
  select * from r_sutun
  union all select * from r_fonksiyon
  union all select * from r_tetik
  union all select * from r_tutarlilik
  union all select * from r_kazanim
  union all select * from r_toplam
) q(sira, kategori, nesne, durum, ayrinti)
order by sira, nesne;
