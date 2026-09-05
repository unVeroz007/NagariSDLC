# Frontend NagariSDLC

Single Page Application React untuk alur governance SDLC Bank Nagari.

## Stack

- React 19
- React Router 7
- Vite 8
- Tailwind CSS 4
- Recharts dan TanStack React Table

## Menjalankan secara lokal

```bash
npm install
copy .env.example .env
npm run dev
```

Perintah verifikasi:

```bash
npm run lint
npm run build
```

## Struktur utama

- `src/router/index.jsx`: route dan guard role.
- `src/services/api.js`: satu pintu panggilan backend.
- `src/contexts`: state global autentikasi, proyek, master data, notifikasi,
  aktivitas, dan chat.
- `src/pages`: halaman per fase dan role.
- `src/components/SITUATWizard.jsx`: alur SIT dan UAT Internal.
- `src/constants/projectStatus.js`: cermin enum/status backend.
- `src/data/menuConfig.js`: menu per role dan pembatasan `menu_access`.

## Sesi aplikasi

Token Sanctum berada pada cookie `HttpOnly`; token tidak disimpan di
`localStorage`. `src/services/api.js` menggunakan `credentials: 'include'` dan
header `X-Requested-With: XMLHttpRequest`. `localStorage.nagari_sdlc_session`
hanya menyimpan profil pengguna serta metadata waktu sesi untuk render awal dan
penjadwalan refresh.

## Konvensi

- Jangan melakukan `fetch` API baru di halaman/komponen; tambahkan ke
  `src/services/api.js`.
- Status, role, dan label bersama ditempatkan pada modul `src/constants`.
- `UNLOCK_ALL_STAGES` pada `SITUATWizard.jsx` harus tetap `false`.
- Otorisasi sebenarnya tetap ditegakkan backend; guard frontend adalah lapisan UX.

Dokumentasi lengkap tersedia di [`../docs`](../docs/README.md).
