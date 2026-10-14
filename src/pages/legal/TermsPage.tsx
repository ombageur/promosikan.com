import { Link } from "react-router";
import { LEGAL_CONTACT_EMAIL, LegalLayout } from "./LegalLayout";

export function TermsPage() {
  return (
    <LegalLayout title="Syarat Layanan">
      <p>
        Dengan membuat akun atau memakai Promosikan.com, Anda menyetujui syarat berikut. Jika Anda memakai layanan atas nama bisnis,
        Anda menyatakan berwenang mewakili bisnis tersebut.
      </p>

      <section>
        <h2>1. Layanan</h2>
        <p>
          Promosikan.com menyediakan alat untuk menemukan percakapan publik yang relevan, menganalisisnya dengan AI, mencocokkan dengan
          katalog bisnis, dan menyiapkan draft balasan. Fitur dapat berubah seiring pengembangan.
        </p>
      </section>

      <section>
        <h2>2. Kewajiban pengguna</h2>
        <ul>
          <li>Setiap balasan dikirim atas persetujuan dan tanggung jawab workspace Anda. Tinjau draft AI sebelum menyetujuinya.</li>
          <li>Dilarang memakai layanan untuk spam, pesan massal yang tidak diminta, penipuan, pelecehan, atau klaim yang menyesatkan.</li>
          <li>Patuhi ketentuan platform sosial yang terhubung (mis. Meta Platform Terms) dan hukum yang berlaku.</li>
          <li>Jaga kerahasiaan akun dan atur peran anggota tim dengan benar.</li>
        </ul>
      </section>

      <section>
        <h2>3. AI dan batasannya</h2>
        <p>
          Analisis, skor, dan draft dihasilkan AI dan dapat keliru. Hasil tersebut adalah saran, bukan jaminan. Promosikan.com tidak
          mengirim balasan tanpa persetujuan manusia.
        </p>
      </section>

      <section>
        <h2>4. Integrasi pihak ketiga</h2>
        <p>
          Integrasi memakai API resmi dan tunduk pada izin serta batasan platform terkait. Kami tidak memakai scraping atau otomasi
          browser. Ketersediaan fitur integrasi bergantung pada pihak ketiga.
        </p>
      </section>

      <section>
        <h2>5. Paket, kuota, dan penghentian</h2>
        <p>
          Pemakaian dibatasi kuota sesuai paket. Kami dapat menangguhkan akun yang melanggar syarat ini atau membahayakan pengguna lain
          dan platform. Anda dapat berhenti memakai layanan kapan saja.
        </p>
      </section>

      <section>
        <h2>6. Data</h2>
        <p>
          Pemrosesan data dijelaskan di{" "}
          <Link to="/privacy" className="font-semibold text-primary">
            Kebijakan Privasi
          </Link>
          . Anda tetap memiliki konten dan data bisnis yang Anda masukkan.
        </p>
      </section>

      <section>
        <h2>7. Batasan tanggung jawab & hukum yang berlaku</h2>
        <p>
          Layanan disediakan “sebagaimana adanya”. Sejauh diizinkan hukum, kami tidak bertanggung jawab atas kerugian tidak langsung dari
          pemakaian layanan. Syarat ini tunduk pada hukum Republik Indonesia. Kontak:{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="font-semibold text-primary">
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalLayout>
  );
}
