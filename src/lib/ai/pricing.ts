// ============================================================================
// MODEL FİYATLANDIRMA — maliyet analizi için.
//
// NEDEN KODDA, VERİTABANINDA DEĞİL:
// Fiyatlar satıcı tarafında değişiyor. Veritabanına yazsaydık her fiyat
// değişiminde geçmiş raporlar sessizce yanlış gösterilirdi (eski token'lar
// yeni fiyatla çarpılır). Kodda tutmak da bunu tam çözmüyor ama en azından
// değişiklik sürüm kontrolünde görünür ve tek noktadan güncelleniyor.
//
// DEĞERLER TAHMİNİDİR. Gerçek fatura satıcının panelindedir; buradaki rakam
// büyüklük mertebesi ve ajanlar arası KARŞILAŞTIRMA içindir — "hangi ajan
// bütçeyi yiyor" sorusunu cevaplar, muhasebe kaydı değildir.
//
// Birim: 1 milyon token başına USD.
// ============================================================================

export interface ModelPrice {
  /** 1M girdi (prompt) token başına USD. */
  input: number;
  /** 1M çıktı (completion) token başına USD. */
  output: number;
  label: string;
}

/**
 * Sağlayıcı adı ya da model kimliği ile eşleşir.
 * Bilinmeyen model için `DEFAULT_PRICE` kullanılır.
 */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  // Sağlayıcı bazlı kaba karşılıklar (provider.name buraya düşüyor)
  openai:    { input: 0.15, output: 0.60, label: "OpenAI (gpt-4o-mini sınıfı)" },
  anthropic: { input: 3.00, output: 15.00, label: "Anthropic (Sonnet sınıfı)" },

  // Model kimliği verilmişse daha isabetli
  "gpt-4o-mini":         { input: 0.15, output: 0.60,  label: "GPT-4o mini" },
  "gpt-4o":              { input: 2.50, output: 10.00, label: "GPT-4o" },
  "gpt-4.1-mini":        { input: 0.40, output: 1.60,  label: "GPT-4.1 mini" },
  "claude-3-5-haiku":    { input: 0.80, output: 4.00,  label: "Claude 3.5 Haiku" },
  "claude-3-5-sonnet":   { input: 3.00, output: 15.00, label: "Claude 3.5 Sonnet" },
};

export const DEFAULT_PRICE: ModelPrice = {
  input: 0.50, output: 2.00, label: "Bilinmeyen model (tahmini)",
};

/** Model adına en iyi eşleşen fiyatı bulur (ön ek eşleşmesi destekli). */
export function priceFor(model: string | null | undefined): ModelPrice {
  if (!model) return DEFAULT_PRICE;
  const key = model.toLowerCase();
  if (MODEL_PRICES[key]) return MODEL_PRICES[key];
  // "claude-3-5-sonnet-latest" gibi sürüm ekli adlar için ön ek eşleşmesi
  const match = Object.keys(MODEL_PRICES).find((k) => key.startsWith(k));
  return match ? MODEL_PRICES[match] : DEFAULT_PRICE;
}

/** Token sayısından USD maliyeti. */
export function estimateCost(
  model: string | null | undefined,
  promptTokens: number,
  completionTokens: number
): number {
  const p = priceFor(model);
  return (promptTokens / 1_000_000) * p.input + (completionTokens / 1_000_000) * p.output;
}

/** Kullanıcıya gösterilecek biçim. Çok küçük tutarlarda ondalık artırılır. */
export function formatUsd(v: number): string {
  if (v === 0) return "$0";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  if (v < 1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(2)}`;
}

/** Kabaca TL karşılığı — kur env'den, yoksa gösterilmez. */
export function tryFormatTry(usd: number): string | null {
  const rate = Number(process.env.USD_TRY_RATE);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const t = usd * rate;
  return `₺${t < 1 ? t.toFixed(2) : t.toFixed(t < 100 ? 1 : 0)}`;
}
