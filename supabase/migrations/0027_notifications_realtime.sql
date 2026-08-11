-- Bildirimlerin uygulama içi zilde CANLI görünmesi için realtime yayınını aç.
-- Zil bileşeni bu tabloya postgres_changes aboneliği kurar; tablo yayına ekli
-- değilse yeni bildirimler ancak yenilemede görünür. (Yedek: 45sn yoklama + odak.)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- Realtime'ın satırı iletebilmesi için REPLICA IDENTITY FULL (RLS ile birlikte).
alter table public.notifications replica identity full;
