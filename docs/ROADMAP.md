# Roadmap Implementasi Promosikan.com

Spesifikasi lengkap ada di [SPEC.md](SPEC.md). Setiap fase punya tujuan, cakupan, batasan, dan **Definition of Done (DoD)**. Sebuah fase baru boleh disebut selesai jika semua poin DoD terpenuhi, dan lint, typecheck, tes, serta build lulus di CI.

| Fase | Nama | Hasil utama | Bergantung pada |
|---|---|---|---|
| 0 | Migrasi & Fondasi | Repo Vite + Firebase + emulator + CI | – |
| 1 | Auth, Workspace & RBAC | Login, workspace, anggota, rules + tes | 0 |
| 2 | App Shell, Katalog & Demo Mode | Semua halaman berjalan dengan data demo; katalog & keyword nyata | 1 |
| 3 | AI Intelligence | Analisis, scoring, matching, draft balasan (lewat input manual) | 2 |
| 4 | Integrasi Threads | OAuth, monitoring keyword, dedup, pipeline otomatis | 3 + App Review Meta |
| 5 | Reply Center & CRM | Approval, publikasi yang didukung API, pipeline lead | 4 |
| 6 | Analytics | Agregasi, dashboard, laporan | 5 |
| 7 | Komersialisasi SaaS | Plan, kuota, billing, manajemen tim lanjutan | 6 |
| 8 | Hardening & Launch | Audit keamanan, kepatuhan, observability, rilis publik | 7 |

> **Jalur paralel non-teknis:** pengajuan App Review Meta (privacy policy, ToS, screencast) dimulai di Fase 3, karena prosesnya bisa memakan waktu berminggu-minggu.

---

## Fase 0 — Migrasi & Fondasi

**Tujuan:** mengganti codebase lama (Next.js + Prisma + PostgreSQL + bun) dengan fondasi Vite + Firebase sesuai SPEC, tanpa kehilangan bagian yang masih berguna.

**Cakupan:**
- Hapus Next.js (`next.config.ts`, `next-env.d.ts`, `.next/`, `src/app/api/*`), Prisma (`prisma/`, `@prisma/client`), `bcryptjs`, `jose`, `bun.lock`, dan `tsconfig.tsbuildinfo`.
- Pertahankan dan pindahkan:
  - `src/lib/scoring.ts` dan tesnya → `shared/scoring.ts` (ganti nama field `relevance` → `productRelevance` dan `suitability` → `conversationSuitability`)
  - `src/lib/demo.ts` → `src/services/demo/fixtures.ts`
  - Isi `src/lib/navigation.ts` dan komponen UI yang masih relevan
- Inisialisasi Vite + React + TS strict, Tailwind v4, shadcn/ui, React Router, TanStack Query, RHF, Zod, Recharts, dan Lucide.
- Struktur folder sesuai SPEC §23, termasuk `shared/` dan `functions/` (Gen 2, TS, ESLint).
- Atur `firebase.json` (hosting dengan SPA rewrite, functions, firestore, storage, emulators), `.firebaserc` (dev/staging/prod), serta `firestore.rules` dan `storage.rules` awal yang menolak semua akses.
- `src/lib/firebase/`: inisialisasi, koneksi otomatis ke emulator di mode dev, dan App Check (debug token di dev).
- Pindah ke npm. Script: `dev`, `build`, `lint`, `typecheck`, `test`, `test:rules` (kini `test:emulator`), `emulators`.
- Perbarui CI GitHub Actions: Node 22, npm ci, lint, typecheck, test, tes rules di emulator, dan build.
- Perbarui `.env.example` dan README.

**Bukan cakupan:** fitur apa pun.

**DoD:** ✅ selesai 2026-10-14 (branch `phase-0-migration`)
- [x] `npm run dev` menampilkan halaman kosong ber-brand. `npm run emulators` menyalakan Auth, Firestore, Functions, Storage, dan Hosting.
- [x] Tidak ada sisa dependensi atau berkas Next/Prisma.
- [x] Tes `shared/scoring` lulus.
- [x] CI hijau.

---

## Fase 1 — Auth, Workspace & RBAC

**Tujuan:** pengguna bisa mendaftar, membuat workspace, mengundang tim, dan setiap akses dibatasi dengan benar.

**Cakupan:**
- Login email/password dan Google, verifikasi email, lupa password, logout, persistensi sesi.
- `AuthContext`, `ProtectedRoute`, `RequireVerifiedEmail`.
- `shared/permissions.ts` berisi matriks role (SPEC §4) beserta tesnya.
- Functions: `createWorkspace`, `inviteMember`, `acceptInvitation`, `updateMemberRole`, `removeMember`, `transferOwnership`, dan helper `requirePermission`.
- `WorkspaceContext`, routing `/w/:workspaceId/*`, workspace switcher, dan onboarding (buat workspace pertama atau coba demo).
- Halaman Workspace Settings: profil bisnis, logo (Storage), dan anggota.
- `firestore.rules` dan `storage.rules` untuk `users`, `workspaces`, `members`, dan `invitations`.
- Tes rules: setiap role × aksi, akses lintas workspace, dan penulisan field terlindungi (`role`, `ownerId`, `plan`).
- Audit log untuk perubahan anggota dan role.

**DoD:** ✅ selesai 2026-10-15 (branch `phase-1-auth-workspace`)
- [x] User A tidak bisa membaca maupun menulis apa pun di workspace User B (dibuktikan dengan tes). — `tests/rules/firestore.test.ts`, `tests/rules/storage.test.ts`, `tests/e2e/workspace-flow.test.ts`
- [x] Viewer tidak bisa menulis. Admin tidak bisa mengubah Owner. — tes matriks role di `tests/rules/`, `shared/permissions.test.ts`, `functions/src/workspace/workspace.test.ts`
- [x] Undangan kedaluwarsa dalam 7 hari dan hanya bisa dipakai sekali. — `workspace.test.ts` ("undangan anggota")
- [x] Semua function menolak pemanggil yang tidak terautentikasi, emailnya belum terverifikasi, atau bukan anggota. — `requireAuth` + tes orang luar di `workspace.test.ts`, alur e2e

**Catatan Fase 1:**
- Email undangan ditulis ke koleksi `mail` (format Firebase Extension "Trigger Email"). Sampai extension dipasang, admin membagikan link undangan yang tampil di dialog.
- App Check untuk callable dikendalikan `ENFORCE_APP_CHECK` (default `false`) sampai site key reCAPTCHA Enterprise tersedia.
- Platform Super Admin (custom claim) belum diimplementasikan; dijadwalkan di Fase 8.
- Hapus workspace dijadwalkan di Fase 7.

---

## Fase 2 — App Shell, Katalog & Demo Mode

**Tujuan:** seluruh antarmuka bisa dijelajahi dengan data demo, sementara katalog dan keyword sudah tersimpan nyata di Firestore.

**Cakupan:**
- Layout dashboard: sidebar berkelompok (menjadi drawer di mobile), top bar, menu profil, toast, skeleton, empty state, dan error state.
- Abstraksi `DataSource` dengan dua implementasi, `firestore` dan `demo`.
- Halaman berikut, berisi data demo atau "belum ada data" untuk workspace nyata: Overview, Discover, Opportunities, Smart Match, Reply Center, Leads CRM, Analytics, Automation, Integrations, Billing (placeholder).
- **Nyata (CRUD Firestore):** Products & Services (`offerings`), keyword groups & keywords (ditautkan ke offering), dan dokumen `settings/automation`.
- Demo publik `/demo` tanpa login, plus `createDemoWorkspace`. Banner "Data Demo" tampil di semua halaman demo.
- Rules untuk `offerings`, `keywordGroups`, `keywords`, dan `settings` beserta tesnya.
- Dokumen `docs/FIRESTORE_SCHEMA.md`.

**DoD:** ✅ selesai 2026-10-15 (branch `phase-2-shell-catalog`)
- [x] Semua halaman di sidebar bisa dibuka, responsif di 375 px, dan punya state loading, empty, serta error. — smoke test headless Chrome: 13 halaman demo × 375/1280 px tanpa error console & tanpa overflow horizontal; 13 halaman workspace nyata setelah login (emulator)
- [x] Produk dan keyword tersimpan dan dapat diedit sesuai role. — `tests/rules/catalog.test.ts` (matriks role), smoke test UI menyimpan produk/grup/keyword/automation ke Firestore emulator
- [x] Tidak ada data demo yang tampil tanpa label "Data Demo". — banner di layout untuk setiap workspace `isDemo`; dicek otomatis di setiap halaman demo
- [x] Lighthouse accessibility ≥ 90 di halaman utama. — 100 di beranda, login, daftar, dan 8 halaman demo

**Catatan Fase 2:**
- Data peluang/draft/lead/statistik di workspace demo berasal dari fixtures di browser (`shared/demo/publishAgency.ts`); katalog workspace demo tersimpan nyata di Firestore. Workspace nyata menampilkan state kosong yang jujur sampai Fase 3–6.
- Halaman di balik login belum diaudit Lighthouse (hanya smoke test).

---

## Fase 3 — AI Intelligence

**Tujuan:** AI menganalisis percakapan, memberi skor, mencocokkan dengan katalog, dan menyusun draft balasan. Semua ini bisa diuji lewat **Analisis Manual**, sebelum Threads terhubung.

**Cakupan:**
- Klien Claude API (`@anthropic-ai/sdk`) di functions dengan `defineSecret("ANTHROPIC_API_KEY")`, structured outputs (`output_config.format`) + validasi Zod, effort eksplisit per rute, prompt caching, penanganan `stop_reason: "refusal"` (+ fallback server-side), dan retry terbatas.
- Prompt berversi di `functions/src/ai/prompts/`, dengan mitigasi prompt injection.
- `analyzeConversation` (callable, untuk input manual) dan `analyzePost` (task queue, dipakai di Fase 4). Analisis dan matching dijalankan dalam satu panggilan.
- Skor akhir dihitung oleh `shared/scoring.ts`.
- `generateReply` dan `validateReply` dengan guardrails sesuai SPEC §11.
- Pencatatan usage (token dan biaya) di `usage/{yyyy-mm}`, kuota AI per workspace, dan rate limit per user.
- UI: form Analisis Manual di Discover, kartu analisis di Opportunities, Smart Match, serta Promotion Studio (generate, regenerate, persingkat, ganti nada, simpan).
- Halaman Kebijakan Privasi dan Syarat Layanan (dibutuhkan untuk App Review Meta).
- **Mulai pengajuan App Review Meta.** Sebelum itu, tulis `docs/THREADS_API_NOTES.md` dari dokumentasi resmi.

**DoD:** 4 dari 5 terpenuhi (2026-10-15, branch `phase-3-ai`); eval belum dijalankan terhadap Claude sungguhan.
- [x] Output AI yang tidak valid menurut Zod ditolak dan dicatat, tanpa membuat aplikasi crash. — `runAi` + tes "output tidak valid/tidak lengkap" di `functions/src/ai/ai.test.ts`
- [x] Ada tes unit dengan klien Claude tiruan (mock) untuk parsing, skor, kasus "tidak ada yang cocok", dan kegagalan API. — `ai.test.ts` (16 tes) + `units.test.ts`
- [ ] Ada set evaluasi berisi ≥ 30 contoh post berbahasa Indonesia (dengan label yang diharapkan), dan skrip `npm run eval:ai` melaporkan akurasi klasifikasi. — **dataset (32 kasus) & skrip selesai; belum dijalankan** karena belum ada `ANTHROPIC_API_KEY` di lingkungan pengembangan. Jalankan: `ANTHROPIC_API_KEY=… npm run eval:ai -- --yes` (perkiraan < US$1).
- [x] Kuota habis menghasilkan pesan yang jelas, dan tidak ada panggilan Claude API yang terjadi. — tes kuota & rate limit memastikan klien tiruan tidak dipanggil
- [x] Tidak ada secret di bundle frontend (diverifikasi dengan grep pada `dist/`). — grep `sk-ant|ANTHROPIC_API_KEY|anthropic-ai|client_secret|THREADS_APP_SECRET`: kosong

**Catatan Fase 3:**
- `analyzePost` (task queue) dipindah ke Fase 4 bersama `socialPosts`, karena belum ada sumber post otomatis untuk diuji. Logika intinya (`buildOpportunityFields`, prompt, `runAi`) sudah dipakai bersama.
- Smoke test UI di browser (emulator + AI tiruan `AI_FAKE=true`): Analisis Manual → peluang → draft → persingkat → sunting → periksa ulang → pemakaian tercatat.
- Workspace demo tidak memanggil AI (server menolak); demo publik menampilkan contoh hasil.
- App Review Meta: checklist di `docs/THREADS_API_NOTES.md` §5 — tugas pemilik produk.

---

## Fase 4 — Integrasi Threads

**Tujuan:** workspace menghubungkan akun Threads, lalu sistem menemukan post relevan secara terjadwal dan menganalisisnya otomatis.

**Prasyarat:** `docs/THREADS_API_NOTES.md` sudah diverifikasi, dan permission yang dibutuhkan sudah disetujui atau tersedia dalam mode development.

**Cakupan:**
- `startThreadsOAuth`, `threadsOAuthCallback` (dengan validasi `state`), penukaran ke long-lived token, `refreshThreadsTokens`, `disconnectThreads`, `threadsDeauthorize`, dan `threadsDataDeletion`.
- Token dienkripsi (AES-GCM dengan kunci dari Secret Manager) di `integrationSecrets`.
- Deteksi kapabilitas berdasarkan scope.
- `scheduledSocialMonitoring` → `syncWorkspaceKeywords` (task queue) → simpan post dengan ID `threads_{id}` via `create()` → prefilter → `analyzePost`.
- Penanganan kuota dan rate limit Threads, `monitoringRuns`, dan TTL `expiresAt`.
- Halaman Integrations (status koneksi, scope, waktu sinkron terakhir, tombol putuskan) dan Discover (feed post nyata dengan filter).

**DoD:**
- [ ] Menjalankan sinkron dua kali tidak menghasilkan post atau analisis duplikat (dibuktikan dengan tes integrasi di emulator).
- [ ] Token tidak pernah muncul di dokumen yang bisa dibaca client, juga tidak di log.
- [ ] Token yang kedaluwarsa atau dicabut tampil sebagai status yang jelas dan menghentikan monitoring workspace tersebut.
- [ ] Workspace demo tidak pernah memanggil Threads.

---

## Fase 5 — Reply Center & CRM

**Tujuan:** draft disetujui manusia lalu dikirim lewat API jika didukung, dan lead dikelola di CRM.

**Cakupan:**
- Reply Center: antrean approval dengan informasi lengkap (SPEC §12) dan update status realtime.
- `submitReplyForApproval` dan `publishApprovedReply`, mengikuti 9 langkah di SPEC §12 (transaksi, idempotency, duplikat, batas harian, jeda per author).
- Status `unsupported` dengan tombol Buka Post Asli.
- Pembuatan lead dengan ID deterministik, Kanban, daftar dan detail lead, assign, catatan, timeline aktivitas, serta pencatatan konversi.
- Notifikasi in-app untuk draft baru, kegagalan kirim, dan lead yang di-assign.

**DoD:**
- [ ] Mengklik Approve dua kali atau memanggil function bersamaan hanya menghasilkan satu balasan (dibuktikan dengan tes).
- [ ] Status `sent` hanya tercatat setelah API mengembalikan ID yang valid. Kegagalan API menghasilkan `failed` dengan pesan yang bisa dibaca.
- [ ] Sales tidak bisa approve. Viewer tidak bisa mengubah lead.
- [ ] Tidak ada jalur kode yang bisa mengirim balasan tanpa `approvedBy`.

---

## Fase 6 — Analytics

**Tujuan:** dashboard dan laporan berbasis data nyata dengan biaya baca yang terkendali.

**Cakupan:**
- Trigger `aggregateStats`, lalu `stats/daily_{yyyymmdd}`.
- Overview dengan metrik nyata, plus halaman Analytics (harian, mingguan, bulanan, rentang kustom, dan tren).
- Funnel konversi, top keywords, top offerings, top gaya balasan, dan tracking engagement jika API menyediakannya.
- Ekspor CSV.

**DoD:**
- [ ] Laporan 90 hari membaca ≤ 90 dokumen.
- [ ] Angka di dashboard cocok dengan perhitungan manual pada data uji.
- [ ] Metrik yang tidak tersedia ditampilkan sebagai "Tidak tersedia", bukan 0.

---

## Fase 7 — Komersialisasi SaaS

**Prasyarat:** keputusan terbuka #1 dan #2 di SPEC §26.

**Cakupan:**
- Definisi plan (Free/Trial, Starter, Pro, Agency) beserta kuotanya.
- Enforcement kuota di server untuk keyword aktif, analisis AI, search, balasan per hari, dan jumlah anggota.
- Integrasi payment gateway lewat webhook yang terverifikasi, dengan status subscription hanya ditulis oleh backend.
- Halaman Billing (plan, pemakaian, invoice, upgrade/downgrade), masa trial, dan grace period.
- Manajemen tim lanjutan: transfer ownership dan penghapusan workspace (soft delete, lalu hard delete setelah 30 hari).

**DoD:**
- [ ] Webhook pembayaran idempoten dan diverifikasi tanda tangannya.
- [ ] Melewati kuota menghasilkan penolakan yang jelas di UI dan server.
- [ ] Member tidak bisa mengubah plan (dibuktikan dengan tes rules).

---

## Fase 8 — Hardening & Launch

**Cakupan:**
- Review keamanan: rules, functions, App Check enforcement, CSP header di Hosting, dan dependency audit.
- Kepatuhan: UU PDP, alur hapus akun dan data, serta pemeriksaan retensi.
- Observability: alert error, budget alert GCP dan Anthropic, serta dashboard biaya per workspace.
- Uji beban pipeline monitoring dengan jumlah workspace sintetis.
- Backup Firestore terjadwal (PITR atau export).
- Pilot dengan Publish Agency di production, mengumpulkan feedback, lalu memperbaiki temuan.

**DoD:**
- [ ] Tidak ada temuan keamanan high/critical yang terbuka.
- [ ] Runbook insiden dan rollback terdokumentasi.
- [ ] Pilot berjalan minimal 2 minggu tanpa insiden data lintas tenant.

---

## Prompt Siap Pakai untuk Agen Coding

Kirim satu fase per sesi. Template:

```
Baca AGENTS.md, docs/SPEC.md, dan docs/ROADMAP.md.
Kerjakan HANYA Fase <N> — <Nama> sesuai ROADMAP.md.
Sebelum menulis kode, tampilkan rencana singkat: berkas yang akan dibuat/diubah dan urutannya.
Setelah selesai:
1. Jalankan npm run lint, npm run typecheck, npm test, npm run test:emulator, npm run build.
2. Perbaiki semua error.
3. Centang setiap poin DoD Fase <N> beserta buktinya (nama tes/perintah). Poin yang belum terpenuhi tulis apa adanya.
4. Perbarui README (status fase) dan tulis langkah berikutnya.
Jangan mengerjakan fase lain dan jangan mengklaim fase selesai jika DoD belum terpenuhi.
```
