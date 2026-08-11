// Yasal/metin sayfaları için basit tipografi sarmalayıcısı.
export function Prose({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {updated && <p className="text-sm text-fg-muted">Son güncelleme: {updated}</p>}
      <div className="prose-viva space-y-4 text-sm leading-relaxed text-fg/90 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-fg [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_a]:text-brand [&_a]:underline">
        {children}
      </div>
    </article>
  );
}
