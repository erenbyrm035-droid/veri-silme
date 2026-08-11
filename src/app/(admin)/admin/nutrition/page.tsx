import Link from "next/link";
import { redirect } from "next/navigation";
import { Apple, ChefHat, Salad, Calculator, Utensils, TrendingUp, Star, Flame } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { getNutritionOverview } from "@/features/admin/features/nutrition/queries";
import { Card } from "@/features/admin/components/ui/card";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nutrition · Admin" };

const SECTIONS = [
  { href: "/admin/nutrition/foods", icon: Apple, title: "Besin Veritabanı", desc: "Profesyonel besinler, makro & mikro, barkod, dış kaynak." },
  { href: "/admin/nutrition/recipes", icon: ChefHat, title: "Tarifler", desc: "Malzeme, makro (oto), hazırlanış, video, kapak." },
  { href: "/admin/nutrition/diets", icon: Salad, title: "Diyet Planları", desc: "Hazır planlar, günler, öğünler, besinler." },
  { href: "/admin/nutrition/tools", icon: Calculator, title: "Kalori & Makro Araçları", desc: "BMR/TDEE/BMI/FFMI + makro builder." },
];

export default async function NutritionHubPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");
  const o = await getNutritionOverview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nutrition CMS</h1>
        <p className="mt-1 text-sm text-fg-muted">Beslenme sisteminin yönetim merkezi.</p>
      </div>

      {/* Bölüm kartları */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="group rounded-2xl border border-ink-border bg-ink-card p-5 transition-colors hover:border-brand">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink-soft text-brand"><s.icon size={20} /></span>
            <p className="mt-3 font-semibold group-hover:text-brand">{s.title}</p>
            <p className="mt-1 text-xs text-fg-muted">{s.desc}</p>
          </Link>
        ))}
      </div>

      {/* Özet istatistik */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Toplam Besin", value: o.totalFoods, icon: Apple },
          { label: "Toplam Tarif", value: o.totalRecipes, icon: ChefHat },
          { label: "Diyet Planı", value: o.totalDiets, icon: Salad },
          { label: "Ort. Kalori (log)", value: o.avgCalories, icon: Flame },
        ].map((c) => (
          <Card key={c.label} className="p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-soft text-brand"><c.icon size={18} /></span>
            <p className="mt-3 text-2xl font-bold tracking-tight">{formatNumber(c.value)}</p>
            <p className="mt-0.5 text-xs text-fg-muted">{c.label}</p>
          </Card>
        ))}
      </div>

      {/* Analytics */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Utensils size={16} className="text-brand" /> En Çok Tüketilen</h3>
          <ol className="mt-3 space-y-1.5">
            {o.topFoods.length === 0 ? <p className="text-sm text-fg-muted">Veri yok.</p> : o.topFoods.map((f, i) => (
              <li key={i} className="flex justify-between text-sm"><span className="truncate">{i + 1}. {f.name}</span><span className="text-fg-muted">{f.count}×</span></li>
            ))}
          </ol>
        </Card>
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Star size={16} className="text-brand" /> Popüler Tarifler</h3>
          <ol className="mt-3 space-y-1.5">
            {o.topRecipes.length === 0 ? <p className="text-sm text-fg-muted">Veri yok.</p> : o.topRecipes.map((r, i) => (
              <li key={i} className="flex justify-between text-sm"><span className="truncate">{i + 1}. {r.name}</span><span className="text-fg-muted">{r.favorite_count} ♥</span></li>
            ))}
          </ol>
        </Card>
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><TrendingUp size={16} className="text-brand" /> Makro Dağılımı (log ort.)</h3>
          <div className="mt-3 space-y-2">
            {[
              { label: "Protein", val: o.macroSplit.protein_g, color: "bg-brand" },
              { label: "Karbonhidrat", val: o.macroSplit.carbs_g, color: "bg-sky-400" },
              { label: "Yağ", val: o.macroSplit.fat_g, color: "bg-amber-400" },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex justify-between text-sm"><span>{m.label}</span><span className="text-fg-muted">{m.val} g</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-soft">
                  <div className={`h-full ${m.color}`} style={{ width: `${Math.min(100, m.val)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-fg-muted">En çok kullanılan diyet planları: {o.topDiets.map((d) => d.name).join(", ") || "—"}</p>
        </Card>
      </div>
    </div>
  );
}
