/**
 * Grup Perencanaan dan Quality Assurance — sumber acuan otorisasi untuk grup ini.
 *
 * Grup ini menaungi dua fase kerja yang dijalankan orang yang sama:
 *
 *   - Perencanaan (Fase 1): lead `lead_group` (Kadiv), analis `analyst`;
 *   - Pengujian QA (Fase 3): lead `qa_lead`, analis `qa_tester`.
 *
 * Halamannya sengaja dipisah supaya pembagian pekerjaan per fase tetap jelas, tetapi
 * ORANGNYA satu kumpulan: QA Lead boleh mendisposisikan pengujian ke analis mana pun di
 * grup ini, dan setiap analis punya dua halaman kerja — Workspace Analyst untuk
 * perencanaan dan Tugas QA Saya untuk pengujian.
 *
 * Grup kerja kini JUGA ada sebagai data: tabel `groups` dengan kolom `roles.group_id`,
 * dan Super Admin dapat mengelolanya di halaman Manajemen Grup. Migration
 * `2026_08_25_000001_create_groups_and_role_menu_access` mengisi grup `PERENCANAAN-QA`
 * dengan keempat role di bawah, sehingga keduanya bermula sama.
 *
 * Meskipun demikian, daftar di modul ini tetap acuan OTORISASI, bukan tabel `groups`.
 * Penempatan grup di basis data hanya mengubah pengelompokan dan tampilan; hak melihat
 * halaman, menerima disposisi, dan mengubah status proyek tetap dicocokkan pada nama
 * role. Memindahkan role antar grup lewat halaman Administrasi TIDAK mengubah hak itu —
 * yang harus diubah adalah modul ini beserta cerminannya di backend.
 *
 * Cerminannya di backend ada pada `App\Enums\UserRole`
 * (`PLANNING_QA_GROUP_LABEL`, `PLANNING_QA_ANALYST_ROLES`, `PLANNING_QA_LEAD_ROLES`).
 * Keduanya harus diubah bersamaan: menambah role di sini tanpa menambahkannya di
 * backend membuat pengguna melihat halaman yang setiap aksinya ditolak 403.
 */

/** Nama resmi grup, untuk dipakai apa adanya di teks antarmuka. */
export const PLANNING_QA_GROUP_LABEL = 'Grup Perencanaan dan Quality Assurance';

/**
 * Analis anggota grup — berhak menerima penugasan Fase 1 maupun disposisi QA.
 *
 * Cermin `UserRole::PLANNING_QA_ANALYST_ROLES`.
 */
export const PLANNING_QA_ANALYST_ROLES = ['analyst', 'qa_tester'];

/**
 * Lead pada grup ini. `lead_group` memimpin sisi Perencanaan, `qa_lead` sisi QA.
 *
 * Cermin `UserRole::PLANNING_QA_LEAD_ROLES`.
 */
export const PLANNING_QA_LEAD_ROLES = ['lead_group', 'qa_lead'];

/**
 * Seluruh anggota grup, lead maupun analis.
 */
export const PLANNING_QA_GROUP_ROLES = [
    ...PLANNING_QA_LEAD_ROLES,
    ...PLANNING_QA_ANALYST_ROLES,
];

/**
 * Role yang boleh membuka halaman kerja grup ini — Workspace Analyst (Fase 1),
 * Workspace QA, dan Tugas QA Saya (Fase 3).
 *
 * Halamannya tetap terpisah per fase, tetapi seluruh anggota grup boleh membukanya
 * karena orangnya sama: `analyst` mengerjakan disposisi QA, `qa_tester` mengerjakan
 * penugasan Fase 1, dan kedua Lead perlu membaca fase pasangannya untuk mengatur
 * pembagian kerja.
 *
 * Membuka halaman tidak sama dengan membuka proyek orang lain: daftar proyek tetap
 * disaring `App\Services\ProjectAccessService` di backend, sehingga anggota grup hanya
 * melihat proyek yang memang menjadi tanggung jawabnya.
 */
export const PLANNING_QA_PAGE_ROLES = [
    'super_admin',
    ...PLANNING_QA_LEAD_ROLES,
    ...PLANNING_QA_ANALYST_ROLES,
];

/**
 * Role yang sah menerima disposisi pengujian QA.
 *
 * Cermin `TestingTrack::QA->testerRoles()`: seluruh analis grup, ditambah QA Lead yang
 * pada tim kecil kadang mengerjakan pengujiannya sendiri. Dipakai penyaring daftar
 * personel di Workspace QA — sebelumnya penyaring itu memakai uji substring `'qa'` pada
 * nama role, yang mustahil menemukan `analyst` dan akan ikut meloloskan role baru mana
 * pun yang namanya kebetulan memuat "qa".
 */
export const QA_DISPOSITION_ROLES = [...PLANNING_QA_ANALYST_ROLES, 'qa_lead'];

/**
 * Baca nama role dari objek user, apa pun bentuk payload-nya.
 *
 * `userService.getAll()` mengembalikan `role_detail.name`, sementara konteks autentikasi
 * menyimpan `role` sebagai string. Keduanya dipakai bergantian di banyak halaman.
 */
export const readRoleName = (user) => (
    user?.role_detail?.name || user?.role || ''
).toString().toLowerCase();

/** Apakah pengguna ini analis pada Grup Perencanaan dan Quality Assurance? */
export const isPlanningQaAnalyst = (user) => PLANNING_QA_ANALYST_ROLES.includes(readRoleName(user));

/** Apakah pengguna ini sah menerima disposisi pengujian QA? */
export const isQaDispositionEligible = (user) => QA_DISPOSITION_ROLES.includes(readRoleName(user));
