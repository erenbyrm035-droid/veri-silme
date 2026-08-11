import type { LucideIcon } from "lucide-react";

/** Cam efektli bölüm kartı (Apple/HIG hissi). */
export function SectionCard({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="glass rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand/15 text-brand">
            <Icon size={15} />
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Etiket + değer satırı (değer yoksa "—"). */
export function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  const empty = value === null || value === undefined || value === "" ;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink-border/50 py-2.5 last:border-0">
      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-fg-muted">{label}</span>
      <span className={`text-right text-sm font-semibold ${empty ? "text-fg-muted/60" : ""}`}>
        {empty ? "—" : value}
      </span>
    </div>
  );
}

/** Etiket listesi (chip'ler). */
export function ChipList({ items, empty = "Belirtilmedi" }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="text-sm text-fg-muted/70">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t) => (
        <span key={t} className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
          {t}
        </span>
      ))}
    </div>
  );
}

/** İstatistik kutucuğu. */
export function StatTile({
  icon: Icon,
  label,
  value,
  color = "#A3E635",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-ink-border bg-ink-card p-3.5">
      <Icon size={17} style={{ color }} />
      <p className="mt-2 text-lg font-bold tracking-tight tabular-nums">{value}</p>
      <p className="text-[11px] text-fg-muted">{label}</p>
    </div>
  );
}
