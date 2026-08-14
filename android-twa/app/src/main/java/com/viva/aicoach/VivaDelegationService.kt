package com.viva.aicoach

import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsRequestHandler
import com.google.androidbrowserhelper.trusted.DelegationService

/**
 * TWA kabuğundaki TEK uygulama kodu.
 *
 * Görevi: Digital Goods API isteklerini Play Billing'e bağlamak. Bu servis
 * kayıtlı olmazsa web tarafındaki
 * `getDigitalGoodsService("https://play.google.com/billing")` çağrısı
 * "unsupported context" ile başarısız olur ve
 * `src/lib/billing/play-client.ts` → `isPlayBillingAvailable()` false döner.
 *
 * Sınıf adı neden `VivaDelegationService`: üst sınıfın adı da
 * `DelegationService`. Kotlin'de aynı adı verirsek sınıf kendini miras almış
 * olur ve derlenmez. Google'ın demosu da bu yüzden farklı bir ad kullanıyor.
 *
 * Dosya yolu ÖNEMLİ:
 * app/src/main/java/com/viva/aicoach/VivaDelegationService.kt
 * (manifest'te `.VivaDelegationService` olarak, paket adına göreli yazılı).
 */
class VivaDelegationService : DelegationService() {
    override fun onCreate() {
        super.onCreate()
        registerExtraCommandHandler(DigitalGoodsRequestHandler(applicationContext))
    }
}
