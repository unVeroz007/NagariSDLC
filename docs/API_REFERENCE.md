# NagariSDLC — Referensi API

Base URL: `http://localhost:8000/api/v1` (dev). Semua route kecuali auth dan
link approval UAT eksternal dilindungi `auth:sanctum`. Format response standar:
`{ "status": "success|error", "message": "...", "data": ..., "meta": ...? }`

## Autentikasi
| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/auth/register` | Daftar |
| POST | `/auth/login` | Login → `{ token, user }` |
| POST | `/auth/me` | User saat ini |
| PATCH | `/auth/profile` | Update profil |
| PATCH | `/auth/password` | Ganti password |
| POST | `/auth/logout` | Logout |
| POST | `/auth/refresh` | Refresh token |

## Proyek
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/projects` | List (isolasi per role) |
| POST | `/projects` | Buat proyek (`title`, `description`, `contact_phone`, `division`, `target_date`, `type`, `project_type`) |
| GET | `/projects/next-req-id` | Generate req_id |
| GET | `/projects/{id}` | Detail |
| PATCH | `/projects/{id}` | Update (termasuk `sitUatData`/`contact_phone`) |
| DELETE | `/projects/{id}` | Hapus |
| PATCH | `/projects/{id}/status` | Transisi status (via workflow) |
| GET | `/projects/{id}/timeline` | Riwayat status |
| GET | `/projects/{id}/sit-gate` | Gate SIT (task done?) |
| POST | `/projects/{id}/sit-approval` | Approval SIT (role: developer/pm/development_lead) |
| POST | `/projects/{id}/uat-execution` | Simpan hasil UAT Tahap 2 per skenario dan hitung kesimpulan |
| GET | `/projects/{id}/uat-approval-matrix` | Matrix approver putaran terbaru |
| POST | `/projects/{id}/uat-approval-rounds` | Buat ulang putaran approval (PM/admin) |
| POST | `/projects/{id}/uat-approvers/{approver}/link` | Buat/rotasi link approver eksternal |
| POST | `/projects/{id}/uat-approvers/{approver}/decision` | Keputusan approver IT yang ditugaskan |
| POST | `/projects/{id}/uat-change-request` | Ajukan CR UAT (business_user) |
| POST | `/projects/{id}/uat-change-request/decision` | Putuskan CR (admin/pm/dev_lead) |

## Task
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/projects/{projectId}/tasks` | List task proyek |
| POST | `/projects/{projectId}/tasks` | Buat task |
| PATCH | `/tasks/{taskId}` | Update (status, dll) |
| DELETE | `/tasks/{taskId}` | Hapus |
| POST | `/tasks/{taskId}/request-revision` | Revisi task (kembali ke dev + note) |

## Chat (per proyek)
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/projects/{projectId}/chat` | List pesan |
| POST | `/projects/{projectId}/chat` | Kirim pesan `{ message, type }` |

## Dokumen
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/documents?project_id=` | List |
| POST | `/documents` | Upload (multipart `file`, `project_id`, `document_type`, `original_filename`) |
| GET | `/documents/{id}/download` | Download (cek otorisasi) |
| DELETE | `/documents/{id}` | Hapus |

## Notifikasi & Aktivitas
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/notifications` | List |
| PATCH | `/notifications/{id}/read` | Tandai baca |
| PATCH | `/notifications/read-all` | Baca semua |
| GET | `/activity-logs?project_id=&task_id=` | Log aktivitas (filter proyek/task) |

## QA / Cyber / Release / Dashboard
| Method | Endpoint | Fungsi |
|---|---|---|
| GET/POST | `/qa-requests` | Pengajuan QA |
| PATCH | `/qa-requests/{id}/status` | Update status QA |
| GET/POST | `/cyber-requests` | Pengajuan Cyber |
| GET/POST | `/release-requests` | Release |
| GET | `/dashboard/summary`, `/analytics` | Dashboard |
| GET | `/quality-gate/queue`, POST `/quality-gate/approve` | Quality gate (Head of IT) |
| GET | `/workspace/{role}` | Data workspace per role |

## RBAC / Master
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/roles`, `/divisions`, `/users` | Master (semua auth) |
| POST/PATCH/DELETE | `/roles`, `/divisions`, `/users` | Admin (super_admin) |

## Contoh Payload

### Login
```
POST /auth/login
{ "email": "user@nagari.co.id", "password": "..." }
→ 200
{ "status": "success", "data": { "token": "...", "user": { "id": 1, "name": "...", "role": "developer", ... } } }
```

### Buat Proyek (dari form request business user)
```
POST /projects
{
  "name": "Aplikasi LOS",
  "description": "...",
  "contact_phone": "081234567890",   // nomor kontak pemohon untuk UAT
  "division": "Divisi Operasional",
  "priority": "Medium",
  "targetDate": "2026-12-01",
  "type": "RBB",
  "project_type": "baru"
}
→ 201 { "status": "success", "data": { "id": 24, "req_id": "REQ-2026-024", "contact_phone": "081234567890", ... } }
```

### Update proyek (termasuk data SIT/UAT)
```
PATCH /projects/{id}
{ "sitUatData": { "activeSitStep": 3, "sit2_task_approvals": { "task_10": { "approved": true } }, ... } }
→ 200 { "status": "success", "data": { ... } }
```

### Approval SIT (role: developer / pm / development_lead)
```
POST /projects/{id}/sit-approval
{ "note": "Oke, disetujui." }
→ 200 { "status": "success", "message": "Persetujuan SIT dari developer berhasil disimpan." }
```

### Approval UAT internal per orang
```
POST /projects/{id}/uat-approvers/{approver}/decision
{ "decision": "approved|rejected", "note": "Wajib jika rejected" }
```

### Approval UAT eksternal (publik, token pribadi)
```
GET  /uat-approvals/{token}                         # preview + masking nomor
POST /uat-approvals/{token}/verify                  # { "phone": "0812..." }
GET  /uat-approvals/{token}/detail                  # header X-UAT-Approval-Access
POST /uat-approvals/{token}/decision                # header akses + decision/note
GET  /uat-approvals/{token}/documents/{id}/download # header akses
```

Endpoint `/projects/{id}/uat-approval` hanya dipertahankan untuk kompatibilitas
client lama dan tidak menjadi sumber gate approval baru.

### Eksekusi UAT Tahap 2 (pemohon / PM proyek / admin)
```json
POST /projects/{id}/uat-execution
{
  "scenarios": [{
    "id": "task_10",
    "task_id": 10,
    "scenario": "Unduh laporan",
    "result": "revision",
    "change_type": "minor",
    "request": "Ubah label tombol menjadi Unduh PDF",
    "comment": "Tidak mengubah proses bisnis",
    "attachments": [{ "docId": 91 }]
  }],
  "notes": "Demonstrasi bersama user pemohon"
}
```
Server memvalidasi semua task aktif dan lampiran `UAT_EVIDENCE`, menghitung
summary, serta mengembalikan `meta.conclusion`. `major_revision` otomatis
memindahkan proyek ke `UAT_REVISION_DEV`; `minor_revision` tetap
`UAT_IN_PROGRESS` dan lanjut ke Persetujuan Final.

Field hasil/kesimpulan UAT, flag resume, approval UAT, Change Request, dan arsip
SIT bersifat server-managed; `PATCH /projects/{id}` tidak dapat menimpanya.

### Change Request UAT (oleh business_user)
```
POST /projects/{id}/uat-change-request
{ "type": "mayor", "title": "Ubah alur transaksi", "detail": "..." }
→ 200 { "status": "success", "message": "Change request UAT berhasil diajukan." }
```

### Putuskan Change Request (oleh PM/DevLead/Admin)
```
POST /projects/{id}/uat-change-request/decision
{ "cr_id": "cr_1234", "decision": "approved", "note": "Disetujui." }
→ 200 (mayor berpindah ke UAT_REVISION_DEV; minor tidak mengubah status)
```

### Chat proyek
```
GET  /projects/{id}/chat   → { "status": "success", "data": [ { "id", "message", "type", "userId", "name", "timestamp" } ] }
POST /projects/{id}/chat
{ "message": "Halo tim", "type": "text" }
→ 201 { "status": "success", "data": { "id", "message", "name", "timestamp" } }
```

### Upload dokumen (multipart)
```
POST /documents
form-data: file, project_id, document_type (contoh: SIT_TASK_EVIDENCE), original_filename
→ 201 { "status": "success", "data": { "id", "file_name", "original_filename", ... } }
```

### Download dokumen
```
GET /documents/{id}/download   → stream file (cek otorisasi proyek)
```

## Catatan Error Handling
- Response error: `{ "status": "error", "message": "...", "errors": { field: [msg] } }`
- 401 → token invalid/expired → frontend clear session.
- 403 → tidak berwenang (role/akses).
- 422 → validasi gagal atau transisi status ilegal.
