-- ============================================================================
-- Migration 0013 — Admin Panel rol sistemi (Sprint 14)
-- profiles.admin_role: 'super_admin' | 'admin' | 'editor' | null
-- Mevcut is_admin=true kullanıcılar super_admin yapılır. Mevcut yapıyı bozmaz.
-- ============================================================================

alter table public.profiles
  add column if not exists admin_role text;  -- super_admin | admin | editor | null

-- Mevcut adminleri super_admin yap.
update public.profiles
set admin_role = 'super_admin'
where is_admin = true and admin_role is null;

-- Admin panel erişim yardımcı fonksiyonu (rol bazlı).
create or replace function public.has_admin_access(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_admin or admin_role in ('super_admin','admin','editor')
     from public.profiles where id = uid),
    false
  );
$$;
