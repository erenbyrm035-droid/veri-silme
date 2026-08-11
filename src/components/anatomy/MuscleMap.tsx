"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, X } from "lucide-react";
import type { Muscle, BodyRegion } from "@/lib/database.types";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/utils";

/**
 * İnteraktif SVG kas haritası. Ön/arka görünüm + erkek/kadın oranları.
 * Bir kasa tıklandığında ilgili kas sayfasına yönlendirir.
 * Bölge id'leri muscles.svg_region_id (= slug) ile eşleşir.
 */

type Region = { slug: string; el: React.ReactNode };

// Her görünüm için kas bölgeleri (basit, stilize geometri).
const FRONT: Region[] = [
  { slug: "omuz", el: <><ellipse cx="72" cy="118" rx="15" ry="13" /><ellipse cx="148" cy="118" rx="15" ry="13" /></> },
  { slug: "gogus", el: <><path d="M92 120 q18 -6 18 14 q0 12 -18 12 q-14 0 -14 -14 q0 -10 14 -12z" /><path d="M128 120 q-18 -6 -18 14 q0 12 18 12 q14 0 14 -14 q0 -10 -14 -12z" /></> },
  { slug: "biceps", el: <><ellipse cx="60" cy="150" rx="9" ry="18" /><ellipse cx="160" cy="150" rx="9" ry="18" /></> },
  { slug: "on-kol", el: <><ellipse cx="52" cy="188" rx="8" ry="18" /><ellipse cx="168" cy="188" rx="8" ry="18" /></> },
  { slug: "yan-karin", el: <><path d="M92 150 q-6 20 0 40 q-8 -2 -9 -20 q-1 -14 9 -20z" /><path d="M128 150 q6 20 0 40 q8 -2 9 -20 q1 -14 -9 -20z" /></> },
  { slug: "karin", el: <rect x="97" y="150" width="26" height="46" rx="8" /> },
  { slug: "on-bacak", el: <><ellipse cx="97" cy="268" rx="13" ry="34" /><ellipse cx="123" cy="268" rx="13" ry="34" /></> },
];

const BACK: Region[] = [
  { slug: "trapez", el: <path d="M96 108 q14 -10 28 0 q-4 22 -14 26 q-10 -4 -14 -26z" /> },
  { slug: "omuz", el: <><ellipse cx="72" cy="118" rx="15" ry="13" /><ellipse cx="148" cy="118" rx="15" ry="13" /></> },
  { slug: "sirt", el: <><path d="M96 138 q-14 6 -14 30 q0 8 14 10 q6 -24 0 -40z" /><path d="M124 138 q14 6 14 30 q0 8 -14 10 q-6 -24 0 -40z" /></> },
  { slug: "triceps", el: <><ellipse cx="60" cy="150" rx="9" ry="18" /><ellipse cx="160" cy="150" rx="9" ry="18" /></> },
  { slug: "bel", el: <rect x="99" y="182" width="22" height="26" rx="7" /> },
  { slug: "kalca", el: <><ellipse cx="98" cy="222" rx="15" ry="15" /><ellipse cx="122" cy="222" rx="15" ry="15" /></> },
  { slug: "arka-bacak", el: <><ellipse cx="97" cy="276" rx="13" ry="32" /><ellipse cx="123" cy="276" rx="13" ry="32" /></> },
  { slug: "baldir", el: <><ellipse cx="98" cy="356" rx="10" ry="26" /><ellipse cx="122" cy="356" rx="10" ry="26" /></> },
];

export function MuscleMap({ muscles }: { muscles: Muscle[] }) {
  const router = useRouter();
  const [view, setView] = useState<BodyRegion>("front");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [hover, setHover] = useState<string | null>(null);

  const bySlug = new Map(muscles.map((m) => [m.slug, m]));
  const regions = view === "front" ? FRONT : BACK;
  const [openRegion, setOpenRegion] = useState<string | null>(null);

  // Bölge (svg_region_id) → o bölgeye bağlı tüm kaslar. Ana grup kası en üstte.
  const bySvgRegion = useMemo(() => {
    const map = new Map<string, Muscle[]>();
    for (const m of muscles) {
      const key = m.svg_region_id ?? m.slug;
      (map.get(key) ?? map.set(key, []).get(key)!).push(m);
    }
    const isMain = (m: Muscle) => (m.slug === (m.svg_region_id ?? m.slug) ? 0 : 1);
    for (const [, list] of map) {
      list.sort((a, b) => isMain(a) - isMain(b) || a.sort_order - b.sort_order);
    }
    return map;
  }, [muscles]);

  // Kadın oranı: omuzlar biraz dar, kalça biraz geniş.
  const shoulderScale = gender === "female" ? 0.92 : 1;
  const hipScale = gender === "female" ? 1.08 : 1;

  function go(slug: string) {
    const list = bySvgRegion.get(slug) ?? [];
    if (list.length > 1) { setOpenRegion(slug); return; }   // birden çok kas → menü
    if (list.length === 1) { router.push(`/anatomy/${list[0].slug}`); return; }
    if (bySlug.has(slug)) router.push(`/anatomy/${slug}`);
  }

  const hoverMuscle = hover ? bySlug.get(hover) : null;
  const openList = openRegion ? bySvgRegion.get(openRegion) ?? [] : [];
  const regionHas = (slug: string) => (bySvgRegion.get(slug)?.length ?? 0) > 0 || bySlug.has(slug);

  return (
    <div className="card flex flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between gap-2">
        <Segmented
          options={[
            { value: "front", label: "Ön" },
            { value: "back", label: "Arka" },
          ]}
          value={view}
          onChange={(v) => setView(v as BodyRegion)}
        />
        <Segmented
          options={[
            { value: "male", label: "Erkek" },
            { value: "female", label: "Kadın" },
          ]}
          value={gender}
          onChange={(v) => setGender(v as "male" | "female")}
        />
      </div>

      <div className="relative">
        <svg
          viewBox="0 0 220 460"
          className="h-[440px] w-auto max-w-full"
          role="img"
          aria-label="İnteraktif kas haritası"
        >
          {/* Vücut silueti */}
          <g fill="rgb(var(--surface-2))" stroke="rgb(var(--border))" strokeWidth="1.5">
            {/* baş + boyun */}
            <circle cx="110" cy="40" r="20" />
            <rect x="101" y="58" width="18" height="14" rx="4" />
            {/* gövde */}
            <g style={{ transformOrigin: "110px 120px", transform: `scaleX(${shoulderScale})` }}>
              <path d="M70 110 q40 -22 80 0 q-6 60 -12 96 q-28 12 -56 0 q-6 -36 -12 -96z" />
            </g>
            {/* kollar */}
            <path d="M64 112 q-14 30 -14 84 q6 6 12 0 q6 -52 14 -78z" />
            <path d="M156 112 q14 30 14 84 q-6 6 -12 0 q-6 -52 -14 -78z" />
            {/* kalça + bacaklar */}
            <g style={{ transformOrigin: "110px 220px", transform: `scaleX(${hipScale})` }}>
              <path d="M84 200 q26 12 52 0 q6 20 2 40 q-28 10 -56 0 q-4 -20 2 -40z" />
            </g>
            <path d="M86 236 q-6 100 6 190 q10 4 14 -2 q4 -96 2 -188 q-12 4 -22 0z" />
            <path d="M134 236 q6 100 -6 190 q-10 4 -14 -2 q-4 -96 -2 -188 q12 4 22 0z" />
          </g>

          {/* Kas bölgeleri */}
          <g>
            {regions.map((r) => {
              const has = regionHas(r.slug);
              const active = hover === r.slug;
              return (
                <motion.g
                  key={r.slug}
                  onClick={() => go(r.slug)}
                  onMouseEnter={() => setHover(r.slug)}
                  onMouseLeave={() => setHover(null)}
                  className={cn(has && "cursor-pointer")}
                  initial={false}
                  animate={{
                    fill: active
                      ? "rgba(214,248,76,1)"
                      : has
                      ? "rgba(214,248,76,0.32)"
                      : "rgba(154,160,140,0.22)",
                    scale: active ? 1.05 : 1,
                  }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  style={{
                    stroke: active ? "rgb(var(--brand))" : "transparent",
                    strokeWidth: 1.5,
                    transformBox: "fill-box",
                    transformOrigin: "center",
                  }}
                >
                  {r.el}
                </motion.g>
              );
            })}
          </g>
        </svg>

        {/* Hover etiketi */}
        {hoverMuscle && !openRegion && (
          <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-lg border border-ink-border bg-ink-card px-3 py-1.5 text-xs font-semibold shadow-lg">
            {hoverMuscle.name_tr}
            <span className="ml-1 text-fg-muted">{hoverMuscle.latin_name}</span>
          </div>
        )}

        {/* Bölge kas menüsü — o bölgedeki tüm alt kaslar */}
        <AnimatePresence>
          {openRegion && openList.length > 0 && (
            <>
              <motion.div
                className="absolute inset-0 z-10 rounded-xl bg-black/40"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setOpenRegion(null)}
              />
              <motion.div
                className="absolute left-1/2 top-1/2 z-20 w-[min(20rem,90%)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-ink-border bg-ink-card shadow-2xl"
                initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.15 }}
              >
                <div className="flex items-center justify-between border-b border-ink-border px-4 py-2.5">
                  <p className="text-sm font-bold">{openList[0].muscle_group} · {openList.length} kas</p>
                  <button onClick={() => setOpenRegion(null)} className="grid h-7 w-7 place-items-center rounded-lg text-fg-muted hover:bg-fg/5 hover:text-fg" aria-label="Kapat">
                    <X size={16} />
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {openList.map((m) => (
                    <Link
                      key={m.id}
                      href={`/anatomy/${m.slug}`}
                      onClick={() => setOpenRegion(null)}
                      className="flex items-center justify-between border-b border-ink-border/60 px-4 py-2.5 last:border-0 hover:bg-fg/5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{m.name_tr}</p>
                        <p className="truncate text-xs text-fg-muted">{m.latin_name}</p>
                      </div>
                      <ChevronRight size={16} className="shrink-0 text-fg-muted" />
                    </Link>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <p className="text-center text-xs text-fg-muted">
        Bir bölgeye dokun → o bölgedeki kaslar, egzersizler ve anatomi.
      </p>
    </div>
  );
}
