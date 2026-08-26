# NagariSDLC — Referensi API

Base URL: `http://localhost:8000/api/v1` (dev). Semua route kecuali auth dan
link approval UAT eksternal dilindungi `auth:sanctum`. Format response standar:
`{ "status": "success|error", "message": "...", "data": ..., "meta": ...? }`

## Autentikasi
| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/auth/register` | Daftar akun mandiri. Body: `name`, `email`, `password`, `password_confirmation`, `division_id` (atau `department` = nama divisi terdaftar, untuk klien lama), `phone_number?` |
| GET | `/auth/divisions` | Publik, hanya baca. Daftar `{ id, name }` divisi resmi untuk dropdown formulir pendaftaran |
| POST | `/auth/login` | Login → `{ token, user }` |
| POST | `/auth/forgot-password` | Publik. Kirim tautan reset ke email. Body: `email` |
| POST | `/auth/reset-password` | Publik. Setel password baru. Body: `token`, `email`, `password`, `password_confirmation` |
| GET | `/auth/me` | User saat ini |
| PATCH | `/auth/profile` | Update profil |
| PATCH | `/auth/password` | Ganti password |
| POST | `/auth/logout` | Logout |
| POST | `/auth/refresh` | Refresh token |

Pendaftaran mandiri **selalu** menghasilkan akun berperan `business_user`. Field
`role`, `role_id`, dan `is_active` ditolak `422` (`prohibited`) — sebelumnya
`role` diterima apa adanya sehingga satu request tanpa autentikasi dapat membuat
akun `super_admin`. Penambahan akun berperan lain adalah wewenang Super Admin
lewat `POST /users`. Divisi wajib menunjuk baris `divisions` yang sudah ada;
endpoint ini tidak lagi membuat divisi baru dari masukan bebas. Aturan kekuatan
password sama dengan `PATCH /auth/password`.

### Reset password

Dibangun di atas broker password Laravel (`password_reset_tokens`,
`config('auth.passwords.users')`): token disimpan dalam bentuk hash, berlaku **60
menit**, dan **sekali pakai** — barisnya dihapus begitu berhasil dipakai.

`POST /auth/forgot-password` menjawab `200` dengan pesan yang **sama** untuk email
terdaftar maupun tidak. Balasan yang berbeda akan menjadikan formulir "lupa
password" alat pemeriksa siapa yang punya akun di sistem internal bank. Akun
nonaktif (`is_active = false`) dan akun yang sudah dihapus lunak juga tidak dikirimi
tautan, dengan balasan yang sama. Satu pengecualian: `429` bila permintaan berulang
lebih cepat dari jeda broker (60 detik), agar tombol "kirim ulang" tidak terasa
diam-diam gagal.

`POST /auth/reset-password` menjawab `422` dengan satu pesan generik untuk token
salah, token kadaluarsa, token sudah dipakai, email tidak terdaftar, dan akun
nonaktif. Setelah berhasil, **semua token Sanctum akun itu dihapus** — reset adalah
jalur pemulihan akun yang dicurigai bocor, jadi sesi yang masih terbuka harus ikut
berakhir.

Tautan pada email mengarah ke **frontend**, bukan backend:
`{FRONTEND_URL}/reset-password?token=…&email=…` (`config('app.frontend_url')`,
dibangun oleh `App\Notifications\ResetPasswordNotification`). `FRONTEND_URL` wajib
diisi di `.env` produksi; tanpa itu tautannya menunjuk `http://localhost:5173`.
Pengiriman email memakai mailer aktif — dengan `MAIL_MAILER=log` isi emailnya
tertulis di `storage/logs/laravel.log`, bukan terkirim.

Kedua endpoint dibatasi `throttle:5,1` di level route, dan keduanya dicatat di
`activity_logs` (`request_password_reset`, `reset_password`) dengan `user_id` null
karena pelakunya belum bersesi.

## Proyek
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/projects` | List (isolasi per role) |
| POST | `/projects` | Buat proyek (`title`, `description`, `contact_phone`, `division`, `target_date`, `rbb_deadline`, `priority`, `type`, `project_type`). `rbb_deadline` opsional dan hanya diminta untuk `type = 'RBB'`; diterima juga sebagai `rbbDeadline` |
| GET | `/projects/next-req-id` | Generate req_id |
| GET | `/projects/{id}` | Detail |
| PATCH | `/projects/{id}` | Update (termasuk `sitUatData`/`contact_phone`). Kunci `sit_uat_data` yang dikelola server diabaikan, dan `uat1_participants` dilindungi dari pengosongan — lihat catatan di bawah |
| DELETE | `/projects/{id}` | Hapus |
| PATCH | `/projects/{id}/status` | Transisi status (via workflow). Keluar dari `UAT_IN_PROGRESS` menuju `UAT_REVISION_DEV`/`UAT_REVISION_SIT` ikut men-`superseded` putaran approval yang masih berjalan, di dalam transaksi transisi yang sama |
| POST | `/projects/{id}/team` | Alokasi tim proyek oleh PM. Body: `team` (array, min. 1). Setiap anggota diresolusi lewat `user_id`, `id`, atau `email`; `skill`/`role` menjadi `role_in_project`. Baris `project_team_members` lama proyek itu diganti seluruhnya dalam satu transaksi |
| GET | `/projects/{id}/timeline` | Riwayat status |
| GET | `/projects/{id}/sit-gate` | Gate SIT (task done?) |
| POST | `/projects/{id}/sit-approval` | Approval SIT (role: developer/pm/development_lead) |
| PUT | `/projects/{id}/uat-execution/draft` | Simpan draft UAT Tahap 2 tanpa menghitung kesimpulan, tanpa memundurkan status, dan tanpa membentuk Change Request. Body sama dengan `POST /uat-execution`, tetapi `result` dan `change_type` boleh kosong |
| POST | `/projects/{id}/uat-execution` | Simpan hasil UAT Tahap 2 per skenario dan hitung kesimpulan. Temuan Mayor menahan UAT dan mengulangnya dari Tahap 1 — lihat catatan di bawah |
| GET | `/projects/{id}/uat-approval-matrix` | Matrix approver putaran terbaru |
| POST | `/projects/{id}/uat-approval-rounds` | Buat ulang putaran approval (PM/admin) |
| POST | `/projects/{id}/uat-approval-rounds/sync` | Sinkronkan peserta putaran aktif dengan UAT Tab 1 (PM/admin). Peserta yang dicabut hanya boleh yang belum memberi keputusan; keputusan yang sudah sah dipertahankan |
| POST | `/projects/{id}/uat-approvers/{approver}/link` | Buat/rotasi link approver eksternal |
| POST | `/projects/{id}/uat-approvers/{approver}/decision` | Keputusan approver IT yang ditugaskan |
| POST | `/projects/{id}/uat-change-request/decision` | Putuskan CR (admin/pm/dev_lead) |

## Task
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/projects/{projectId}/tasks` | List task proyek |
| POST | `/projects/{projectId}/tasks` | Buat task. Body: `title` (wajib, maks. 255), `description?`, `assignee_id?`, `status?` (`TaskStatus`), `due_date?`, `priority?` (`High`\|`Medium`\|`Low`), `return_round_id?` — lihat catatan di bawah |
| PATCH | `/tasks/{taskId}` | Update (status, dll) |
| DELETE | `/tasks/{taskId}` | Hapus |
| POST | `/tasks/{taskId}/request-revision` | Revisi task (kembali ke dev + note) |

### `return_round_id` — menandai task sebagai task perbaikan

`return_round_id` menautkan task baru ke satu **putaran pengembalian** QA / Keamanan
Siber (`project_return_rounds`). Kolom ini opsional; tanpa nilai, task yang dibuat adalah
task biasa.

Validasinya bukan sekadar "ID ini ada". Putaran yang dirujuk wajib **milik proyek yang
sama** (`project_id` = `{projectId}` di URL) **dan** masih berstatus **`OPEN`**:

```
POST /projects/12/tasks
{ "title": "Perbaiki validasi sesi", "return_round_id": 7 }
→ 422 {
    "status": "error",
    "message": "...",
    "errors": {
      "return_round_id": [
        "Putaran pengembalian yang dipilih bukan milik proyek ini atau sudah diajukan ulang, sehingga task perbaikan tidak dapat ditambahkan ke dalamnya."
      ]
    }
  }
```

Syarat `OPEN` itu bukan kerapian: menempelkan task baru pada putaran yang sudah diajukan
ulang menambah pekerjaan ke putaran yang riwayatnya sudah tertutup, sehingga gerbang
pengajuan ulang tidak akan pernah menilai task itu.

Pembuatan task perbaikan yang berhasil dicatat di `activity_logs` sebagai `create_task`
dengan deskripsi yang menyebut putarannya, plus metadata `return_round_id`,
`return_round_track`, dan `return_round_number`. Aturan lama tetap berlaku: pembuat wajib
lolos `ProjectAccessService::canUpdate()` (403 bila tidak) dan `assignee_id` wajib anggota
tim proyek (422 bila tidak).

Payload task memaparkan tiga field terkait:

| Field | Selalu ada? | Keterangan |
|---|---|---|
| `return_round_id` | ya | `null` untuk task biasa |
| `return_round_track` | hanya bila relasi `returnRound` dimuat | `qa` / `cyber` |
| `return_round_number` | hanya bila relasi `returnRound` dimuat | Nomor putaran |

Dua field terakhir sengaja bersyarat agar resource ini tidak pernah memicu satu query per
task. Untuk mengelompokkan task per putaran tanpa memuat relasinya, pakai
`return_round_id` — atau baca `return_rounds[].fix_tasks` pada payload proyek.

## Chat (per proyek)
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/projects/{projectId}/chat` | List pesan |
| POST | `/projects/{projectId}/chat` | Kirim pesan `{ message, type }` |

## Dokumen
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/documents?project_id=` | List, tersaring visibilitas proyek |
| POST | `/documents` | Upload (multipart `file`, `project_id`, `document_type`, `original_filename`) |
| GET | `/documents/{id}/download` | Download. Otorisasi memakai `ProjectAccessService::canView()` — sama dengan list. QA, Siber, dan Development Lead hanya dapat mengunduh dokumen proyek yang berada di fase mereka atau yang jalurnya mereka pegang, bukan seluruh proyek |
| DELETE | `/documents/{id}` | Hapus. 403 bila bukan pengunggah / pemohon / PM proyek / Super Admin / Head of IT. 404 bila proyek pemiliknya sudah dihapus lunak. 422 bila dokumen masih terikat jejak audit, dengan rinciannya di `data.reasons` |

Penolakan 422 pada `DELETE /documents/{id}` terjadi bila dokumen:

1. dirujuk sebagai bukti pada baris `test_reports` (`evidence_document_ids`);
2. berada di `sit_uat_data.sit3_docs` sementara status proyek sudah melewati SIT
   (`SIT_PASSED` sampai `LIVE_PRODUCTION`, termasuk `CANCELLED`);
3. berada di `sit_uat_data.uat1_docs` atau `uat3_docs` sementara UAT Internal sudah
   selesai (`UAT_PASSED` sampai `LIVE_PRODUCTION`, termasuk `CANCELLED`);
4. berada di `uat3_docs` dan sudah ada approver UAT pada putaran `active`/`completed`
   terakhir yang memberi keputusan, meski status proyek belum berpindah;
5. tersimpan pada snapshot histori `sit_uat_data.sit_cycles[].documents`.

Batas nomor 2–4 sengaja dibuat identik dengan kondisi `readOnly` pada wizard SIT/UAT,
sehingga setiap penolakan server adalah tombol yang di layar sudah mati. Penghapusan
yang berhasil dicatat sebagai `delete_document`, penolakan sebagai
`delete_document_blocked` berstatus `error`, keduanya di `activity_logs`.

Bukti per task SIT (`sit2_task_approvals[*].attachments[].docId`) dan bukti per skenario
UAT (`uat2_scenarios[*].attachments[].docId`) belum ikut dibekukan: keduanya masih boleh
diganti selama siklus revisi mayor berjalan, dan komponen `SITTaskExecution` dirender
tanpa prop `readOnly`, jadi pembekuan di server akan menolak aksi yang di layar masih
aktif.

## Notifikasi & Aktivitas
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/notifications` | List |
| PATCH | `/notifications/{id}/read` | Tandai baca |
| PATCH | `/notifications/read-all` | Baca semua |
| GET | `/activity-logs?project_id=&task_id=` | Log aktivitas (filter proyek/task). Terbuka untuk semua user terautentikasi |
| GET | `/activity-logs/summary` | Rekap agregat: total hari ini, minggu ini, keseluruhan, dan jumlah user aktif hari ini. **Hanya `super_admin`** |
| GET | `/me/uat-approvals` | Inbox personal approval UAT milik akun yang sedang login (developer, Analyst/PM, Lead, Head of IT) |

## Operasional
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/health` | Publik, tanpa autentikasi. Cek koneksi database untuk load balancer/monitoring |

## Jalur Pengujian (QA & Audit Keamanan Siber)
Kedua jalur memakai empat langkah yang identik bentuknya, satu peran per langkah. Kolom jalur (`projects.qa_status` / `projects.cyber_status`) adalah kebenaran jalurnya; `projects.status` hanya penunjuk siklus yang bergerak menyusul.

Kedua kolom itu hanya boleh ditulis oleh empat endpoint di bawah dan oleh
`ProjectWorkflowService::syncTestingTrackStatuses()`. `PATCH /projects/{id}` menolak
seluruh nilai jalur kecuali `FAILED`, dan `FAILED` pun wajib disertai `status` =
`RETURN_TO_DEV` pada request yang sama (422 bila tidak). Tanpa batas itu, siapa pun yang
boleh mengubah proyek dapat menyetel `qa_status=SUBMITTED` dan memunculkan proyeknya di
antrean QA/Siber tanpa melewati gerbang fase, disposisi Lead, maupun baris `test_reports`.

Kedua endpoint `submit` menolak proyek yang belum selesai dikembangkan: `projects.status` wajib salah satu dari `DEV_COMPLETED`, `RETURN_TO_DEV`, `READY_FOR_QA`, `QA_IN_PROGRESS`, `QA_PASSED`, `CYBER_IN_PROGRESS`, `CYBER_PASSED`. Status pengembangan (`IN_DEVELOPMENT`, `SIT_*`, `UAT_*`) ditolak — lihat `docs/WORKFLOW.md` bagian "Gerbang masuk fase pengujian".

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/qa-requests`, `/cyber-requests` | Daftar laporan pengujian jalur tersebut, tersaring visibilitas proyek |
| POST | `/qa-requests/submit` | Langkah 1 — Analis Pengembangan mengajukan proyek ke QA. Body: `project_id`, `staging_url?`, `target_completion_date?`, `notes?`. Menyetel `qa_status=SUBMITTED` dan menaikkan status utama ke `READY_FOR_QA` bila transisinya sah. **Endpoint yang sama dipakai untuk pengajuan ulang** setelah pengembalian; lihat "Pengajuan ulang setelah pengembalian" di bawah |
| POST | `/cyber-requests/submit` | Langkah 1 — pengajuan ke Audit Keamanan Siber. Body: `project_id`, `cyber_check_type` (`pentest`\|`secure_code`), lalu **`cyber_target_url` wajib bila `pentest`** atau **`cyber_source_code_ref` wajib bila `secure_code`**, ditambah `staging_url?`, `target_completion_date?`, `notes?`. Status utama tidak digerakkan di sini. **Endpoint yang sama dipakai untuk pengajuan ulang** setelah pengembalian |
| POST | `/qa-requests/assign`, `/cyber-requests/assign` | Langkah 2 — Lead jalur mendisposisikan pelaksana. Body: `project_id`, `assignee_id`, `notes?`. Mengisi `qa_assignee_id` / `cyber_assignee_id` dan menaikkan jalur ke `IN_PROGRESS`. Ditolak bila jalurnya `FAILED` dan masih punya putaran pengembalian terbuka |
| POST | `/qa-requests/report`, `/cyber-requests/report` | Langkah 3 — pelaksana mengirim laporan. Body: `project_id`, `result` (`pass`\|`conditional_pass`\|`fail`), `notes` (wajib bila `result` bukan `pass`), `severity?`, `tested_scenarios?` (teks bebas, maks. 5000 karakter), `attachment_url?`, `checklist?` (warisan), `evidence_document_ids?` (maks. 50, wajib milik proyek yang sama dan bertipe bukti jalurnya). Membuat baris `test_reports` dan menghentikan jalur di `REVIEW` |
| POST | `/qa-requests/sign-off`, `/cyber-requests/sign-off` | Langkah 4 — Lead memutuskan. Body: `project_id`, `result` (`pass`\|`fail`), `notes` (wajib bila `fail`). `pass` menutup jalur ke `PASSED`; `fail` menutup ke `FAILED`, mengembalikan proyek ke `RETURN_TO_DEV`, **dan membuka satu putaran pengembalian baru** untuk jalur itu |

Cakupan pengujian sekarang ditulis bebas pada `tested_scenarios`, bukan dicentang dari
daftar tetap. `checklist` masih diterima dan masih dipaparkan `TestReportResource`
(beserta `checklist_summary`) supaya laporan lama tetap terbaca, tetapi tidak ada
antarmuka yang mengisinya lagi — daftar enam skenario tetap sudah dihapus dari laman QA
maupun Siber karena tidak pernah cocok untuk semua proyek.

Bukti pengujian tidak diunggah menempel pada laporan: berkasnya diunggah lebih dulu lewat `POST /documents` dengan `document_type` `QA_EVIDENCE` atau `CYBER_EVIDENCE`, lalu ID dokumennya dirujuk pada `evidence_document_ids`.

Endpoint lama `POST /qa-requests` dan `PATCH /qa-requests/{id}/status` sudah dihapus karena keduanya menggabungkan laporan pelaksana dengan keputusan Lead menjadi satu tindakan.

### Pengajuan ulang setelah pengembalian

**Tidak ada endpoint baru untuk pengajuan ulang.** PM memakai `POST /qa-requests/submit`
dan `POST /cyber-requests/submit` yang sama seperti pengajuan pertama, dengan body yang
sama. Yang bertambah hanyalah efek sampingnya: pengajuan yang berhasil **menutup putaran
pengembalian yang masih terbuka** pada jalur itu — `status` menjadi `RESUBMITTED`,
`resubmitted_by` diisi pengaju, `resubmitted_at` diisi waktu pengajuan, dan
`resubmit_notes` diisi `notes` dari body bila ada. Semuanya berada di dalam transaksi yang
sama dengan penulisan kolom jalur, jadi tidak ada keadaan setengah jadi.

Bila putaran terbukanya belum layak diajukan ulang, request **ditolak `422`** dengan pesan
Indonesia dari service dan **tanpa** kunci `errors` (ini bukan kegagalan validasi field,
melainkan pelanggaran aturan alur). Tiga alasan penolakan, dalam urutan pemeriksaannya:

1. putaran belum memiliki satu pun task perbaikan;
2. ada task perbaikan yang belum memiliki penerima (`assignee_id` kosong);
3. ada task perbaikan yang belum selesai (status di luar `done` dan `take_down`).

Pesan penolakan menyebut nama putarannya (mis. "Pengujian QA — Pengembalian ke-2")
dan mendaftar task yang menghalangi sebagai `#{id} {judul}`, sehingga PM tahu apa yang
harus diselesaikan tanpa menebak.

Gerbang yang sama ditegakkan di **tiga tempat** yang semuanya bermuara pada satu aturan
(`ProjectReturnRoundService::assertResubmitAllowed()`):

1. `POST /{track}-requests/submit` — jalur resmi PM.
2. `POST /{track}-requests/assign` — menolak Lead mendisposisikan ulang jalur yang
   `FAILED` selagi putarannya masih terbuka. Tanpa ini pengujian bisa berjalan lagi tanpa
   pernah melewati pengajuan, karena `FAILED` bukan `NOT_SUBMITTED` dan bukan pula lulus.
3. `PATCH /projects/{id}/status` — lihat catatan di bawah.

Pemeriksaannya **per jalur**: proyek yang dikembalikan Keamanan Siber tetap boleh
mengajukan QA, dan sebaliknya.

### Gerbang putaran pengembalian pada `PATCH /projects/{id}/status`

`PATCH /projects/{id}/status` tidak boleh menjadi pintu belakang. Aturannya dinyatakan
sebagai **invarian atas status tujuan**, bukan atas status asal: status utama **tidak
boleh masuk fase pengujian sebuah jalur selama jalur itu masih memiliki putaran
pengembalian terbuka** — dari status mana pun ia datang.

| Status tujuan | Jalur yang diperiksa |
|---|---|
| `READY_FOR_QA`, `QA_IN_PROGRESS` | QA |
| `CYBER_IN_PROGRESS` | Keamanan Siber |
| lainnya | tidak ada pemeriksaan |

Penolakannya `422` dengan pesan yang sama seperti pada endpoint `submit`. Jalur yang tidak
punya putaran terbuka selalu lolos tanpa efek samping apa pun.

Pengikatan pada status **tujuan** itu penting: matriks transisi juga mengizinkan masuk
fase pengujian dari `READY_FOR_QA`, `QA_IN_PROGRESS`, `QA_PASSED`, `CYBER_IN_PROGRESS`,
dan `CYBER_PASSED`. Gerbang yang hanya berlaku saat status saat ini `RETURN_TO_DEV` bisa
dilangkahi: QA mengembalikan proyek, Cyber Lead secara sah memindahkan status utama ke
`CYBER_IN_PROGRESS`, dan sejak itu gerbang lama tidak akan pernah menyala lagi.

## Release / Dashboard
| Method | Endpoint | Fungsi |
|---|---|---|
| GET/POST | `/release-requests` | Pengajuan migrasi & rilis ke Grup Infrastruktur. `POST` membuat baris `release_requests` **dan** memindahkan proyek ke `PENDING_GOLIVE` dalam satu transaksi; ditolak 422 bila jalur QA/Siber belum lulus. Body: `project_id`, `target_release_date`, `downtime_estimate?`, `rollback_plan?`, `notes?`. `GET` hanya menampilkan pengajuan pada proyek yang boleh dilihat pengguna |
| GET | `/dashboard/summary` | Angka kartu dasbor, **disaring sesuai wewenang pengguna** lewat `ProjectAccessService::applyVisibilityScope()` — sumber kebenaran yang sama dengan `GET /projects`. `total_projects`, `pending_projects`, `in_development`, `in_qa`, `live_production`, dan `total_tasks` hanya menghitung proyek yang boleh dilihat pengguna tersebut; role yang tidak dikenal menerima 0 untuk semuanya. `total_users` berisi jumlah akun hanya untuk role pengawas (`super_admin`, `head_of_it`, `lead_group`) dan `null` untuk role lain |
| GET | `/dashboard/analytics` | Agregat lintas seluruh portofolio untuk halaman Analitik SDLC: `status_distribution` (objek dengan kunci status), `avg_cycle_time`, `success_rate`, `bug_density`, `velocity`, `release_trend` (6 bulan), `developer_workloads` (`name` + `workload`, tanpa email), `role_distribution`, `total_projects`, `total_users`, `total_tasks`. **Hanya `super_admin`** — angkanya tidak bisa disaring per pengguna, jadi gerbangnya route. `avg_cycle_time` dan `release_trend` dihitung dari `project_status_histories` (transisi pertama ke `LIVE_PRODUCTION`), bukan dari `projects.updated_at` |
| GET | `/quality-gate/queue` | Antrean proyek `PENDING_GOLIVE` beserta rencana rilisnya. **Hanya `head_of_it` / `super_admin`** |
| POST | `/quality-gate/approve` | Setujui rilis; proyek berpindah ke `LIVE_PRODUCTION`. Body: `project_id`, `notes?` |
| POST | `/quality-gate/reject` | Tolak rilis. Body: `project_id`, `reason` (**wajib, 10–2000 karakter**). Proyek berpindah ke `REJECTED` (bukan `RETURN_TO_DEV` — itu jalur pengembalian milik jalur pengujian), alasannya tersimpan di `projects.rejection_reason` dan pada `release_requests.rejection_notes`/`rejected_by`/`rejected_at` |

## RBAC / Master
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/roles`, `/divisions`, `/groups`, `/users` | Master (semua auth) |
| POST/PATCH/DELETE | `/roles`, `/divisions`, `/groups`, `/users` | Admin (super_admin) |

Bacanya dibuka untuk semua akun yang sudah login karena pemilih personel di banyak
halaman kerja membutuhkannya; yang dijaga `role:super_admin` hanya tulisannya.

### `/groups` — grup kerja
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/groups` | Daftar grup beserta role anggotanya: `id`, `code`, `name`, `description`, `roles_count`, `users_count`, dan `roles[]` (`id`, `name`, `display_name`, `users_count`). Role selalu disertakan karena setiap layar yang memakai grup juga menampilkan anggotanya |
| POST | `/groups` | Body: `code` (wajib, huruf besar/angka/tanda hubung, unik), `name` (wajib), `description?`. `code` dinormalkan ke huruf besar sebelum validasi |
| PATCH | `/groups/{id}` | Field yang sama, semuanya `sometimes` |
| DELETE | `/groups/{id}` | 422 bila grup masih menaungi role — pindahkan anggotanya dahulu di Manajemen Role |

> **Grup tidak memberi wewenang apa pun.** Memindahkan role antar grup hanya mengubah
> pengelompokan dan tampilan. Hak transisi status tetap milik
> `ProjectWorkflowService::$rolePermissions`, cakupan proyek milik `ProjectAccessService`,
> dan hak pelaksana uji milik `TestingTrack::testerRoles()` — semuanya mencocokkan
> `roles.name`, bukan grup. Menambah role baru lewat API ini pun belum membuatnya
> berfungsi: router frontend dan ketiga sumber otorisasi itu berada di dalam kode.

### `/roles` — payload yang diperluas
`POST /roles` dan `PATCH /roles/{id}` sekarang menerima dua field tambahan di samping
`name`, `display_name`, dan `description`:

```
PATCH /roles/7
{
  "group_id": 3,                                  // null untuk mengeluarkan role dari grup
  "menu_access": ["/projects", "/my-tasks/qa"]     // [] untuk mencabut pembatasan
}
```

- `group_id` — `nullable`, harus ada di `groups`.
- `menu_access` — `nullable`, array maksimum 200 path. Daftar disaring dan
  dideduplikasi `RoleController::normalizeMenuAccess()`, lalu **daftar kosong disimpan
  sebagai `null`** karena keduanya berarti hal yang sama: tanpa pembatasan. Ini disengaja
  — menyimpan daftar kosong sebagai pembatasan nyata akan mengosongkan seluruh sidebar
  role itu, dan role tanpa akses Administrasi tidak dapat membatalkannya sendiri.
- Pembatasan bersifat **mengurangi saja**: path yang tidak ada di
  `frontend/src/data/menuConfig.js` untuk role tersebut tetap tidak muncul, dan
  menyembunyikan menu **tidak** menutup rutenya — gerbangnya tetap `ProtectedRoute` serta
  middleware `role:`.
- `menu_access` role `super_admin` ditolak 422 oleh `UpdateRoleRequest`, karena halaman
  Administrasi yang mengatur pembatasan itu sendiri berada di dalam menu.
- `GET /roles` menyertakan relasi `group` dan `users_count`.

### `role_detail.menu_access` pada profil
`GET /auth/me` (dan setiap `UserResource` lain) kini membawa daftar itu:

```
{ "role_detail": { "id": 7, "name": "qa_tester", "display_name": "QA Tester",
                   "menu_access": ["/projects", "/my-tasks/qa"] } }
```

`null` berarti tanpa pembatasan. `MainLayout` memakainya untuk menyaring sidebar lewat
`filterSectionsByMenuAccess()`; tidak ada query tambahan karena relasi `role` memang sudah
dibaca resource-nya.

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
  "priority": "Medium",              // High | Medium | Low. Label lama (Urgent/Tinggi/Sedang/Rendah/Normal) dipetakan otomatis; nilai lain ditolak 422
  "targetDate": "2026-12-01",
  "type": "RBB",
  "project_type": "baru"
}
→ 201 { "status": "success", "data": { "id": 24, "req_id": "REQ-2026-024", "contact_phone": "081234567890", "priority": "Medium", ... } }
```

> `priority` juga dapat diubah lewat `PATCH /projects/{id}` (`sometimes`, nilainya sama:
> `High`/`Medium`/`Low`, label lama dikanonikalisasi `StoreProjectRequest::canonicalPriority()`).
> Yang ditolak adalah **pengosongannya**: kolomnya `NOT NULL` dengan default `Medium`,
> jadi `priority` tidak masuk daftar kolom yang boleh di-null-kan. Karena default itu,
> 20 proyek yang dibuat sebelum kolom ini ada ikut terisi `Medium` oleh MySQL saat migrasi
> — nilai itu bawaan sistem, bukan pilihan pengajunya. Nilai `null` hanya muncul pada
> baris lama; frontend tetap menanganinya sebagai "Belum ditentukan".

### Update proyek (termasuk data SIT/UAT)
```
PATCH /projects/{id}
{ "sitUatData": { "activeSitStep": 3, "sit2_task_approvals": { "task_10": { "approved": true } }, ... } }
→ 200 { "status": "success", "data": { ... } }
```

### `return_rounds` pada payload proyek

`GET /projects` dan `GET /projects/{id}` memaparkan `return_rounds`: riwayat pengembalian
proyek dari jalur pengujian ke pengembangan, terbaru lebih dulu. Nilainya **selalu array**
— kosong bila proyek belum pernah dikembalikan *maupun* bila relasinya belum dimuat, jadi
layar tidak perlu membedakan keduanya.

```json
"return_rounds": [
  {
    "id": 7,
    "track": "qa",
    "track_label": "Pengujian QA",
    "round_number": 2,
    "round_label": "Pengujian QA — Pengembalian ke-2",

    "status": "OPEN",
    "status_label": "Menunggu Perbaikan",
    "is_open": true,

    "test_report_id": 41,
    "returned_by": 9,
    "returned_by_name": "Rina Wati",
    "returned_at": "2026-08-25T09:12:00+07:00",
    "lead_notes": "Validasi sesi masih bocor pada dua skenario.",
    "severity": "High",

    "resubmitted_by": null,
    "resubmitted_by_name": null,
    "resubmitted_at": null,
    "resubmit_notes": null,

    "fix_tasks": [
      { "id": 88, "title": "Perbaiki validasi sesi", "status": "in_progress",
        "priority": "High", "assignee_id": 14, "assignee": "Budi", "due_date": "2026-08-27" }
    ],
    "fix_task_summary": { "total": 1, "blocking": 1, "unassigned": 0 },

    "can_resubmit": false,
    "resubmit_blocker": "1 task perbaikan belum selesai."
  }
]
```

| Field | Keterangan |
|---|---|
| `id` | PK baris `project_return_rounds` — nilai yang dikirim sebagai `return_round_id` saat membuat task perbaikan |
| `track` / `track_label` | `qa` / `cyber` beserta label Indonesianya (`Pengujian QA` / `Audit Keamanan Siber`) |
| `round_number` / `round_label` | Nomor putaran per jalur, dan label siap-tampil ("… — Pengembalian ke-2") |
| `status` / `status_label` / `is_open` | `OPEN`\|`RESUBMITTED`, labelnya, dan bentuk boolean-nya |
| `test_report_id` | Laporan uji yang memicu pengembalian; boleh `null` pada putaran hasil backfill |
| `returned_by` / `returned_by_name` / `returned_at` | Lead yang menandatangani TIDAK LULUS dan waktunya |
| `lead_notes` / `severity` | Catatan dan keparahan sisi pengujian. **Salinan** saat pengembalian, bukan bacaan hidup dari `test_reports` |
| `resubmitted_by` / `resubmitted_by_name` / `resubmitted_at` / `resubmit_notes` | Terisi hanya setelah putaran ditutup. `resubmitted_by` juga `null` pada putaran hasil backfill, karena pengaju ulangnya memang tidak tercatat |
| `fix_tasks[]` | Task perbaikan putaran ini: `id`, `title`, `status`, `priority`, `assignee_id`, `assignee`, `due_date` |
| `fix_task_summary` | `total`, `blocking` (belum selesai), `unassigned` (belum ada penerima) |
| `can_resubmit` | Verdikt gerbang pengajuan ulang, dihitung server |
| `resubmit_blocker` | Alasan satu baris bila `can_resubmit` bernilai `false`; `null` bila tidak ada penghalang atau putarannya sudah tertutup |

> **Klien wajib mempercayai `can_resubmit`, bukan menurunkan ulang aturannya.** Verdikt ini
> adalah cermin `ProjectReturnRoundService::assertResubmitAllowed()` yang dihitung di
> server. Bila layar menghitung sendiri "apakah semua task sudah selesai", tombol "Ajukan
> Ulang" dan penolakan server akan berbeda pendapat setiap kali aturannya berubah di salah
> satu sisi saja. Pakai `can_resubmit` untuk mengaktifkan tombol dan `resubmit_blocker`
> untuk menjelaskan mengapa tombol itu mati.
>
> Satu nilai `resubmit_blocker` bukan soal pekerjaan, melainkan soal pemuatan data:
> `"Daftar task perbaikan belum dimuat."` muncul bila relasi `tasks` proyek tidak ikut
> dimuat pada respons itu. Dalam keadaan itu `can_resubmit` juga `false` — server memilih
> menahan daripada menjanjikan.

Task perbaikan pada `fix_tasks` disaring dari relasi `tasks` proyek yang sudah dimuat,
bukan dimuat lagi lewat relasi putaran; hasilnya sama tanpa memuat task dua kali per
permintaan. Payload `tasks` proyek juga memaparkan `return_round_id` per task.

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
summary, serta mengembalikan `meta`:

```json
"meta": {
  "conclusion": "accepted|minor_revision|major_revision",
  "requires_development_revision": true,
  "next_uat_step": 1
}
```

- `accepted` / `minor_revision` → `next_uat_step: 3`, proyek tetap `UAT_IN_PROGRESS` dan
  lanjut ke Persetujuan Final. Pesan: *"Hasil UAT tersimpan. Proyek dapat melanjutkan ke
  persetujuan final UAT."*
- `major_revision` → `next_uat_step` bernilai **`1`**, bukan `2`. Proyek berpindah ke
  `UAT_REVISION_DEV`, putaran approval yang berjalan di-`superseded`, dan UAT akan
  **dijalankan ulang dari Tahap 1** setelah SIT ulang menyeluruh lulus. Pesan: *"Hasil UAT
  tersimpan. Revisi mayor dicatat sebagai Change Request, proyek dikembalikan ke developer,
  dan UAT akan dijalankan ulang dari Tahap 1 setelah SIT ulang lulus."*

Karena revisi Mayor mengosongkan `uat2_summary` setelah mengarsipkannya ke
`sit_uat_data.uat_cycles`, `meta.conclusion` untuk kasus itu tidak dibaca dari summary
melainkan diturunkan dari `Project::isUatRestartPending()`.

> Endpoint `POST /projects/{id}/uat-major-verification` **sudah dihapus** bersama mode
> verifikasi item Mayor. Tidak ada penggantinya: user mengeksekusi ulang seluruh skenario
> lewat `POST /projects/{id}/uat-execution` yang biasa.

### Kunci `sit_uat_data` yang dikelola server

Field hasil/kesimpulan UAT, penanda pengulangan, cap waktu SIT ulang, approval UAT,
Change Request, serta arsip siklus UAT dan SIT bersifat server-managed.
`PATCH /projects/{id}` tidak dapat menimpanya: untuk setiap kunci dalam
`ProjectController::SERVER_MANAGED_SIT_UAT_KEYS`, nilai yang tersimpan dipulihkan bila ada
dan kiriman client dibuang bila tidak ada. Kunci yang dilindungi mencakup `uat2_scenarios`,
`uat2_additional_requests`, `uat2_summary`, `uat2_executedCount`, `uat2_passedCount`,
`uat2_findings`, `uat2_execNotes`, `uat_restart_after_sit`, `uat2_resume_after_sit`,
`uat2_verification_history`, `uat2_major_revision_verified_at`,
`uat_sit_retest_passed_at`, `uat2_sit_retest_passed_at`, `uat_hold`,
`uat_revision_cycles`, `uat_cycles`, `sit_retest_scope`, `uat3_approvals`,
`uat_change_requests`, dan `sit_cycles`.

Nama-nama lama berawalan `uat2_` tetap dilindungi karena baris produksi lama masih
menyimpannya.

### Perlindungan `uat1_participants` pada `PATCH /projects/{id}`

Daftar penanda tangan UAT tidak boleh hilang hanya karena satu kiriman yang tidak
menyertakannya. Bila roster yang tersimpan **tidak kosong** sementara
`uat1_participants` yang masuk kosong, absen, atau bukan array, maka roster yang tersimpan
dipertahankan.

Menyunting entri dan menambah peserta tetap berjalan seperti biasa — yang ditolak hanya
**pengosongan**. Alasannya: orang yang sama membawa peran approval-nya melewati setiap
siklus revisi Mayor, dan tidak ada satu pun kondisi bisnis yang membenarkan daftar ini
kembali kosong. Tanpa penjagaan ini, formulir mana pun yang mengirim `sit_uat_data` tanpa
`uat1_participants` akan menghapus seluruh roster dan memaksa PM mengetik ulang belasan
nama beserta nomor HP-nya.

### Change Request UAT
Tidak ada lagi endpoint pengajuan manual. Sejak layar pengajuan CR terpisah dihapus,
setiap Change Request UAT lahir dari Eksekusi Pengujian UAT (Tahap 2): skenario yang
ditandai `result: "revision"` beserta `change_type` minor/mayor dikirim lewat
`POST /projects/{id}/uat-execution`, dan backend yang menuliskan entri
`sit_uat_data.uat_change_requests`. Satu pintu masuk berarti setiap CR selalu terikat
pada skenario pengujian yang menjadi buktinya.

`POST /projects/{id}/uat-change-request` sudah dihapus beserta Form Request-nya.

### Putuskan Change Request (oleh PM/DevLead/Admin)
```
POST /projects/{id}/uat-change-request/decision
{ "cr_id": "cr_1234", "decision": "approved", "note": "Disetujui." }
→ 200 (mayor berpindah ke UAT_REVISION_DEV; minor tidak mengubah status)
```

Keputusan `mayor` mendelegasikan penahanan UAT ke
`UatExecutionService::holdForMajorRevision()` — implementasi yang sama dengan jalur
Eksekusi UAT — sehingga kedua pintu meninggalkan bentuk `sit_uat_data` yang identik:
putaran UAT berjalan diarsipkan ke `uat_cycles`, `sit_retest_scope` diisi `mode: 'full'`,
`uat_hold` diisi dengan `resumeStep: 1`, dan `activeUatStep` menjadi `1`. Urutannya:
mutasi data → `supersedeActiveRounds()` → `transition()`.

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
GET /documents/{id}/download   → stream file (otorisasi = ProjectAccessService::canView)
```

### Hapus dokumen yang masih terikat jejak audit
```
DELETE /documents/{id}
→ 422 {
    "status": "error",
    "message": "Dokumen ini tidak dapat dihapus karena masih menjadi bukti jejak audit: ...",
    "data": { "reasons": ["Dokumen dirujuk sebagai bukti pada laporan pengujian QA."] }
  }
```

## Catatan Error Handling

Seluruh error API memakai envelope yang sama, termasuk error yang dilempar kerangka
kerja. Penyeragamannya dilakukan satu tempat di `backend/bootstrap/app.php`
(`withExceptions`), bukan di masing-masing controller.

- Bentuk respons error: `{ "status": "error", "message": "...", "errors": { field: [msg] } }`.
  Kunci `errors` hanya muncul pada kegagalan validasi.
- 401 → token tidak valid/kedaluwarsa → frontend membersihkan sesi.
- 403 → tidak berwenang. Pesan `abort(403, '...')` dari controller dipertahankan apa
  adanya karena memang ditulis untuk pengguna.
- 404 → data tidak ditemukan. Pesan bawaan Laravel (yang menyebut nama kelas model)
  diganti pesan generik agar tidak membocorkan struktur internal.
- 405 dan 429 memakai pesan generik, dengan header `Allow` dan `Retry-After` tetap
  dipertahankan.
- 422 → validasi gagal atau transisi status ilegal.
- 500 → pesan generik; rincian kegagalan hanya masuk `storage/logs`. Saat
  `APP_DEBUG=true`, kegagalan tak terduga tetap diserahkan ke penangan bawaan Laravel
  supaya jejak tumpukannya masih terlihat selama pengembangan.
