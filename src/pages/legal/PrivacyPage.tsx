import { LEGAL_CONTACT_EMAIL, LegalLayout } from "./LegalLayout";

export function PrivacyPage() {
  return (
    <LegalLayout title="Kebijakan Privasi">
      <p>
        Promosikan.com (“kami”) membantu bisnis menemukan percakapan publik yang relevan, menganalisisnya dengan AI, dan menyiapkan
        balasan yang disetujui manusia. Kebijakan ini menjelaskan data apa yang kami proses, untuk apa, dan hak Anda, sesuai Undang-Undang
        No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.
      </p>

      <section>
        <h2>1. Data yang kami proses</h2>
        <ul>
          <li>Data akun: nama, email, foto profil (jika masuk dengan Google), dan informasi login.</li>
          <li>Data workspace: profil bisnis, logo, katalog produk/layanan, keyword, pengaturan, dan daftar anggota tim.</li>
          <li>
            Konten publik media sosial: teks post publik, nama/handle penulis, tautan, dan waktu posting yang diperoleh melalui API resmi
            platform (mis. Meta Threads) atau ditempelkan pengguna lewat Analisis Manual.
          </li>
          <li>Hasil analisis: skor peluang, masalah pelanggan, kecocokan produk, draft balasan, dan catatan CRM.</li>
          <li>Data teknis: log keamanan, pemakaian fitur, dan informasi perangkat yang diperlukan untuk menjalankan layanan.</li>
        </ul>
      </section>

      <section>
        <h2>2. Tujuan pemrosesan</h2>
        <ul>
          <li>Menyediakan layanan: menemukan percakapan relevan, menganalisis kebutuhan, mencocokkan katalog, dan menyusun draft balasan.</li>
          <li>Mengirim balasan hanya setelah disetujui anggota workspace, dan hanya bila diizinkan API platform.</li>
          <li>Keamanan akun, pencegahan penyalahgunaan dan spam, serta pemenuhan kewajiban hukum.</li>
        </ul>
        <p>Kami tidak menjual data pribadi dan tidak memakai data platform sosial untuk tujuan di luar yang dijelaskan di sini.</p>
      </section>

      <section>
        <h2>3. Pihak pemroses</h2>
        <ul>
          <li>Google Firebase / Google Cloud — hosting, autentikasi, database, dan penyimpanan file.</li>
          <li>Anthropic (Claude API) — analisis teks post dan penyusunan draft balasan. Kami hanya mengirim teks yang diperlukan untuk analisis.</li>
          <li>Meta (Threads API) — mengambil konten publik dan mengirim balasan atas izin akun yang dihubungkan workspace.</li>
        </ul>
      </section>

      <section>
        <h2>4. Penyimpanan & retensi</h2>
        <ul>
          <li>Post yang tidak memenuhi syarat sebagai peluang dihapus otomatis setelah 30 hari; post lain setelah 180 hari.</li>
          <li>Token akses platform sosial disimpan terenkripsi dan dihapus saat akun diputus.</li>
          <li>Data workspace disimpan selama workspace aktif dan dihapus setelah workspace dihapus pemiliknya.</li>
        </ul>
      </section>

      <section id="hapus-data">
        <h2>5. Hak Anda & penghapusan data</h2>
        <p>
          Anda berhak mengakses, memperbaiki, dan meminta penghapusan data pribadi Anda, termasuk konten publik Anda yang mungkin
          diproses oleh workspace pengguna kami. Kirim permintaan ke <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="font-semibold text-primary">{LEGAL_CONTACT_EMAIL}</a>{" "}
          dengan menyebutkan akun/handle terkait. Kami menanggapi paling lambat 3 × 24 jam sesuai UU PDP. Pengguna yang memutus akses
          aplikasi kami di pengaturan Meta juga memicu penghapusan data terkait secara otomatis.
        </p>
      </section>

      <section>
        <h2>6. Keamanan</h2>
        <p>
          Akses data dibatasi per workspace dan per peran, komunikasi dienkripsi (HTTPS), dan secret disimpan di Google Secret Manager.
          Tidak ada sistem yang sepenuhnya bebas risiko; kami akan memberi tahu pihak terdampak sesuai ketentuan hukum bila terjadi
          kegagalan pelindungan data.
        </p>
      </section>

      <section>
        <h2>7. Perubahan & kontak</h2>
        <p>
          Kami dapat memperbarui kebijakan ini dan akan mencantumkan tanggal pembaruan di atas. Pertanyaan:{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="font-semibold text-primary">{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </section>
    </LegalLayout>
  );
}
