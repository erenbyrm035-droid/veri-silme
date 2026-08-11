import { Prose } from "@/components/legal/Prose";

export const metadata = { title: "İletişim" };

export default function ContactPage() {
  return (
    <Prose title="İletişim">
      <p>Bize ulaşmanın yolları:</p>
      <ul>
        <li><strong>Genel & Destek:</strong> <a href="mailto:destek@vivacoach.app">destek@vivacoach.app</a></li>
        <li><strong>Gizlilik & KVKK:</strong> <a href="mailto:kvkk@vivacoach.app">kvkk@vivacoach.app</a></li>
        <li><strong>İş birlikleri:</strong> <a href="mailto:info@vivacoach.app">info@vivacoach.app</a></li>
      </ul>
      <p className="text-fg-muted">
        Viva AI Coach — Türkiye. Tüm hakları saklıdır.
      </p>
    </Prose>
  );
}
