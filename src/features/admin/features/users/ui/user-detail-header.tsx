import Link from "next/link";
import { ArrowLeft, Mail, Phone, CalendarClock, Clock } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/features/admin/components/ui/avatar";
import { Button } from "@/features/admin/components/ui/button";
import { RoleBadge, PremiumBadge, AccountStatusBadge } from "./badges";
import { formatDate, timeAgo, initials } from "./format";
import type { AdminUserRow } from "@/lib/database.types";

export function UserDetailHeader({ user }: { user: AdminUserRow }) {
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/users">
          <ArrowLeft size={16} /> Kullanıcılar
        </Link>
      </Button>

      <div className="flex flex-col gap-4 rounded-2xl border border-ink-border bg-ink-card p-5 sm:flex-row sm:items-center">
        <Avatar className="h-16 w-16">
          {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
          <AvatarFallback className="text-lg">{initials(user.full_name, user.email)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">
              {user.full_name ?? "İsimsiz kullanıcı"}
            </h1>
            <PremiumBadge isPremium={user.is_premium} />
            <RoleBadge role={user.admin_role} />
            <AccountStatusBadge isBanned={user.is_banned} isActive={user.is_active} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted">
            <span className="inline-flex items-center gap-1.5">
              <Mail size={14} /> {user.email ?? "—"}
            </span>
            {user.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone size={14} /> {user.phone}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock size={14} /> Kayıt: {formatDate(user.registered_at ?? user.created_at)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} /> Son giriş: {timeAgo(user.last_sign_in_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
