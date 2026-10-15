# Deploy ke produksi (`promosikan-com`)

Status pengecekan 15 Oktober 2026 (lewat Firebase CLI dan gcloud dengan akun pemilik project):

| Prasyarat | Status |
|---|---|
| Billing (paket Blaze) | ✅ aktif |
| Firestore `(default)` | ✅ ada, lokasi `asia-southeast2` (sama dengan region functions) |
| Web app Firebase | ✅ `1:690382694776:web:afa0eec692f98af47a408d` |
| Login Google | ✅ aktif |
| Authorized domains | ✅ `promosikan-com.web.app`, `promosikan-com.firebaseapp.com`, `promosikan.com` |
| **Login Email/Password** | ❌ belum aktif — langkah 1 |
| **Bucket Storage** | ❌ belum ada — langkah 2 |
| **Secret di Secret Manager** | ❌ belum ada — langkah 3 |
| **Meta Developer App (Threads)** | ❌ belum ada — langkah 6 |
| Domain `promosikan.com` | ✅ domain utama (Hosting aktif, kepemilikan terverifikasi; SSL sedang diterbitkan). `promosikan-com.web.app` & `promosikan-com.firebaseapp.com` dialihkan ke sini oleh `index.html` |

## 1. Aktifkan login Email/Password
Firebase Console → Authentication → Sign-in method → **Email/Password** → Enable (tanpa "Email link").

## 2. Buat bucket Storage
Firebase Console → Storage → **Get started**.
- Pilih production mode.
- Pilih lokasi **asia-southeast2** (Jakarta).

Rules dari repo akan menimpa rules bawaan saat deploy.

## 3. Simpan secret (sekali, dari folder repo)

```bash
npx firebase use promosikan-com

# Key Claude. Tempelkan saat diminta; jangan tulis di chat atau di commit.
npx firebase functions:secrets:set ANTHROPIC_API_KEY

# Kunci enkripsi token OAuth: 32 byte acak. Simpan juga cadangannya di password manager,
# karena token lama tidak bisa dibaca tanpa kunci ini.
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
npx firebase functions:secrets:set TOKEN_ENCRYPTION_KEY

# Diisi setelah langkah 6. Sebelum itu, function Threads tidak di-deploy.
npx firebase functions:secrets:set THREADS_APP_SECRET
```

Setelah itu, atur **batas pengeluaran** di Anthropic Console (Settings → Limits).

## 4. Konfigurasi non-secret (sudah disiapkan di lokal, diabaikan git)

- `.env.production.local`: konfigurasi web Firebase + `VITE_USE_EMULATORS=false`. Dipakai `npm run build`.
- `functions/.env.promosikan-com`:
  - `APP_URL=https://promosikan.com`
  - `CLAUDE_MODEL=claude-opus-5-5`
  - `ENFORCE_APP_CHECK=false`
  - `THREADS_APP_ID=` (diisi di langkah 6)

> Untuk menguji build lokal dengan emulator, jalankan `npx vite build --mode development`. Build biasa (`npm run build`) sekarang selalu mengarah ke produksi.

## 5. Deploy (tanpa Threads)

```bash
npm run lint && npm run typecheck && npm test && npm run test:emulator && npm run build

npx firebase deploy --only firestore,storage

npx firebase deploy --only "functions:health,functions:createWorkspace,functions:createDemoWorkspace,functions:inviteMember,functions:acceptInvitation,functions:revokeInvitation,functions:updateMemberRole,functions:removeMember,functions:transferOwnership,functions:analyzeConversation,functions:generateReply,functions:validateReply,functions:analyzePost"

npx firebase deploy --only hosting
```

Catatan:
- Deploy pertama mengaktifkan API Cloud Functions, Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Cloud Tasks, dan Eventarc. Bisa memakan waktu 5–10 menit.
- `storage.rules` membaca Firestore (cek role untuk upload logo). Jika CLI meminta izin IAM untuk "Firebase Rules Firestore Service Agent", setujui.
- `firestore.indexes.json` juga mengaktifkan **TTL** pada `socialPosts.expiresAt`, `monitoringRuns.expiresAt`, dan `oauthStates.expiresAt`, sesuai retensi data di SPEC §14 dan Kebijakan Privasi.

## 6. Meta Developer App untuk Threads

1. developers.facebook.com → Create App → use case **Access the Threads API**.
2. Isi URL berikut di pengaturan Threads app:
   - Redirect callback: `https://promosikan.com/api/integrations/threads/callback`
   - Uninstall callback: `https://promosikan.com/api/integrations/threads/deauthorize`
   - Delete callback: `https://promosikan.com/api/integrations/threads/data-deletion`
   - Privacy policy: `https://promosikan.com/privacy`
   - Terms: `https://promosikan.com/terms`
3. Tambahkan akun Threads Anda sebagai **tester** (Roles → Threads Testers) dan terima undangannya di Threads.
4. Masukkan **Threads App ID** ke `functions/.env.promosikan-com` (`THREADS_APP_ID=…`), lalu simpan **Threads App Secret** dengan perintah `secrets:set THREADS_APP_SECRET` di langkah 3.
5. Deploy function Threads:
   ```bash
   npx firebase deploy --only "functions:startThreadsOAuth,functions:disconnectThreads,functions:threadsOAuthCallback,functions:threadsDeauthorize,functions:threadsDataDeletion,functions:refreshThreadsTokens,functions:scheduledSocialMonitoring,functions:syncWorkspaceKeywords"
   npx firebase deploy --only hosting   # rewrite /oauth & /api ke functions
   ```
6. Uji: buka Integrations → **Hubungkan Threads**. Sampai `threads_keyword_search` disetujui lewat App Review, pencarian hanya menemukan post milik akun Anda sendiri.

## 7. Domain

- `promosikan.com` adalah domain utama (`APP_URL`). URL callback Meta di langkah 6 memakai domain ini.
- `promosikan-com.web.app` dan `promosikan-com.firebaseapp.com` dialihkan ke `promosikan.com` lewat skrip di `index.html` (path & query dipertahankan). Jalur `/__/auth/…` milik Firebase (login Google, verifikasi email) tidak terpengaruh.
- `www.promosikan.com`: Firebase Console → Hosting → **Add custom domain** → `www.promosikan.com` → centang **Redirect to an existing website** → `promosikan.com`. Lalu tambahkan record DNS yang ditampilkan di panel DNS Hostinger.

## Verifikasi setelah deploy

- `https://promosikan.com` terbuka (dan `promosikan-com.web.app` dialihkan ke sana). Daftar akun baru → email verifikasi terkirim → onboarding → buat workspace.
- Analisis Manual mengembalikan skor dari Claude sungguhan, dan Integrations menampilkan pemakaian AI bertambah.
- Log: `npx firebase functions:log --only analyzeConversation`.
