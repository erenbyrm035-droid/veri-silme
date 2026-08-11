-- ===========================================================================
-- ÇOKLU AJAN DOĞRULAMA (migration 0047)
--
-- SALT OKUNUR — hiçbir veriyi değiştirmez, silmez, eklemez.
-- Tüm kontroller TEK sorguda: Supabase SQL Editor yalnızca son sorgunun
-- sonucunu gösterir. `durum` sütununda tek bir "KALDI" olmamalı.
--
-- Önce 0047_multi_agent.sql'i çalıştır, sonra bunu.
-- ===========================================================================

with

t_tablo as (
  select 1 as sira, 'Tablo' as grup, x.ad as kontrol,
         (to_regclass('public.' || x.ad) is not null) as ok,
         'tablo oluşmamış' as hata
  from (values ('ai_agents'), ('ai_agent_prompts'), ('ai_agent_runs'), ('ai_ab_tests')) as x(ad)
),

t_fn as (
  select 2, 'Fonksiyon', x.ad,
         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = x.ad),
         'fonksiyon oluşmamış'
  from (values
    ('pick_prompt_variant'), ('agent_metrics'), ('agent_daily_tokens'), ('ab_test_results')
  ) as x(ad)
),

-- 10 varsayılan ajan seed edilmiş mi
t_seed as (
  select 3, 'Ajan kaydı', x.ad,
         exists (select 1 from public.ai_agents a where a.key = x.ad),
         'ajan seed edilmemiş'
  from (values
    ('orchestrator'), ('fitness'), ('nutrition'), ('physio'), ('recovery'),
    ('mental'), ('gamification'), ('social'), ('medical'), ('synthesizer')
  ) as x(ad)
),

-- Ajanların araç izinleri ve hafıza katmanları dolu mu
t_config as (
  select 4, 'Yapılandırma', 'uzman ajanların hafıza katmanı var',
         not exists (
           select 1 from public.ai_agents a
           where a.key in ('fitness','nutrition','physio','recovery','mental','gamification','social')
             and coalesce(array_length(a.memory_layers, 1), 0) = 0
         ),
         'bir uzmanın hafıza katmanı boş — bağlamsız çalışır'
  union all
  select 4, 'Yapılandırma', 'araç izinleri tanımlı',
         exists (select 1 from public.ai_agents a
                  where a.key = 'fitness' and coalesce(array_length(a.allowed_tools, 1), 0) > 0),
         'fitness ajanının aracı yok'
  union all
  select 4, 'Yapılandırma', 'tıbbi güvenlik ajanının aracı YOK (olmamalı)',
         coalesce((select array_length(a.allowed_tools, 1) from public.ai_agents a where a.key = 'medical'), 0) = 0,
         'tıbbi güvenlik ajanına araç verilmiş — denetleyici veri yazmamalı'
),

t_rls as (
  select 5, 'RLS açık', x.ad,
         coalesce((select c.relrowsecurity from pg_class c
                    join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relname = x.ad), false),
         'RLS KAPALI — prompt içerikleri herkese açık!'
  from (values ('ai_agents'), ('ai_agent_prompts'), ('ai_agent_runs'), ('ai_ab_tests')) as x(ad)
),

t_pol as (
  select 6, 'Politika', x.ad || ' → ' || x.pol,
         exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = x.ad and policyname = x.pol),
         'politika yok'
  from (values
    ('ai_agents',        'ai_agents_admin'),
    ('ai_agent_prompts', 'ai_agent_prompts_admin'),
    ('ai_ab_tests',      'ai_ab_tests_admin'),
    ('ai_agent_runs',    'ai_agent_runs_read'),
    ('ai_agent_runs',    'ai_agent_runs_admin')
  ) as x(ad, pol)
),

t_chk as (
  select 7, 'Kısıt', x.ad,
         exists (select 1 from pg_constraint where conname = x.ad),
         'kısıt yok — geçersiz ayar girilebilir'
  from (values
    ('ai_agents_temp_chk'), ('ai_agents_tokens_chk'),
    ('ai_agents_memlimit_chk'), ('ai_agent_prompts_variant_chk'), ('ai_ab_split_chk')
  ) as x(ad)
),

-- Ajan başına tek aktif A/B testi olabilmeli
t_uniq as (
  select 8, 'Tekillik', 'ajan başına tek aktif A/B testi',
         exists (select 1 from pg_indexes
                  where schemaname = 'public' and indexname = 'idx_ab_one_active_per_agent'),
         'iki test aynı kullanıcıyı farklı varyantlara atayabilir'
  union all
  select 8, 'Tekillik', 'prompt: ajan + sürüm + varyant',
         exists (select 1 from pg_indexes
                  where schemaname = 'public' and tablename = 'ai_agent_prompts'
                    and indexdef ilike '%UNIQUE%' and indexdef ilike '%(agent_key, version, variant)%'),
         'aynı sürüm iki kez oluşabilir'
),

-- A/B ataması KARARLI mı: aynı kullanıcı hep aynı varyantı görmeli
t_variant as (
  select 9, 'A/B', 'aktif test yokken herkes kontrol grubunda',
         public.pick_prompt_variant('fitness', '00000000-0000-0000-0000-000000000001') = 'a',
         'test yokken bile B dağıtılıyor'
  union all
  select 9, 'A/B', 'atama kararlı (aynı kullanıcı = aynı varyant)',
         public.pick_prompt_variant('fitness', '00000000-0000-0000-0000-000000000001')
           = public.pick_prompt_variant('fitness', '00000000-0000-0000-0000-000000000001'),
         'her çağrıda değişiyor — test ölçüm üretemez'
),

-- Metrik fonksiyonları çalışıyor mu (veri olmasa da hata vermemeli)
t_metrics as (
  select 10, 'Metrik', 'agent_metrics çalışıyor',
         (select count(*) >= 0 from public.agent_metrics(7)), 'fonksiyon hata veriyor'
  union all
  select 10, 'Metrik', 'agent_daily_tokens çalışıyor',
         (select count(*) >= 0 from public.agent_daily_tokens(14)), 'fonksiyon hata veriyor'
  union all
  select 10, 'Metrik', 'ab_test_results çalışıyor',
         (select count(*) >= 0 from public.ab_test_results('fitness')), 'fonksiyon hata veriyor'
),

-- 0046 ve öncesi bozulmamış mı
t_eski as (
  select 11, 'Eski tablo', x.ad,
         (to_regclass('public.' || x.ad) is not null),
         'ESKİ TABLO KAYBOLMUŞ — veri kaybı!'
  from (values
    ('ai_facts'), ('ai_goals'), ('ai_reports'), ('ai_actions'),
    ('ai_memory'), ('ai_conversations'), ('ai_messages'),
    ('ai_usage'), ('ai_logs'), ('ai_prompt_versions')
  ) as x(ad)
  union all
  select 11, 'Eski RPC', x.ad,
         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = x.ad),
         'ESKİ RPC KAYBOLMUŞ — sayfalar bozulur!'
  from (values
    ('agent_snapshot'), ('goal_progress'), ('evaluate_ai_goals'), ('upsert_ai_fact'),
    ('daily_summary'), ('recovery_score'), ('season_state'), ('sync_gamification')
  ) as x(ad)
),

hepsi as (
  select * from t_tablo
  union all select * from t_fn
  union all select * from t_seed
  union all select * from t_config
  union all select * from t_rls
  union all select * from t_pol
  union all select * from t_chk
  union all select * from t_uniq
  union all select * from t_variant
  union all select * from t_metrics
  union all select * from t_eski
)

select
  case when h.ok then '✅ GEÇTİ' else '❌ KALDI' end as durum,
  h.grup,
  h.kontrol,
  case when h.ok then '' else h.hata end as aciklama
from hepsi h

union all

select
  case when (select bool_and(ok) from hepsi) then '🎉 TÜMÜ GEÇTİ' else '⛔ SORUN VAR' end,
  'ÖZET',
  (select count(*) filter (where ok) from hepsi)::text || ' / ' ||
  (select count(*) from hepsi)::text || ' kontrol geçti',
  case when (select bool_and(ok) from hepsi)
       then 'Çoklu ajan mimarisi hazır. Admin → AI Yönetim Merkezi''nden yönetebilirsin.'
       else 'Yukarıdaki KALDI satırlarına bak.' end

order by 1 desc, 2, 3;
