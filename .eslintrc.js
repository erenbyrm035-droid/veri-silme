// ============================================================================
// ESLint yapılandırması.
//
// NEDEN VAR: Bu dosya eklenene kadar depoda HİÇBİR ESLint yapılandırması
// yoktu. `next lint` yapılandırma bulamayınca interaktif olarak "nasıl
// kuralım?" diye soruyor; CI'da TTY olmadığı için 1 ile çıkıyordu. Sonuç:
// GitHub Actions'ta lint adımı her çalışmada patlıyor, arkasındaki typecheck
// ve build adımlarına hiç sıra gelmiyordu (son 12 çalışmanın 12'si kırmızı).
//
// Biçim `.eslintrc.js` (flat config değil): depodaki eslint 8.57 flat config'i
// tam desteklemiyor. Next 16'ya geçerken `eslint.config.mjs` + ESLint 9'a
// taşınacak (`npx @next/codemod@canary next-lint-to-eslint-cli .`).
// ============================================================================

module.exports = {
  extends: ["next/core-web-vitals", "next/typescript"],

  ignorePatterns: [
    "node_modules/",
    ".next/",
    "out/",
    "android-twa/", // Android kaynak dosyaları — JS/TS değil
    "scripts/", // tek seferlik veri betikleri
  ],

  rules: {
    // Kullanılmayan değişken hata olsun; ama `_` önekli olanlar kasıtlıdır.
    // `caughtErrors: "none"` → `catch {}` bloklarındaki yakalanan hata
    // değişkeni kullanılmasa da sorun değil (kod tabanında yaygın desen).
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
    ],

    // KAPALI — uygulama dili Türkçe. Türkçede kesme işareti ek ayırmak için
    // her cümlede geçiyor ("Viva'nın", "Premium'a", "Play'de"). Bu kural her
    // birini `&apos;` yazmaya zorluyor; hem mevcut ~12 yerde hem de yazılacak
    // her yeni Türkçe metinde tekrar patlar ve kaynak okunmaz hâle gelir.
    // Kuralın koruduğu şey (JSX'te tırnak karışıklığı) bizde bir sorun değil.
    "react/no-unescaped-entities": "off",
  },
};
