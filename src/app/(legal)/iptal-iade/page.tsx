import { Prose } from "@/components/legal/Prose";

export const metadata = { title: "İptal ve İade Politikası" };

export default function CancellationRefundPage() {
  return (
    <Prose title="İptal ve İade Politikası" updated="23 Temmuz 2026">
      <p>
        Bu politika, Viva AI Coach Premium üyeliğinin iptali ve iade koşullarını
        açıklar. <a href="/mesafeli-satis">Mesafeli Satış Sözleşmesi</a>’nin
        ayrılmaz bir parçasıdır.
      </p>

      <h2>1. Üyelik İptali</h2>
      <ul>
        <li>Premium üyeliğini istediğin an iptal edebilirsin.</li>
        <li>
          <strong>Uygulama içi (web/iyzico):</strong> Premium sayfasındaki
          “Üyeliği iptal et” seçeneğiyle otomatik yenilemeyi durdurabilirsin.
        </li>
        <li>
          <strong>iOS (App Store):</strong> Ayarlar → Apple Kimliği → Abonelikler
          üzerinden iptal edilir.
        </li>
        <li>
          <strong>Android (Google Play):</strong> Play Store → Abonelikler
          üzerinden iptal edilir.
        </li>
        <li>
          İptal sonrası mevcut dönemin sonuna kadar Premium özelliklerden
          yararlanmaya devam eder, dönem bitince ücretsiz plana geçersin.
        </li>
      </ul>

      <h2>2. İade Koşulları</h2>
      <p>
        Premium; ödeme onaylandığı anda ifa edilen dijital bir hizmettir. Bu
        nedenle Mesafeli Sözleşmeler Yönetmeliği md. 15/1-(ğ) uyarınca kural
        olarak cayma/iade hakkı doğmaz. Bununla birlikte aşağıdaki durumlarda
        iade değerlendirilir:
      </p>
      <ul>
        <li>Teknik bir arıza nedeniyle hizmete hiç erişememiş olman ve sorunun tarafımızca çözülememesi,</li>
        <li>Aynı dönem için mükerrer (çift) tahsilat yapılmış olması,</li>
        <li>Yürürlükteki tüketici mevzuatının iadeyi zorunlu kıldığı diğer haller.</li>
      </ul>
      <p>
        Kabul edilen iadelerde, kullanılmamış döneme ilişkin tutar iade edilir;
        ödeme hangi yöntemle yapıldıysa aynı yönteme (iyzico/kart) yapılır.
      </p>

      <h2>3. Mağaza Üzerinden Yapılan Satın Almalar</h2>
      <p>
        Apple App Store veya Google Play üzerinden yapılan satın almaların
        iadeleri, ilgili mağazanın iade politikalarına tabidir ve doğrudan
        Apple/Google tarafından işlenir:
      </p>
      <ul>
        <li>Apple: reportaproblem.apple.com</li>
        <li>Google Play: play.google.com/store/account</li>
      </ul>

      <h2>4. İade Süreci ve Süresi</h2>
      <ul>
        <li>İade talebini <a href="mailto:erenbyrm43@gmail.com">erenbyrm43@gmail.com</a> adresine, hesap e-postan ve ödeme tarihiyle ilet.</li>
        <li>Talebini en geç 3 iş günü içinde değerlendirir, sonucu e-posta ile bildiririz.</li>
        <li>Onaylanan iadeler, bankana/ödeme sağlayıcısına bağlı olarak genellikle 7-14 iş günü içinde hesabına yansır.</li>
      </ul>

      <h2>5. İletişim</h2>
      <p>
        Soruların için: <a href="mailto:erenbyrm43@gmail.com">erenbyrm43@gmail.com</a>
      </p>
    </Prose>
  );
}
