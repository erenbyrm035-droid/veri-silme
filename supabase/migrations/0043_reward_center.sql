-- ============================================================================
-- Migration 0043 — Ödül Merkezi
--
-- Mevcut `reward_catalog` / `reward_claims` KORUNUR ve genişletilir; paralel
-- bir tablo kurulmaz. Eski satırlar ('active' / 'consumed' durumları) çalışmaya
-- devam eder.
--
-- KAPSAM KARARI: şimdilik dijital + kupon. Adres/telefon TOPLANMAZ (KVKK yükü
-- yok). Fiziksel ürün sütunları şemada tanımlıdır ama kullanılmaz; ileride
-- yalnızca form + akış eklenerek açılır.
--
-- PARA BİRİMİ NOTU: `cost_coins` harcanan para birimidir. `req_xp`, `req_level`,
-- rozet/başarım/görev koşulları ise ESİK (eligibility) — düşülmez. Sebebi:
-- `sync_gamification()` total_xp'yi her çağrıda sıfırdan hesapladığı için
-- XP'den düşüm bir sonraki senkronda kaybolurdu. Coin ekonomisi (0040) bu
-- yüzden ayrı `coins_spent` sayacı üzerine kurulmuştu.
--
-- Additive + idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Katalog genişletme
-- ---------------------------------------------------------------------------
alter table public.reward_catalog
  add column if not exists image_url        text,
  add column if not exists long_description text,
  add column if not exists category         text,
  add column if not exists fulfillment_type text not null default 'digital',  -- digital | coupon | physical
  add column if not exists req_xp           int  not null default 0,
  add column if not exists req_level        int  not null default 0,
  add column if not exists req_badge_id     uuid references public.badges(id) on delete set null,
  add column if not exists req_achievement_id uuid references public.achievements(id) on delete set null,
  add column if not exists req_challenge_id uuid references public.weekly_challenges(id) on delete set null,
  add column if not exists req_team_level   int  not null default 0,
  add column if not exists stock            int,                     -- null = sınırsız
  add column if not exists expires_at       timestamptz,
  add column if not exists terms            text,
  add column if not exists coupon_code      text,
  add column if not exists external_url     text,
  add column if not exists sponsor_name     text,
  add column if not exists sponsor_logo_url text,
  add column if not exists featured         boolean not null default false,
  add column if not exists updated_at       timestamptz not null default now();

create index if not exists idx_reward_catalog_enabled
  on public.reward_catalog (enabled, featured desc, sort_order);

-- ---------------------------------------------------------------------------
-- 2) Talep genişletme
--    Durumlar: pending | approved | rejected | delivered | cancelled
--    (eski 'active' / 'consumed' satırları olduğu gibi kalır)
-- ---------------------------------------------------------------------------
alter table public.reward_claims
  add column if not exists spent_coins   int not null default 0,
  add column if not exists spent_xp      int not null default 0,
  add column if not exists admin_note    text,
  add column if not exists decided_by    uuid references auth.users(id) on delete set null,
  add column if not exists decided_at    timestamptz,
  add column if not exists delivered_at  timestamptz,
  add column if not exists coupon_issued text,
  -- Fiziksel gönderim için hazır; şu an doldurulmaz.
  add column if not exists shipped_at        timestamptz,
  add column if not exists shipping_name     text,
  add column if not exists shipping_phone    text,
  add column if not exists shipping_address  text,
  add column if not exists shipping_city     text,
  add column if not exists shipping_tracking text;

create index if not exists idx_reward_claims_status
  on public.reward_claims (status, claimed_at desc);

-- ---------------------------------------------------------------------------
-- 3) Durum geçiş günlüğü
-- ---------------------------------------------------------------------------
create table if not exists public.reward_events (
  id         uuid primary key default uuid_generate_v4(),
  claim_id   uuid not null references public.reward_claims(id) on delete cascade,
  from_status text,
  to_status   text not null,
  note        text,
  actor_id    uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_reward_events_claim on public.reward_events (claim_id, created_at);

alter table public.reward_events enable row level security;
drop policy if exists reward_events_read on public.reward_events;
create policy reward_events_read on public.reward_events for select
  using (
    exists (select 1 from public.reward_claims c
             where c.id = claim_id and (c.user_id = auth.uid() or public.has_admin_access(auth.uid())))
  );

-- ---------------------------------------------------------------------------
-- 4) Uygunluk kontrolü — kullanıcı neden alamıyor?
--    Arayüz "❌ 2500 XP daha gerekiyor" gibi net mesajlar için bunu kullanır.
-- ---------------------------------------------------------------------------
create or replace function public.reward_eligibility(p_user uuid, p_reward uuid)
returns table (eligible boolean, reasons text[])
language plpgsql stable security definer set search_path = public as $$
declare
  r record; v_xp int := 0; v_level int := 1; v_coins int := 0;
  v_team_level int := 0; v_reasons text[] := '{}'; v_taken boolean;
begin
  select * into r from public.reward_catalog where id = p_reward;
  if not found then
    return query select false, array['Ödül bulunamadı.'];
    return;
  end if;

  if not r.enabled then
    v_reasons := array_append(v_reasons, 'Bu ödül şu anda yayında değil.');
  end if;
  if r.expires_at is not null and r.expires_at < now() then
    v_reasons := array_append(v_reasons, 'Bu ödülün süresi doldu.');
  end if;
  if r.stock is not null and r.stock <= 0 then
    v_reasons := array_append(v_reasons, 'Stok tükendi.');
  end if;

  select coalesce(g.total_xp,0), coalesce(g.level,1), coalesce(g.coins,0)
    into v_xp, v_level, v_coins
    from public.user_gamification g where g.user_id = p_user;

  if coalesce(r.req_xp,0) > 0 and v_xp < r.req_xp then
    v_reasons := array_append(v_reasons, (r.req_xp - v_xp)::text || ' XP daha gerekiyor');
  end if;
  if coalesce(r.req_level,0) > 0 and v_level < r.req_level then
    v_reasons := array_append(v_reasons, 'Seviye ' || r.req_level || ' olmalısın (şu an ' || v_level || ')');
  end if;
  if coalesce(r.cost_coins,0) > 0 and v_coins < r.cost_coins then
    v_reasons := array_append(v_reasons, (r.cost_coins - v_coins)::text || ' coin daha gerekiyor');
  end if;

  if r.req_achievement_id is not null and not exists (
    select 1 from public.achievement_progress ap
     where ap.user_id = p_user and ap.achievement_id = r.req_achievement_id and ap.completed
  ) then
    v_reasons := array_append(v_reasons, 'Şu başarım tamamlanmalı: ' ||
      coalesce((select a.name from public.achievements a where a.id = r.req_achievement_id), 'başarım'));
  end if;

  if r.req_badge_id is not null and not exists (
    select 1 from public.achievement_progress ap
      join public.achievements a on a.id = ap.achievement_id
     where ap.user_id = p_user and ap.completed and a.badge_id = r.req_badge_id
  ) then
    v_reasons := array_append(v_reasons, 'Şu rozet gerekli: ' ||
      coalesce((select b.name from public.badges b where b.id = r.req_badge_id), 'rozet'));
  end if;

  if r.req_challenge_id is not null and not exists (
    select 1 from public.challenge_progress cp
     where cp.user_id = p_user and cp.challenge_id = r.req_challenge_id and cp.completed
  ) then
    v_reasons := array_append(v_reasons, 'Şu görev tamamlanmalı: ' ||
      coalesce((select wc.title from public.weekly_challenges wc where wc.id = r.req_challenge_id), 'görev'));
  end if;

  if coalesce(r.req_team_level,0) > 0 then
    select coalesce(t.level,0) into v_team_level
      from public.team_members tm join public.teams t on t.id = tm.team_id
     where tm.user_id = p_user limit 1;
    if coalesce(v_team_level,0) < r.req_team_level then
      v_reasons := array_append(v_reasons, 'Takımın ' || r.req_team_level || '. seviyede olmalı');
    end if;
  end if;

  -- Kalıcı (tüketilmeyen) ödül zaten alınmışsa tekrar alınamaz
  select exists (
    select 1 from public.reward_claims c
     where c.user_id = p_user and c.reward_id = p_reward
       and c.status in ('active','pending','approved','delivered')
  ) into v_taken;
  if v_taken and r.type <> 'premium_days' then
    v_reasons := array_append(v_reasons, 'Bu ödülü zaten aldın.');
  end if;

  return query select (array_length(v_reasons, 1) is null), v_reasons;
end $$;

-- ---------------------------------------------------------------------------
-- 5) Atomik talep
--    Koşul kontrolü + coin düşümü + stok azaltma + kayıt, TEK transaction'da.
--    Eski `claimReward` iyimser kilidi yarış koşuluna açıktı.
-- ---------------------------------------------------------------------------
create or replace function public.claim_reward(p_reward uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  r record; v_ok boolean; v_reasons text[];
  v_claim uuid; v_status text; v_spent int := 0;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'Oturum bulunamadı.');
  end if;

  -- Katalog satırını kilitle → eşzamanlı taleplerde stok tutarlı kalır
  select * into r from public.reward_catalog where id = p_reward for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ödül bulunamadı.');
  end if;

  select e.eligible, e.reasons into v_ok, v_reasons
    from public.reward_eligibility(v_user, p_reward) e;
  if not v_ok then
    return jsonb_build_object('ok', false, 'error', array_to_string(v_reasons, ' · '), 'reasons', to_jsonb(v_reasons));
  end if;

  -- Coin düşümü (0040'taki atomik sayaç)
  if coalesce(r.cost_coins, 0) > 0 then
    if not public.spend_coins(v_user, r.cost_coins) then
      return jsonb_build_object('ok', false, 'error', 'Yetersiz coin bakiyesi.');
    end if;
    v_spent := r.cost_coins;
  end if;

  -- Stok azalt
  if r.stock is not null then
    update public.reward_catalog set stock = stock - 1, updated_at = now()
     where id = p_reward and stock > 0;
    if not found then
      if v_spent > 0 then perform public.refund_coins(v_user, v_spent); end if;
      return jsonb_build_object('ok', false, 'error', 'Stok tükendi.');
    end if;
  end if;

  -- Dijital/anında verilenler doğrudan teslim; diğerleri onay bekler
  v_status := case
    when r.fulfillment_type = 'digital' or r.type = 'premium_days' then 'delivered'
    else 'pending' end;

  begin
    insert into public.reward_claims
      (user_id, reward_id, status, meta, spent_coins, coupon_issued, delivered_at)
    values
      (v_user, p_reward, v_status, coalesce(r.value, '{}'::jsonb), v_spent,
       case when r.fulfillment_type = 'coupon' then r.coupon_code else null end,
       case when v_status = 'delivered' then now() else null end)
    returning id into v_claim;
  exception when unique_violation then
    if v_spent > 0 then perform public.refund_coins(v_user, v_spent); end if;
    if r.stock is not null then
      update public.reward_catalog set stock = stock + 1 where id = p_reward;
    end if;
    return jsonb_build_object('ok', false, 'error', 'Bu ödüle zaten sahipsin.');
  end;

  insert into public.reward_events (claim_id, from_status, to_status, actor_id, note)
  values (v_claim, null, v_status, v_user, 'Kullanıcı talebi');

  -- Premium gün ödülü ise süreyi uzat
  if r.type = 'premium_days' then
    declare v_days int := coalesce((r.value->>'days')::int, 0);
    begin
      if v_days > 0 then
        update public.profiles
           set is_premium = true,
               membership_type = 'premium',
               premium_until = greatest(coalesce(premium_until, now()), now()) + (v_days || ' days')::interval
         where id = v_user;
      end if;
    end;
  end if;

  insert into public.notifications (user_id, type, title, body, href)
  values (v_user, 'achievement'::notification_type, '🎉 Ödül talebin alındı',
          r.name || (case when v_status = 'delivered' then ' hesabına tanımlandı.' else ' için talebin incelemeye alındı.' end),
          '/rewards');

  return jsonb_build_object(
    'ok', true, 'claim_id', v_claim, 'status', v_status,
    'coupon', case when r.fulfillment_type = 'coupon' then r.coupon_code else null end,
    'spent_coins', v_spent
  );
end $$;

-- ---------------------------------------------------------------------------
-- 6) Yönetici durum değişikliği (onay / red / teslim)
-- ---------------------------------------------------------------------------
create or replace function public.decide_reward_claim(
  p_claim uuid, p_status text, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare c record; v_actor uuid := auth.uid(); v_title text; v_body text;
begin
  if not public.has_admin_access(v_actor) then
    return jsonb_build_object('ok', false, 'error', 'Yetkin yok.');
  end if;
  if p_status not in ('approved','rejected','delivered','cancelled','shipped') then
    return jsonb_build_object('ok', false, 'error', 'Geçersiz durum.');
  end if;

  select * into c from public.reward_claims where id = p_claim;
  if not found then return jsonb_build_object('ok', false, 'error', 'Talep bulunamadı.'); end if;

  update public.reward_claims
     set status = p_status,
         admin_note = coalesce(p_note, admin_note),
         decided_by = v_actor,
         decided_at = now(),
         delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
         shipped_at   = case when p_status = 'shipped'   then now() else shipped_at end
   where id = p_claim;

  insert into public.reward_events (claim_id, from_status, to_status, actor_id, note)
  values (p_claim, c.status, p_status, v_actor, p_note);

  -- Reddedilirse coin iade edilir, stok geri verilir
  if p_status in ('rejected','cancelled') and coalesce(c.spent_coins,0) > 0 then
    perform public.refund_coins(c.user_id, c.spent_coins);
    update public.reward_catalog
       set stock = stock + 1
     where id = c.reward_id and stock is not null;
  end if;

  select case p_status
           when 'approved'  then '✅ Ödül talebin onaylandı'
           when 'rejected'  then '❌ Ödül talebin reddedildi'
           when 'delivered' then '🎁 Ödülün teslim edildi'
           when 'shipped'   then '📦 Ödülün kargoya verildi'
           else 'Ödül talebin güncellendi' end
    into v_title;
  v_body := coalesce(p_note, (select name from public.reward_catalog where id = c.reward_id));

  -- Not: `type` bir enum (notification_type). CASE ifadesi önce text olarak
  -- çözüldüğü için açık cast şart; aksi halde her admin kararında hata alınır.
  insert into public.notifications (user_id, type, title, body, href)
  values (c.user_id,
          (case when p_status = 'rejected' then 'info' else 'achievement' end)::notification_type,
          v_title, v_body, '/rewards');

  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- 7) Yönetici istatistikleri
-- ---------------------------------------------------------------------------
create or replace function public.reward_stats()
returns table (
  total_rewards int, active_rewards int, total_claims int,
  pending_claims int, delivered_claims int, rejected_claims int,
  spent_coins bigint
)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from public.reward_catalog),
    (select count(*)::int from public.reward_catalog where enabled),
    (select count(*)::int from public.reward_claims),
    (select count(*)::int from public.reward_claims where status = 'pending'),
    (select count(*)::int from public.reward_claims where status in ('delivered','active','consumed')),
    (select count(*)::int from public.reward_claims where status in ('rejected','cancelled')),
    (select coalesce(sum(spent_coins), 0)::bigint from public.reward_claims);
$$;

-- ---------------------------------------------------------------------------
-- 8) Ödül görselleri için storage bucket (herkese açık okuma — katalog görseli)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('rewards', 'rewards', true) on conflict (id) do nothing;

drop policy if exists "rewards_read" on storage.objects;
create policy "rewards_read" on storage.objects for select
  using (bucket_id = 'rewards');

drop policy if exists "rewards_admin_write" on storage.objects;
create policy "rewards_admin_write" on storage.objects for insert
  with check (bucket_id = 'rewards' and public.has_admin_access(auth.uid()));

drop policy if exists "rewards_admin_delete" on storage.objects;
create policy "rewards_admin_delete" on storage.objects for delete
  using (bucket_id = 'rewards' and public.has_admin_access(auth.uid()));

-- ---------------------------------------------------------------------------
-- 9) Yetkiler
-- ---------------------------------------------------------------------------
grant execute on function public.reward_eligibility(uuid, uuid)          to authenticated, service_role;
grant execute on function public.claim_reward(uuid)                      to authenticated, service_role;
grant execute on function public.decide_reward_claim(uuid, text, text)   to authenticated, service_role;
grant execute on function public.reward_stats()                          to authenticated, service_role;
