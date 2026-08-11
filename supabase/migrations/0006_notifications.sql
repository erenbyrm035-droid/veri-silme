-- ============================================================================
-- Migration 0006 — Bildirimler (Sprint 6)
-- Uygulama içi bildirim altyapısı (push için temel). Idempotent.
-- ============================================================================

do $$ begin
  create type notification_type as enum ('info', 'workout', 'nutrition', 'achievement', 'coach');
exception when duplicate_object then null; end $$;

create table if not exists public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        notification_type not null default 'info',
  title       text not null,
  body        text,
  href        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_owner" on public.notifications;
create policy "notifications_owner" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
