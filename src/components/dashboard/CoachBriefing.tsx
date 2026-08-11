import Link from "next/link";
import { Sparkles, AlertTriangle, PartyPopper, Info, TriangleAlert } from "lucide-react";
import { REPORT_LABELS, type AgentReport, type ProactiveNudge } from "@/lib/ai/agent/types";

// ============================================================================
// Koç brifingi — dashboard'un en üstündeki proaktif blok.
//
// İki parçası var:
//   1. GÜNÜN RAPORU  — agent tarafından üretilmiş sabah/akşam özeti.
//   2. UYARILAR      — deterministik hesaplanmış proaktif bulgular
//                      ("protein hedefinden 40 gram uzaktasın").
//
// Sunucu component'i: hiç JS göndermiyor. Uyarılar zaten sunucuda hesaplanmış
// statik metin; bunları istemciye taşıyıp orada yeniden üretmenin faydası yok.
//
// İkisi de boşsa component HİÇBİR ŞEY çizmez — yeni kullanıcının dashboard'u
// boş kutularla dolmasın.
// ============================================================================

const TONE = {
  alert:     { icon: TriangleAlert, ring: "border-red-500/40 bg-red-500/[0.07]",      text: "text-red-600 dark:text-red-400" },
  warning:   { icon: AlertTriangle, ring: "border-amber-500/40 bg-amber-500/[0.07]",  text: "text-amber-600 dark:text-amber-400" },
  celebrate: { icon: PartyPopper,   ring: "border-brand/40 bg-brand/[0.08]",          text: "text-brand" },
  info:      { icon: Info,          ring: "border-ink-border bg-ink-soft",            text: "text-fg-muted" },
} as const;

interface Props {
  report: AgentReport | null;
  nudges: ProactiveNudge[];
}

export function CoachBriefing({ report, nudges }: Props) {
  if (!report && nudges.length === 0) return null;

  return (
    <section className="animate-fade-up space-y-3">
      {report && (
        <Link
          href="/coach"
          className="block rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/[0.12] to-transparent p-4 transition-colors hover:border-brand/60"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-brand" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand">
              {REPORT_LABELS[report.kind]}
            </span>
            {!report.seen_at && (
              <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-label="Okunmadı" />
            )}
          </div>
          <h2 className="mt-1.5 font-bold leading-snug">{report.headline}</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">
            {report.body}
          </p>
        </Link>
      )}

      {nudges.map((n) => {
        const tone = TONE[n.tone];
        const Icon = tone.icon;
        const inner = (
          <div className={`flex items-start gap-2.5 rounded-2xl border p-3.5 ${tone.ring}`}>
            <Icon size={16} className={`mt-0.5 shrink-0 ${tone.text}`} />
            <p className="flex-1 text-sm leading-relaxed text-fg">{n.text}</p>
            {n.cta && (
              <span className={`shrink-0 self-center text-xs font-semibold ${tone.text}`}>
                {n.cta} →
              </span>
            )}
          </div>
        );
        return n.href ? (
          <Link key={n.id} href={n.href} className="block transition-opacity hover:opacity-80">
            {inner}
          </Link>
        ) : (
          <div key={n.id}>{inner}</div>
        );
      })}
    </section>
  );
}
