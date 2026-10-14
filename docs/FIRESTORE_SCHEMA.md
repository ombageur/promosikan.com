# Skema Firestore

Status per Fase 3. Sumber kebenaran validasi ada di `shared/schemas/*` (Zod) dan dicerminkan di [`firestore.rules`](../firestore.rules). Tes di [`tests/rules/`](../tests/rules) memastikan keduanya selaras.

Keterangan kolom **Penulis**:
- **Client**: ditulis langsung dari browser dan dibatasi Security Rules.
- **Backend**: hanya Cloud Functions (Admin SDK) yang menulis; client ditolak.

## Koleksi global

| Path | Penulis | Isi | Catatan |
|---|---|---|---|
| `users/{uid}` | Client (pemilik) | `displayName`, `email`, `photoURL`, `lastWorkspaceId`, `createdAt`, `updatedAt` | `email` harus sama dengan token. Hanya pemilik yang bisa membaca. |
| `invitations/{inviteId}` | Backend | `workspaceId`, `workspaceName`, `email`, `role`, `tokenHash`, `status` (`pending`/`accepted`/`revoked`), `invitedBy`, `invitedByName`, `createdAt`, `expiresAt`, `acceptedBy`, `acceptedAt` | Bisa dibaca oleh penerima (email cocok) atau Owner/Admin workspace. Token disimpan sebagai hash SHA-256. |
| `mail/{id}` | Backend | `to`, `message.subject`, `message.text` | Antrean untuk Firebase Extension "Trigger Email". Client tidak punya akses. |

## `workspaces/{wid}`

| Field | Penulis | Keterangan |
|---|---|---|
| `name`, `businessName`, `industry`, `website`, `description`, `location`, `contactEmail`, `contactPhone`, `brandVoice`, `preferredLanguage` | Client (Owner/Admin) | Lihat `workspaceProfileSchema` |
| `logoPath`, `logoUrl` | Client (Owner/Admin) | `logoPath` harus diawali `workspaces/{wid}/logo/` |
| `ownerId`, `plan`, `isDemo`, `createdAt` | Backend | Tidak bisa diubah client |
| `updatedAt` | Client/Backend | Wajib `request.time` |

### Subkoleksi

| Path | Penulis | Izin tulis | Isi |
|---|---|---|---|
| `members/{uid}` | Backend | — | `uid`, `role`, `email`, `displayName`, `invitedBy`, `joinedAt` |
| `auditLogs/{id}` | Backend | — | `action`, `actorUid`, `targetUid`, `details`, `createdAt`. Bisa dibaca Owner/Admin. Immutable. |
| `offerings/{id}` | Client | `catalog.manage` | `offeringSchema`: `name`, `type`, `category`, `description`, `benefits[]` (≤10), `targetAudience`, `problemsSolved[]` (≤10), `keywords[]` (≤20), `priceRange`, `usp`, `landingPageUrl`, `allowedClaims[]` (≤10), `isActive` |
| `keywordGroups/{id}` | Client | `catalog.manage` | `name`, `offeringId` (nullable) |
| `keywords/{id}` | Client | `catalog.manage` | `term`, `groupId` (nullable), `offeringId` (nullable), `isActive` |
| `opportunities/{id}` | Backend (client: `status` saja, `reply.edit`) | — | `post{platform,text,authorName,authorHandle,postedAt,permalink,matchedKeyword}`, `intent`, `customerProblem`, `subScores`, `score`, `band` (dihitung `shared/scoring`), `reasons`, `redFlags`, `matches[≤3]`, `analysisStatus` (`ok`/`refused`), `status` (`new`/`saved`/`skipped`), `source`, `promptVersion`, `model`, `createdAt`, `createdBy` |
| `replyDrafts/draft_{opportunityId}` | Backend (client: `text` & `status` draft/pending_approval/skipped, `reply.edit`) | — | `opportunityId`, `text` (≤300), `style`, `status`, `quality{passed,notes,checkedAt}`, `publishable`, `promptVersion`, `model`, `createdAt`, `updatedAt`, `updatedBy` |
| `usage/{yyyy-mm}` | Backend | — | `aiCalls`, token input/output/cache, `costUsd` (estimasi biaya platform), `calls.{route}`. Bisa dibaca Owner/Admin. |
| `usage/rate_{uid}` | Backend | — | Rate limit AI per menit |
| `settings/automation` | Client | `automation.manage` | `automationSettingsSchema`. `manualApproval` selalu `true`. Dokumen lain di `settings/` ditolak. |

Dokumen katalog yang ditulis client wajib membawa jejak penulis:
- `createdAt` = `request.time` dan `createdBy` = uid saat dibuat. Keduanya tidak boleh berubah setelahnya.
- `updatedAt` = `request.time` dan `updatedBy` = uid di setiap penulisan.
- Field di luar skema ditolak (`keys().hasOnly`).

### Direncanakan (Fase 4–7, belum ada di rules)

`socialAccounts`, `socialPosts`, `replyAttempts`, `leads` (+ `activities`), `monitoringRuns`, `stats`. Bentuk datanya sudah didefinisikan sebagai tipe di `shared/types/intelligence.ts` dan dipakai oleh data demo. Semuanya ditulis oleh backend, kecuali field CRM tertentu di `leads`.

## Index

Didefinisikan di [`firestore.indexes.json`](../firestore.indexes.json):

| Koleksi | Field | Dipakai oleh |
|---|---|---|
| `invitations` | `workspaceId` ↑, `createdAt` ↑ | Batas undangan harian (`inviteMember`) |
| `invitations` | `workspaceId` ↑, `status` ↑, `createdAt` ↓ | Daftar undangan tertunda |
| `workspaces` | `ownerId` ↑, `isDemo` ↑ | Batas workspace & workspace demo |
| `members` (collection group) | `uid` ↑ | Workspace switcher |

## Batas query

Semua list memakai `limit()`:

| Data | Batas |
|---|---|
| offerings | 200 |
| keyword groups | 100 |
| keywords | 500 |
| anggota | 200 |
| workspace per user | 50 |
| undangan | 100 |

Kuota per paket ditegakkan di Fase 7.
