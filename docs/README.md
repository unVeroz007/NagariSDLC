# NagariSDLC — Dokumentasi Proyek

Berikut kumpulan dokumen untuk memahami **NagariSDLC** secara menyeluruh.

## 📄 Daftar Dokumen

| File | Isi |
|---|---|
| [`AI_HANDOFF.md`](AI_HANDOFF.md) | **Konteks kerja terkini untuk memindahkan sesi ke AI baru** |
| [`AI_START_PROMPT.md`](AI_START_PROMPT.md) | Prompt siap-tempel saat membuka sesi AI baru |
| [`PROJECT_SUMMARY.md`](PROJECT_SUMMARY.md) | **Ringkasan eksekutif 1 halaman** — mulai dari sini |
| [`PRD.md`](PRD.md) | Product Requirements Document |
| [`AGENTS.md`](AGENTS.md) | Panduan agent AI / pengembang (aturan, role, perintah) |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Arsitektur backend & frontend |
| [`WORKFLOW.md`](WORKFLOW.md) | State machine & alur SDLC (SIT/UAT/QA/Cyber/CR) |
| [`DATA_MODEL.md`](DATA_MODEL.md) | Model data, tabel, `sit_uat_data`, enum |
| [`API_REFERENCE.md`](API_REFERENCE.md) | Referensi endpoint API |

## 🚀 Cara Menjalankan

```bash
# Backend (PHP 8.3 — Laragon)
cd backend
php artisan serve --port=8000

# Frontend
cd frontend
npm run dev
```

Environment: salin `backend/.env.example` menjadi `backend/.env` dan
`frontend/.env.example` menjadi `frontend/.env`. Untuk staging/produksi pakai
`backend/.env.production.example` dan `frontend/.env.production.example`.

- Test backend: `cd backend && php artisan test` (106 test). `backend/phpunit.xml`
  memaksa SQLite in-memory, jadi menjalankan test tidak menyentuh database sungguhan.
- Build frontend: `cd frontend && npm run build`

## ⚠️ Catatan Penting

1. `UNLOCK_ALL_STAGES = false` di `frontend/src/components/SITUATWizard.jsx` —
   alur SIT/UAT terkunci mengikuti status proyek (mode produksi). Nilai `true`
   hanya untuk debug lokal dan tidak boleh di-commit.
2. Role `dev_analyst` (PM modern) belum ada di enum backend — database memakai
   `project_manager`.
3. Data SIT/UAT di `projects.sit_uat_data` (JSON) — lihat `DATA_MODEL.md` §3.
4. CORS backend dibaca dari `CORS_ALLOWED_ORIGINS` (dipisah koma). Setelah
   mengubah `.env` di server, jalankan `php artisan config:cache` lagi.

## ℹ️ Tentang `API_CONTRACT.md` (di root repo)

File `API_CONTRACT.md` di root adalah **dokumen kontrak awal/aspirasi** (berisi
contoh base URL production `sdlc-api.banknagari.co.id` & JWT). Implementasi
aktual berbeda:
- Base URL dev: `http://localhost:8000/api/v1`.
- Auth: **Sanctum Bearer token** (bukan JWT) + refresh.
- Sumber kebenaran endpoint aktual ada di `docs/API_REFERENCE.md`.
