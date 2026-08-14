# android-twa — Android kabuğu referans dosyaları

Bu klasör **derlenmez ve `npm run build`'e girmez**. Android Studio'da
oluşturacağın projeye kopyalanacak dosyaların hazır hâlini tutar.

Ne yapacağını adım adım anlatan rehber:
**[`docs/android-studio-twa-kurulum.md`](../docs/android-studio-twa-kurulum.md)**

## Özet

Uygulama bir **TWA** (Trusted Web Activity): adres çubuğu olmadan tam ekran
çalışan Chrome. Kod web'de kalır — her Vercel deploy'u uygulamayı da günceller,
yeni Play yüklemesi gerekmez.

| Değer | |
|---|---|
| Paket adı | `com.viva.aicoach` |
| Açılış adresi | `https://veri-silme.vercel.app/dashboard` |
| Minimum SDK | 23 (kütüphanelerin alt sınırı) |
| androidbrowserhelper | 2.7.3 |
| billing (Digital Goods API) | 1.2.0 |

## Dosyalar

```
app/build.gradle.kts                                  bağımlılıklar, SDK sürümleri
app/src/main/AndroidManifest.xml                      TWA + Play Billing bileşenleri
app/src/main/java/com/viva/aicoach/
    VivaDelegationService.kt                          tek Kotlin dosyası
app/src/main/res/values/strings.xml                   asset_statements, uygulama adı
app/src/main/res/values/colors.xml                    #0a0a0b (manifest.ts ile aynı)
app/src/main/res/values/themes.xml                    uygulama teması
app/src/main/res/xml/filepaths.xml                    splash için FileProvider yolu
app/src/main/res/drawable/splash.png                  public/icon-512.png kopyası
```

Eksik olan tek şey **Play App Signing SHA-256 parmak izi** — Play Console'da
uygulamayı açtıktan sonra `public/.well-known/assetlinks.json` içine yazılacak.
O yazılmadan adres çubuğu gizlenmez.
