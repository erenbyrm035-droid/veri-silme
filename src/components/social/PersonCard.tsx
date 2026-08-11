"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Flame, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Glass, Avatar, compact } from "@/components/teams/shared";
import { PRESENCE_DOT, lastSeenText } from "@/lib/social/types";
import type { PresenceInfo, SocialState } from "@/lib/social/types";
import { SocialActions, type ExtraAction } from "./SocialActions";

export interface PersonCardData {
  user_id: string;
  name: string;
  avatar_url: string | null;
  level: number;
  total_xp: number;
  streak: number;
  /** Takipçi sayısı — keşif sayfasında gösterilir. */
  followers?: number;
  presence?: PresenceInfo | null;
  social: SocialState;
}

/**
 * Sporcu kartı — keşif, arkadaş listesi ve profil önizlemelerinde kullanılır.
 * Takım üye kartından farkı: rol/katkı/yönetim yok, sosyal aksiyon var.
 */
export function PersonCard({
  person, index = 0, extra, subtitle,
}: {
  person: PersonCardData;
  index?: number;
  extra?: ExtraAction[];
  subtitle?: React.ReactNode;
}) {
  const presence = person.presence ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.02, 0.2) }}
    >
      <Glass className="p-3.5">
        <div className="flex items-start gap-3">
          <Link href={`/u/${person.user_id}`} className="relative shrink-0">
            <Avatar src={person.avatar_url} name={person.name} size={44} />
            {presence && (
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink-card",
                  PRESENCE_DOT[presence.status]
                )}
                title={lastSeenText(presence)}
              />
            )}
          </Link>

          <div className="min-w-0 flex-1">
            <Link href={`/u/${person.user_id}`} className="block truncate text-sm font-bold hover:text-brand">
              {person.name}
            </Link>
            <p className="text-[11px] text-fg-muted">
              {subtitle ?? (presence ? lastSeenText(presence) : `Seviye ${person.level}`)}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-semibold text-fg-muted">
              <span className="inline-flex items-center gap-0.5">
                <Zap size={10} className="text-brand" /> Sv.{person.level}
              </span>
              <span className="inline-flex items-center gap-0.5 tabular-nums">
                {compact(person.total_xp)} XP
              </span>
              {person.streak > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <Flame size={10} className="text-coral" /> {person.streak}
                </span>
              )}
              {typeof person.followers === "number" && person.followers > 0 && (
                <span className="inline-flex items-center gap-0.5 tabular-nums">
                  <Users2 size={10} /> {compact(person.followers)}
                </span>
              )}
            </div>
          </div>
        </div>

        <SocialActions
          userId={person.user_id}
          social={person.social}
          extra={extra}
          className="mt-3"
        />
      </Glass>
    </motion.div>
  );
}
