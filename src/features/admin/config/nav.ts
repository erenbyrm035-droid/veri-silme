import {
  LayoutDashboard,
  Users,
  Dumbbell,
  CalendarDays,
  Apple,
  ScanLine,
  PersonStanding,
  BarChart3,
  Bot,
  Bell,
  FolderOpen,
  Settings,
  Film,
  Trophy,
  Gift,
  Activity,
  Compass,
  type LucideIcon,
} from "lucide-react";
import type { AdminRole } from "@/lib/database.types";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Bu öğe hangi rollere görünür (boşsa herkese). */
  roles?: AdminRole[];
  /** Modül henüz hazır değil (stub). */
  soon?: boolean;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

/** Sidebar yapısı — feature bazlı, gelecekte modüller buraya eklenir. */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Genel",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "AI Coach", href: "/admin/ai", icon: Bot },
      { label: "AI Yönetim Merkezi", href: "/admin/ai-center", icon: Compass },
      { label: "Gamification", href: "/admin/gamification", icon: Trophy },
      { label: "Ödül Merkezi", href: "/admin/rewards", icon: Gift },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "İçerik",
    items: [
      { label: "Exercises", href: "/admin/exercises", icon: Dumbbell },
      { label: "Egzersiz Medya", href: "/admin/exercise-media", icon: Film },
      { label: "Programs", href: "/admin/programs", icon: CalendarDays },
      { label: "Nutrition", href: "/admin/nutrition", icon: Apple },
      { label: "Posture", href: "/admin/posture", icon: ScanLine },
      { label: "Anatomy", href: "/admin/anatomy", icon: PersonStanding },
      { label: "Animations", href: "/admin/animations", icon: Film },
      { label: "Files", href: "/admin/files", icon: FolderOpen },
    ],
  },
  {
    label: "Yönetim",
    items: [
      { label: "Users", href: "/admin/users", icon: Users, roles: ["super_admin", "admin", "editor"] },
      { label: "Notifications", href: "/admin/notifications", icon: Bell },
      { label: "System", href: "/admin/system", icon: Activity, roles: ["super_admin"] },
      { label: "Settings", href: "/admin/settings", icon: Settings, roles: ["super_admin"] },
    ],
  },
];

export const ADMIN_NAV_FLAT: AdminNavItem[] = ADMIN_NAV.flatMap((g) => g.items);

/** Yol → başlık (breadcrumb + sayfa başlığı için). */
export function labelForPath(pathname: string): string {
  const exact = ADMIN_NAV_FLAT.find((i) => i.href === pathname);
  if (exact) return exact.label;
  const prefix = ADMIN_NAV_FLAT.filter((i) => i.href !== "/admin" && pathname.startsWith(i.href)).sort(
    (a, b) => b.href.length - a.href.length
  )[0];
  return prefix?.label ?? "Admin";
}

export { Film };
