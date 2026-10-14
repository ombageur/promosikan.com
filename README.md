# Promosikan.com

**Temukan yang Butuh. Tawarkan yang Tepat.**

Platform AI multi-tenant untuk customer discovery dan smart promotion: menemukan calon pelanggan dari percakapan publik, mencocokkan kebutuhan dengan katalog, lalu menyiapkan balasan yang disetujui manusia.

- Spesifikasi: [docs/SPEC.md](docs/SPEC.md)
- Roadmap & Definition of Done: [docs/ROADMAP.md](docs/ROADMAP.md)
- Aturan agen coding: [AGENTS.md](AGENTS.md)

## Status

| Fase | Status |
|---|---|
| 0 — Migrasi & Fondasi | ✅ selesai |
| 1 — Auth, Workspace & RBAC | ✅ selesai |
| 2 — App Shell, Katalog & Demo Mode | ✅ selesai |
| 3 — AI Intelligence | berikutnya |

Yang sudah berfungsi:

- **Akun:** daftar/masuk dengan email atau Google, verifikasi email (wajib sebelum memakai workspace), lupa kata sandi, keluar.
- **Workspace multi-tenant:** buat workspace, workspace switcher, profil bisnis & logo, data terisolasi per workspace.
- **Tim & role** (Owner, Admin, Marketing, Sales, Viewer — matriks di `shared/permissions.ts`): undang lewat link (berlaku 7 hari, sekali pakai), ubah role, keluarkan anggota, keluar, transfer ownership. Semua perubahan tercatat di audit log.
- **Keamanan:** Firestore & Storage rules per role, Cloud Functions yang memverifikasi login, email terverifikasi, keanggotaan, dan izin.
- **Katalog & keyword (nyata di Firestore):** Products & Services, grup keyword yang ditautkan ke layanan, aktif/nonaktif keyword, dan pengaturan Automation (approval manual selalu wajib).
- **Semua halaman dashboard:** Overview, Discover, Opportunities, Smart Match, Reply Center, Leads CRM (Kanban), Analytics, Integrations, Billing. Untuk workspace nyata, halaman berbasis data AI menampilkan state kosong sampai fasenya dikerjakan — tidak ada data palsu.
- **Demo:** `/demo` publik tanpa login (data di memori browser), dan tombol **Coba workspace demo** yang membuat workspace berisi katalog Publish Agency. Semua data simulasi diberi banner **Data Demo** dan tidak pernah dikirim ke platform sosial.
- Skema data: [docs/FIRESTORE_SCHEMA.md](docs/FIRESTORE_SCHEMA.md).

## Prasyarat

- Node.js ≥ 22.13 dan npm
- Java 21+ (untuk Firebase Emulator Suite)
- Firebase CLI sudah ada sebagai devDependency (`npx firebase ...`)

## Menjalankan secara lokal

```bash
npm install                  # juga meng-install functions/ (postinstall)
cp .env.example .env.local   # VITE_USE_EMULATORS=true untuk development
npm run emulators            # Auth, Firestore, Functions, Storage, Hosting + UI di http://127.0.0.1:4000
npm run dev                  # di terminal lain → http://localhost:5173
```

Dengan `VITE_USE_EMULATORS=true`, aplikasi memakai project emulator `demo-promosikan` dan tidak menyentuh project cloud. Link verifikasi email dan reset kata sandi di emulator tidak dikirim ke inbox — buka di log terminal emulator atau di Emulator UI (tab Authentication). Login Google di emulator memakai akun tiruan. Untuk menyambung ke project nyata `promosikan-com`, isi variabel `VITE_FIREBASE_*` dari Firebase Console dan set `VITE_USE_EMULATORS=false`.

## Verifikasi

```bash
npm run lint
npm run typecheck     # app + functions
npm test              # unit test (vitest)
npm run test:emulator # Security Rules + integrasi Functions + alur e2e (butuh Java)
npm run build         # output: dist/
```

> **Windows:** jika Functions emulator gagal dengan "Cannot determine backend specification. Timeout after 10000", jalankan dengan `FUNCTIONS_DISCOVERY_TIMEOUT=60` (cold start lambat).
>
> **Windows:** setelah `npm run test:emulator`, proses Java emulator Firestore kadang tetap hidup sehingga run berikutnya gagal dengan "port taken". Hentikan dengan:
> `Get-NetTCPConnection -LocalPort 8080 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`

## Struktur

```
src/        aplikasi React (app/, pages/, components/, services/demo/, lib/firebase/)
shared/     kode yang dipakai bersama frontend & functions (skema, scoring)
functions/  Cloud Functions Gen 2, dibundel esbuild ke functions/lib
tests/rules tes Firestore & Storage rules
docs/       SPEC, ROADMAP
```

## Keamanan & konfigurasi

- Semua variabel `VITE_*` masuk ke bundle browser dan bersifat **publik**. Konfigurasi web Firebase memang publik; keamanan ditegakkan oleh Security Rules dan App Check.
- Secret (OpenAI, Threads, kunci enkripsi) **hanya** di Secret Manager: `npx firebase functions:secrets:set NAMA_SECRET`.
- Firebase Analytics sengaja belum diaktifkan sampai ada kebijakan persetujuan sesuai UU PDP.
- Konfigurasi Functions non-secret ada di `functions/.env.<project-id>` (contoh: [functions/.env.example](functions/.env.example)): `APP_URL` untuk link undangan, `ENFORCE_APP_CHECK`.

## Sebelum deploy pertama ke `promosikan-com`

1. Firebase Console → Authentication: aktifkan provider **Email/Password** dan **Google**; tambahkan domain produksi di *Authorized domains*.
2. Buat database **Firestore** dan bucket **Storage** (region sesuai keputusan #5 di SPEC §26).
3. Upgrade ke paket **Blaze** (wajib untuk Cloud Functions).
4. Buat `functions/.env.promosikan-com` dari `functions/.env.example`.
5. Opsional: pasang Firebase Extension **Trigger Email** (koleksi `mail`) agar undangan terkirim lewat email.

## Deploy

```bash
npx firebase use default                 # promosikan-com
npx firebase deploy --only hosting,firestore,storage
npx firebase deploy --only functions     # butuh paket Blaze
```

Project staging belum dibuat; tambahkan alias `staging` di `.firebaserc` setelah project-nya ada.
