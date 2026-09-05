# Kontrak REST API NagariSDLC

**Status:** ringkasan aktif. Referensi endpoint lengkap berada di
[`docs/API_REFERENCE.md`](docs/API_REFERENCE.md), sedangkan route yang benar-benar
aktif berada di [`backend/routes/api.php`](backend/routes/api.php).

Dokumen versi awal menggunakan JWT, endpoint workspace khusus, dan status
`APPROVED_FOR_RELEASE`. Rancangan tersebut sudah tidak berlaku. Implementasi saat
ini menggunakan Laravel Sanctum dan state machine `ProjectStatus`.

## Konfigurasi dasar

- Base URL development: `http://localhost:8000/api/v1`.
- Format respons: `{ "status": "success|error", "message": "...", "data": ..., "meta"?: ... }`.
- SPA memakai cookie Sanctum `HttpOnly` dengan `credentials: 'include'`.
- Request berbasis cookie wajib menyertakan `X-Requested-With: XMLHttpRequest`.
- Header `Authorization: Bearer <token>` tetap diterima untuk Postman, test, dan
  klien non-browser yang kompatibel.
- Link approval UAT eksternal menggunakan token tautan dan header akses terpisah,
  bukan sesi aplikasi.

## Kelompok endpoint aktif

| Modul | Endpoint utama |
|---|---|
| Autentikasi | `/auth/register`, `/auth/login`, `/auth/me`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password` |
| Proyek | `/projects`, `/projects/{id}`, `/projects/{id}/status`, `/projects/{id}/timeline`, `/projects/{id}/team` |
| Task | `/projects/{projectId}/tasks`, `/tasks/{taskId}`, `/tasks/{taskId}/request-revision` |
| SIT/UAT | `/projects/{id}/sit-gate`, `/projects/{id}/sit-approval`, `/projects/{id}/uat-execution`, `/projects/{id}/uat-approval-matrix` |
| QA | `/qa-requests/submit`, `/qa-requests/assign`, `/qa-requests/report`, `/qa-requests/sign-off` |
| Siber | `/cyber-requests/submit`, `/cyber-requests/assign`, `/cyber-requests/report`, `/cyber-requests/sign-off` |
| Rilis | `/release-requests`, `/quality-gate/queue`, `/quality-gate/approve`, `/quality-gate/reject` |
| Dokumen | `/documents`, `/documents/{id}/download` |
| Administrasi | `/users`, `/roles`, `/groups`, `/divisions`, `/activity-logs` |
| Dashboard | `/dashboard/summary`, `/dashboard/analytics` |
| Operasional | `/health` |

## Aturan kontrak penting

1. Semua perubahan `projects.status` melalui
   `ProjectWorkflowService::transition()`.
2. QA dan Siber berjalan paralel menggunakan `qa_status` dan `cyber_status`.
3. Go-live hanya dapat diajukan setelah kedua jalur berstatus `PASSED`.
4. Tidak ada UAT final setelah QA/Siber. `READY_FOR_UAT` hanya status legacy.
5. Validasi write menggunakan Form Request.
6. Bentuk field aktual harus mengikuti API Resource dan contoh pada
   `docs/API_REFERENCE.md`, bukan contoh kontrak historis.
