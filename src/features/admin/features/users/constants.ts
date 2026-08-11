import type { MembershipType } from "@/lib/database.types";

/** Sayfa başına kullanıcı (server-side pagination). */
export const USERS_PAGE_SIZE = 20;

export type UserFilter =
  | "all"
  | "premium"
  | "free"
  | "admin"
  | "editor"
  | "super_admin"
  | "banned"
  | "active"
  | "passive";

export const USER_FILTERS: { value: UserFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "premium", label: "Premium" },
  { value: "free", label: "Premium Değil" },
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
  { value: "super_admin", label: "Super Admin" },
  { value: "banned", label: "Banlı" },
  { value: "active", label: "Aktif" },
  { value: "passive", label: "Pasif" },
];

export type UserSort =
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "last_login"
  | "premium";

export const USER_SORTS: { value: UserSort; label: string }[] = [
  { value: "newest", label: "En yeni" },
  { value: "oldest", label: "En eski" },
  { value: "name_asc", label: "İsim A-Z" },
  { value: "name_desc", label: "İsim Z-A" },
  { value: "last_login", label: "Son giriş" },
  { value: "premium", label: "Premium" },
];

export const MEMBERSHIP_LABELS: Record<MembershipType, string> = {
  free: "Ücretsiz",
  premium: "Premium",
  trial: "Deneme",
  lifetime: "Ömür Boyu",
};
