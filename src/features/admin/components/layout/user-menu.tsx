"use client";

import Link from "next/link";
import { LogOut, LayoutGrid, UserRound, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { ADMIN_ROLE_LABELS, ADMIN_ROLE_BADGE } from "../../config/roles";
import type { AdminRole } from "@/lib/database.types";

export function UserMenu({
  name,
  email,
  avatarUrl,
  role,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
  role: AdminRole | null;
}) {
  const initial = (name || email || "A").charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 outline-none transition-colors hover:bg-fg/5 focus-visible:ring-2 focus-visible:ring-brand/40">
        <Avatar>
          {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <ChevronDown size={15} className="text-fg-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-fg">{name || "Admin"}</span>
            <span className="truncate text-xs font-normal text-fg-muted">{email}</span>
            {role && (
              <Badge variant={ADMIN_ROLE_BADGE[role]} className="mt-1 w-fit">
                {ADMIN_ROLE_LABELS[role]}
              </Badge>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutGrid size={15} /> Uygulamaya dön
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <UserRound size={15} /> Profilim
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action="/auth/signout" method="post" className="w-full">
            <button type="submit" className="flex w-full items-center gap-2.5 text-coral">
              <LogOut size={15} /> Çıkış yap
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
