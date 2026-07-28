# SPESIFIKASI KONTRAK REST API (BACKEND API CONTRACT)
## **NagariSDLC - System Governance & SDLC Management**
**Bank Nagari**

Dokumentasi ini menyajikan kontrak endpoint REST API JSON yang dibutuhkan oleh aplikasi frontend **NagariSDLC** untuk dapat langsung terhubung dengan Backend Service Bank Nagari.

---

## 1. BASE CONFIGURATION & AUTHENTICATION

* **Base URL**: `https://sdlc-api.banknagari.co.id/api/v1`
* **Authentication Method**: JWT (JSON Web Token) via Bearer Header.
* **Header Default**:
  ```http
  Authorization: Bearer <JWT_TOKEN>
  Content-Type: application/json
  ```

---

## 2. MODUL AUTENTIKASI (`/auth`)

### `POST /auth/login`
Memverifikasi kredensial pengguna dan mengembalikan sesi JWT.
* **Request Body**:
  ```json
  {
    "email": "user@banknagari.co.id",
    "password": "password123"
  }
  ```
* **Response 200 OK**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
    "user": {
      "id": 1,
      "name": "Ahmad Fauzi",
      "email": "admin@banknagari.co.id",
      "role": "super_admin",
      "department": "Divisi TI",
      "nip": "199001011234"
    }
  }
  ```

### `GET /auth/me`
Mendapatkan profil pengguna yang sedang login berdasarkan token.

---

## 3. MODUL MANAJEMEN PROYEK (`/projects`)

### `GET /projects`
Mendapatkan daftar seluruh proyek SDLC.
* **Query Parameters**: `status`, `type` (RBB/NON_RBB), `division`, `search`.
* **Response 200 OK**:
  ```json
  {
    "data": [
      {
        "id": "PRJ-2026-099",
        "name": "Modul Pelaporan OJK Terpusat",
        "type": "RBB",
        "typeLabel": "RBB (Wajib Selesai)",
        "rbbDeadline": "2026-08-02",
        "division": "Divisi Kepatuhan",
        "phase": "Fase 1: Inisiasi",
        "status": "READY_FOR_DEVELOPMENT",
        "targetDate": "30 Mar 2026",
        "pm": { "id": 2, "name": "Budi Santoso" }
      }
    ]
  }
  ```

### `POST /projects`
Inisiasi proyek baru oleh Business User.
* **Request Body**:
  ```json
  {
    "name": "Aplikasi E-Form KPR",
    "type": "RBB",
    "rbbDeadline": "2026-11-30",
    "division": "Divisi Kredit",
    "description": "Pengajuan KPR online nasabah.",
    "targetDate": "2026-10-15"
  }
  ```

### `PATCH /projects/:id/status`
Transisi status fase proyek.
* **Request Body**:
  ```json
  {
    "status": "APPROVED_FOR_RELEASE",
    "phase": "Fase 4: Rilis Produksi (Live)",
    "notes": "Quality Gate lulus 4 pilar."
  }
  ```

---

## 4. MODUL TASK & KANBAN (`/projects/:id/tasks`)

### `GET /projects/:projectId/tasks`
Mendapatkan daftar task pada suatu proyek.

### `POST /projects/:projectId/tasks`
Membuat task pengembang baru.

---

## 5. MODUL QUALITY GATE & RELEASE (`/quality-gate`)

### `GET /quality-gate/queue`
Mendapatkan antrean rilis yang menunggu approval Head of IT.

### `POST /quality-gate/:releaseId/approve`
Memberikan persetujuan rilis ke lingkungan produksi.

---

## 6. MODUL AUDIT LOG (`/admin/activity-log`)

### `GET /admin/activity-log`
Mendapatkan daftar audit trail sistem.

---
*Kontrak API ini diselaraskan dengan service abstraction layer `frontend/src/services/api.js`.*
