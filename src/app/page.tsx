import Link from "next/link";
import { DemoCoach } from "@/components/DemoCoach";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { FadeIn } from "@/components/motion/FadeIn";
import {
  Dumbbell,
  Brain,
  Apple,
  LineChart,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI Fitness Koçu",
    desc: "Yaşını, kilonu, hedefini ve geçmiş antrenmanlarını analiz eder; doğal dilde tavsiye verir.",
  },
  {
    icon: Dumbbell,
    title: "Antrenman Takibi",
    desc: "Set, tekrar ve ağırlık gir. Antrenmanı başlat, tamamla, geçmişini canlı izle.",
  },
  {
    icon: Apple,
    title: "Türk Mutfağı Beslenme",
    desc: "Tavuk, pilav, mercimek, yoğurt... Bildiğin yemeklerle kalori ve protein takibi.",
  },
  {
    icon: LineChart,
    title: "Vücut Gelişimi",
    desc: "Kilo, bel, kol ve göğüs ölçülerini kaydet; değişimini grafiklerle gör.",
  },
];

const steps = [
  { n: "01", title: "Kaydol", desc: "30 saniyede hesabını oluştur, e-posta yeterli." },
  { n: "02", title: "Profilini kur", desc: "Yaş, boy, kilo ve hedefini gir; Viva kaloriyi hesaplasın." },
  { n: "03", title: "Koçunla konuş", desc: "Sorularını sor, sana özel antrenman ve beslenme al." },
  { n: "04", title: "Gelişimini izle", desc: "Her antrenman ve ölçümle grafiklerin şekillensin." },
];

function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="grid -rotate-6 place-items-center rounded-xl rounded-br-[3px] bg-brand font-black text-black"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      <span className="rotate-6">V</span>
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh]">
      {/* NAV */}
      <header className="pt-safe px-safe sticky top-0 z-50 border-b border-ink-border bg-ink/80 backdrop-blur-lg">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
            <BrandMark size={34} /> Viva{" "}
            <span className="hidden font-semibold text-fg-muted sm:inline">
              AI&nbsp;Coach
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <Link
              href="#ozellikler"
              className="hidden text-sm font-semibold text-fg-muted hover:text-fg sm:block"
            >
              Özellikler
            </Link>
            <Link
              href="#nasil"
              className="hidden text-sm font-semibold text-fg-muted hover:text-fg sm:block"
            >
              Nasıl çalışır
            </Link>
            <Link href="/login" className="text-sm font-semibold text-fg-muted hover:text-fg">
              Giriş
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-black transition-transform hover:-translate-y-0.5"
            >
              Ücretsiz Başla
            </Link>
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <main className="px-safe mx-auto max-w-6xl px-5">
        {/* HERO */}
        <section className="grid animate-fade-up items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.18em] text-coral">
              <span className="h-0.5 w-6 bg-coral" />
              Türkiye&apos;nin yapay zeka fitness koçu
            </span>
            <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[0.98] tracking-tight sm:text-6xl">
              Cebinde bir{" "}
              <span className="relative whitespace-nowrap text-brand">
                antrenör
                <span className="absolute inset-x-0 bottom-1.5 -z-10 h-3 rounded bg-brand/25" />
              </span>
              , mutfağında bir diyetisyen.
            </h1>
            <p className="mt-6 max-w-md text-lg text-fg-muted">
              Antrenman, beslenme ve gelişimini tek yerde topla. Viva senin
              verilerinle konuşur, sana özel planlarla ilerlemeni hızlandırır.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="btn-primary text-base">
                Hemen başla <ArrowRight size={18} />
              </Link>
              <Link href="#demo" className="btn-ghost text-base">
                Koçu dene
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-6 tabular-nums">
              {[
                { b: "10 dk", s: "kurulum" },
                { b: "7/24", s: "AI koç" },
                { b: "20+", s: "Türk yemeği" },
              ].map((t) => (
                <div key={t.s} className="flex flex-col">
                  <b className="text-2xl font-extrabold tracking-tight">{t.b}</b>
                  <span className="text-xs uppercase tracking-wide text-fg-muted">
                    {t.s}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Gömülü demo koç */}
          <div id="demo" className="scroll-mt-24">
            <DemoCoach />
          </div>
        </section>

        {/* FEATURES */}
        <section id="ozellikler" className="scroll-mt-20 py-16">
          <div className="max-w-xl">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-coral">
              Tek uygulama, tüm yolculuk
            </span>
            <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
              Formda kalmak için ihtiyacın olan her şey.
            </h2>
            <p className="mt-3 text-fg-muted">
              Dağınık uygulamalarla uğraşma. Viva antrenmanı, tabağı ve gelişimi
              aynı ekranda birleştirir.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.08} className="card card-hover">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/15 text-brand">
                  <f.icon size={20} />
                </span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-fg-muted">{f.desc}</p>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* HOW */}
        <section id="nasil" className="scroll-mt-20 py-16">
          <div className="mb-8 max-w-xl">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-coral">
              Dört adımda başla
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Kaydol, planını al, ilerlemeye başla.
            </h2>
          </div>
          <div className="grid overflow-hidden rounded-3xl border border-ink-border bg-ink-card sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div
                key={s.n}
                className={`p-7 ${
                  i < steps.length - 1 ? "border-b border-ink-border lg:border-b-0 lg:border-r" : ""
                } ${i % 2 === 0 ? "sm:border-r sm:border-ink-border" : ""}`}
              >
                <div
                  className="text-4xl font-extrabold tracking-tighter text-transparent tabular-nums"
                  style={{ WebkitTextStroke: "1.5px #e7fb00" }}
                >
                  {s.n}
                </div>
                <h4 className="mt-3.5 font-semibold">{s.title}</h4>
                <p className="mt-1.5 text-sm text-fg-muted">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* STAT BAND */}
        <section className="py-8">
          <div className="grid gap-8 rounded-3xl bg-white px-8 py-11 text-black sm:grid-cols-4">
            {[
              { b: "%100", em: true, s: "Türkçe ve yerelleştirilmiş" },
              { b: "6", s: "takip modülü" },
              { b: "7/24", s: "her an ulaşılabilir koç" },
              { b: "0₺", em: true, s: "başlangıç için" },
            ].map((x) => (
              <div key={x.s} className="tabular-nums">
                <b className="block text-4xl font-extrabold tracking-tight sm:text-5xl">
                  {x.b}
                </b>
                <span className="mt-2 block text-sm text-black/60">{x.s}</span>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section id="basla" className="scroll-mt-20 py-16 text-center">
          <div className="rounded-3xl border border-ink-border bg-gradient-to-b from-brand/10 to-transparent px-6 py-16">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-coral">
              Bugün başla
            </span>
            <h2 className="mx-auto mt-4 max-w-md text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">
              İlk antrenmanın bir mesaj uzağında.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-fg-muted">
              Viva AI Coach ile hedeflerine bugün adım at. Kredi kartı yok,
              taahhüt yok.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/register" className="btn-primary text-base">
                Ücretsiz kaydol <ArrowRight size={18} />
              </Link>
              <Link href="#ozellikler" className="btn-ghost text-base">
                Özellikleri gör
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="pb-safe px-safe border-t border-ink-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-fg-muted">
          <div className="flex items-center gap-2.5 font-bold text-fg-muted">
            <BrandMark size={28} /> Viva AI Coach
          </div>
          <span className="rounded-lg border border-dashed border-ink-border px-2.5 py-1 text-xs">
            Demo koç kural tabanlıdır · gerçek yanıtlar OpenAI ile
          </span>
          <Link href="/veri-silme.html" className="hover:text-fg-muted">
            Veri Silme Talimatı
          </Link>
        </div>
      </footer>
    </div>
  );
}
