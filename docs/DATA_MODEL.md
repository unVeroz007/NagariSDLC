# NagariSDLC — Model Data

## 1. Diagram Entitas Utama

```
users ──┬── roles
        ├── divisions
        ├── projects (created_by)      ← pemohon
        ├── projects (pm_id)           ← PM
        ├── projects (analyst_id)      ← analyst
        ├── document_vaults (uploaded_by)
        ├── chat_messages (user_id)
        ├── project_status_histories (changed_by)
        └── notifications (user_id)

projects ──┬── project_tasks
           ├── project_team_members
           ├── project_status_histories
           ├── document_vaults
           ├── activity_logs (subject)
           └── chat_messages
```

## 2. Tabel & Field Utama

### users
`id, name, email, password, role_id, division_id, phone_number, is_active`

### roles
`id, name (super_admin, ..., developer, business_user), display_name`

### divisions
`id, code, name`

### projects
| Field | Tipe | Keterangan |
|---|---|---|
| id | int | PK |
| req_id | string | Kode unik `REQ-YYYY-NNN` |
| title / description | string | Nama & deskripsi |
| **contact_phone** | string | **Nomor telpon kontak pemohon (untuk UAT & koordinasi)** |
| type | string | `RBB` / `NON_RBB` |
| project_type | string | `baru` / `perbaikan` / `update` |
| status | string(enum) | Lihat ProjectStatus |
| created_by | FK users | Pemohon |
| pm_id | FK users | PM |
| analyst_id | FK users | Analyst |
| division_id | FK divisions | Divisi pemohon |
| target_date | date | Target selesai |
| staging_url | string | URL staging |
| **sit_uat_data** | json | **Seluruh data SIT/UAT (lihat bawah)** |
| rejection_reason | text | Alasan tolak |
| team_allocated_by_pm | boolean | Tim sudah dialokasi PM |

### project_tasks
`id, project_id, title, description, assignee_id, status (todo|in_progress|hold|done|take_down), due_date, priority, revision_note, revision_requested_at, revision_requested_by`

### project_team_members
`id, project_id, user_id, role_in_project, assigned_by (lead|pm)`

### project_status_histories
`id, project_id, from_status, to_status, changed_by, notes`

### document_vaults
`id, project_id, uploaded_by, document_type, original_filename, file_name (masked), file_path, file_size, mime_type`

### chat_messages
`id, project_id, user_id, message, type (text|system), created_at`

### activity_logs
`id, user_id, action, action_label, description, subject_type, subject_id, metadata (json), ip_address`

### notifications
`id, user_id, title, message, type, is_read, link`

### release_requests
`id, project_id, requested_by, status, notes`

## 3. `sit_uat_data` (JSON di projects)

Struktur lengkap:

```jsonc
{
  // Step aktif wizard
  "activeSitStep": 1,
  "activeUatStep": 1,

  // SIT Tahap 1
  "sit1_stagingUrl": "https://...",

  // SIT Tahap 2 — approval & bukti per task
  "sit2_task_approvals": {
    "task_10": {
      "approved": true,
      "comment": "...",
      "attachments": [{ "id": "...", "docId": 83, "name": "masked", "originalName": "...", "url": "...", "uploadedAt": "..." }],
      "approvedAt": "ISO",
      "approvedBy": "Nama",
      "revisedAt": "ISO",
      "revisedBy": "Nama"
    }
  },
  "sit2_totalCases": 4, "sit2_passedCases": 3, "sit2_defects": 0,

  // SIT Tahap 3 — persetujuan
  "sit3_reviewNotes": "...",
  "sit3_approvals": {
    "developer": { "required": 2, "approvedCount": 2, "developers": [{ "userId": 19, "name": "...", "at": "..." }] },
    "pm": { "approved": true, "approvedBy": "...", "at": "..." },
    "development_lead": { "approved": true, "approvedBy": "...", "at": "..." }
  },

  // UAT Tahap 1
  "uat1_scenarioList": "...",
  "uat1_unit": "Divisi Operasional",
  "uat1_startDate": "2026-08-20",
  "uat1_preparedBy": "Nama PM",
  "uat1_participants": [
    { "id": "uuid", "name": "Pemohon", "role": "Pemohon", "unit": "Divisi...", "phone": "08xx", "isApprover": true, "approvalRole": "requester", "approvalMode": "external_link", "userId": null },
    { "id": "uuid", "name": "PM", "role": "PM / Analyst Pengembangan", "unit": "Divisi Pengembangan TI", "phone": "", "isApprover": true, "approvalRole": "analyst_pm", "approvalMode": "internal_account", "userId": 7 }
  ],
  "uat1_docs": [
    {
      "docId": 90,
      "doc_type": "UNDANGAN",
      "name": "001/GPTD/UNDANGAN/20-Agustus2026_NamaProyek.pdf",
      "originalName": "undangan.pdf",
      "type": "PDF",
      "url": "..."
    }
  ],

  // UAT Tahap 2 — snapshot per skenario; summary dihitung backend
  "uat2_scenarios": [
    {
      "id": "task_10", "taskId": 10, "scenario": "Unduh laporan",
      "result": "accepted|revision", "changeType": "minor|mayor|null",
      "request": "Detail perubahan bila revision", "comment": "...",
      "attachments": [{ "docId": 91, "doc_type": "UAT_EVIDENCE", "name": "masked", "originalName": "bukti.png" }]
    }
  ],
  "uat2_summary": {
    "executedCount": 20, "acceptedCount": 19, "revisionCount": 1,
    "minorCount": 1, "majorCount": 0,
    "conclusion": "accepted|minor_revision|major_revision",
    "notes": "...", "submittedBy": "...", "submittedById": 7, "submittedAt": "ISO"
  },
  // field legacy/kompatibilitas, selalu diturunkan dari summary
  "uat2_executedCount": 20, "uat2_passedCount": 19, "uat2_findings": 1, "uat2_execNotes": "...",
  "uat2_resume_after_sit": false,
  "uat2_major_revision_resolved_at": "ISO|null",

  // UAT Tahap 3 — catatan/dokumen. Approval aktif disimpan pada tabel
  // uat_approval_rounds + uat_approvers; uat3_approvals hanya data legacy.
  "uat3_approvalNotes": "...",
  "uat3_approvals": {
    "business_user": { "approved": true, "approvedBy": "...", "at": "..." },
    "pm": { "approved": true, ... },
    "development_lead": { "approved": true, ... }
  },

  // Change Request UAT; source=uat_execution dibuat otomatis untuk revisi mayor
  "uat_change_requests": [
    { "id": "cr_...", "type": "minor|mayor", "title": "...", "detail": "...",
      "status": "pending|approved|rejected", "submittedBy": "...", "at": "...",
      "source": "uat_execution|legacy", "taskId": 10, "attachments": [],
      "decisionBy": "...", "decisionAt": "...", "decisionNote": "..." }
  ],

  // Snapshot SIT lama sebelum data aktif direset untuk SIT ulang
  "sit_cycles": [
    { "closedAt": "ISO", "reason": "UAT_MAJOR_REVISION", "taskApprovals": {}, "reviewNotes": "...", "documents": [], "approvals": {} }
  ],

  // Riwayat revisi
  "revisions": [ { "type": "SIT_TO_DEV|UAT_TO_SIT|UAT_TO_DEV|UAT_CHANGE_MAYOR|UAT_CHANGE_MINOR", "notes": "...", "at": "...", "by": "..." } ]
}
```

## 4. Persetujuan UAT terstruktur

`uat_approval_rounds` menyimpan setiap putaran persetujuan final per proyek dengan
status `active|completed|superseded`. `uat_approvers` menyimpan satu baris untuk
setiap orang, posisi approval, sisi peminta/IT, metode `external_link` atau
`internal_account`, keputusan, waktu, serta audit akses.

Token link dan token sesi eksternal hanya disimpan sebagai SHA-256 hash. Nomor HP
snapshot approver juga disimpan sebagai keyed hash serta bentuk masking; nilai asli
tetap berada pada data peserta UAT agar PM dapat memperbaikinya sebelum putaran dibuat.

Posisi wajib: pemohon, pimpinan grup pemohon, pimpinan divisi pemohon, minimal satu
developer, Analyst/PM, pimpinan grup pengembangan, serta pimpinan Divisi Teknologi
dan Digitalisasi.

### Normalisasi penting (ProjectResource::normalizeSitUatData)
- `sit2_task_approvals` → key di-prefix `task_` (mis. `task_10`) agar PHP
  `json_encode` menghasilkan **object** bukan array. Frontend wajib strip prefix.

## 5. Enum

### ProjectStatus (project.status)
`PENDING, IN_REVIEW, ANALYSIS_APPROVED, REJECTED, READY_FOR_DEVELOPMENT,
DEV_ANALYSIS, DEV_ANALYSIS_DONE, IN_DEVELOPMENT, SIT_IN_PROGRESS, SIT_PASSED,
SIT_REVISION, UAT_IN_PROGRESS, UAT_REVISION_SIT, UAT_REVISION_DEV, DEV_COMPLETED,
READY_FOR_QA, QA_IN_PROGRESS, RETURN_TO_DEV, QA_PASSED, CYBER_IN_PROGRESS,
CYBER_PASSED, READY_FOR_UAT, UAT_PASSED, PENDING_GOLIVE, LIVE_PRODUCTION,
ON_HOLD, CANCELLED`

### TaskStatus (project_tasks.status)
`todo, in_progress, hold, done, take_down`

### UserRole (users.role)
`super_admin, head_of_it, lead_group, analyst, development_lead, project_manager,
developer, qa_lead, qa_tester, cyber_lead, pentester, business_user`

> Frontend (router/menu) juga mengenal `dev_analyst` (PM modern) & `cyber_team`
> (alias tim cyber) yang TIDAK ada di enum backend — DB memakai
> `project_manager` & `cyber_lead`/`pentester`.

## 5. Migrations Terkini (relevan)

- `2026_08_14_..._add_team_allocated_by_pm...`
- `2026_08_15_..._add_revision_fields_to_project_tasks...`
- `2026_08_20_..._create_chat_messages_table...`
- `2026_08_21_..._add_contact_phone_to_projects...`
