import { Prose } from "@/components/legal/Prose";

export const metadata = { title: "Destek" };

export default function SupportPage() {
  return (
    <Prose title="Destek Merkezi">
      <p>Sıkça sorulan sorular ve yardım. Aradığını bulamazsan bize yaz.</p>

      <h2>Sıkça Sorulan Sorular</h2>
      <ul>
        <li><strong>Şifremi unuttum:</strong> Giriş ekranında &quot;Şifremi unuttum&quot; bağlantısını kullan.</li>
        <li><strong>AI koç yanıt vermiyor:</strong> İnternet bağlantını kontrol et; Free planda günlük limit olabilir.</li>
        <li><strong>Premium&apos;a nasıl geçerim:</strong> Ayarlar → Premium bölümünden planları görebilirsin.</li>
        <li><strong>Verilerimi nasıl indiririm:</strong> Ayarlar → Gizlilik → &quot;Verilerimi İndir&quot;.</li>
        <li><strong>Hesabımı nasıl silerim:</strong> Ayarlar → Gizlilik → &quot;Hesabımı Sil&quot;.</li>
      </ul>

      <h2>İletişim</h2>
      <p>
        E-posta: <a href="mailto:destek@vivacoach.app">destek@vivacoach.app</a><br />
        Yanıt süresi: genellikle 24-48 saat.
      </p>
    </Prose>
  );
}
