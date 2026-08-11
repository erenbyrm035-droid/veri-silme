import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasFeature } from "@/lib/premium/entitlements";
import { PremiumGate } from "@/components/premium/PremiumGate";
// TF.js paketi bileşenin İÇİNDE `await import()` ile yükleniyor (kullanıcı
// "Başlat"a basana kadar inmiyor), bu yüzden burada next/dynamic gerekmez.
import { FormAnalyzer } from "@/components/form/FormAnalyzer";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Form Analizi · Viva",
  description: "Kameranla hareket formunu analiz et, tekrarlarını otomatik saydır.",
};

export default async function FormPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium, membership_type, premium_until")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Form Analizi</h1>
        <p className="text-sm text-fg-muted">
          Kameranı aç, hareketini yap — tekrarların otomatik sayılsın, form
          hataların anında uyarı olarak görünsün.
        </p>
      </header>

      <PremiumGate
        feature="form_analysis"
        mode="replace"
        title="AI Form Analizi"
        description="Canlı kamera ile tekrar sayımı ve form geri bildirimi Premium üyeliğe özeldir."
      >
        <FormAnalyzer isPremium={hasFeature(profile ?? undefined, "voice_coach")} />
      </PremiumGate>
    </div>
  );
}
