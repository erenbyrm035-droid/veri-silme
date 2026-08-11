import Link from "next/link";
import {
  Sparkles, ChefHat, CalendarDays, Users, ArrowRight, Brain, ScanLine,
} from "lucide-react";
import type { ReadinessInfo } from "@/lib/data/dashboard";

interface Suggestion {
  href: string;
  icon: React.ReactNode;
  tag: string;
  title: string;
  desc: string;
}

/**
 * "Bugün Sana Özel" — günün durumuna göre değişen kısayollar.
 * Hazır olma skoru düşükse ağır antrenman yerine toparlanma önerilir.
 */
export function ForYouSection({
  readiness, hasWorkoutToday, streak,
}: { readiness: ReadinessInfo; hasWorkoutToday: boolean; streak: number }) {
  const items: Suggestion[] = [];

  // 1) Günün ana önerisi — hazır olma skoruna göre
  if (readiness.score < 45) {
    items.push({
      href: "/posture",
      icon: <ScanLine size={17} />,
      tag: "Toparlanma",
      title: "Bugün hafif geç",
      desc: readiness.hint,
    });
  } else if (!hasWorkoutToday) {
    items.push({
      href: "/programs/hazir",
      icon: <CalendarDays size={17} />,
      tag: "Antrenman",
      title: "Hazır bir program seç",
      desc: "Seviyene uygun planlar; tek dokunuşla takvimine eklenir.",
    });
  } else {
    items.push({
      href: "/progress",
      icon: <Sparkles size={17} />,
      tag: "Gelişim",
      title: "İlerlemeni gör",
      desc: "Hacim, rekorlar ve vücut ölçümlerin tek ekranda.",
    });
  }

  // 2) Beslenme
  items.push({
    href: "/nutrition/coach",
    icon: <ChefHat size={17} />,
    tag: "Beslenme",
    title: "Bugüne uygun tarif",
    desc: "Kalan makrolarına göre AI diyetisyenden öneri al.",
  });

  // 3) AI koç
  items.push({
    href: "/coach",
    icon: <Brain size={17} />,
    tag: "AI Koç",
    title: "Koça bir şey sor",
    desc: "Geçmiş antrenmanlarını bilerek cevap verir.",
  });

  // 4) Topluluk
  items.push({
    href: "/teams",
    icon: <Users size={17} />,
    tag: "Topluluk",
    title: streak >= 3 ? "Serini takımınla paylaş" : "Bir takıma katıl",
    desc: streak >= 3
      ? `${streak} günlük serin var — takım akışında görünsün.`
      : "Birlikte antrenman yap, haftalık sıralamada yüksel.",
  });

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg-muted">
        <Sparkles size={14} className="text-brand" /> Bugün Sana Özel
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((s) => (
          <Link
            key={s.href + s.title}
            href={s.href}
            className="group rounded-2xl border border-white/10 bg-ink-card/70 p-3.5 backdrop-blur-xl transition-colors hover:border-brand/40"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
                {s.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-brand">{s.tag}</p>
                <p className="truncate text-sm font-bold">{s.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-fg-muted">{s.desc}</p>
              </div>
              <ArrowRight
                size={16}
                className="mt-1 shrink-0 text-fg-muted transition-transform group-hover:translate-x-0.5"
              />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
