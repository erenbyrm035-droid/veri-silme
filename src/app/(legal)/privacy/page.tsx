import { Prose } from "@/components/legal/Prose";

export const metadata = { title: "Gizlilik Politikası" };

export default function PrivacyPage() {
  return (
    <Prose title="Gizlilik Politikası" updated="12 Temmuz 2026">
      <p>
        Viva AI Coach (&quot;Uygulama&quot;) olarak gizliliğine önem veriyoruz. Bu politika, 6698 sayılı Kişisel
        Verilerin Korunması Kanunu (KVKK) ve Genel Veri Koruma Tüzüğü (GDPR) kapsamında hangi verileri
        topladığımızı, nasıl kullandığımızı ve haklarını açıklar.
      </p>

      <h2>Topladığımız Veriler</h2>
      <ul>
        <li><strong>Hesap bilgileri:</strong> e-posta, ad, profil fotoğrafı (isteğe bağlı).</li>
        <li><strong>Fitness verileri:</strong> antrenman, beslenme, su, ölçüm, postür analizleri ve fotoğraflar.</li>
        <li><strong>Kullanım verileri:</strong> uygulama içi etkileşimler, XP/başarım kayıtları.</li>
        <li><strong>Teknik veriler:</strong> cihaz, tarayıcı ve hata günlükleri (crash reporting).</li>
      </ul>

      <h2>Verilerin Kullanımı</h2>
      <ul>
        <li>Kişiselleştirilmiş program, beslenme ve AI koçluk hizmeti sunmak.</li>
        <li>İlerlemeni takip etmek ve raporlamak.</li>
        <li>Hizmet güvenliğini sağlamak ve kötüye kullanımı önlemek.</li>
      </ul>

      <h2>Yapay Zeka İşleme</h2>
      <p>
        AI koç ve analiz özellikleri için verilerin, yalnızca sana yanıt üretmek amacıyla AI sağlayıcılarına
        (OpenAI / Anthropic) iletilebilir. Bu veriler pazarlama amacıyla kullanılmaz.
      </p>

      <h2>Veri Saklama ve Güvenlik</h2>
      <p>
        Veriler Supabase altyapısında, satır düzeyi güvenlik (RLS) politikalarıyla korunur. Fotoğraflar özel
        (private) depolama kovalarında tutulur ve yalnızca imzalı bağlantılarla erişilir.
      </p>

      <h2>Haklarınız (KVKK / GDPR)</h2>
      <ul>
        <li><strong>Erişim ve taşınabilirlik:</strong> Ayarlar → &quot;Verilerimi İndir&quot; ile tüm verini JSON olarak alabilirsin.</li>
        <li><strong>Silme (unutulma hakkı):</strong> Ayarlar → &quot;Hesabımı Sil&quot; ile hesabını ve verilerini kalıcı olarak silebilirsin.</li>
        <li><strong>Düzeltme:</strong> Profil bilgilerini istediğin zaman güncelleyebilirsin.</li>
        <li><strong>Rıza geri çekme:</strong> AI onayını istediğin zaman kaldırabilirsin.</li>
      </ul>

      <h2>Çerezler</h2>
      <p>
        Yalnızca oturum ve tercih çerezleri kullanılır; üçüncü taraf reklam çerezi kullanılmaz.
      </p>

      <h2>İletişim</h2>
      <p>Sorular için: <a href="mailto:destek@vivacoach.app">destek@vivacoach.app</a></p>
    </Prose>
  );
}
