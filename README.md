# Promosikan.com

**Temukan yang Butuh. Tawarkan yang Tepat.**

Platform AI multi-tenant untuk customer discovery dan smart promotion: menemukan calon pelanggan dari percakapan publik, mencocokkan kebutuhan dengan katalog, lalu menyiapkan balasan yang disetujui manusia.

- Spesifikasi: [docs/SPEC.md](docs/SPEC.md)
- Roadmap & Definition of Done: [docs/ROADMAP.md](docs/ROADMAP.md)
- Aturan agen coding: [AGENTS.md](AGENTS.md)

## Status

**Fase 0 — Migrasi & Fondasi: selesai.** Belum ada fitur produk nyata (login, workspace, AI, Threads). Yang tersedia:

- Vite + React 19 + TypeScript strict, Tailwind v4, React Router, TanStack Query, Zod.
- Beranda dan **demo publik `/demo`** (Publish Agency). Semua data di demo adalah **data simulasi** dari fixtures, disimpan di `localStorage` browser, dan tidak pernah mengirim apa pun ke platform sosial.
- `shared/scoring.ts`: perhitungan opportunity score (SPEC §9) beserta tes.
- Cloud Functions Gen 2 (`functions/`) dengan endpoint `health`.
- Firestore & Storage rules yang **menolak semua akses client** (aturan per koleksi mulai Fase 1) beserta tes di emulator.

Fase berikutnya: **Fase 1 — Auth, Workspace & RBAC**.

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

Dengan `VITE_USE_EMULATORS=true`, aplikasi memakai project emulator `demo-promosikan` dan tidak menyentuh project cloud. Untuk menyambung ke project nyata `promosikan-com`, isi variabel `VITE_FIREBASE_*` dari Firebase Console dan set `VITE_USE_EMULATORS=false`.

## Verifikasi

```bash
npm run lint
npm run typecheck     # app + functions
npm test              # unit test (vitest)
npm run test:rules    # tes Security Rules di emulator
npm run build         # output: dist/
```

> **Windows:** setelah `npm run test:rules`, proses Java emulator Firestore kadang tetap hidup sehingga run berikutnya gagal dengan "port taken". Hentikan dengan:
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

## Deploy

```bash
npx firebase use default                 # promosikan-com
npx firebase deploy --only hosting,firestore,storage
npx firebase deploy --only functions     # butuh paket Blaze
```

Project staging belum dibuat; tambahkan alias `staging` di `.firebaserc` setelah project-nya ada.
