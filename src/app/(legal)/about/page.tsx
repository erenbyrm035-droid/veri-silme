import { Prose } from "@/components/legal/Prose";
import { APP_VERSION } from "@/lib/constants";

export const metadata = { title: "Hakkında" };

export default function AboutPage() {
  return (
    <Prose title="Viva AI Coach Hakkında">
      <p>
        Viva, Türkiye&apos;nin yapay zeka destekli fitness koçudur. Antrenman, beslenme, postür, anatomi ve
        motivasyonu tek platformda birleştirir.
      </p>

      <h2>Sürüm Bilgisi</h2>
      <ul>
        <li><strong>Sürüm:</strong> {APP_VERSION}</li>
        <li><strong>Platform:</strong> Web (PWA) · iOS & Android hazırlığında</li>
      </ul>

      <h2>Yasal</h2>
      <ul>
        <li><a href="/privacy">Gizlilik Politikası</a></li>
        <li><a href="/terms">Kullanım Şartları</a></li>
        <li><a href="/support">Destek</a></li>
        <li><a href="/contact">İletişim</a></li>
      </ul>
    </Prose>
  );
}
