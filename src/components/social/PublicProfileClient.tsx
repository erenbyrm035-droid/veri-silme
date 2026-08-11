"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Flame, Award, Dumbbell, Users2, MapPin, Users } from "lucide-react";
import { Glass, Avatar, StatTile, compact } from "@/components/teams/shared";
import { SocialActions } from "./SocialActions";
import { PostCard, EmptyFeed } from "@/components/feed/PostCard";
import { PRESENCE_DOT, lastSeenText } from "@/lib/social/types";
import { cn } from "@/lib/utils";
import type { PublicProfile } from "@/lib/social/feed";

/** Herkese açık sporcu profili — akış ve keşif sayfalarından buraya gelinir. */
export function PublicProfileClient({ profile, meId }: { profile: PublicProfile; meId: string }) {
  const joined = profile.joined_at
    ? new Date(profile.joined_at).toLocaleDateString("tr-TR", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="space-y-4">
      <Glass className="relative overflow-hidden p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(70% 80% at 15% 0%, rgba(163,230,53,0.10) 0%, transparent 60%)" }}
        />
        <div className="relative">
          <div className="flex items-start gap-4">
            <span className="relative shrink-0">
              <Avatar src={profile.avatar_url} name={profile.name} size={72} ring="ring-2 ring-brand/40" />
              {profile.presence && (
                <span
                  className={cn(
                    "absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-2 border-ink-card",
                    PRESENCE_DOT[profile.presence.status]
                  )}
                  title={lastSeenText(profile.presence)}
                />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-black">{profile.name}</h1>
              <p className="text-xs text-fg-muted">
                {profile.presence ? lastSeenText(profile.presence) : `Seviye ${profile.level}`}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-muted">
                {profile.city && (
                  <span className="inline-flex items-center gap-1"><MapPin size={10} /> {profile.city}</span>
                )}
                {profile.team && (
                  <Link href={`/teams/${profile.team.slug}`} className="inline-flex items-center gap-1 hover:text-brand">
                    <Users size={10} /> {profile.team.name}
                  </Link>
                )}
                {joined && <span>{joined}&apos;den beri</span>}
              </div>
            </div>
          </div>

          {profile.bio && (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-fg/90">{profile.bio}</p>
          )}

          {!profile.is_me && (
            <SocialActions
              userId={profile.user_id}
              social={profile.social}
              columns={2}
              allowUnfriend
              className="mt-4 max-w-xs"
            />
          )}
        </div>
      </Glass>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <StatTile label="Seviye" value={String(profile.level)} icon={<Zap size={10} />} />
        <StatTile label="XP" value={compact(profile.total_xp)} icon={<Zap size={10} />} />
        <StatTile label="Seri" value={String(profile.streak)} hint={`En uzun ${profile.longest_streak}`} icon={<Flame size={10} />} />
        <StatTile label="Rozet" value={String(profile.badges)} icon={<Award size={10} />} />
        <StatTile label="Antrenman" value={compact(profile.workouts)} icon={<Dumbbell size={10} />} />
        <StatTile label="Takipçi" value={compact(profile.followers)} hint={`${compact(profile.friends)} arkadaş`} icon={<Users2 size={10} />} />
      </div>

      <section className="space-y-2.5">
        <h2 className="px-1 text-sm font-bold">Paylaşımlar</h2>
        {profile.posts.length === 0 ? (
          <EmptyFeed
            title="Görünür paylaşım yok"
            desc={
              profile.is_me
                ? "Akış sekmesinden ilk paylaşımını yapabilirsin."
                : "Bu sporcunun sana açık bir paylaşımı bulunmuyor. Arkadaş olursanız arkadaşlara özel gönderileri de görürsün."
            }
          />
        ) : (
          <AnimatePresence initial={false}>
            {profile.posts.map((p, i) => (
              <motion.div key={p.id} layout>
                <PostCard
                  post={p}
                  index={i}
                  canReact
                  canModerate={false}
                  meId={meId}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </section>
    </div>
  );
}
