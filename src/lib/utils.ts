import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind sınıflarını güvenli şekilde birleştirir. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** ISO tarih (YYYY-MM-DD) döndürür. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Sayıyı Türkçe formatta gösterir. */
export function formatNumber(n: number, digits = 0): string {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(n);
}

/** Tarihi "8 Tem" gibi kısa Türkçe formata çevirir. */
export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

/** 0-1 arası oranı yüzdeye çevirir (0-100, taşma engelli). */
export function toPercent(value: number, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}
