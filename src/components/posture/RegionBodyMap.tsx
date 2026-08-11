import type { PostureRegion, RegionScore, RegionStatus } from "@/lib/database.types";
import { REGION_LABELS, REGION_ORDER, STATUS_TR } from "@/lib/posture/recommend";

const FILL: Record<RegionStatus, string> = {
  normal: "rgb(52 211 153)",     // emerald-400
  attention: "rgb(251 191 36)",  // amber-400
  high_risk: "rgb(255 107 90)",  // coral
};

/** Bölge → şematik vücut haritasındaki dikey konum (0-100). */
const REGION_Y: Record<PostureRegion, number> = {
  head: 8, neck: 16, shoulders: 24, scapula: 28, chest: 32, thoracic: 38,
  lower_back: 50, pelvis: 58, hip: 62, knee: 80, ankle: 92, foot: 97,
};

/**
 * Vücut haritası — analiz edilen bölgeleri yeşil/sarı/kırmızı gösterir.
 * (3B altyapı için ölçeklenebilir; şimdilik hafif SVG şeması.)
 */
export function RegionBodyMap({ regions }: { regions: Record<string, RegionScore> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
      <div className="mx-auto">
        <svg viewBox="0 0 100 105" className="h-64 w-auto" role="img" aria-label="Vücut haritası">
          {/* Basit gövde silüeti */}
          <g stroke="rgb(var(--border))" strokeWidth="0.6" fill="rgb(var(--surface-2))">
            <circle cx="50" cy="8" r="5" />
            <rect x="44" y="14" width="12" height="4" rx="2" />
            <path d="M38 22 H62 L60 52 H40 Z" />
            <rect x="42" y="52" width="16" height="12" rx="3" />
            <rect x="43" y="64" width="6" height="34" rx="3" />
            <rect x="51" y="64" width="6" height="34" rx="3" />
          </g>
          {REGION_ORDER.map((r) => {
            const rs = regions[r];
            if (!rs) return null;
            return <circle key={r} cx={50} cy={REGION_Y[r]} r={2.6} fill={FILL[rs.status]} stroke="rgb(var(--bg))" strokeWidth="0.5" />;
          })}
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-1.5 self-center">
        {REGION_ORDER.map((r) => {
          const rs = regions[r];
          if (!rs) return null;
          return (
            <div key={r} className="flex items-center justify-between rounded-lg border border-ink-border px-2.5 py-1.5 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: FILL[rs.status] }} />
                {REGION_LABELS[r]}
              </span>
              <span className="text-fg-muted">{STATUS_TR[rs.status]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
