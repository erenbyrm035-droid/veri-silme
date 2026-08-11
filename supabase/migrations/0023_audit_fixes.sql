-- ============================================================================
-- Migration 0023 — Denetim düzeltmeleri
-- reward_claims: kozmetik ödüllerin tekrar alınmasını engelle (idempotent).
-- ============================================================================

-- Tüketilen ödüller (premium gün gibi) 'consumed' işaretlenir; kozmetik/kalıcı
-- ödüller 'active' kalır. Kısmi tekil index yalnızca 'active' talepleri kapsar,
-- böylece premium tekrar satın alınabilirken kozmetik ödül iki kez alınamaz.
create unique index if not exists uq_reward_claims_active
  on public.reward_claims (user_id, reward_id)
  where status = 'active';
