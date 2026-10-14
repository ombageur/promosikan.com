# Catatan Meta Threads API

Dokumen ini dibuat dari dokumentasi resmi Meta per **15 Oktober 2026** untuk persiapan Fase 4 dan App Review. Verifikasi ulang sebelum implementasi, karena endpoint, izin, dan kuota bisa berubah.

Setiap poin ditandai:
- ✅ **Terverifikasi**: tertulis di halaman resmi yang dicantumkan.
- ⚠️ **Belum terverifikasi**: tidak ditemukan di halaman resmi yang dibaca, atau hanya berasal dari ringkasan/pencarian.

## 1. Keyword search
Sumber: [Keyword Search](https://developers.facebook.com/docs/threads/keyword-search/)

- ✅ **Endpoint:** `GET https://graph.threads.net/v1.0/keyword_search`.
- ✅ **Parameter:**

  | Parameter | Nilai |
  |---|---|
  | `q` | wajib |
  | `search_type` | `TOP` (default) atau `RECENT` |
  | `search_mode` | `KEYWORD` (default) atau `TAG` |
  | `media_type` | `TEXT`, `IMAGE`, atau `VIDEO` |
  | `since` | minimal `1688540400` |
  | `until` | — |
  | `limit` | default 25, maksimum **100** |
  | `author_username` | — |
  | `fields` | mis. `id,text,media_type,permalink,timestamp,username,has_replies,is_quote_post,is_reply` |

  Field `owner` tidak pernah dikembalikan.
- ✅ **Izin:** `threads_basic` dan `threads_keyword_search`.
- ✅ **Sebelum `threads_keyword_search` disetujui,** pencarian hanya mencakup post milik pengguna yang login. Post publik baru bisa dicari setelah izin disetujui. **Karena itu App Review wajib sebelum monitoring berguna.**
- ✅ **Kuota pencarian:**
  - Maksimal **2.200 query per pengguna per 24 jam bergulir**, dihitung lintas semua aplikasi, bukan per aplikasi.
  - Query berulang untuk keyword yang sama tetap dihitung.
  - Query tanpa hasil tidak dihitung.
- ✅ Keyword yang dianggap sensitif atau ofensif mengembalikan array kosong.
- ✅ Dokumentasi menyebut bahwa media publik yang **baru saja dicari** dapat dibalas, dikutip, atau di-repost, dan aksi itu "mungkin memerlukan izin tambahan".

**Dampak ke desain (Fase 4):**
- Kuota 2.200 per pengguna dipakai bersama aplikasi lain yang dipakai akun itu.
  - Contoh: 50 keyword aktif × setiap jam = 1.200 query/hari, masih aman.
  - 100 keyword × setiap 30 menit = 4.800 query/hari, melebihi kuota.
  - Jadi jumlah keyword × interval harus dibatasi per paket. Sisakan margin, misalnya maksimal 1.500 query/hari dari Promosikan.com.
- Gunakan `search_type=RECENT` dan `since` = waktu sinkron terakhir supaya hasil yang sama tidak diambil ulang.
- Simpan `permalink` dan `timestamp` dari setiap hasil. ID post dipakai sebagai kunci deduplikasi (`threads_{id}`).

## 2. Publikasi & balasan
Sumber: [Threads Posts](https://developers.facebook.com/docs/threads/posts/), [Publishing reference](https://developers.facebook.com/documentation/threads/reference/publishing), [Create posts](https://developers.facebook.com/docs/threads/create-posts), [Reply management](https://developers.facebook.com/docs/threads/reply-management)

- ✅ **Alur publikasi:**
  1. Buat container dengan `POST /{threads-user-id}/threads`.
  2. Terbitkan dengan `POST /{threads-user-id}/threads_publish` (`creation_id`).

  Dokumentasi menyarankan menunggu sekitar 30 detik sebelum menerbitkan.
- ✅ **Balasan:** `reply_to_id` di `POST /{threads-user-id}/threads` bersifat "Optional. Required if replying to a post."
- ✅ **Izin publikasi:** `threads_content_publish`. Sebelum mendapat advanced access, aplikasi **hanya bisa memposting untuk akun sendiri dan akun tester**.
- ✅ **Batas teks:** maksimal **500 karakter**; emoji dihitung sebagai jumlah byte UTF-8. Batas balasan kita (`REPLY_MAX_CHARS` = 300) masih di bawahnya.
- ✅ **Batas post:** 250 post per profil per 24 jam.
- ⚠️ **Batas balasan:** 1.000 balasan per profil per 24 jam bergulir, bisa dicek lewat `GET /{threads-user-id}/threads_publishing_limit` (butuh `threads_basic`, `threads_content_publish`, `threads_manage_replies`). Angka ini dari ringkasan halaman overview di hasil pencarian, belum dibaca langsung.
- ⚠️ **Izin untuk membalas post milik pengguna lain** (bukan hanya post sendiri) tidak dijelaskan eksplisit di halaman yang dibaca. Perlu diuji dengan akun tester di Fase 5 sebelum fitur "Approve & Reply" diaktifkan. Selama belum pasti, status `unsupported` + tombol **Buka post asli** tetap menjadi jalur cadangan (SPEC §12).
- ⚠️ Ada laporan di forum developer bahwa `POST /me/threads` dengan `reply_to_id` mengembalikan HTTP 500. Belum ada resolusi resmi, jadi uji di Fase 5.

## 3. Token
Sumber: [Long-lived tokens](https://developers.facebook.com/docs/threads/get-started/long-lived-tokens)

- ✅ **Masa berlaku:**
  - Token short-lived: 1 jam.
  - Token long-lived: 60 hari.
  - Izin dari profil privat: 90 hari.
- ✅ **Tukar token** (server-side saja, karena memakai app secret): `GET /access_token?grant_type=th_exchange_token&client_secret=…&access_token=<short-lived>`.
- ✅ **Refresh:** `GET /refresh_access_token?grant_type=th_refresh_token&access_token=<long-lived>`.
  - Syarat: token berumur ≥ 24 jam, belum kedaluwarsa, dan pengguna memberi `threads_basic`.
  - Hasil refresh berlaku 60 hari sejak tanggal refresh. Token yang tidak di-refresh dalam 60 hari kedaluwarsa permanen.
- **Dampak:** `refreshThreadsTokens` (scheduled, harian) me-refresh token yang berumur lebih dari 7 hari dan kurang dari 50 hari. Token yang gagal di-refresh membuat status akun menjadi `expired` dan monitoring berhenti.

## 4. Izin yang akan diajukan di App Review

| Izin | Untuk | Fase |
|---|---|---|
| `threads_basic` | Wajib untuk semua endpoint | 4 |
| `threads_keyword_search` | Menemukan percakapan publik | 4 |
| `threads_content_publish` | Mengirim balasan yang disetujui | 5 |
| `threads_manage_replies` | Cek kuota balasan, kelola balasan (⚠️ periksa apakah wajib untuk `reply_to_id`) | 5 |

## 5. Checklist sebelum mengajukan App Review (tugas pemilik produk)

- [ ] Buat Meta Developer App dengan use case Threads API, lalu tambahkan akun tester.
- [ ] Siapkan URL publik:
  - Kebijakan Privasi: `/privacy` (sudah ada di aplikasi)
  - Syarat Layanan: `/terms` (sudah ada)
  - Instruksi penghapusan data: `/privacy#hapus-data`
- [ ] Siapkan domain produksi dan redirect URI OAuth: `https://<domain>/oauth/threads/callback`.
- [ ] Tinjau isi Kebijakan Privasi dan Syarat Layanan (bersama penasihat hukum bila perlu). Pastikan alamat `privacy@promosikan.com` benar-benar aktif.
- [ ] Siapkan screencast alur nyata untuk setiap izin. Contoh: hubungkan akun → keyword → hasil pencarian → draft → approval manual → balasan terkirim.
- [ ] Siapkan deskripsi penggunaan data yang konsisten dengan Kebijakan Privasi: tanpa scraping, tanpa auto-reply, ada approval manusia, ada retensi terbatas.
- [ ] ⚠️ Verifikasi format callback **deauthorize** dan **data deletion** untuk aplikasi Threads di App Dashboard, lalu implementasikan di Fase 4.
