# Android Studio — Viva AI Coach TWA Kabuğu Kurulumu

Bu rehber, **Android Studio'da açık olan "New Project" sihirbazından** başlayıp
Google Play'e yüklenebilir bir Android uygulamasına kadar her alanı birebir
anlatır. Kopyala-yapıştır yapılacak dosyaların tamamı depoda
[`android-twa/`](../android-twa) altında hazır.

## Neden TWA (Capacitor değil)

**TWA (Trusted Web Activity)** = uygulamanın içinde adres çubuğu olmadan,
tam ekran çalışan Chrome. Kod web'de kalır; her Vercel deploy'u uygulamayı da
günceller, yeniden Play yüklemesi gerekmez.

Bu proje zaten TWA'ya göre yazılmış:

| Hazır olan | Dosya |
|---|---|
| Digital Goods API ile Play satın alma, `android-app://` referrer tespiti | `src/lib/billing/play-client.ts` |
| Satın almayı Google Play Developer API ile doğrulayan sunucu ucu | `src/app/api/billing/play/verify/route.ts` |
| `com.viva.aicoach` paket adı bildirimi | `public/.well-known/assetlinks.json` |
| `payment=(self)` izni (Permissions-Policy) | `next.config.ts` |
| PWA manifest (ad, start_url, renk, ikon) | `src/app/manifest.ts` |

Capacitor yolu `@revenuecat/purchases-capacitor` paketini gerektirirdi — yeni
npm bağımlılığı. TWA sıfır npm bağımlılığı ve tek dosyalık Kotlin kodu ister.

---

## 1. New Project sihirbazı — alanlar

| Alan | Yazılacak değer |
|---|---|
| Template | **No Activity** |
| Name | `Viva AI Coach` |
| Package name | `com.viva.aicoach` |
| Save location | serbest (ör. `C:\Users\<sen>\AndroidStudioProjects\VivaAICoach`) |
| Language | `Kotlin` |
| Minimum SDK | **API 23 (Android 6.0 Marshmallow)** |
| Build configuration language | `Kotlin DSL (build.gradle.kts)` |

**Package name'i değiştirme.** `com.viva.aicoach` değeri
`public/.well-known/assetlinks.json` içinde ve Vercel'deki
`ANDROID_PACKAGE_NAME` ortam değişkeninde geçiyor; farklı yazarsan Play
satın alma doğrulaması ve adres çubuğu gizleme çalışmaz.

**Minimum SDK neden 23:** `androidbrowserhelper:2.7.3` ve `billing:1.2.0`
kütüphanelerinin ikisi de AAR'ında `minSdkVersion 23` bildiriyor. 21 seçersen
Gradle "manifest merger failed" hatası verir.

`Use legacy android.support libraries` **işaretlenmeyecek**.

---

## 2. Dosyaları yerleştir

Sihirbaz projeyi oluşturduktan sonra, `android-twa/` altındaki dosyaları
projedeki karşılıklarının **üzerine yaz**:

| Depodaki dosya | Android Studio'daki yeri |
|---|---|
| `android-twa/app/build.gradle.kts` | `app/build.gradle.kts` |
| `android-twa/app/src/main/AndroidManifest.xml` | `app/src/main/AndroidManifest.xml` |
| `android-twa/app/src/main/java/com/viva/aicoach/VivaDelegationService.kt` | aynı yol (klasörü sihirbaz zaten açtı) |
| `android-twa/app/src/main/res/values/strings.xml` | `app/src/main/res/values/strings.xml` |
| `android-twa/app/src/main/res/values/colors.xml` | `app/src/main/res/values/colors.xml` (yoksa oluştur) |
| `android-twa/app/src/main/res/values/themes.xml` | `app/src/main/res/values/themes.xml` |
| `android-twa/app/src/main/res/xml/filepaths.xml` | `app/src/main/res/xml/filepaths.xml` (klasörü oluştur) |
| `android-twa/app/src/main/res/drawable/splash.png` | `app/src/main/res/drawable/splash.png` |

**`plugins { }` bloğu istisna:** sihirbaz sürüm kataloğu kullandıysa senin
dosyanda `alias(libs.plugins.android.application)` yazar. O iki satırı **kendi
halinde bırak**, gerisini (`android { }`, `dependencies { }`) depodakiyle
değiştir.

### Kütüphane sürümleri

```kotlin
implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.3")
implementation("com.google.androidbrowserhelper:billing:1.2.0")
```

Bu sürümler Google Maven'dan doğrulandı. `billing:1.2.0` içeride Play Billing
Library **8.3.0** kullanıyor. İnternette bulacağın çoğu rehber (Chrome'un kendi
dokümanı dahil) hâlâ `2.1.0` + `1.0.0-alpha05` diyor — **kullanma**, Play artık
eski Billing Library'leri kabul etmiyor.

---

## 3. İkonlar

Android Studio → `app/src/main/res` klasörüne sağ tık → **New → Image Asset**

| Alan | Değer |
|---|---|
| Icon Type | `Launcher Icons (Adaptive and Legacy)` |
| Name | `ic_launcher` |
| Foreground Layer → Source Asset → Path | depodaki `public/icon-maskable-512.png` |
| Background Layer → Color | `#0a0a0b` |

`icon-maskable-512.png` zaten maskable (kenar boşluğu ayarlı) üretildiği için
adaptive icon kaynağı olarak doğru dosya bu. Sihirbaz `mipmap-*` klasörlerini
ve `ic_launcher` + `ic_launcher_round` dosyalarını kendisi oluşturur —
manifest bu iki adı bekliyor.

Splash görseli (`res/drawable/splash.png`) zaten `public/icon-512.png`'nin
kopyası; ayrıca bir şey yapmana gerek yok.

---

## 4. Gradle sync + cihazda ilk çalıştırma

1. **File → Sync Project with Gradle Files**
2. Telefonu USB ile bağla (Geliştirici Seçenekleri → USB hata ayıklama açık)
   veya bir emülatör başlat → **Run ▶**

Beklenen sonuç: uygulama açılır, Viva yüklenir, **ama üstte adres çubuğu
görünür.**

> Bu bir hata DEĞİL. Adres çubuğu, Digital Asset Links doğrulaması
> tamamlanmadığı için duruyor. Doğrulama, imzalama sertifikasının parmak izini
> gerektiriyor; o da ancak Play Console'a yükledikten sonra çıkıyor
> (Adım 6–7). Şimdilik doğru davranış budur.

---

## 5. İmzalı App Bundle üret

**Build → Generate Signed App Bundle / APK → Android App Bundle**

İlk seferde **Create new…** ile bir keystore oluştur:

| Alan | Not |
|---|---|
| Key store path | Bilgisayarında güvenli bir yer (ör. `C:\keys\viva-upload.jks`) |
| Password / Key password | Güçlü, **kaydet** |
| Alias | `viva-upload` |
| Validity | 25+ yıl |
| First and Last Name / Organization | kendi bilgilerin |

**Bu `.jks` dosyasını ve şifrelerini kaybetme.** Play App Signing kullanacağız
(aşağıda), o yüzden kaybolursa dünyanın sonu değil ama yükleme anahtarını
sıfırlatmak Google'la yazışma gerektirir. Depoya **koyma** — `.gitignore`
zaten kapsıyor olsa bile keystore uzak depoya asla girmemeli.

Çıktı: `app/release/app-release.aab`

---

## 6. Play Console — uygulamayı oluştur

1. [Play Console](https://play.google.com/console) → **Uygulama oluştur**
   - Uygulama adı: `Viva AI Coach`
   - Varsayılan dil: Türkçe
   - Uygulama / Oyun: **Uygulama**, Ücretsiz
2. **Test et ve yayınla → Test → Dahili test** → yeni sürüm →
   `app-release.aab` yükle
3. Yükleme sırasında Play App Signing otomatik açılır (varsayılan).

---

## 7. SHA-256 parmak izini al ve siteye yaz

Play Console → **Test et ve yayınla → Kurulum → Uygulama bütünlüğü**
(*Test and release → Setup → App integrity*) → **Uygulama imzalama anahtarı
sertifikası** bölümündeki **SHA-256 sertifika parmak izini** kopyala.

`public/.well-known/assetlinks.json` içindeki tek satırı değiştir:

```json
"sha256_cert_fingerprints": [
  "AB:CD:EF:...:12"          ← buraya yapıştır (REPLACE_WITH_... yerine)
]
```

Sonra deploy et. Kontrol:

```bash
curl -s https://veri-silme.vercel.app/.well-known/assetlinks.json
```

**Hangi parmak izi?** "Uygulama imzalama anahtarı" (upload key değil).
Chrome doğrulamayı cihazdaki APK'nın imzasına göre yapar; Play App Signing
açıkken cihaza giden APK'yı Google kendi anahtarıyla imzalar.

---

## 8. Doğrula — adres çubuğu kayboldu mu

1. Dahili test kanalındaki bağlantıdan uygulamayı telefona **Play üzerinden**
   yükle (Android Studio'dan doğrudan kurulan sürüm farklı anahtarla
   imzalandığı için doğrulanmaz)
2. Aç → **adres çubuğu görünmemeli**

Görünmeye devam ediyorsa:

| Belirti | Sebep |
|---|---|
| Adres çubuğu duruyor | `assetlinks.json` deploy edilmemiş, yanlış parmak izi, ya da `site` değeri sondaki `/` olmadan yazılmış |
| Uygulama Chrome yerine tarayıcı sekmesinde açılıyor | Cihazda Chrome 72+ yok → `FALLBACK_STRATEGY=customtabs` devrede |
| Yükleme sonrası hemen çalışmıyor | Doğrulama önbelleği; uygulamayı kaldırıp yeniden kur |

Google'ın doğrulayıcısı:
`https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://veri-silme.vercel.app&relation=delegate_permission/common.handle_all_urls`

---

## 9. Play Billing (premium satışı)

### 9.1 Ürünleri oluştur

Play Console → **Para kazanma → Ürünler**

| Plan | Ürün kimliği (**birebir**) | Tür |
|---|---|---|
| Premium Aylık | `premium_monthly` | Abonelik |
| Premium Yıllık | `premium_yearly` | Abonelik |
| Lifetime | `premium_lifetime` | Uygulama içi ürün (tek seferlik) |

Bu kimlikler `src/lib/premium/plans.ts` içindeki `playSku` alanlarından geliyor.
Farklı yazarsan `planForSku()` `null` döner ve her satın alma
**"Bilinmeyen ürün"** ile reddedilir.

### 9.2 Sunucu doğrulaması için Vercel ortam değişkenleri

| Değişken | Değer |
|---|---|
| `ANDROID_PACKAGE_NAME` | `com.viva.aicoach` |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Servis hesabı JSON anahtarının **tamamı**, tek satır string olarak |

Servis hesabı: Play Console → **Kurulum → API erişimi** → Google Cloud
projesine bağla → servis hesabı oluştur → Play Console'da bu hesaba
*"Finansal verileri görüntüle"* + *"Sipariş yönetimi"* izni ver → Google
Cloud'dan JSON anahtar indir.

Bu ikisi olmadan `/api/billing/play/verify` **501** döner ve satın alma
"Play doğrulaması yapılandırılmadı." mesajıyla biter.

### 9.3 Test

Play Console → **Kurulum → Lisans testi** listesine kendi Google hesabını ekle
(gerçek para çekilmez). Uygulamada `/premium` sayfasını aç:

- `isPlayBillingAvailable()` true dönmeli (TWA içinde olduğun için)
- Satın alma penceresi açılmalı, tamamlanınca premium anında aktifleşmeli

> **RevenueCat bu yolda kullanılmıyor.** `docs/revenuecat-kurulum.md` Capacitor
> senaryosu için duruyor. TWA doğrudan `/api/billing/play/verify` kullanıyor.

---

## 10. Sürüm yükseltme

Her Play yüklemesinde `app/build.gradle.kts` içindeki `versionCode` bir
artmalı (`versionName` serbest):

```kotlin
versionCode = 2
versionName = "1.0.1"
```

Web tarafında yaptığın değişiklikler için yeni yükleme **gerekmez** — TWA
canlı siteyi gösterdiği için Vercel deploy'u yeterlidir. Yeni AAB yalnızca
manifest/ikon/paket ayarları değişince gerekir.

---

## Sorun giderme

| Hata | Çözüm |
|---|---|
| `Manifest merger failed ... minSdkVersion 23` | `minSdk = 23` yap (21 değil) |
| `Unresolved reference: DigitalGoodsRequestHandler` | `billing:1.2.0` bağımlılığı eksik ya da Gradle sync yapılmadı |
| `Class 'VivaDelegationService' ... cyclic inheritance` | Sınıfa üst sınıfla aynı adı (`DelegationService`) vermişsin |
| `resource string/assetStatements not found` | `strings.xml` yerine yazılmamış ya da tırnaklar `\"` ile kaçırılmamış |
| `error: attribute 'resource' not found` | Renk/görsel meta-data'larında `android:value` kullanmışsın; `android:resource` olmalı |
| Splash görünmüyor | `filepaths.xml` eksik ya da `FILE_PROVIDER_AUTHORITY` ile `provider` içindeki `authorities` farklı |
| Satın alma "unsupported context" | `VivaDelegationService` manifest'te kayıtlı değil ya da intent-filter'ı eksik |

Derleme hatası alırsan Gradle çıktısının tamamını paylaş — düzeltilir.
