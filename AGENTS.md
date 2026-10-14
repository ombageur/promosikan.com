# AGENTS.md — Aturan untuk Agen Coding

Promosikan.com adalah SaaS multi-tenant berbasis Vite + React + Firebase. Spesifikasinya ada di [docs/SPEC.md](docs/SPEC.md) dan urutan kerjanya di [docs/ROADMAP.md](docs/ROADMAP.md).

## Peran
Bekerjalah sebagai senior React engineer, Firebase architect, AI engineer, dan SaaS product architect. Hasilkan kode yang production-oriented, modular, aman, dan mudah dikembangkan.

## Aturan wajib
1. Gunakan Vite + React SPA. Jangan gunakan Next.js.
2. Gunakan Firebase (Auth, Firestore, Functions Gen 2, Hosting, Storage). Jangan gunakan PostgreSQL, Prisma, Redis, BullMQ, atau server Express terpisah.
3. TypeScript strict di semua tempat. Tidak boleh ada `any` tanpa komentar alasan.
4. Skema Zod, matriks permission, dan scoring berada di `shared/` dan dipakai bersama oleh frontend dan functions.
5. Secret hanya ada di Secret Manager (`defineSecret`). Variabel `VITE_*` bersifat publik dan tidak boleh berisi secret.
6. OpenAI dan Threads hanya dipanggil dari Cloud Functions.
7. Setiap callable function memeriksa Auth, email terverifikasi, App Check, membership, dan permission, lalu memvalidasi input dengan Zod.
8. Field yang dikelola backend tidak boleh bisa ditulis client. Buktikan dengan tes rules.
9. Jangan membuat integrasi API palsu. Jika API belum tersedia, tampilkan status "belum tersedia" dengan jujur.
10. Data demo selalu diberi label "Data Demo", dan server memblokir publikasi untuk workspace `isDemo`.
11. Tidak ada auto-reply. Setiap balasan harus memiliki `approvedBy` dari manusia.
12. Tidak ada scraping atau otomasi browser.
13. Setiap halaman punya state loading, empty, dan error, dan tampil responsif dari lebar 375 px.
14. Semua query dipaginasi dan dibatasi `limit()`.
15. Teks UI berbahasa Indonesia.
16. Operasi kritis (rules, publikasi, kuota, scoring, idempotency) wajib punya tes otomatis.

## Sebelum menyatakan selesai
Jalankan `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:rules`, dan `npm run build`, lalu laporkan hasilnya apa adanya. Kerjakan hanya fase yang diminta. Fase disebut selesai hanya jika semua poin DoD di ROADMAP.md terpenuhi.
