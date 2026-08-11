-- ============================================================================
-- Dalga 3 (0044) — KURULUM DOĞRULAMA
-- Hiçbir şey değiştirmez; yalnızca okur ve rapor üretir.
-- "durum" sütununda tek bir ✗ bile olmamalı.
-- ============================================================================

with
r_sutun as (
  select 1 as sira, 'Sütun' as kategori, b.tablo || '.' || b.sutun as nesne,
         case when c.column_name is null then '✗ EKSİK' else '✓' end as durum,
         coalesce(c.data_type ||
           case when c.is_nullable = 'YES' then ' (null olabilir)' else ' (zorunlu)' end, '—') as ayrinti
  from (values
    ('team_posts','visibility'),
    ('team_posts','team_id'),
    ('team_live_sessions','visibility'),
    ('team_live_sessions','activity'),
    ('team_live_sessions','met'),
    ('team_live_participants','calories')
  ) b(tablo, sutun)
  left join information_schema.columns c
    on c.table_schema = 'public' and c.table_name = b.tablo and c.column_name = b.sutun
),
-- team_id'ler artık null KABUL ETMELİ (kişisel akış / arkadaş partisi)
r_nullable as (
  select 2, 'Nullable kontrolü', b.tablo || '.team_id',
         case when c.is_nullable = 'YES' then '✓' else '✗ HÂLÂ ZORUNLU' end,
         'null olmalı → kişisel akış / arkadaş partisi'
  from (values ('team_posts'), ('team_live_sessions')) b(tablo)
  left join information_schema.columns c
    on c.table_schema='public' and c.table_name=b.tablo and c.column_name='team_id'
),
r_tablo as (
  select 3, 'Tablo', 'live_session_invites',
         case when t.tablename is null then '✗ EKSİK' else '✓' end,
         coalesce((select case when cl.relrowsecurity then 'RLS açık' else '! RLS KAPALI' end
                     from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
                    where n.nspname='public' and cl.relname='live_session_invites'), '—')
  from (select 1) x
  left join pg_tables t on t.schemaname='public' and t.tablename='live_session_invites'
),
r_fonksiyon as (
  select 4, 'Fonksiyon', b.ad,
         case when p.proname is null then '✗ EKSİK' else '✓' end, '—'
  from (values
    ('are_friends'), ('can_see_post'), ('can_see_live_session'),
    ('feed_post_ids'), ('trending_exercises'), ('popular_users'), ('end_live_session')
  ) b(ad)
  left join pg_proc p on p.proname = b.ad
   and p.pronamespace = (select oid from pg_namespace where nspname='public')
),
r_kisit as (
  select 5, 'Kısıt', b.ad,
         case when c.conname is null then '✗ EKSİK' else '✓' end, '—'
  from (values
    ('team_posts_visibility_chk'), ('team_posts_owner_chk'),
    ('live_sessions_visibility_chk'), ('live_sessions_owner_chk')
  ) b(ad)
  left join pg_constraint c on c.conname = b.ad
),
r_politika as (
  select 6, 'RLS politikası', b.ad,
         case when p.policyname is null then '✗ EKSİK' else '✓' end,
         coalesce(p.tablename, '—')
  from (values
    ('team_posts_member_select'), ('team_posts_member_insert'),
    ('team_post_reactions_all'), ('team_post_comments_select'),
    ('live_sessions_select'), ('live_parts_select'), ('live_invites_select')
  ) b(ad)
  left join pg_policies p on p.schemaname='public' and p.policyname = b.ad
),
r_index as (
  select 7, 'Index', b.ad,
         case when i.indexname is null then '✗ EKSİK' else '✓' end, '—'
  from (values
    ('idx_team_posts_author'), ('idx_team_posts_global'),
    ('idx_live_sessions_host'), ('idx_live_invites_user')
  ) b(ad)
  left join pg_indexes i on i.schemaname='public' and i.indexname = b.ad
),
-- Davranış testi: are_friends kendi kendine false dönmeli, null güvenli olmalı
r_davranis as (
  select 8, 'Davranış', 'are_friends(null,null)',
         case when public.are_friends(null, null) is false then '✓' else '✗ BEKLENMEYEN' end,
         'null → false olmalı'
  union all
  select 8, 'Davranış', 'can_see_post(anonim)',
         case when public.can_see_post(null, null, 'public', null) is false then '✓' else '✗ BEKLENMEYEN' end,
         'oturumsuz → false olmalı'
),
r_veri as (
  select 9, 'Veri', 'gönderi kapsamları',
         '✓',
         'takım: ' || count(*) filter (where team_id is not null)::text ||
         ' · arkadaş: ' || count(*) filter (where team_id is null and visibility = 'friends')::text ||
         ' · herkese açık: ' || count(*) filter (where team_id is null and visibility = 'public')::text
  from public.team_posts
  union all
  select 9, 'Veri', 'canlı oturumlar',
         '✓',
         'takım: ' || count(*) filter (where team_id is not null)::text ||
         ' · arkadaş partisi: ' || count(*) filter (where team_id is null)::text ||
         ' · aktif: ' || count(*) filter (where status = 'live')::text
  from public.team_live_sessions
)
select kategori, nesne, durum, ayrinti
from (
  select * from r_sutun
  union all select * from r_nullable
  union all select * from r_tablo
  union all select * from r_fonksiyon
  union all select * from r_kisit
  union all select * from r_politika
  union all select * from r_index
  union all select * from r_davranis
  union all select * from r_veri
) q(sira, kategori, nesne, durum, ayrinti)
order by sira, nesne;
