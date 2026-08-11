import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS, FEATURE_LABELS, FREE_LIMITS, planById, type FeatureKey } from "@/lib/premium/plans";

export const metadata = {
  title: "Fiyatlar & Planlar · Viva",
  description: "Viva AI Coach Free ve Premium plan fiyatları: aylık, yıllık ve ömür boyu abonelik seçenekleri.",
};

// Liste `plans.ts`'ten türetilir — orada olmayan bir özellik burada da
// duyurulmasın diye. (Önceden elle yazılıydı ve var olmayan üç özellik
// aylardır fiyat sayfasında duruyordu.)
const ALL_FEATURES: FeatureKey[] = planById("premium_yearly").features;

export default function PricingPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Fiyatlar & Planlar</h1>
        <p className="mx-auto max-w-xl text-fg-muted">
          Yapay zeka koçun ve diyetisyeninle sana özel antrenman ve beslenme.
          Ücretsiz başla, dilediğinde Premium’a yükselt. Tüm fiyatlara KDV dahildir.
        </p>
      </header>

      {/* Plan kartları */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => {
          const isFree = p.id === "free";
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-2xl border p-5 ${
                p.highlight ? "border-brand bg-brand/5" : "border-ink-border bg-ink-card"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-0.5 text-[11px] font-black text-black">
                  EN POPÜLER
                </span>
              )}
              <p className="text-sm font-bold">{p.name}</p>
              <p className="mt-1 text-xs text-fg-muted">{p.tagline}</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-black">{p.priceLabel}</span>
                <span className="text-sm text-fg-muted">{p.period}</span>
              </div>

              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {isFree ? (
                  <>
                    <Feat text={`Günde ${FREE_LIMITS.aiPerDay} AI mesajı`} />
                    <Feat text={`${FREE_LIMITS.maxPrograms} antrenman programı`} />
                    <Feat text={`${FREE_LIMITS.maxDiets} beslenme planı (7 güne kadar)`} />
                    <Feat text="Egzersiz kütüphanesi & anatomi" />
                    <Feat text="Gelişim takibi" />
                  </>
                ) : (
                  ALL_FEATURES.map((f) => <Feat key={f} text={FEATURE_LABELS[f]} />)
                )}
              </ul>

              <Link
                href="/register"
                className={`mt-5 w-full rounded-xl px-4 py-2.5 text-center text-sm font-bold ${
                  isFree
                    ? "border border-ink-border bg-ink-soft text-fg hover:border-brand/50"
                    : "bg-brand text-black"
                }`}
              >
                {isFree ? "Ücretsiz Başla" : "Premium’a Geç"}
              </Link>
            </div>
          );
        })}
      </div>

      {/* Karşılaştırma / notlar */}
      <div className="rounded-2xl border border-ink-border bg-ink-card p-5 text-sm text-fg-muted">
        <p className="mb-2 font-semibold text-fg">Bilmen gerekenler</p>
        <ul className="space-y-1.5">
          <li>• Premium abonelikler dönem sonunda otomatik yenilenir; istediğin an iptal edebilirsin.</li>
          <li>• Web üzerinden ödemeler iyzico güvenli altyapısıyla; mobil uygulamalarda App Store / Google Play üzerinden alınır.</li>
          <li>• Tüm fiyatlara KDV dahildir. Fiyatlar satın alma anındaki tutardır.</li>
          <li>
            • Ayrıntılar için{" "}
            <Link href="/mesafeli-satis" className="text-brand underline">Mesafeli Satış Sözleşmesi</Link>,{" "}
            <Link href="/iptal-iade" className="text-brand underline">İptal &amp; İade Politikası</Link> ve{" "}
            <Link href="/terms" className="text-brand underline">Kullanım Şartları</Link>.
          </li>
        </ul>
      </div>

      <p className="text-center text-xs text-fg-muted">
        Viva bilgilendirme amaçlıdır, tıbbi tavsiye yerine geçmez.
      </p>
    </div>
  );
}

function Feat({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <Check size={16} className="mt-0.5 shrink-0 text-brand" />
      <span className="text-fg">{text}</span>
    </li>
  );
}
