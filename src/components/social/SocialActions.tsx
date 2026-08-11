"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus, UserCheck, UserMinus, Hourglass, Star, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sendFriendRequest, respondFriendRequest, removeFriend, toggleFollow } from "@/lib/social/actions";
import type { SocialState } from "@/lib/social/types";

/**
 * Tek bir sosyal aksiyon düğmesi.
 *
 * `TeamMembers` içindeki yerel `Action` bileşeninden çıkarıldı; artık takım
 * üye kartı, profil sayfası ve keşif sayfası aynı görsel dili paylaşıyor.
 */
export function ActionButton({
  onClick, icon, label, active, disabled, busy, title,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  busy?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      title={title ?? label}
      aria-label={title ?? label}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-[9px] font-bold transition-colors active:scale-95",
        active
          ? "border-brand/50 bg-brand/15 text-brand"
          : "border-white/10 bg-ink-soft/60 text-fg-muted hover:border-brand/40 hover:text-fg",
        (disabled || busy) && "cursor-default opacity-60"
      )}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

export interface ExtraAction {
  key: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}

/**
 * Arkadaşlık + takip düğmeleri, iyimser güncellemeli.
 *
 * Sunucu isteği başarısız olursa durum eski haline döner; başarılıysa
 * `router.refresh()` ile sayfa verisi tazelenir (arkadaş sayacı, akış kapsamı
 * gibi türetilmiş alanlar da güncellensin diye).
 */
export function SocialActions({
  userId, social, extra = [], columns, allowUnfriend = false, className,
}: {
  userId: string;
  social: SocialState;
  extra?: ExtraAction[];
  /** Izgara sütun sayısı; verilmezse toplam düğme sayısından türetilir. */
  columns?: number;
  /** Arkadaşken düğme "Çıkar"a dönüşsün mü? (profil sayfasında evet) */
  allowUnfriend?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [friend, setFriend] = React.useState(social.friend);
  const [requestId, setRequestId] = React.useState(social.request_id);
  const [following, setFollowing] = React.useState(social.following);
  const [busy, setBusy] = React.useState<"friend" | "follow" | null>(null);

  React.useEffect(() => {
    setFriend(social.friend);
    setRequestId(social.request_id);
    setFollowing(social.following);
  }, [social.friend, social.request_id, social.following]);

  async function onFriend() {
    if (busy) return;

    // Gelen istek varsa düğme "Kabul et" işlevi görür
    if (friend === "pending_in" && requestId) {
      setBusy("friend"); setFriend("friends");
      const res = await respondFriendRequest(requestId, true);
      setBusy(null);
      if (res.ok) { setRequestId(null); router.refresh(); }
      else setFriend("pending_in");
      return;
    }

    if (friend === "friends") {
      if (!allowUnfriend) return;
      if (!confirm("Arkadaşlıktan çıkarılsın mı?")) return;
      setBusy("friend"); setFriend("none");
      const res = await removeFriend(userId);
      setBusy(null);
      if (res.ok) router.refresh(); else setFriend("friends");
      return;
    }

    if (friend === "pending_out") return;

    setBusy("friend"); setFriend("pending_out");
    const res = await sendFriendRequest(userId);
    setBusy(null);
    if (!res.ok) setFriend(social.friend);
    else {
      // Karşı taraf zaten istek göndermişse sunucu doğrudan kabul eder
      if (res.data?.status === "accepted") setFriend("friends");
      router.refresh();
    }
  }

  async function onFollow() {
    if (busy) return;
    const next = !following;
    setBusy("follow"); setFollowing(next);
    const res = await toggleFollow(userId);
    setBusy(null);
    if (!res.ok) setFollowing(!next);
  }

  const friendIcon =
    friend === "friends" ? (allowUnfriend ? <UserMinus size={14} /> : <UserCheck size={14} />)
    : friend === "pending_out" ? <Hourglass size={14} />
    : <UserPlus size={14} />;

  const friendLabel =
    friend === "friends" ? (allowUnfriend ? "Çıkar" : "Arkadaş")
    : friend === "pending_out" ? "Bekliyor"
    : friend === "pending_in" ? "Kabul et"
    : "Ekle";

  const cols = columns ?? 2 + extra.length;

  return (
    <div
      className={cn("grid gap-1.5", className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      <ActionButton
        onClick={onFriend}
        busy={busy === "friend"}
        disabled={friend === "pending_out" || (friend === "friends" && !allowUnfriend)}
        active={friend === "friends"}
        icon={friendIcon}
        label={friendLabel}
        title={friend === "friends" && !allowUnfriend ? "Arkadaşsınız" : friendLabel}
      />
      <ActionButton
        onClick={onFollow}
        busy={busy === "follow"}
        active={following}
        icon={<Star size={14} className={following ? "fill-current" : undefined} />}
        label={following ? "Takipte" : "Takip et"}
      />
      {extra.map((a) => (
        <ActionButton key={a.key} onClick={a.onClick} icon={a.icon} label={a.label} active={a.active} />
      ))}
    </div>
  );
}
