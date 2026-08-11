import { Prose } from "@/components/legal/Prose";

export const metadata = { title: "Kullanım Şartları" };

export default function TermsPage() {
  return (
    <Prose title="Kullanım Şartları" updated="12 Temmuz 2026">
      <p>
        Viva AI Coach&apos;u kullanarak aşağıdaki şartları kabul etmiş olursun. Lütfen dikkatlice oku.
      </p>

      <h2>1. Hizmet</h2>
      <p>
        Viva; antrenman, beslenme ve fitness takibi için yapay zeka destekli araçlar sunar. Hizmet
        &quot;olduğu gibi&quot; sağlanır ve zaman zaman güncellenebilir.
      </p>

      <h2>2. Sağlık Sorumluluk Reddi</h2>
      <p>
        Uygulama tıbbi tavsiye yerine geçmez. Sunulan program, diyet ve öneriler bilgilendirme amaçlıdır.
        Yeni bir egzersiz veya beslenme programına başlamadan önce bir sağlık uzmanına danışman önerilir.
        Sakatlık veya rahatsızlık durumunda hekimine başvur.
      </p>

      <h2>3. Hesap Sorumluluğu</h2>
      <ul>
        <li>Hesap güvenliğinden ve şifrenden sen sorumlusun.</li>
        <li>Doğru ve güncel bilgi vermeyi kabul edersin.</li>
        <li>Hizmeti yasa dışı veya kötüye kullanım amacıyla kullanamazsın.</li>
      </ul>

      <h2>4. Premium ve Ödemeler</h2>
      <p>
        Premium abonelikler dönemsel olarak yenilenir. Ödeme, uygulama mağazası veya ödeme sağlayıcısı
        aracılığıyla işlenir. İptal ve iade koşulları ilgili mağaza politikalarına tabidir.
      </p>

      <h2>5. Fikri Mülkiyet</h2>
      <p>
        Uygulamadaki içerik, tasarım ve markalar Viva&apos;ya aittir. İzinsiz çoğaltılamaz.
      </p>

      <h2>6. Sorumluluğun Sınırlandırılması</h2>
      <p>
        Viva, hizmetin kullanımından doğabilecek dolaylı zararlardan sorumlu tutulamaz.
      </p>

      <h2>7. Değişiklikler</h2>
      <p>
        Bu şartlar güncellenebilir. Önemli değişikliklerde uygulama içinden bilgilendirilirsin.
      </p>

      <h2>İletişim</h2>
      <p><a href="mailto:destek@vivacoach.app">destek@vivacoach.app</a></p>
    </Prose>
  );
}
