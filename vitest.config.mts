import { defineConfig } from "vitest/config";

// ============================================================================
// Test yapılandırması.
//
// KAPSAM: yalnızca SAF fonksiyonlar (`src/lib/**`). Bu modüller Supabase,
// ağ ya da React'e dokunmuyor; girdi → çıktı olarak sınanabiliyorlar. Bu
// oturumda bu fonksiyonlar `npx tsx` ile tek kullanımlık dosyalarla test
// edilmişti ve testler depoda kalmamıştı — bu yapılandırma onları kalıcı
// hâle getirip CI'da her push'ta çalıştırıyor.
//
// jsdom/React bileşen testleri KAPSAM DIŞI: ayrı bağımlılıklar gerektirir
// (jsdom, testing-library) ve bu turda alınmadı.
// ============================================================================

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    // tsconfig'deki "@/*" → "src/*" eşlemesinin aynısı.
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      // Sunucu modüllerini test edebilmek için — gerekçe stub dosyasında.
      "server-only": new URL("./src/test/server-only-stub.ts", import.meta.url).pathname,
    },
  },
});
