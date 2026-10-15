# PROMOSIKAN.COM — Spesifikasi Produk & Teknis

**Platform AI untuk Customer Discovery, Smart Promotion & Business Growth**

| | |
|---|---|
| Brand | Promosikan.com |
| Tagline | Temukan yang Butuh. Tawarkan yang Tepat. |
| Tipe aplikasi | Multi-tenant SaaS |
| Frontend | Vite + React + TypeScript (SPA) |
| Backend | Firebase Cloud Functions Gen 2 (TypeScript) |
| Database | Cloud Firestore |
| Hosting | Firebase Hosting |
| AI | Claude API — Anthropic (hanya dari Cloud Functions) |
| Integrasi sosial pertama | Meta Threads API (resmi) |
| Bahasa default | Bahasa Indonesia |
| Bisnis pilot | Publish Agency |

Urutan pengerjaan ada di [ROADMAP.md](ROADMAP.md). Aturan untuk agen coding ada di [../AGENTS.md](../AGENTS.md).

---

## 1. Tujuan Produk

Promosikan.com membantu bisnis menemukan calon pelanggan dari percakapan publik di media sosial. Platform memahami kebutuhan mereka, mencocokkannya dengan produk atau layanan yang relevan, lalu menyiapkan pendekatan promosi yang sopan dan tepat. Setiap balasan tetap harus disetujui manusia sebelum dikirim.

**Alur inti:** Discover → Understand → Match → Connect → Promote → Convert

**Target pengguna:** UMKM, digital marketing agency, freelancer, perusahaan B2B, e-commerce, jasa profesional, serta tim sales & marketing.

**Prinsip produk:**
1. **Human-in-the-loop.** AI hanya memberi saran. Manusia yang memutuskan dan mengirim.
2. **Relevan, bukan spam.** Lebih baik tidak membalas daripada membalas secara tidak relevan.
3. **Jujur soal data.** Data demo selalu diberi label. Status "Terkirim" hanya muncul setelah API mengonfirmasi.
4. **Hanya API resmi.** Tidak ada scraping atau otomasi browser.
5. **Isolasi tenant.** Data satu workspace tidak pernah terlihat oleh workspace lain.

---

## 2. Technology Stack

### Frontend
Vite, React 19, TypeScript (strict), React Router, Tailwind CSS v4, shadcn/ui, Lucide React, Recharts, TanStack Query, React Hook Form, Zod. Gunakan function components dan custom hooks.

### Backend & Infrastruktur
Firebase Authentication, Cloud Firestore, Cloud Functions for Firebase Gen 2, Firebase Hosting, Firebase Storage, Firebase App Check, Firebase Emulator Suite, Google Cloud Secret Manager.

Untuk pekerjaan latar belakang:
- **Scheduled functions** (`onSchedule`) sebagai pemicu berkala.
- **Task queue functions** (`onTaskDispatched`, berbasis Cloud Tasks) untuk antrean, retry, dan pembatasan konkurensi.
- **Firestore triggers** (`onDocumentWritten`) untuk agregasi metrik dan efek samping ringan.

### Integrasi eksternal
Claude API (Anthropic), Meta Threads API, OAuth 2.0, dan layanan email transaksional untuk undangan anggota (misalnya Firebase Extension "Trigger Email").

### Tidak digunakan
Next.js, Prisma, PostgreSQL, Redis, BullMQ, dan server Express terpisah. Pengecualian: Express boleh dipakai *di dalam* satu `onRequest` function untuk OAuth callback dan webhook, bukan sebagai server aplikasi.

### Package manager
Gunakan **npm** dengan `package-lock.json`, baik di root maupun di `functions/`, supaya selaras dengan toolchain Firebase saat deploy (Cloud Build menjalankan `npm ci`).

---

## 3. Arsitektur

```
Baca/tulis data biasa:
React SPA ──▶ Firebase Auth ──▶ Firestore Security Rules ──▶ Firestore

Operasi sensitif (AI, integrasi, publikasi, perubahan role):
React SPA ──▶ Callable Function (Auth + App Check)
          ──▶ Validasi Zod + cek membership/permission
          ──▶ Business logic ──▶ Claude API / Threads API
          ──▶ Firestore (Admin SDK) + audit log

Monitoring berkala:
Cloud Scheduler ──▶ scheduledSocialMonitoring (fan-out)
               ──▶ Task queue: syncWorkspaceKeywords (per workspace)
               ──▶ Task queue: analyzePost (per post baru)
               ──▶ Firestore
```

**Aturan arsitektur:**
- Browser tidak pernah memegang secret dan tidak pernah memanggil Claude API atau Threads secara langsung.
- Satu scheduler melakukan fan-out ke task per workspace. Jangan membuat satu scheduler per workspace.
- Semua handler task harus **idempoten** karena Cloud Tasks bisa mengirim ulang task yang sama.
- Field yang dihasilkan backend (hasil AI, status publikasi, usage, billing) hanya boleh ditulis lewat Admin SDK.

---

## 4. Autentikasi & Otorisasi

### Fitur Auth
Login email & password, Google Sign-In, lupa password, verifikasi email (wajib sebelum bisa membuat workspace), logout, protected routes, dan persistensi sesi.

### Role
Role berlaku **per workspace** dan disimpan di `workspaces/{wid}/members/{uid}.role`.

| Permission | Owner | Admin | Marketing | Sales | Viewer |
|---|:-:|:-:|:-:|:-:|:-:|
| Lihat data workspace | ✓ | ✓ | ✓ | ✓ | ✓ |
| Kelola katalog & keyword | ✓ | ✓ | ✓ | – | – |
| Analisis AI & generate draft | ✓ | ✓ | ✓ | ✓ | – |
| Edit draft balasan | ✓ | ✓ | ✓ | ✓ | – |
| **Approve & kirim balasan** | ✓ | ✓ | ✓ | – | – |
| Kelola lead CRM (status, catatan, assign) | ✓ | ✓ | ✓ | ✓ | – |
| Kelola integrasi (Threads) | ✓ | ✓ | – | – | – |
| Pengaturan automation | ✓ | ✓ | – | – | – |
| Undang/hapus anggota, ubah role | ✓ | ✓¹ | – | – | – |
| Billing & subscription | ✓ | – | – | – | – |
| Hapus workspace / transfer ownership | ✓ | – | – | – | – |

¹ Admin tidak bisa mengubah atau menghapus Owner, dan tidak bisa mengangkat anggota menjadi Owner.

**Platform Super Admin** bukan role workspace. Super Admin ditandai dengan custom claim `platformAdmin: true` yang hanya dipasang lewat skrip Admin SDK. Super Admin dipakai untuk dukungan pelanggan, dan setiap aksesnya tercatat di audit log.

**Aturan:**
- Role yang dikirim dari frontend tidak boleh dipercaya. Rules dan functions selalu membaca role dari Firestore.
- Matriks permission didefinisikan **sekali** di `shared/permissions.ts`. Modul ini dipakai frontend (untuk menyembunyikan UI) dan functions (untuk enforcement). Firestore rules mencerminkan matriks yang sama, dan tes rules memverifikasinya.

---

## 5. Multi-Tenant Workspace

**Data workspace:** nama workspace, nama bisnis, logo (Storage), industri, website, deskripsi, lokasi, kontak, brand voice, bahasa utama, `plan`, `isDemo`, `createdAt`, `ownerId`.

**Fitur:** buat, edit, undang anggota lewat email, terima undangan, kelola anggota, ubah role, pindah workspace (workspace switcher), dan pengaturan.

**Isolasi:**
- Seluruh data bisnis berada di bawah `workspaces/{wid}/...`.
- Setiap function menerima `workspaceId`, lalu memverifikasi membership dan permission sebelum melakukan apa pun.
- Workspace aktif disimpan di URL (`/w/:workspaceId/...`) supaya link bisa dibagikan dan tab berbeda bisa membuka workspace berbeda.

---

## 6. Katalog Produk & Layanan

Produk dan layanan disimpan dalam **satu koleksi** `offerings` dengan field `type: "product" | "service"`. Koleksi `products` dan `services` yang terpisah tidak diperlukan karena field-nya sama dan matching harus membaca keduanya sekaligus.

| Field | Tipe | Keterangan |
|---|---|---|
| name | string | wajib |
| type | `product` \| `service` | wajib |
| category | string | |
| description | string | maks. 1.000 karakter |
| benefits | string[] | |
| targetAudience | string | |
| problemsSolved | string[] | dipakai matching |
| keywords | string[] | dipakai matching & saran keyword |
| priceRange | string | opsional, teks bebas |
| usp | string | Unique Selling Proposition |
| landingPageUrl | string (URL) | |
| allowedClaims | string[] | klaim yang boleh disebut AI (lihat §11) |
| isActive | boolean | hanya item aktif yang dipakai matching |

**Contoh (Publish Agency):** layanan *SEO Management*. Target: pemilik bisnis. Masalah yang diselesaikan: traffic organik rendah. Keywords: jasa SEO, traffic website, ranking Google, optimasi website.

---

## 7. Overview Dashboard

**Metrik:** percakapan ditemukan, peluang potensial, high-intent leads, peluang ter-match, draft AI, balasan terkirim, lead engaged, pelanggan terkonversi, conversion rate.

**Komponen:** grafik pertumbuhan peluang, funnel konversi lead, peluang terbaru, top keywords, top layanan, draft yang menunggu approval, dan aktivitas terbaru.

Semua metrik dibaca dari dokumen agregat `stats/*` (§14). Dashboard tidak boleh menghitung ulang dari koleksi mentah.

---

## 8. Social Listening (Discover)

### Manajemen keyword
Tambah, edit, hapus, kelompokkan (keyword group), aktif/nonaktifkan monitoring, dan tautkan keyword ke `offeringId`. Jumlah keyword aktif dibatasi oleh plan.

**Contoh grup:**
- SEO: "butuh jasa SEO", "cari agency SEO", "website sepi pengunjung"
- Website: "cari jasa website", "butuh website perusahaan", "website company profile"
- Digital Marketing: "cari digital agency", "butuh jasa iklan", "rekomendasi agency"
- Influencer: "cari KOL", "butuh influencer", "agency KOL"

### Alur monitoring
1. `scheduledSocialMonitoring` berjalan sesuai interval terpendek yang diizinkan.
2. Function mengambil workspace yang monitoring-nya aktif, punya akun Threads terhubung, dan sudah jatuh tempo (`nextRunAt <= now`).
3. Untuk tiap workspace, function membuat task `syncWorkspaceKeywords`.
4. Task memanggil endpoint keyword search Threads dengan token akun workspace tersebut, sambil menghormati kuota API dan kuota plan.
5. Setiap post disimpan dengan ID deterministik `threads_{platformPostId}`. Penulisan memakai `create()` supaya duplikat gagal dengan aman.
6. Hanya post baru yang dikirimi task `analyzePost`.
7. `monitoringRuns/{runId}` mencatat jumlah post ditemukan, post baru, error, dan kuota yang terpakai.

### Prefilter (hemat biaya)
Sebelum memanggil AI, buang post yang terlalu pendek, berbahasa di luar target, milik akun workspace sendiri, atau berasal dari author yang ada di daftar blokir. Post yang lolos baru dianalisis.

### Analisis Manual
Pengguna dapat menempelkan teks post atau URL secara manual untuk dianalisis. Fitur ini memberi nilai sebelum integrasi Threads disetujui Meta, dan sekaligus berguna untuk platform yang belum didukung.

---

## 9. AI Intent Detection & Opportunity Scoring

AI hanya mengembalikan **sub-skor dan alasan**. **Skor akhir dihitung di kode** (fungsi murni di `shared/scoring.ts`) supaya hasilnya deterministik, bisa dites, dan tidak bisa "dikarang" oleh model.

### Output AI (structured outputs Claude + validasi Zod)
```ts
{
  language: string,
  isCommercialIntent: boolean,
  customerProblem: string,          // ringkas, Bahasa Indonesia
  intentType: "active_search" | "asking_recommendation" | "problem_aware" | "comparing" | "general_discussion",
  subScores: {
    buyingIntent: 0-100,
    productRelevance: 0-100,
    urgency: 0-100,
    problemClarity: 0-100,
    conversationSuitability: 0-100  // pantas dibalas oleh bisnis?
  },
  reasons: string[],                // penjelasan per sub-skor
  redFlags: string[]                // mis. keluhan sensitif, minor, topik terlarang
}
```

### Bobot skor
| Komponen | Bobot |
|---|---|
| Buying Intent | 30% |
| Product Relevance | 30% |
| Urgency | 15% |
| Problem Clarity | 15% |
| Conversation Suitability | 10% |

### Klasifikasi
| Skor | Kelas |
|---|---|
| 80–100 | High Opportunity |
| 60–79 | Medium Opportunity |
| 40–59 | Low Opportunity |
| 0–39 | Not Qualified |

Jika `redFlags` tidak kosong, peluang ditandai **Perlu review manual** dan tidak bisa dibalas dengan draft AI tanpa disunting terlebih dulu.

---

## 10. Smart Match Engine

1. Ambil masalah pelanggan dari hasil analisis.
2. Ambil kandidat offering aktif. Pada tahap awal katalog cukup kecil sehingga bisa dikirim seluruhnya. Jika katalog lebih dari 30 item, saring dulu berdasarkan overlap keyword/kategori (embedding bisa ditambahkan nanti).
3. AI menilai relevansi tiap kandidat dan mengembalikan `matchScore` 0–100 beserta alasannya.
4. Simpan maksimal 3 kandidat teratas beserta pendekatan yang direkomendasikan (consultative, helpful, soft selling, dan sebagainya).

**Contoh:** post "Butuh agency yang bisa bantu meningkatkan penjualan toko online." → match: *Google Ads Management*, skor 92, pendekatan: Consultative Reply.

**Aturan:** jika tidak ada kandidat dengan `matchScore` di atas ambang workspace (default 60), hasilnya **"Tidak ada yang cocok"**. Jangan memaksakan pencocokan.

---

## 11. Smart Promotion Studio (AI Reply Generator)

**Input:** post asli, masalah pelanggan, offering ter-match, profil bisnis, brand voice, gaya balasan.

**Gaya balasan:** Friendly, Professional, Consultative, Helpful, Soft Selling.

**Aksi:** Generate, Regenerate, Edit, Persingkat, Ganti nada, Simpan draft, Ajukan approval, Lewati.

**Contoh:**
> Post: "Butuh agency buat naikin traffic website."
> Draft: "Boleh tahu websitenya bergerak di bidang apa? Biasanya strategi meningkatkan traffic bisa berbeda tergantung target market dan kondisi SEO sebelumnya."

### Guardrails (wajib)
- **Prompt injection.** Teks post adalah input tidak tepercaya. Bungkus dalam delimiter, dan jangan pernah ikuti instruksi yang ada di dalamnya.
- **Tanpa klaim palsu.** AI hanya boleh menyebut fakta dari profil bisnis dan `allowedClaims`. Tidak boleh menjanjikan hasil ("pasti ranking 1"), menyebut harga yang tidak ada di katalog, atau mengarang testimoni.
- **Batas panjang** mengikuti batas karakter Threads, dengan default ≤ 300 karakter.
- **Reply Quality Validation.** Draft melewati pemeriksaan kedua sebelum boleh di-approve: relevansi, nada, klaim, kemiripan dengan balasan sebelumnya (anti-template-spam), dan bahasa. Hasil validasi ditampilkan ke reviewer.
- **Fallback.** Jika Claude API gagal atau menolak (refusal), tampilkan error yang jelas dan sediakan template manual. Jangan pernah mengirim draft kosong atau setengah jadi.

---

## 12. Reply Approval Center

**Informasi per item:** post asli, username, platform, tanggal posting, opportunity score, offering ter-match, draft AI, hasil quality check, dan **kelayakan publikasi** (apakah API mengizinkan membalas post ini).

**Aksi:** Regenerate, Edit, Approve & Reply, Lewati, Buka Post Asli.

### Status draft
`draft → pending_approval → approved → sending → sent | failed | unsupported`, ditambah `skipped`.

### Alur `publishApprovedReply` (Callable)
1. Verifikasi Auth dan App Check.
2. Verifikasi membership dan permission `reply.publish`.
3. Tolak jika workspace `isDemo`.
4. Verifikasi kelayakan publikasi. Jika tidak layak, set `unsupported` dan tampilkan tombol **Buka Post Asli** supaya pengguna bisa membalas manual.
5. **Transaksi:** cek idempotency key (`replyAttempts/{draftId}_{n}`), cek duplikat (sudah ada balasan `sent` ke post yang sama?), cek kuota harian, lalu set status `sending`.
6. Kirim lewat Threads API.
7. Simpan respons API (ID reply, permalink, error) di `replyAttempts`.
8. Set status `sent` **hanya** setelah API mengembalikan ID media yang valid. Jika gagal, set `failed` dengan pesan error yang bisa dibaca pengguna.
9. Perbarui status lead menjadi `replied` dan tulis audit log.

Retry otomatis maksimal 3 kali, hanya untuk error yang bersifat sementara (5xx atau rate limit). Error 4xx tidak di-retry.

---

## 13. Lead Management CRM

**Pembuatan lead:** lead dibuat ketika sebuah peluang di-approve untuk dibalas, atau ketika pengguna menekan "Jadikan Lead". ID lead deterministik `{platform}_{authorId}`, sehingga satu orang yang muncul di banyak post tetap menjadi satu lead.

**Status:** Discovered, Qualified, Matched, Reply Drafted, Replied, Engaged, Contacted, Negotiation, Converted, Lost.

**Fitur:** daftar lead dengan pencarian, filter, dan pagination; detail lead; Kanban pipeline; assign ke anggota; catatan internal; timeline aktivitas (subkoleksi, bukan array); pencatatan konversi (nilai deal opsional).

**Realtime:** gunakan `onSnapshot` hanya untuk Reply Center (status pengiriman), notifikasi, dan Kanban yang sedang dibuka. Halaman lain memakai TanStack Query dengan `getDocs` dan cursor pagination.

---

## 14. Struktur Firestore

### Koleksi global
```
users/{uid}                                  profil, lastWorkspaceId
invitations/{inviteId}                       email, workspaceId, role, tokenHash, expiresAt   (backend-only write)
integrationSecrets/{workspaceId}_{accountId} token OAuth terenkripsi                          (deny all untuk client)
```

### Subkoleksi workspace
```
workspaces/{wid}
  members/{uid}                role, joinedAt, displayName (denormalisasi)
  offerings/{offeringId}
  keywordGroups/{groupId}
  keywords/{keywordId}         term, groupId, offeringId, isActive
  socialAccounts/{accountId}   platform, username, status, scopes, capabilities (tanpa token)
  socialPosts/{platform_postId} teks, author, permalink, postedAt, keywordIds, expiresAt
  opportunities/{oppId}        postId, analysis{}, score, band, topMatches[≤3], status
  replyDrafts/{draftId}        oppId, text, style, quality{}, status, approvedBy
  replyAttempts/{attemptId}    draftId, request, response, status, error
  leads/{platform_authorId}    status, assigneeId, value, lastActivityAt
  leads/{leadId}/activities/{activityId}
  monitoringRuns/{runId}
  settings/automation          satu dokumen
  usage/{yyyy-mm}              counter AI token, biaya, search, reply (backend-only)
  stats/daily_{yyyymmdd}       agregat harian untuk dashboard & analytics
  auditLogs/{logId}            backend-only, immutable
```

**Perubahan dari draf awal:**
- `products` dan `services` digabung menjadi `offerings`.
- `workspaceMembers` global diganti `workspaces/{wid}/members/{uid}` supaya rules cukup memakai `exists()` dengan satu path yang deterministik. Untuk menampilkan daftar workspace milik seorang user, gunakan collection group query `members` dengan `uid == auth.uid` (field `uid` disimpan juga di dalam dokumen).
- `leadAnalysis` dan `productMatches` ditanam di `opportunities`, karena selalu dibaca bersamaan dan ukurannya kecil. Riwayat panggilan AI dicatat di `usage` dan log terstruktur.
- `leadActivities` dipindah menjadi subkoleksi lead.
- `automationSettings` cukup satu dokumen `settings/automation`.

### Aturan database
- Gunakan `serverTimestamp()` untuk semua timestamp.
- Semua list harus dipaginasi dengan `limit()` dan `startAfter()`. Tidak boleh ada query tanpa batas.
- Gunakan ID deterministik untuk deduplikasi (post, lead, attempt).
- Gunakan transaksi untuk publikasi, counter kuota, dan perubahan role.
- Tidak boleh ada array yang terus membesar di satu dokumen. Gunakan subkoleksi.
- Retensi: `socialPosts` yang Not Qualified dihapus setelah 30 hari, sisanya setelah 180 hari (dapat dikonfigurasi). Gunakan TTL policy Firestore pada `expiresAt`.
- Semua composite index dicatat di `firestore.indexes.json`.

---

## 15. Firestore & Storage Security Rules

- Hanya pengguna terautentikasi dengan email terverifikasi yang dapat mengakses data privat.
- Baca data workspace hanya jika `exists(/workspaces/{wid}/members/{request.auth.uid})`.
- Izin tulis mengikuti matriks role di §4. Viewer tidak bisa menulis apa pun.
- Field yang dikelola backend tidak boleh diubah client. Contoh: `analysis`, `score`, `topMatches`, status `sending/sent/failed`, `plan`, `usage`, `stats`, `role`, dan `ownerId`. Terapkan dengan `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`.
- `auditLogs`, `usage`, `replyAttempts`, `invitations`, dan `integrationSecrets` tidak bisa ditulis oleh client.
- `socialAccounts` hanya berisi metadata. Token tidak pernah disimpan di dokumen yang dapat dibaca client.
- Storage: logo hanya di `workspaces/{wid}/logo/*`, berupa gambar ≤ 2 MB, dan hanya Owner/Admin yang boleh menulis.
- **Tes rules wajib** dengan `@firebase/rules-unit-testing` di emulator. Tes harus mencakup setiap role × setiap koleksi, akses lintas workspace, dan percobaan menulis field yang dilindungi.

---

## 16. Cloud Functions

| Domain | Function | Tipe |
|---|---|---|
| Workspace | `createWorkspace`, `updateMemberRole`, `removeMember`, `inviteMember`, `acceptInvitation`, `transferOwnership` | Callable |
| Demo | `createDemoWorkspace` | Callable |
| AI | `analyzeConversation` (manual), `generateReply`, `validateReply` | Callable |
| AI (background) | `analyzePost` (analisis + matching) | Task queue |
| Threads | `startThreadsOAuth` | Callable |
| | `threadsOAuthCallback`, `threadsDeauthorize`, `threadsDataDeletion` | onRequest |
| | `disconnectThreads` | Callable |
| | `refreshThreadsTokens` | Scheduled (harian) |
| Discovery | `scheduledSocialMonitoring` | Scheduled |
| | `syncWorkspaceKeywords` | Task queue |
| Replies | `submitReplyForApproval`, `publishApprovedReply` | Callable |
| Analytics | `aggregateStats` | Firestore trigger |
| Maintenance | `cleanupExpiredData` (melengkapi TTL) | Scheduled |

Perhitungan skor **bukan** function terpisah, melainkan fungsi murni di `shared/scoring.ts`.

**Wajib untuk setiap function:**
- Callable: `enforceAppCheck: true`. Validasi `request.auth` dan email terverifikasi.
- Validasi input dengan Zod. Skema input dan output disimpan di `shared/` supaya dipakai frontend dan backend.
- Satu helper `requirePermission(wid, uid, permission)` dipakai di semua function.
- Gunakan `HttpsError` dengan kode yang tepat dan pesan berbahasa Indonesia.
- Logging terstruktur (`firebase-functions/logger`) dengan `workspaceId`, `uid`, dan `requestId`, tanpa token dan tanpa teks pribadi lengkap.
- Rate limit per user/workspace memakai counter Firestore (token bucket per menit).
- Idempotency untuk operasi yang berefek ke luar.
- Retry terbatas dengan backoff hanya di task queue (`retryConfig`).
- Secret diakses lewat `defineSecret()` dari Secret Manager.
- Region default `asia-southeast2` (Jakarta), dengan catatan: verifikasi dulu ketersediaan fitur (misalnya Scheduler dan Tasks) di region tersebut.

---

## 17. Integrasi Claude API (Anthropic)

**Kapabilitas:** klasifikasi intent, deteksi masalah, sub-skor peluang, product matching, pembuatan draft balasan, dan validasi kualitas balasan.

**SDK & akses:**
- Gunakan SDK resmi `@anthropic-ai/sdk`, hanya di dalam Cloud Functions. Endpoint yang dipakai adalah `POST /v1/messages`.
- API key `ANTHROPIC_API_KEY` disimpan di Secret Manager dan dibaca lewat `defineSecret()`.
- Jangan memakai shim yang kompatibel dengan OpenAI.

**Model:**
- Default `claude-opus-5-5` ($4 input / $20 output per 1 juta token; cache read $0,20).
- Nama model disimpan sebagai konfigurasi (`CLAUDE_MODEL`), bukan hardcode, supaya bisa diganti tanpa mengubah kode.
- Model yang lebih murah untuk rute tertentu (misalnya Claude Haiku 5.5 untuk prefilter) adalah keputusan terbuka #7. Keputusan itu harus diambil berdasarkan hasil eval, bukan asumsi.

**Aturan pemanggilan (berlaku untuk Claude Opus 5.5):**
- **Effort per rute, selalu diset eksplisit** lewat `output_config.effort`, karena default di Opus 5.5 adalah `medium`. Gunakan `low` untuk analisis dan matching, dan `medium` untuk draft balasan. Thinking tidak bisa dimatikan di model ini; effort adalah satu-satunya pengatur.
- **Structured outputs** lewat `output_config.format` (JSON Schema dari skema Zod di `shared/`). Hasilnya divalidasi ulang dengan Zod sebelum disimpan.
- Fitur berikut tidak dipakai, karena ditolak di model ini: prefill assistant, forced `tool_choice` (`any`/`tool`), dan `temperature`.
- **Penanganan refusal:**
  - Selalu periksa `stop_reason` sebelum membaca konten.
  - Aktifkan fallback server-side (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`).
  - Jika seluruh rantai tetap menolak (`stop_reason: "refusal"`), tandai peluang sebagai **Perlu review manual**, tanpa draft.
- **Error:** tangkap error SDK per jenisnya. `RateLimitError` dan 5xx di-retry dengan batas (SDK default 2 kali, ditambah retry task queue). `BadRequestError` tidak di-retry dan dicatat.

**Optimasi biaya:**
- Analisis dan matching dijalankan dalam **satu panggilan** per post.
- **Prompt caching:** instruksi sistem, profil bisnis, dan katalog diletakkan di awal prompt dengan `cache_control`, sedangkan teks post diletakkan paling akhir. Prefix tidak boleh memuat timestamp atau ID. Efektivitasnya diverifikasi lewat `usage.cache_read_input_tokens`.
- **Message Batches API** (biaya 50% lebih murah, asinkron) dipakai untuk analisis hasil monitoring terjadwal di Fase 4, karena latensinya tidak kritis. Analisis manual dan draft balasan memakai panggilan biasa.
- Draft balasan dibuat **sesuai permintaan** (saat pengguna membuka peluang) atau otomatis hanya untuk skor ≥ ambang. Jangan membuat draft untuk semua post.
- Hasil di-cache berdasarkan `postId` + versi prompt + `updatedAt` katalog. Jangan menganalisis ulang tanpa alasan.
- Teks post dibatasi maksimal 2.000 karakter. Post yang lebih panjang ditandai, bukan dipotong diam-diam.
- Kuota AI per workspace per bulan sesuai plan. Panggilan ditolak dengan pesan jelas jika kuota habis.
- Catat token input, output, cache write, dan cache read beserta estimasi biaya di `usage/{yyyy-mm}`.
- Versi prompt disimpan di kode (`functions/src/ai/prompts/*.ts`) dan dicatat di setiap hasil analisis.

**Keamanan:** API key hanya ada di Secret Manager. Tidak boleh ada variabel `VITE_*` yang berisi secret, dan semua variabel `VITE_*` dianggap publik.

---

## 18. Integrasi Meta Threads API

> ⚠️ **Verifikasi dokumentasi resmi terbaru sebelum implementasi.** Endpoint, permission, kuota, dan persyaratan App Review bisa berubah. Catat hasil verifikasi (tanggal, endpoint, permission, dan batasan) di `docs/THREADS_API_NOTES.md` sebelum menulis kode integrasi.

**Yang diimplementasikan:**
- OAuth authorization dengan parameter `state` (anti-CSRF, disimpan di server, kedaluwarsa dalam 10 menit).
- Penukaran token, lalu penukaran ke long-lived token, lalu refresh terjadwal sebelum kedaluwarsa.
- Deteksi kapabilitas: simpan scope yang benar-benar diberikan di `socialAccounts.capabilities`. UI menyesuaikan diri berdasarkan kapabilitas ini.
- Keyword search (jika permission tersedia), pengambilan post, dan publikasi balasan (jika diizinkan untuk post tersebut).
- Penanganan rate limit dengan membaca header atau endpoint kuota jika tersedia, plus backoff.
- Endpoint wajib aplikasi Meta: **deauthorize callback** dan **data deletion callback**.
- Status koneksi: `connected`, `expired`, `revoked`, `error`.

**Jangan mengasumsikan:** semua post bisa dicari, semua post bisa dibalas, semua permission disetujui, atau semua akun punya fitur yang sama. Kuota search kemungkinan dihitung **per akun pengguna**, jadi rancang penjadwalan berdasarkan kuota tersebut.

**Ketergantungan non-teknis:** App Review dari Meta (termasuk screencast, privacy policy, dan terms of service) memerlukan waktu. Mulai prosesnya sejak Fase 3 supaya Fase 4 tidak terblokir.

---

## 19. Automation Settings

Disimpan di dokumen `settings/automation`:

| Pengaturan | Default |
|---|---|
| Monitoring aktif | nonaktif |
| Interval monitoring | 60 menit (minimum mengikuti plan) |
| Skor peluang minimum | 60 |
| Skor match minimum | 60 |
| Gaya balasan default | Consultative |
| Mode approval manual | **selalu aktif** (tidak bisa dimatikan di versi ini) |
| Batas balasan harian | 20 |
| Jeda balasan ke author yang sama | 7 hari |
| Deteksi duplikat | aktif |
| Notifikasi (in-app/email) | in-app aktif |

**Auto-reply tidak disediakan** di versi ini. Kode boleh menyiapkan abstraksi untuk masa depan, tetapi tidak boleh ada jalur kode yang mengirim balasan tanpa `approvedBy` dari manusia.

---

## 20. Analytics

**Metrik:** percakapan ditemukan, peluang qualified, rata-rata skor, product match rate, balasan di-approve, balasan terkirim, engagement rate, lead conversion rate, top keywords, top offerings, dan top gaya balasan.

**Laporan:** harian, mingguan, bulanan, dan rentang kustom (maksimal 365 hari).

**Implementasi:** trigger `aggregateStats` menaikkan counter di `stats/daily_{yyyymmdd}` dengan `FieldValue.increment()`. Laporan membaca paling banyak 365 dokumen harian. Tidak boleh ada scan koleksi mentah.

**Engagement** (like/reply atas balasan kita) hanya dilacak jika API menyediakan insight untuk post tersebut. Jika tidak tersedia, tampilkan "Tidak tersedia". Jangan menampilkan angka nol yang menyesatkan.

---

## 21. Demo Mode

Demo Mode punya dua bentuk:
1. **Demo publik `/demo`** (tanpa login). Datanya berasal dari fixtures statis di frontend lewat abstraksi `DataSource` (repository pattern), sehingga halaman yang sama bisa membaca dari demo atau dari Firestore.
2. **Workspace demo.** `createDemoWorkspace` membuat workspace dengan `isDemo: true` dan mengisi data contoh, sehingga pengguna bisa mencoba alur penuh dengan akun mereka sendiri.

**Data:** Publish Agency, industri Digital Marketing. Layanan: SEO Management, Google Ads, Social Media Management, Website Development, Influencer Marketing.

**Percakapan contoh:**
- "Ada rekomendasi agency SEO Surabaya?"
- "Cari KOL buat campaign skincare."
- "Butuh website company profile."
- "Agency digital marketing yang bagus apa ya?"
- "Ada yang bisa bantu Google Ads?"
- "Website toko online saya traffic-nya turun."

**Output yang ditampilkan:** analisis intent, opportunity score, offering ter-match, match score, draft balasan, dan status CRM.

**Aturan:**
- Banner **"Data Demo"** selalu terlihat.
- Nama dan handle author adalah fiktif.
- Server menolak publikasi dan pemanggilan Threads untuk `isDemo`. Pemblokiran ini tidak boleh hanya mengandalkan UI.
- Fixtures demo saat ini ada di `src/lib/demo.ts` (codebase lama) dan perlu dipindahkan.

---

## 22. UI/UX

**Warna:** Primary Blue `#2563EB`, Dark Navy `#0F172A`, Soft Blue `#EFF6FF`, Success Green `#16A34A`, Background `#F8FAFC`, White `#FFFFFF`, Border `#E2E8F0`. Tambahkan juga Warning `#D97706` dan Danger `#DC2626` untuk status gagal dan red flag.

**Tipografi:** Plus Jakarta Sans.

**Layout:** sidebar responsif (menjadi drawer di mobile), top bar, workspace switcher, notification center, menu profil, kartu, tabel data, grafik, dialog, toast, loading skeleton, empty state, dan error state di setiap halaman.

**Sidebar (dikelompokkan):**
- **Utama:** Overview, Discover, Opportunities, Smart Match, Reply Center, Leads CRM, Analytics
- **Konfigurasi:** Products & Services, Automation, Integrations
- **Workspace:** Workspace Settings, Billing (hanya terlihat oleh Owner)

Menu yang tidak diizinkan oleh role disembunyikan. Aksi yang tidak diizinkan dinonaktifkan dan diberi tooltip penjelasan.

**Aksesibilitas:** kontras AA, navigasi keyboard, label form, dan fokus yang terlihat.

**Bahasa:** Bahasa Indonesia sebagai default. Semua teks UI dikumpulkan di satu tempat supaya mudah menambah bahasa lain nanti.

---

## 23. Struktur Folder

```
promosikan.com/
├─ src/
│  ├─ app/              # router, providers, layout root
│  ├─ components/
│  │  ├─ ui/            # shadcn
│  │  ├─ layout/
│  │  ├─ dashboard/
│  │  ├─ discovery/
│  │  ├─ opportunities/
│  │  ├─ replies/
│  │  └─ crm/
│  ├─ pages/
│  ├─ hooks/
│  ├─ contexts/         # AuthContext, WorkspaceContext
│  ├─ services/         # DataSource: firestore/ & demo/
│  ├─ lib/firebase/     # init, emulator connect, app check
│  ├─ types/
│  └─ utils/
├─ shared/              # Zod schemas, permissions, scoring (dipakai src & functions)
├─ functions/
│  └─ src/
│     ├─ auth/  workspace/  ai/  threads/  discovery/
│     ├─ matching/  replies/  analytics/  scheduled/  utils/
├─ tests/rules/         # tes Firestore & Storage rules
├─ docs/                # SPEC, ROADMAP, FIRESTORE_SCHEMA, THREADS_API_NOTES
├─ public/
├─ firestore.rules  firestore.indexes.json  storage.rules
├─ firebase.json  .firebaserc
├─ vite.config.ts  tsconfig.json  package.json
├─ .env.example  AGENTS.md  README.md
```

`shared/` adalah tempat tunggal untuk skema dan aturan bisnis yang dipakai kedua sisi. Folder ini dibundel ke `functions/` saat build (misalnya lewat path alias dan esbuild, atau npm workspace).

---

## 24. Environment & Deployment

- **Tiga project Firebase terpisah:** `promosikan-dev` (emulator dan uji coba), `promosikan-staging`, dan `promosikan-prod`, dengan alias di `.firebaserc`.
- Konfigurasi frontend memakai `.env.development`, `.env.staging`, dan `.env.production`. Isinya hanya konfigurasi web Firebase yang memang publik.
- Secret per project ada di Secret Manager: `ANTHROPIC_API_KEY`, `THREADS_APP_ID`, `THREADS_APP_SECRET`, dan `TOKEN_ENCRYPTION_KEY`.
- Hosting: output Vite `dist/`, dengan rewrite `** → /index.html` untuk SPA. Tambahkan juga rewrite `/oauth/threads/callback` ke function.
- CI (GitHub Actions): lint, typecheck, unit test, tes rules di emulator, dan build. Deploy ke staging dari `main`. Deploy ke production melalui tag atau persetujuan manual.
- Monitoring: Cloud Logging, error alert untuk function yang gagal, dan budget alert di GCP serta Anthropic Console (batas pengeluaran workspace API).

---

## 25. Privasi, Kepatuhan & Etika

- Patuhi **UU No. 27/2022 tentang Pelindungan Data Pribadi (UU PDP)**: tujuan pemrosesan yang jelas, retensi terbatas, hak hapus, dan kebijakan privasi publik.
- Patuhi **Meta Platform Terms** dan **Developer Policies**. Data Threads hanya dipakai untuk tujuan yang dideklarasikan saat App Review.
- Hanya simpan data post yang diperlukan. Jangan membangun profil personal di luar konteks bisnis.
- Teks post dikirim ke Claude API (Anthropic) untuk dianalisis. Kirim seminimal mungkin (tanpa data akun yang tidak perlu), tinjau kebijakan retensi data Anthropic untuk organisasi API, dan sebutkan pemrosesan oleh penyedia AI di Kebijakan Privasi.
- Saat akun Threads diputus atau callback penghapusan data diterima, hapus token dan data terkait sesuai kebijakan.
- Tolak atau tandai percakapan sensitif: kesehatan pribadi, keuangan pribadi yang rentan, anak di bawah umur, duka, dan konflik.
- Halaman publik **Kebijakan Privasi** dan **Syarat Layanan** wajib ada sebelum App Review.

---

## 26. Keputusan Terbuka

Perlu diputuskan pemilik produk sebelum fase terkait dimulai:

| # | Keputusan | Fase |
|---|---|---|
| 1 | Payment gateway (misalnya Midtrans atau Xendit) dan model harga (bulanan/tahunan, mata uang IDR) | 7 |
| 2 | Daftar plan beserta kuotanya (keyword aktif, analisis AI/bulan, balasan/hari, jumlah anggota) | 7 |
| 3 | Layanan email transaksional untuk undangan dan notifikasi — **sementara:** koleksi `mail` (format Trigger Email) + link undangan manual; penyedia SMTP belum dipilih | 1 |
| 4 | Domain produksi dan email pengirim | 1 |
| 5 | Region Firebase/Functions final (`asia-southeast2` vs `asia-southeast1`) | 0 |
| 6 | Platform sosial berikutnya setelah Threads | setelah 8 |
| 7 | Model Claude per rute: tetap `claude-opus-5-5` di semua rute, atau model lebih murah (mis. Claude Haiku 5.5) untuk prefilter/analisis. Data eval Fase 3: Opus 5.5 effort low → akurasi 94–100%, ±US$0,012 per analisis. Bandingkan dengan `CLAUDE_MODEL=claude-haiku-5-5 npm run eval:ai -- --yes` sebelum memutuskan | 3–4 |
