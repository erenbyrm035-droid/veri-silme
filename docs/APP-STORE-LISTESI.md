# 📱 Mağaza Yayın Kiti — App Store & Google Play

Uygulamayı mağazalara gönderirken kullanılacak hazır metinler, gizlilik
beyanı ve inceleme notları. `[…]` alanlarını kendi bilgilerinle doldur.

---

## 1) Kimlik

| Alan | Değer |
|------|-------|
| Uygulama adı | Viva – AI Fitness & Beslenme Koçu |
| Alt başlık (iOS, 30 karakter) | Yapay zeka koçun cebinde |
| Kategori | Sağlık ve Fitness (Health & Fitness) |
| İkincil kategori | Yaşam Tarzı |
| Yaş sınırı | 12+ (sağlık/fitness içeriği; tıbbi tavsiye değil) |
| Fiyat | Ücretsiz (uygulama içi Premium abonelik) |
| Diller | Türkçe (birincil) |

## 2) Promosyon metni (App Store, 170 karakter)

> Yapay zeka koçun ve diyetisyeninle sana özel antrenman, beslenme planı ve
> gelişim takibi. Pilates’ten kuvvete yüzlerce egzersiz, binlerce besin.

## 3) Açıklama (App Store & Play — uzun)

```
Viva, cebindeki yapay zeka destekli kişisel fitness ve beslenme koçun.
Hedeflerine, seviyene ve tercihlerine göre her şeyi tek uygulamada topluyor.

• AI Koç — 7/24 sohbet: antrenman, form ve motivasyon için sana özel yanıt.
• AI Diyetisyen — gerçek bir diyetisyen gibi seninle görüşür, sonra günlük
  beslenme planını, makrolarını ve alışveriş listeni hazırlar.
• Hazır Programlar — Pilates, Yoga, Mobilite, Kalistenik, HIIT ve daha fazlası;
  seç ve başla, günlerin antrenman listene eklensin.
• Egzersiz Kütüphanesi — yüzlerce hareket; hedef kaslar, doğru form ve ipuçları.
• Anatomi — interaktif kas haritasıyla neyi nasıl çalıştıracağını keşfet.
• Gelişim Takibi — kilo, ölçü ve fotoğraflarla ilerlemeni grafiklerle izle.
• Binlerce besin — Türk mutfağı ve market ürünleriyle kalori/makro takibi.

Premium ile: sınırsız AI koç & diyetisyen, sınırsız program ve plan,
3D anatomi, ileri analizler ve daha fazlası.

Önemli: Viva bilgilendirme amaçlıdır, tıbbi tavsiye yerine geçmez. Yeni bir
programa başlamadan önce sağlık uzmanına danışman önerilir.
```

## 4) Anahtar kelimeler

**iOS (tek satır, 100 karakter, virgülle):**
```
fitness,antrenman,beslenme,diyet,kalori,ai koç,pilates,yoga,kas,egzersiz,program,makro,spor
```

**Google Play — kısa açıklama (80 karakter):**
```
Yapay zeka koçun: sana özel antrenman, beslenme planı ve gelişim takibi.
```

## 5) 🔒 Gizlilik Beyanı (App Store “Data” / Play Data Safety)

Uygulamanın gerçekte topladığı veriler (üçüncü-parti reklam/izleme SDK’sı YOK):

| Veri türü | Toplanıyor mu | Amaç | Kimliğe bağlı | Reklam/izleme |
|-----------|---------------|------|----------------|----------------|
| E-posta / ad | Evet | Hesap, giriş | Evet | Hayır |
| Sağlık & fitness (kilo, boy, yaş, cinsiyet, hedef, sağlık notu, sakatlık) | Evet | Uygulama işlevi (plan/analiz) | Evet | Hayır |
| Kullanıcı içeriği (fotoğraf, öğün/antrenman kayıtları) | Evet | Uygulama işlevi | Evet | Hayır |
| Tanımlayıcı (kullanıcı kimliği) | Evet | Hesap | Evet | Hayır |
| Kullanım verisi (uygulama etkileşimleri) | Evet | Ürün iyileştirme | Evet | Hayır |
| Satın alma | Evet | Abonelik yönetimi (Apple/Google/iyzico) | Evet | Hayır |
| Konum | Hayır | — | — | — |

Ek notlar:
- Veriler reklam veya üçüncü-parti izleme için **kullanılmaz, satılmaz.**
- AI özelliklerinde (koç/diyetisyen) mesaj ve ilgili profil verisi, yanıt üretmek
  için AI hizmet sağlayıcısına (OpenAI) iletilir. Bu, gizlilik politikasında belirtilir.
- **Hesap silme uygulama içinde mevcuttur** (Ayarlar → Hesabı sil) — Apple’ın
  zorunlu tuttuğu gereksinim karşılanır.
- Gizlilik Politikası URL: `https://[DOMAIN]/privacy`

## 6) URL’ler (App Store Connect / Play Console)

| Alan | URL |
|------|-----|
| Gizlilik Politikası | `https://[DOMAIN]/privacy` |
| Destek | `https://[DOMAIN]/support` |
| Pazarlama / Ana sayfa | `https://[DOMAIN]` |
| Kullanım Şartları (EULA) | `https://[DOMAIN]/terms` |

> Domain almadıysan geçici olarak `https://veri-silme.vercel.app/...` kullanılabilir,
> ama yayında kendi domainini kullan.

## 7) App Review Notes (Apple incelemesi için — İngilizce)

```
Demo account:
  email: [DEMO E-POSTA]
  password: [DEMO ŞİFRE]

Notes for the reviewer:
- Viva is an AI-powered fitness & nutrition coaching app (Turkish market).
- AI Coach and AI Dietitian use OpenAI to generate personalized guidance.
- Premium is an auto-renewable subscription sold via Apple In-App Purchase
  (managed through RevenueCat). No external payment is used inside the iOS app.
- The app provides informational content only and is not a medical device;
  a health disclaimer is shown.
- Account deletion is available in-app: Settings → Delete account.
```

## 8) Gerekli görsel varlıklar (senin hazırlaman gerekenler)

- [ ] App ikonu **1024×1024** (şeffaf olmayan, köşesiz) — mevcut Viva “V” logosundan üretilebilir
- [ ] iPhone ekran görüntüleri: 6.7" (1290×2796) ve 6.5" — en az 3-5 adet
      (öneri: AI Diyetisyen planı, AI Koç sohbeti, Hazır Programlar, Egzersiz detay, Gelişim grafiği)
- [ ] iPad ekran görüntüleri (iPad desteklenecekse)
- [ ] Google Play: telefon ekran görüntüleri + **Feature graphic 1024×500**
- [ ] (Opsiyonel) tanıtım videosu

> İpucu: Hoş geldin turu ve AI Diyetisyen ekranları güçlü görsellerdir.

## 9) IAP ürünleri (App Store Connect / Play Console)

| Plan | Ürün kimliği | Tip |
|------|--------------|-----|
| Aylık | `viva_premium_monthly` | Auto-renewable subscription |
| Yıllık | `viva_premium_yearly` | Auto-renewable subscription |
| Ömür boyu | `viva_premium_lifetime` | Non-consumable |

Fiyatları Apple/Google fiyat kademelerinden seç. Bu kimlikler RevenueCat ve
backend eşlemesiyle uyumludur (`docs/revenuecat-kurulum.md`).
