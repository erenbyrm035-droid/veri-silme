// ============================================================================
// Admin dashboard örnek verileri (Sprint 14 — infra).
// Gerçek sorgular sonraki sprintlerde React Query üzerinden bağlanacak.
// ============================================================================

export interface AdminStat {
  key: string;
  label: string;
  value: number;
  delta: number; // yüzde değişim
  icon: string; // lucide isim anahtarı
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface AdminDashboardData {
  stats: AdminStat[];
  charts: {
    dailyUsers: ChartPoint[];
    weeklyUsers: ChartPoint[];
    monthlyUsers: ChartPoint[];
    premiumGrowth: ChartPoint[];
  };
}

const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const WEEKS = ["H1", "H2", "H3", "H4", "H5", "H6"];
const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz"];

function series(base: number, spread: number, labels: string[]): ChartPoint[] {
  return labels.map((label, i) => ({
    label,
    value: Math.round(base + Math.sin(i * 0.9) * spread + i * (spread / labels.length)),
  }));
}

/** Örnek dashboard verisi (placeholder). */
export const SAMPLE_DASHBOARD: AdminDashboardData = {
  stats: [
    { key: "users", label: "Toplam Kullanıcı", value: 1284, delta: 12.4, icon: "users" },
    { key: "premium", label: "Premium Kullanıcı", value: 218, delta: 8.1, icon: "crown" },
    { key: "exercises", label: "Toplam Egzersiz", value: 518, delta: 3.2, icon: "dumbbell" },
    { key: "programs", label: "Toplam Program", value: 342, delta: 5.6, icon: "calendar" },
    { key: "gifs", label: "Toplam GIF", value: 150, delta: 0, icon: "film" },
    { key: "diet_plans", label: "Toplam Diyet Planı", value: 176, delta: 9.3, icon: "apple" },
    { key: "ai_chats", label: "Toplam AI Sohbeti", value: 4127, delta: 21.7, icon: "brain" },
  ],
  charts: {
    dailyUsers: series(180, 60, DAYS),
    weeklyUsers: series(900, 220, WEEKS),
    monthlyUsers: series(3200, 800, MONTHS),
    premiumGrowth: series(60, 40, MONTHS),
  },
};
