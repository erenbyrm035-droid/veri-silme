# 🚀 Viva — Lansman Kontrol Listesi

Durum: ✅ tamam · 🟡 senin bilgin bekleniyor · ⬜ senin görevin (hesap/panel/donanım)

---

## A) Ürün / Kod (hazır)

- ✅ Web uygulaması canlı (Vercel) — auth, onboarding, AI koç, AI diyetisyen,
     antrenman, programlar, beslenme, anatomi, gelişim, oyunlaştırma
- ✅ AI çıktılarında Markdown temizleme
- ✅ AI Koç sohbet geçmişi kalıcılığı
- ✅ Hazır programlar + “başlat → antrenmanlara ekle” + yeniden başlat
- ✅ Ücretsiz/Premium kademe kısıtları (Dengeli paket)
- ✅ Yeni kullanıcı hoş geldin turu
- ✅ RevenueCat (iOS/Android IAP) webhook backend’i + Vercel sırrı
- ✅ Yasal sayfalar: Mesafeli Satış Sözleşmesi + İptal/İade Politikası
- ✅ KVKK: veri dışa aktarma + hesap silme (App Store zorunluluğu karşılanıyor)

## B) Veritabanı seed’leri (Supabase’de çalıştır — ⬜ senin görevin)

Supabase → SQL Editor’de sırayla:
- ⬜ `dietitian_v3_kurulum.sql` (AI Diyetisyen kayıt)
- ⬜ `exercises_wellness.sql` (227 egzersiz) → sonra `ready_programs.sql` (8 program)
- ⬜ `foods_4part_1..4.sql` (~11k besin)

Doğrulama:
```sql
select count(*) from foods;                                  -- ~11000
select count(*) from workout_programs where status='published'; -- 8
select movement_type, count(*) from exercises group by 1 order by 2 desc;
```

## C) Yasal / şirket bilgileri (🟡 senden gelecek)

Şu bilgileri ver, ben sayfalardaki `[…]` yer tutucularını doldurayım:
- 🟡 Şirket unvanı
- 🟡 Adres
- 🟡 Vergi dairesi / no · MERSİS no
- 🟡 Destek e-postası
- 🟡 Telefon

Etkilenen sayfalar: `/mesafeli-satis`, `/iptal-iade` (ve gizlilik/şartlarda iletişim).

## D) Ödeme

- ✅ Web: iyzico sandbox çalışıyor
- ⬜ iyzico **prodüksiyon** başvurusu (şirket evrakı) — onay süreci gün alır
- ⬜ iyzico prod anahtarlarını Vercel env’e ekleme (başvuru onaylanınca)
- ✅ iOS/Android: RevenueCat backend hazır — panel + IAP ürünleri senin görevin
     (bkz. `docs/revenuecat-kurulum.md`)

## E) Domain (⬜ senin görevin — sonra)

Domain alınca `docs/DOMAIN-SONRASI-YAPILACAKLAR.md` listesini uygula
(Vercel domain + NEXT_PUBLIC_SITE_URL, Supabase URL’leri, OAuth redirect,
RevenueCat webhook URL).

## F) Mobil uygulama paketleme

- ⬜ **Android (TWA):** en hızlı mağaza çıkışı; Google Play’e PWA paketlenir
     (Mac gerekmez). *(Domain sonrası daha temiz.)*
- ⬜ **iOS (Capacitor + Apple IAP):** Mac + Xcode + Apple Developer ($99/yıl)
     gerekir. RevenueCat SDK entegrasyonu (`docs/revenuecat-kurulum.md`).

## G) Mağaza yayını

- ✅ Mağaza metinleri + gizlilik beyanı + inceleme notları hazır
     (`docs/APP-STORE-LISTESI.md`)
- ⬜ App ikonu 1024, ekran görüntüleri, feature graphic (senin hazırlaman)
- ⬜ IAP ürünlerini App Store Connect / Play Console’da oluştur
- ⬜ App Store Connect / Play Console kayıtları + gönderim

## H) Güvenlik (⬜ lansman öncesi — senin görevin)

- ⬜ Sohbette paylaşılan anahtarları **yenile (rotate):** OpenAI, iyzico,
     Supabase service_role, RevenueCat webhook sırrı
- ⬜ **Vercel token’ını en sona bırak** — yenilersen ben deploy edemem

---

## Önerilen sıra (en hızlı değer)

1. **B — SQL seed’lerini çalıştır** (app’i doldurur; hemen yapılabilir)
2. **C — şirket bilgilerini ver** → yasal sayfaları tamamlayayım
3. **Beta** — vercel.app linkiyle arkadaşlarına aç, geri bildirim topla
4. **D — iyzico prodüksiyon başvurusu** (paralel yürür)
5. **Domain al** → E listesi
6. **F/G — mobil paketleme + mağaza gönderimi**
7. **H — anahtar yenileme** (en son)
