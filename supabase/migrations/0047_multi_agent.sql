-- ============================================================================
-- 0047 — Çoklu ajan mimarisi (Multi-Agent)
--
-- MEVCUT SİSTEM KORUNUR: 0046'daki ai_facts / ai_goals / ai_reports /
-- ai_actions ve daha eski ai_memory / ai_conversations / ai_messages /
-- ai_usage / ai_logs / ai_prompt_versions tablolarına DOKUNULMAZ.
--
-- NE EKLİYOR:
--   ai_agents        → uzman ajanların yapılandırması (admin panelinden yönetilir)
--   ai_agent_prompts → versiyonlanmış promptlar + A/B varyantları
--   ai_agent_runs    → her ajan çalışmasının telemetrisi (token, süre, başarı)
--   ai_ab_tests      → prompt A/B testleri
--
-- TASARIM KARARI — KONFİGÜRASYON NEDEN VERİTABANINDA:
-- Ajanların promptu, modeli ve sıcaklığı koda gömülü olsaydı her ince ayar
-- için yeni bir dağıtım gerekirdi. Prompt ayarı deneme-yanılma işidir; bunu
-- dağıtım döngüsüne bağlamak deneme sayısını pratikte sıfıra indirir.
-- Kodda yalnızca GÜVENLİ VARSAYILANLAR var (bkz. specialists/*.ts); veritabanı
-- kaydı onları geçersiz kılar. Tablo boşsa sistem varsayılanlarla çalışır.
--
-- Additive + idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) ai_agents — uzman ajan kayıt defteri
-- ---------------------------------------------------------------------------
create table if not exists public.ai_agents (
  key            text primary key,
    -- fitness | nutrition | physio | recovery | mental
    -- | gamification | social | medical | orchestrator | synthesizer
  name           text not null,
  description    text,
  enabled        boolean not null default true,
  -- Boş bırakılırsa genel AI_PROVIDER modeli kullanılır.
  model          text,
  temperature    numeric(3,2) not null default 0.50,
  max_tokens     int not null default 500,
  -- Bu ajanın göreceği hafıza katmanları. Her ajana TÜM bağlamı vermek hem
  -- token israfı hem de odak kaybı; beslenme uzmanının takım savaşını
  -- bilmesine gerek yok.
  memory_layers  text[] not null default '{}',
    -- session | longterm | profile | health | nutrition | workout | goals | social
  -- Bu ajanın çağırabileceği araçlar. Boş = araç yok (sadece akıl yürütür).
  allowed_tools  text[] not null default '{}',
  -- Ajanın kendi bağlam bütçesi (karakter). Hafıza limiti admin'den ayarlanır.
  memory_limit   int not null default 4000,
  sort_order     int not null default 100,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ai_agents_temp_chk') then
    alter table public.ai_agents
      add constraint ai_agents_temp_chk check (temperature >= 0 and temperature <= 2);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ai_agents_tokens_chk') then
    alter table public.ai_agents
      add constraint ai_agents_tokens_chk check (max_tokens between 50 and 4000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ai_agents_memlimit_chk') then
    alter table public.ai_agents
      add constraint ai_agents_memlimit_chk check (memory_limit between 200 and 40000);
  end if;
end $$;

comment on table public.ai_agents is
  'Uzman ajan yapılandırması. Boşsa koddaki varsayılanlar kullanılır; bu kayıtlar onları geçersiz kılar.';

-- ---------------------------------------------------------------------------
-- 2) ai_agent_prompts — versiyonlu promptlar + A/B varyantları
--
-- NEDEN AYRI TABLO: `ai_agents.system_prompt` diye tek bir sütun olsaydı
-- geçmiş sürüme dönmek imkânsız olurdu. Prompt değişikliği geri alınabilir
-- olmalı — bir prompt "iyileştirmesi" cevap kalitesini düşürebilir ve bunu
-- ancak birkaç gün sonra fark edersin.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_agent_prompts (
  id          uuid primary key default uuid_generate_v4(),
  agent_key   text not null references public.ai_agents(key) on delete cascade,
  version     int not null,
  -- A/B testi için varyant etiketi. 'a' varsayılan/kontrol grubudur.
  variant     text not null default 'a',
  content     text not null,
  is_active   boolean not null default false,
  note        text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (agent_key, version, variant)
);
create index if not exists idx_agent_prompts_active on public.ai_agent_prompts (agent_key, variant)
  where is_active;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ai_agent_prompts_variant_chk') then
    alter table public.ai_agent_prompts
      add constraint ai_agent_prompts_variant_chk check (variant in ('a','b'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3) ai_agent_runs — telemetri
--
-- Admin panelindeki "başarı oranı / ortalama süre / maliyet" buradan gelir.
-- Her ajan çalışması bir satır. Orchestrator ve synthesizer da birer ajan
-- sayılır ki yönlendirmenin kendi maliyeti de görünür olsun.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_agent_runs (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references auth.users(id) on delete set null,
  conversation_id   uuid references public.ai_conversations(id) on delete set null,
  agent_key         text not null,
  -- Aynı kullanıcı mesajına ait tüm ajan çalışmalarını gruplar.
  turn_id           uuid,
  model             text,
  variant           text not null default 'a',
  prompt_tokens     int not null default 0,
  completion_tokens int not null default 0,
  latency_ms        int not null default 0,
  ok                boolean not null default true,
  -- Ajan neden seçildi: deterministik skor mu, LLM kararı mı, zorunlu mu?
  selected_by       text,        -- rules | llm | forced | always
  error             text,
  created_at        timestamptz not null default now()
);
create index if not exists idx_agent_runs_time  on public.ai_agent_runs (created_at desc);
create index if not exists idx_agent_runs_agent on public.ai_agent_runs (agent_key, created_at desc);
create index if not exists idx_agent_runs_turn  on public.ai_agent_runs (turn_id);

-- ---------------------------------------------------------------------------
-- 4) ai_ab_tests — prompt A/B testleri
-- ---------------------------------------------------------------------------
create table if not exists public.ai_ab_tests (
  id          uuid primary key default uuid_generate_v4(),
  agent_key   text not null references public.ai_agents(key) on delete cascade,
  name        text not null,
  -- B varyantına giden kullanıcı yüzdesi (0-100). 0 = test kapalı sayılır.
  split_pct   int not null default 50,
  active      boolean not null default false,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_ab_active on public.ai_ab_tests (agent_key) where active;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ai_ab_split_chk') then
    alter table public.ai_ab_tests
      add constraint ai_ab_split_chk check (split_pct between 0 and 100);
  end if;
end $$;

-- Aynı ajanda aynı anda tek aktif test olsun — iki test aynı kullanıcıyı
-- farklı varyantlara atarsa sonuç yorumlanamaz hale gelir.
create unique index if not exists idx_ab_one_active_per_agent
  on public.ai_ab_tests (agent_key) where active;

-- ---------------------------------------------------------------------------
-- 5) Varsayılan ajan kayıtları
--
-- `on conflict do nothing`: admin panelinden yapılan ayarlar migration tekrar
-- çalıştırılınca EZİLMEZ. Bu kasıtlı — bir migration'ın kullanıcının elle
-- yaptığı ayarı geri alması, sessiz ve tespit edilmesi zor bir hata olurdu.
-- ---------------------------------------------------------------------------
insert into public.ai_agents
  (key, name, description, temperature, max_tokens, memory_layers, allowed_tools, memory_limit, sort_order)
values
  ('orchestrator', 'Yönlendirici',
   'Kullanıcı mesajını analiz eder, hangi uzmanların çalışacağına karar verir.',
   0.10, 200, '{session}', '{}', 2000, 10),

  ('fitness', 'Fitness Koçu',
   'Program oluşturma, antrenman analizi, set/tekrar, ilerleme takibi.',
   0.50, 550, '{session,longterm,profile,workout,goals}',
   '{get_workout_history,suggest_exercises,get_goal_progress,schedule_workout,adjust_program_intensity,set_goal,remember_fact}',
   5000, 20),

  ('nutrition', 'Beslenme Uzmanı',
   'Kalori, makro, tarif, market listesi, restoran ve takviye önerileri.',
   0.45, 550, '{session,longterm,profile,nutrition,goals}',
   '{get_nutrition_status,update_macro_targets,log_water,set_goal,remember_fact}',
   5000, 30),

  ('physio', 'Fizyoterapist',
   'Sakatlık, ağrı, mobilite, esneme, postür ve form analizi.',
   0.35, 550, '{session,longterm,profile,health,workout}',
   '{get_workout_history,suggest_exercises,remember_fact}',
   4000, 40),

  ('recovery', 'Toparlanma Uzmanı',
   'Uyku, HRV, yorgunluk, dinlenme, aşırı antrenman ve toparlanma skoru.',
   0.35, 450, '{session,profile,health,workout}',
   '{get_workout_history,add_rest_day,adjust_program_intensity,remember_fact}',
   4000, 50),

  ('mental', 'Mental Koç',
   'Motivasyon, disiplin, alışkanlık, stres ve odaklanma.',
   0.70, 450, '{session,longterm,profile,goals}',
   '{get_goal_progress,set_goal,remember_fact}',
   4000, 60),

  ('gamification', 'Oyunlaştırma Uzmanı',
   'XP, coin, Battle Pass, görevler, challenge ve rozetler.',
   0.55, 400, '{session,profile}',
   '{get_gamification}', 3000, 70),

  ('social', 'Sosyal Koç',
   'Takımlar, arkadaşlar, birlikte antrenman, challenge ve akış.',
   0.55, 400, '{session,social,profile}',
   '{get_team_and_friends,get_gamification}', 3000, 80),

  ('medical', 'Tıbbi Güvenlik',
   'Risk analizi, tehlikeli önerilerin engellenmesi, kontrendikasyon uyarıları.',
   0.10, 400, '{profile,health}', '{}', 3000, 90),

  ('synthesizer', 'Birleştirici',
   'Uzman bulgularını tek bir koç sesinde birleştirir.',
   0.60, 900, '{session}', '{}', 3000, 95)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 6) pick_prompt_variant — A/B ataması
--
-- Kullanıcı KARARLI biçimde bir varyanta atanır: aynı kullanıcı her mesajda
-- farklı varyant görürse test anlamsız olur, kullanıcı da tutarsız bir koçla
-- konuşur. Atama user_id'nin hash'inden türetiliyor — durum saklamaya gerek yok.
-- ---------------------------------------------------------------------------
create or replace function public.pick_prompt_variant(p_agent text, p_user uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_split int;
  v_bucket int;
begin
  select t.split_pct into v_split
    from public.ai_ab_tests t
   where t.agent_key = p_agent and t.active
   limit 1;

  -- Aktif test yok ya da B'ye pay verilmemiş → herkes kontrol grubunda.
  if v_split is null or v_split <= 0 or p_user is null then
    return 'a';
  end if;

  -- 0-99 arası kararlı kova. hashtext negatif dönebilir; abs() şart.
  v_bucket := abs(hashtext(p_agent || ':' || p_user::text)) % 100;
  return case when v_bucket < v_split then 'b' else 'a' end;
end $$;

-- ---------------------------------------------------------------------------
-- 7) agent_metrics — admin paneli göstergeleri
--
-- Maliyet BURADA hesaplanmıyor: model fiyatları satıcı tarafında değişiyor ve
-- bunu migration'a gömmek, fiyat değiştiğinde geçmiş raporları sessizce
-- yanlış gösterir. Token sayıları döndürülüyor, fiyatlandırma uygulama
-- katmanında (lib/ai/pricing.ts) yapılıyor — orada güncellemek tek satır.
-- ---------------------------------------------------------------------------
create or replace function public.agent_metrics(p_days int default 7)
returns table (
  agent_key text,
  runs bigint,
  ok_runs bigint,
  success_pct numeric,
  avg_latency_ms int,
  p95_latency_ms int,
  prompt_tokens bigint,
  completion_tokens bigint,
  total_tokens bigint,
  model text
) language sql stable security definer set search_path = public as $$
  select
    r.agent_key,
    count(*)::bigint as runs,
    count(*) filter (where r.ok)::bigint as ok_runs,
    round(100.0 * count(*) filter (where r.ok) / nullif(count(*), 0), 1) as success_pct,
    coalesce(avg(r.latency_ms), 0)::int as avg_latency_ms,
    coalesce(percentile_disc(0.95) within group (order by r.latency_ms), 0)::int as p95_latency_ms,
    coalesce(sum(r.prompt_tokens), 0)::bigint,
    coalesce(sum(r.completion_tokens), 0)::bigint,
    coalesce(sum(r.prompt_tokens + r.completion_tokens), 0)::bigint,
    mode() within group (order by r.model) as model
  from public.ai_agent_runs r
  where r.created_at >= now() - (greatest(1, least(365, p_days)) || ' days')::interval
  group by r.agent_key
  -- `order by total_tokens` YAZILAMAZ: bu ad `returns table` OUT sütunu ve
  -- select listesinde takma adı yok; PostgreSQL çözemez. İfadenin kendisiyle
  -- sıralıyoruz.
  order by coalesce(sum(r.prompt_tokens + r.completion_tokens), 0) desc;
$$;

/** Günlük token kullanımı — grafik için. */
create or replace function public.agent_daily_tokens(p_days int default 14)
returns table (day date, agent_key text, total_tokens bigint, runs bigint)
language sql stable security definer set search_path = public as $$
  select
    r.created_at::date as day,
    r.agent_key,
    coalesce(sum(r.prompt_tokens + r.completion_tokens), 0)::bigint,
    count(*)::bigint
  from public.ai_agent_runs r
  where r.created_at >= current_date - greatest(1, least(365, p_days))
  group by 1, 2
  order by 1, 2;
$$;

/**
 * A/B testi sonuçları.
 *
 * Bir varyantın "daha iyi" olduğunu söylemiyoruz — o bir ürün kararı.
 * Ölçülebilir olanı veriyoruz: kaç çalışma, başarı oranı, gecikme, token.
 * Maliyet ile kalite arasındaki dengeyi insan kurar.
 */
create or replace function public.ab_test_results(p_agent text)
returns table (
  variant text, runs bigint, ok_runs bigint, success_pct numeric,
  avg_latency_ms int, avg_tokens int
) language sql stable security definer set search_path = public as $$
  select
    r.variant,
    count(*)::bigint,
    count(*) filter (where r.ok)::bigint,
    round(100.0 * count(*) filter (where r.ok) / nullif(count(*), 0), 1),
    coalesce(avg(r.latency_ms), 0)::int,
    coalesce(avg(r.prompt_tokens + r.completion_tokens), 0)::int
  from public.ai_agent_runs r
  join public.ai_ab_tests t on t.agent_key = r.agent_key and t.active
  where r.agent_key = p_agent
    and r.created_at >= t.started_at
  group by r.variant
  order by r.variant;
$$;

-- ---------------------------------------------------------------------------
-- 8) RLS
--
-- ai_agents / ai_agent_prompts / ai_ab_tests → YAPILANDIRMA. Kullanıcı
-- OKUYAMAZ bile: prompt içerikleri ürünün işletme sırrı ve okunabilir olması
-- modeli yönlendirmeye (prompt injection) zemin hazırlar. Yalnızca admin.
--
-- ai_agent_runs → telemetri. Kullanıcı KENDİ çalışmalarını görebilir
-- (şeffaflık: "koç benim adıma ne çalıştırdı"), admin hepsini görür.
-- ---------------------------------------------------------------------------
alter table public.ai_agents        enable row level security;
alter table public.ai_agent_prompts enable row level security;
alter table public.ai_agent_runs    enable row level security;
alter table public.ai_ab_tests      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['ai_agents','ai_agent_prompts','ai_ab_tests'] loop
    execute format('drop policy if exists %I on public.%I', t||'_admin', t);
    execute format($f$create policy %I on public.%I for all
      using (public.has_admin_access(auth.uid()))
      with check (public.has_admin_access(auth.uid()))$f$, t||'_admin', t);
  end loop;
end $$;

drop policy if exists ai_agent_runs_read on public.ai_agent_runs;
create policy ai_agent_runs_read on public.ai_agent_runs for select
  using (user_id = auth.uid() or public.has_admin_access(auth.uid()));

drop policy if exists ai_agent_runs_admin on public.ai_agent_runs;
create policy ai_agent_runs_admin on public.ai_agent_runs for all
  using (public.has_admin_access(auth.uid()))
  with check (public.has_admin_access(auth.uid()));

-- ---------------------------------------------------------------------------
-- Yetkiler
--
-- `ai_agents` okuma yetkisi authenticated'a VERİLMEZ (RLS zaten engelliyor;
-- yetki de verilmeyerek ikinci bir katman kuruluyor). Sunucu tarafı
-- yapılandırmayı service_role ile okur.
-- ---------------------------------------------------------------------------
grant execute on function public.pick_prompt_variant(text, uuid) to authenticated, service_role;
grant execute on function public.agent_metrics(int)              to service_role;
grant execute on function public.agent_daily_tokens(int)         to service_role;
grant execute on function public.ab_test_results(text)           to service_role;
