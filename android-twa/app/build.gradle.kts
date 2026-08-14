// ============================================================================
// Viva AI Coach — Android TWA kabuğu, modül düzeyi Gradle dosyası.
//
// Android Studio "New Project → No Activity" sihirbazının ürettiği
// app/build.gradle.kts dosyasının YERİNE bunu koy.
//
// SÜRÜMLER TAHMİN DEĞİL: Google Maven'dan (dl.google.com/android/maven2)
// doğrulandı — androidbrowserhelper 2.7.3, billing 1.2.0. billing 1.2.0
// içeride Play Billing Library 8.3.0 ve androidx.browser 1.10.0 kullanıyor.
// Chrome'un dokümanındaki 2.1.0 / 1.0.0-alpha05 çifti ESKİ, kullanma.
//
// minSdk 23 ZORUNLU: hem androidbrowserhelper 2.7.3 hem billing 1.2.0 AAR'ı
// `uses-sdk minSdkVersion="23"` bildiriyor. 21 yazarsan manifest birleştirme
// hatası alırsın.
// ============================================================================

plugins {
    // Sihirbaz sürüm kataloğu (libs.versions.toml) kullandıysa kendi
    // dosyandaki satırları AYNEN koru; genelde şöyledir:
    //   alias(libs.plugins.android.application)
    //   alias(libs.plugins.kotlin.android)
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.viva.aicoach"
    compileSdk = 36

    defaultConfig {
        // Bu değer public/.well-known/assetlinks.json ve Vercel'deki
        // ANDROID_PACKAGE_NAME ile BİREBİR aynı olmak zorunda.
        applicationId = "com.viva.aicoach"
        minSdk = 23
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            // TWA kabuğunda küçültülecek uygulama kodu yok; kapalı tutmak
            // manifest/kaynak sürprizlerini önler.
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
}

dependencies {
    // TWA çekirdeği: LauncherActivity, DelegationService, splash, asset links.
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.3")

    // Digital Goods API köprüsü — web tarafındaki
    // src/lib/billing/play-client.ts bunun üzerinden Play Billing'e ulaşır.
    // (Play Billing satmayacaksan bu satırı ve DelegationService.kt'yi sil,
    //  manifest'teki PaymentActivity/PaymentService/BILLING izniyle birlikte.)
    implementation("com.google.androidbrowserhelper:billing:1.2.0")
}
