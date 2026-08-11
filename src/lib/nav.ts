// ============================================================================
// Uygulama gezinme haritası — TEK KAYNAK.
//
// Önceden aynı liste üç yerde ayrı ayrı duruyordu (SideNav, BottomNav, /menu);
// yeni bir sayfa eklendiğinde biri unutuluyor ve sayfa erişilemez kalıyordu
// (bu, Dalga 0'da düzeltilen B3/B4/B5 hatalarının ortak sebebiydi).
// Artık tek liste var; her yüzey kendi filtresini uygular.
//
// Client + server güvenli — yalnızca lucide ikonları ve saf veri içerir.
// ============================================================================

import {
  Home, Dumbbell, Library, PersonStanding, CalendarDays, Brain, Apple, Salad,
  LineChart, ScanLine, Trophy, Gift, Users, Rss, Compass, Crown, LayoutGrid, Video,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  /** Yan menü ve /menu sayfasında görünen ad. */
  label: string;
  /** Alt çubukta görünen kısa ad (dar ekran). Yoksa `label` kullanılır. */
  short?: string;
  /** /menu sayfasındaki açıklama satırı. */
  desc: string;
  icon: LucideIcon;
  /**
   * Aktiflik `startsWith` ile belirlenir. `exact: true` olan öğeler yalnızca
   * tam eşleşmede aktif olur — örn. /nutrition, /nutrition/coach'u yakalamasın.
   */
  exact?: boolean;
  /** Mobil alt çubuktaki 5 birincil sekmeden biri mi? */
  primary?: boolean;
  /** Masaüstü yan menüde görünür mü? (varsayılan: evet) */
  side?: boolean;
  /** Mobil /menu sayfasında görünür mü? (varsayılan: evet) */
  menu?: boolean;
}

/**
 * Sıra masaüstü yan menüdeki sırayı belirler.
 * `primary` işaretli 5 öğe mobil alt çubuğu oluşturur (+ "Menü" düğmesi).
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Ana Sayfa", desc: "Günlük görevlerin", icon: Home, exact: true, primary: true, menu: false },
  { href: "/workouts", label: "Antrenman", desc: "Seansların ve geçmişin", icon: Dumbbell, primary: true, menu: false },
  { href: "/feed", label: "Akış", desc: "Arkadaşlarından haberler", icon: Rss },
  { href: "/discover", label: "Keşfet", desc: "Trendler, sporcular, takımlar", icon: Compass },
  { href: "/exercises", label: "Egzersizler", desc: "Hareket kütüphanesi", icon: Library },
  { href: "/anatomy", label: "Anatomi", desc: "Kas haritası & bilgi", icon: PersonStanding },
  { href: "/posture", label: "Postür Analizi", desc: "Duruş değerlendirme", icon: ScanLine },
  { href: "/form", label: "Form Analizi", desc: "Kamerayla tekrar sayımı", icon: Video },
  { href: "/programs", label: "AI Program", desc: "8 haftalık plan", icon: CalendarDays },
  { href: "/coach", label: "AI Koç", short: "Koç", desc: "Kişisel antrenman koçun", icon: Brain, primary: true, menu: false },
  { href: "/nutrition/coach", label: "AI Diyetisyen", desc: "Beslenme koçu", icon: Salad },
  { href: "/nutrition", label: "Beslenme", desc: "Öğün ve makro takibi", icon: Apple, exact: true, primary: true, menu: false },
  { href: "/progress", label: "Vücut Gelişimi", short: "Gelişim", desc: "Ölçüm ve fotoğraflar", icon: LineChart, primary: true, menu: false },
  { href: "/gamification", label: "Başarılar & XP", desc: "Rozet, seri, liderlik", icon: Trophy },
  { href: "/teams", label: "Takımlar", desc: "Topluluk, sohbet, görev", icon: Users },
  { href: "/rewards", label: "Ödüller", desc: "Coin'lerini harca", icon: Gift },
  { href: "/premium", label: "Premium", desc: "Tüm özellikleri aç", icon: Crown, side: false },
];

/** Masaüstü yan menü. */
export const SIDE_NAV = NAV_ITEMS.filter((i) => i.side !== false);

/** Mobil alt çubuk — 5 birincil sekme + "Menü". */
export const BOTTOM_NAV: NavItem[] = [
  ...NAV_ITEMS.filter((i) => i.primary),
  { href: "/menu", label: "Menü", desc: "Tüm bölümler", icon: LayoutGrid },
];

/** Mobil /menu sayfası — alt çubukta olmayan her şey. */
export const MENU_NAV = NAV_ITEMS.filter((i) => i.menu !== false && !i.primary);

/** Bir yolun verilen öğeyi aktif kılıp kılmadığı. */
export function isActive(item: Pick<NavItem, "href" | "exact">, pathname: string): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}
