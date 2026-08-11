// Premium plan tanımları — client & server güvenli (yan etkisiz).
export type PlanId = "free" | "premium_monthly" | "premium_yearly" | "lifetime";

export interface PlanFeature { key: FeatureKey; label: string; }
/**
 * Premium özellik anahtarları.
 *
 * KURAL: Buraya yalnızca UYGULAMADA GERÇEKTEN KARŞILIĞI OLAN özellikler girer.
 * Önceden `pdf_export`, `custom_theme` ve `custom_avatar` bu listedeydi ve
 * fiyat sayfasında duyuruluyordu; ancak PDF dışa aktarma hiç yazılmamıştı, tema
 * yalnızca herkese açık açık/koyu anahtarıydı ve avatar yükleme zaten
 * ücretsizdi. Var olmayan bir özelliği satmak tüketici mevzuatı açısından da
 * sorunlu olduğu için üçü de kaldırıldı. Yeniden eklenmeden önce gerçekten
 * uygulanmalı ve `hasFeature()` ile bir yerde gate'lenmelidir.
 */
export type FeatureKey =
  | "ai_unlimited" | "unlimited_programs" | "unlimited_diets"
  | "anatomy_3d" | "premium_badge" | "advanced_analytics"
  | "posture_analysis" | "voice_coach" | "form_analysis";

export interface Plan {
  id: PlanId;
  name: string;
  priceLabel: string;
  period: string;
  highlight?: boolean;
  tagline: string;
  features: FeatureKey[];
  /** TL fiyat (iyzico ödemesi için). */
  priceTry?: number;
  /** Google Play Billing ürün/abonelik kimliği. */
  playSku?: string;
  /** Premium süresi (gün). null = ömür boyu. */
  durationDays?: number | null;
}

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  ai_unlimited: "Sınırsız AI Koç & Diyetisyen",
  unlimited_programs: "Sınırsız Antrenman Programı",
  unlimited_diets: "Sınırsız Beslenme Planı (14/30 gün)",
  anatomy_3d: "3D Anatomi",
  voice_coach: "Gerçekçi Sesli Koç",
  form_analysis: "AI Form Analizi (kamera)",
  premium_badge: "Premium Rozet",
  advanced_analytics: "İleri Analizler",
  posture_analysis: "AI Postür Analizi",
};

/** Her özelliğin nerede işe yaradığı — fiyat sayfasında açıklama satırı. */
export const FEATURE_DETAIL: Record<FeatureKey, string> = {
  ai_unlimited: `Ücretsizde günde ${5} mesaj; Premium'da sınır yok.`,
  unlimited_programs: "Ücretsizde 1 aktif program; Premium'da istediğin kadar.",
  unlimited_diets: "Ücretsizde 1 plan ve en fazla 7 gün; Premium'da 14 ve 30 günlük planlar.",
  anatomy_3d: "Kas gruplarını 3B modelde döndürerek incele.",
  voice_coach: "Set ve dinlenme anonsları doğal insan sesiyle.",
  form_analysis: "Kameran hareketini izler, tekrarları sayar, form hatasını anında söyler.",
  premium_badge: "Akış, takım ve liderlik tablosunda adının yanında taç.",
  advanced_analytics: "Hacim trendi, kas dengesi ve toparlanma detayları.",
  posture_analysis: "Fotoğraftan duruş analizi ve düzeltici program.",
};

const PREMIUM_FEATURES: FeatureKey[] = [
  "ai_unlimited", "unlimited_programs", "unlimited_diets",
  "form_analysis", "voice_coach", "posture_analysis",
  "anatomy_3d", "advanced_analytics", "premium_badge",
];

export const PLANS: Plan[] = [
  {
    id: "free", name: "Free", priceLabel: "₺0", period: "sonsuza kadar",
    tagline: "Başlamak için ihtiyacın olan her şey",
    features: [],
  },
  {
    id: "premium_monthly", name: "Premium Aylık", priceLabel: "₺149", period: "/ay",
    tagline: "Tüm premium özellikler, aylık esneklik",
    features: PREMIUM_FEATURES,
    priceTry: 149, playSku: "premium_monthly", durationDays: 30,
  },
  {
    id: "premium_yearly", name: "Premium Yıllık", priceLabel: "₺1.190", period: "/yıl",
    highlight: true, tagline: "2 ay bedava — en popüler",
    features: PREMIUM_FEATURES,
    priceTry: 1190, playSku: "premium_yearly", durationDays: 365,
  },
  {
    id: "lifetime", name: "Lifetime", priceLabel: "₺2.990", period: "tek seferlik",
    tagline: "Bir kez öde, ömür boyu premium",
    features: PREMIUM_FEATURES,
    priceTry: 2990, playSku: "premium_lifetime", durationDays: null,
  },
];

export const FREE_LIMITS = {
  aiPerDay: 5,         // Free: günde 5 AI mesajı (koç + diyetisyen toplam)
  maxPrograms: 1,      // Free: 1 antrenman programı
  maxDiets: 1,         // Free: AI Diyetisyen'de 1 tadımlık plan
  dietMaxSpan: 7,      // Free: en fazla 7 günlük plan (14/30 Premium)
};

export function planById(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/** Plana göre premium bitiş tarihi (ISO). Ömür boyu → uzak gelecek. */
export function premiumUntilFor(id: PlanId): string {
  const days = planById(id).durationDays;
  if (days == null) return new Date("2099-12-31T00:00:00Z").toISOString();
  return new Date(Date.now() + days * 864e5).toISOString();
}
