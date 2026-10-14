# Promosikan.com

**Temukan yang Butuh. Tawarkan yang Tepat.**

Fondasi Phase 1 untuk platform customer discovery dan smart promotion. Antarmuka utama tersedia sebagai **Demo Mode** Publish Agency. Seluruh percakapan, skor, analisis, grafik, dan draft balasan yang tampil adalah data simulasi. Demo tidak mengakses Threads, OpenAI, atau menerbitkan balasan.

## Yang sudah tersedia

- Next.js App Router, TypeScript strict, Tailwind CSS, navigasi responsif, dan dashboard Bahasa Indonesia.
- Halaman Overview, Discover, Opportunities, Smart Match, Reply Center, Leads CRM, Analytics, Products & Services, Automation, Integrations, Workspace Settings, dan Billing.
- Contoh tujuh percakapan Publish Agency. Pencarian, filter, penyuntingan draft, perubahan status CRM, katalog layanan, dan profil demo berfungsi di browser dengan `localStorage`.
- PostgreSQL + Prisma schema multi-tenant dengan model identitas, workspace, katalog, discovery, AI, promosi, CRM, dan SaaS.
- Endpoint pendaftaran, login, logout, daftar workspace, profil bisnis, dan katalog layanan dengan validasi Zod, cookie sesi httpOnly, pembatasan role, dan query berlingkup workspace.
- Fungsi scoring 0–100 dengan bobot sesuai spesifikasi dan automated tests.

## Jalankan secara lokal

Butuh Node.js 22, Bun, dan PostgreSQL untuk fitur akun/database. Dashboard Demo Mode tetap bisa dijalankan tanpa database.

```powershell
bun install --no-optional
Copy-Item .env.example .env
# Isi DATABASE_URL di .env untuk API akun dan workspace
bun run db:generate
bun run db:migrate
bun run db:seed
bun run dev
```

Buka `http://localhost:3000`. Buka `/account` untuk pendaftaran atau login yang memakai PostgreSQL. Demo Mode di `/` berdiri terpisah dari akun database dan selalu diberi label Demo Data.

## Verifikasi

```powershell
bun run lint
bun run typecheck
bun run test
bun run build
```

## Konfigurasi dan keamanan

- Jangan commit `.env` atau kunci API. Gunakan HTTPS dan secret manager saat deployment.
- Endpoint profil dan layanan memeriksa membership serta role di server sebelum membaca atau menulis data. Query dibatasi dengan `workspaceId`.
- Hash kata sandi memakai bcrypt; token sesi acak disimpan sebagai hash SHA-256 di database dan dikirim dalam cookie httpOnly.
- Demo Mode memakai `localStorage` dan tidak cocok untuk data nyata atau sensitif.
- Akun database dan dashboard Demo Mode belum tersambung. Panel workspace produksi, reset password, verifikasi email, audit keamanan, rate limit, dan migrasi deployment masih perlu diselesaikan sebelum rilis publik.
- Schema menyiapkan `expiresAt` untuk retensi post. Pembersihan terjadwal dan kebijakan retensi operasional belum dijalankan.

## Fase berikutnya

1. Hubungkan dashboard dengan API berlingkup workspace dan selesaikan CRUD katalog, keyword, lead, dan approval.
2. Tambahkan OpenAI structured outputs dan validasi Zod untuk intent, match, serta draft. Jangan membuat klaim yang tidak ada di profil bisnis.
3. Verifikasi dokumentasi dan izin Threads API terbaru, lalu implementasikan OAuth, capability detection, monitoring resmi, dan BullMQ jobs. Jangan gunakan scraping.
4. Implementasikan publish hanya untuk post yang didukung API setelah persetujuan manusia, dengan idempotency key, audit log, dan status `Sent` hanya setelah konfirmasi API.
5. Tambahkan analytics berbasis data nyata dan billing di fase lanjutan.
