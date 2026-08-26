/**
 * src/services/api.js
 *
 * Service layer untuk komunikasi dengan Backend API NagariSDLC.
 * 100% API calls — tidak ada lagi mock mode.
 * Semua error di-throw dengan pesan yang informatif untuk ditangkap oleh UI.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const SESSION_KEY = 'nagari_sdlc_session';

/**
 * Header wajib untuk permintaan yang mengandalkan cookie sesi.
 *
 * Nilainya harus sama dengan `config('auth_cookie.required_header')` di backend.
 * Cookie dikirim peramban secara otomatis, termasuk pada permintaan yang dipicu
 * situs lain — itulah bentuk dasar CSRF. Formulir HTML lintas situs tidak dapat
 * menyetel header khusus tanpa memicu preflight CORS, jadi menyertakan header ini
 * pada setiap permintaan menutup jalur tersebut. Backend menjawab 400 (bukan 401)
 * bila headernya hilang, sehingga satu pemanggilan yang lupa tidak mengeluarkan
 * pengguna dari aplikasi.
 */
const SESSION_GUARD_HEADER = 'X-Requested-With';
const SESSION_GUARD_VALUE = 'XMLHttpRequest';

/**
 * Sesi aplikasi yang tersimpan di peramban.
 *
 * Token akses TIDAK lagi disimpan di sini. Backend mengirimkannya sebagai cookie
 * `HttpOnly` (lihat `backend/app/Support/SessionTokenCookie.php`), sehingga
 * peramban melampirkannya sendiri pada setiap permintaan dan JavaScript tidak
 * dapat membacanya. Isi `localStorage` dapat dibaca skrip apa pun yang berhasil
 * dieksekusi di halaman, jadi satu celah XSS dahulu cukup untuk mengeluarkan
 * token dan memakainya dari mesin lain sampai masa berlakunya habis.
 *
 * Yang tersisa di sini hanya data yang memang aman terlihat: profil pengguna
 * untuk render awal sebelum `GET /auth/me` selesai, `issuedAt` untuk menjadwalkan
 * penyegaran, dan `expiresInMinutes` yang dilaporkan backend.
 *
 * Dipakai bersama `AuthContext`, `ProjectContext`, dan halaman Pengaturan supaya
 * bentuk sesinya hanya ditulis di satu tempat.
 */
export const sessionStore = {
    read() {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            // Isi localStorage bisa rusak (disunting manual, atau ditulis versi
            // aplikasi lain). Sesi yang tidak terbaca sama saja dengan tidak ada.
            return null;
        }
    },

    save({ user, issuedAt = Date.now(), expiresInMinutes }) {
        const session = { user, issuedAt };

        const minutes = Number(expiresInMinutes);
        if (Number.isFinite(minutes) && minutes > 0) {
            session.expiresInMinutes = minutes;
        }

        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return session;
    },

    clear() {
        localStorage.removeItem(SESSION_KEY);
    },
};

/**
 * Masa berlaku token bila backend belum pernah melaporkannya.
 *
 * Sumber kebenarannya adalah backend: respons login/refresh mengembalikan
 * `data.token_expires_in_minutes`, yang dihitung dari `SANCTUM_TOKEN_EXPIRATION`.
 * Angka itulah yang dipakai — nilai di bawah ini hanya cadangan untuk sesi lama
 * yang tersimpan sebelum kunci tersebut ada.
 *
 * `VITE_TOKEN_EXPIRY_MINUTES` dipertahankan sebagai cadangan yang dapat disetel,
 * tetapi tidak perlu lagi disamakan manual dengan konfigurasi backend.
 */
const DEFAULT_TOKEN_EXPIRY_MINUTES = 480;
const parsedExpiryMinutes = Number(import.meta.env.VITE_TOKEN_EXPIRY_MINUTES);
const FALLBACK_TOKEN_EXPIRY_MINUTES = Number.isFinite(parsedExpiryMinutes) && parsedExpiryMinutes > 0
    ? parsedExpiryMinutes
    : DEFAULT_TOKEN_EXPIRY_MINUTES;

let isRefreshing = false;
let refreshPromise = null;

// ──────────────────────────────────────────────────────────
// Helper: headers standar untuk permintaan bersesi
// ──────────────────────────────────────────────────────────
function authHeaders() {
    // Tidak ada lagi header `Authorization` di sini: tokennya dibawa cookie
    // `HttpOnly` yang dilampirkan peramban, dan `credentials: 'include'` pada
    // setiap pemanggilanlah yang membuat cookie itu ikut terkirim lintas origin.
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        [SESSION_GUARD_HEADER]: SESSION_GUARD_VALUE,
    };
}

// ──────────────────────────────────────────────────────────
// Helper: check if token needs refresh
// ──────────────────────────────────────────────────────────
function tokenLifetimeMs() {
    const stored = Number(sessionStore.read()?.expiresInMinutes);
    const minutes = Number.isFinite(stored) && stored > 0 ? stored : FALLBACK_TOKEN_EXPIRY_MINUTES;
    return minutes * 60 * 1000;
}

function shouldRefreshToken() {
    const issuedAt = sessionStore.read()?.issuedAt;
    if (!issuedAt) return false;

    const lifetimeMs = tokenLifetimeMs();
    // Segarkan 5 menit sebelum kedaluwarsa. Untuk masa berlaku yang sangat pendek
    // (misal 5 menit saat uji coba), ambang tidak boleh melebihi masa berlaku itu
    // sendiri — kalau tidak, setiap permintaan akan memicu penyegaran.
    const thresholdMs = Math.min(5 * 60 * 1000, Math.floor(lifetimeMs / 2));

    return (Date.now() - issuedAt) > (lifetimeMs - thresholdMs);
}

// ──────────────────────────────────────────────────────────
// Helper: refresh token silently
// ──────────────────────────────────────────────────────────
/**
 * Putar token sesi sebelum kedaluwarsa.
 *
 * Tidak ada token yang dibaca maupun dikembalikan: cookie lama dikirim peramban,
 * backend mencabutnya dan melekatkan cookie baru pada respons. Yang disimpan
 * ulang hanya profil pengguna beserta waktu terbit yang baru.
 *
 * @returns {Promise<boolean>} `true` bila sesi berhasil diperpanjang.
 */
async function refreshToken() {
    if (isRefreshing && refreshPromise) return refreshPromise;

    isRefreshing = true;
    refreshPromise = (async () => {
        try {
            // Tanpa sesi tersimpan, pengguna memang belum masuk — memanggil
            // refresh hanya akan menghasilkan 401 dan memicu toast "sesi berakhir".
            if (!sessionStore.read()) return false;

            const res = await fetch(`${BASE_URL}/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
                headers: authHeaders(),
            });

            if (!res.ok) return false;

            const body = await res.json();
            if (body.status !== 'success' || !body.data?.user) return false;

            sessionStore.save({
                user: body.data.user,
                expiresInMinutes: body.data.token_expires_in_minutes,
            });

            return true;
        } catch {
            return false;
        } finally {
            isRefreshing = false;
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

// ──────────────────────────────────────────────────────────
// Helper: ensure token is fresh before API call
// ──────────────────────────────────────────────────────────
async function ensureFreshToken() {
    if (shouldRefreshToken()) {
        await refreshToken();
    }
}

// ──────────────────────────────────────────────────────────
// Centralized fetch with auto-refresh token
// ──────────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
    await ensureFreshToken();
    const headers = { ...authHeaders(), ...options.headers };
    // `credentials` disetel setelah `options` sehingga pemanggil tidak dapat
    // menghilangkannya tanpa sengaja — tanpa nilai ini peramban tidak mengirim
    // cookie sesi ke origin API dan setiap permintaan dijawab 401.
    const res = await fetch(url, { ...options, credentials: 'include', headers });
    return handleResponse(res);
}

function buildApiErrorMessage(errBody, status) {
    const baseMessage = errBody.message || `HTTP ${status}`;
    if (!errBody.errors || typeof errBody.errors !== 'object') return baseMessage;

    const detailMessages = [...new Set(Object.values(errBody.errors).flat())]
        .filter(message => message && message !== baseMessage);
    return detailMessages.length > 0
        ? `${baseMessage}: ${detailMessages.join(', ')}`
        : baseMessage;
}

// ──────────────────────────────────────────────────────────
// Helper: handle response dari fetch
// ──────────────────────────────────────────────────────────
async function handleResponse(res) {
    if (!res.ok) {
        // 401 → trigger auto-logout via event
        if (res.status === 401) {
            sessionStore.clear();
            window.dispatchEvent(new Event('auth:unauthorized'));
        }

        let errBody;
        try {
            errBody = await res.json();
        } catch {
            errBody = { message: `HTTP ${res.status}: Terjadi kesalahan server.` };
        }

        const errMsg = buildApiErrorMessage(errBody, res.status);
        const error = new Error(errMsg);
        error.status = res.status;
        error.data = errBody;
        throw error;
    }

    // 204 No Content
    if (res.status === 204) return null;
    return res.json();
}

// Endpoint link approval tidak boleh memicu logout sesi aplikasi ketika sesi
// eksternalnya kedaluwarsa atau nomor verifikasi tidak cocok.
async function handlePublicResponse(res) {
    if (!res.ok) {
        let errBody;
        try {
            errBody = await res.json();
        } catch {
            errBody = { message: `HTTP ${res.status}: Terjadi kesalahan server.` };
        }
        const errMsg = buildApiErrorMessage(errBody, res.status);
        const error = new Error(errMsg);
        error.status = res.status;
        error.data = errBody;
        throw error;
    }
    if (res.status === 204) return null;
    return res.json();
}

/**
 * Nama event lintas komponen: jumlah persetujuan internal yang menunggu berubah.
 *
 * Lencana "Persetujuan Saya" hidup di `MainLayout`, sedangkan keputusannya dikirim
 * dari halaman `/approvals` maupun dari wizard SIT/UAT — dua cabang pohon komponen
 * yang tidak saling melihat state. Tanpa isyarat ini lencana hanya ikut selang
 * polling, sehingga tetap menyala sampai 30 detik setelah pengguna menyetujui dan
 * terbaca sebagai pekerjaan yang belum dilakukan.
 *
 * Pengirimannya diletakkan di lapisan service, bukan di masing-masing halaman, agar
 * pemanggil baru tidak perlu mengingat kewajiban ini. Polanya mengikuti
 * `auth:unauthorized` yang sudah dipakai di berkas ini.
 */
export const APPROVALS_CHANGED_EVENT = 'approvals:changed';

function notifyApprovalsChanged() {
    window.dispatchEvent(new Event(APPROVALS_CHANGED_EVENT));
}

// ──────────────────────────────────────────────────────────
// AUTH SERVICE
// ──────────────────────────────────────────────────────────
export const authService = {
    login: async (email, password) => {
        // `credentials: 'include'` wajib: tanpanya peramban membuang header
        // `Set-Cookie` dari respons lintas origin ini dan sesi tidak pernah terbentuk.
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            credentials: 'include',
            headers: authHeaders(),
            body: JSON.stringify({ email, password }),
        });
        return handleResponse(res);
    },

    register: async (data) => {
        const res = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(data),
        });
        return handleResponse(res);
    },

    /**
     * Daftar divisi resmi untuk dropdown formulir pendaftaran.
     *
     * Endpoint publik tersendiri karena formulir pendaftaran berada di luar sesi
     * dan tidak dapat memakai `GET /divisions` yang berada di balik auth. Hanya
     * mengembalikan `{ id, name }`. Registrasi wajib mengirim `division_id` dari
     * daftar ini — backend menolak nama divisi yang tidak terdaftar.
     */
    getPublicDivisions: async () => {
        const res = await fetch(`${BASE_URL}/auth/divisions`, {
            headers: { 'Accept': 'application/json' },
        });
        return handleResponse(res);
    },

    /**
     * Minta tautan reset password dikirim ke email.
     *
     * Balasan backend sengaja seragam untuk email terdaftar maupun tidak, supaya
     * formulir ini tidak dapat dipakai memeriksa siapa yang punya akun. Jangan
     * mengubah pesan sukses menjadi konfirmasi bahwa emailnya ada.
     *
     * Status 429 berarti permintaan terlalu sering — `handleResponse` melemparkan
     * pesan dari backend beserta `error.status`, jadi pemanggil boleh membedakannya.
     */
    requestPasswordReset: async (email) => {
        const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ email }),
        });
        return handleResponse(res);
    },

    /**
     * Setel password baru memakai `token` dan `email` dari tautan email.
     *
     * Keduanya dibaca dari query string halaman `/reset-password` dan harus dikirim
     * apa adanya. Token hanya sekali pakai dan berlaku 60 menit; tautan yang gagal
     * dibalas 422 dengan satu pesan generik.
     */
    resetPassword: async ({ token, email, password, passwordConfirmation }) => {
        // Respons sukses melekatkan cookie sesi kedaluwarsa (seluruh token akun
        // dicabut di server), jadi `credentials: 'include'` diperlukan agar
        // peramban benar-benar membuang cookie yang mungkin masih tersimpan.
        const res = await fetch(`${BASE_URL}/auth/reset-password`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                token,
                email,
                password,
                password_confirmation: passwordConfirmation,
            }),
        });
        return handleResponse(res);
    },

    logout: async () => {
        try {
            await fetch(`${BASE_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: authHeaders(),
            });
        } catch {
            // Ignore error on logout — we clear session anyway
        }
        // Cookie sesinya dihapus server lewat respons di atas; yang dibersihkan di
        // sini hanya sisa data pengguna. Bila permintaannya gagal, cookie masih
        // tertinggal di peramban — tokennya tetap berlaku sampai kedaluwarsa, jadi
        // kegagalan logout tidak boleh dianggap sukses secara diam-diam oleh
        // pemanggil yang memerlukan pencabutan sesi.
        sessionStore.clear();
    },

    getCurrentUser: async () => {
        return apiFetch(`${BASE_URL}/auth/me`);
    },

    updateProfile: async (name, phoneNumber) => {
        return apiFetch(`${BASE_URL}/auth/profile`, {
            method: 'PATCH',
            body: JSON.stringify({ name, phone_number: phoneNumber }),
        });
    },

    updatePassword: async (currentPassword, newPassword) => {
        return apiFetch(`${BASE_URL}/auth/password`, {
            method: 'PATCH',
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
        });
    },
};

// ──────────────────────────────────────────────────────────
// PROJECT SERVICE
// ──────────────────────────────────────────────────────────

// Ukuran halaman saat menarik seluruh daftar proyek. Harus <= batas `per_page`
// yang diterima `ProjectController@index` (200).
const PROJECTS_PAGE_SIZE = 200;

export const projectService = {
    getNextReqId: async () => {
        return apiFetch(`${BASE_URL}/projects/next-req-id`);
    },

    getAll: async (filters = {}) => {
        // Endpoint `/projects` dipaginasi di backend. Hampir semua layar aplikasi
        // menghitung agregat lintas proyek (dasbor, Kanban, laporan, lencana),
        // jadi daftar ini harus utuh: sebelumnya frontend hanya mengambil halaman
        // pertama, sehingga begitu jumlah proyek melewati satu halaman, proyek
        // sisanya tidak pernah tampil maupun ikut terhitung — tanpa pesan apa pun.
        //
        // Halaman pertama diambil lebih dulu untuk mengetahui `last_page`, lalu
        // halaman sisanya diambil serentak dan digabung.
        const buildUrl = (page) => {
            const params = new URLSearchParams({
                ...filters,
                per_page: String(PROJECTS_PAGE_SIZE),
                page: String(page),
            });
            return `${BASE_URL}/projects?${params.toString()}`;
        };

        const firstPage = await apiFetch(buildUrl(1));
        const lastPage = Number(firstPage?.meta?.last_page) || 1;
        if (lastPage <= 1 || !Array.isArray(firstPage?.data)) return firstPage;

        const remainingPages = [];
        for (let page = 2; page <= lastPage; page += 1) remainingPages.push(page);
        const remaining = await Promise.all(remainingPages.map((page) => apiFetch(buildUrl(page))));

        const data = remaining.reduce(
            (acc, res) => (Array.isArray(res?.data) ? acc.concat(res.data) : acc),
            [...firstPage.data],
        );

        return {
            ...firstPage,
            data,
            meta: {
                ...(firstPage.meta || {}),
                // Penanda bahwa `data` sudah berisi seluruh halaman, bukan hanya
                // halaman `current_page`.
                fetched_pages: lastPage,
                fetched_all: true,
            },
        };
    },

    getById: async (id) => {
        return apiFetch(`${BASE_URL}/projects/${id}`);
    },

    create: async (projectData) => {
        return apiFetch(`${BASE_URL}/projects`, {
            method: 'POST',
            body: JSON.stringify(projectData),
        });
    },

    update: async (id, updates) => {
        return apiFetch(`${BASE_URL}/projects/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    },

    updateStatus: async (id, newStatus, notes = '') => {
        return apiFetch(`${BASE_URL}/projects/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus, notes }),
        });
    },

    delete: async (id) => {
        return apiFetch(`${BASE_URL}/projects/${id}`, {
            method: 'DELETE',
        });
    },

    allocateTeam: async (projectId, team) => {
        return apiFetch(`${BASE_URL}/projects/${projectId}/team`, {
            method: 'POST',
            body: JSON.stringify({ team }),
        });
    },

    getTimeline: async (id) => {
        return apiFetch(`${BASE_URL}/projects/${id}/timeline`);
    },

    getSitGate: async (id) => {
        return apiFetch(`${BASE_URL}/projects/${id}/sit-gate`);
    },

    // Persetujuan SIT Tahap 3 oleh role (developer/analyst/development_lead)
    submitSitApproval: async (id, note = '') => {
        const response = await apiFetch(`${BASE_URL}/projects/${id}/sit-approval`, {
            method: 'POST',
            body: JSON.stringify({ note }),
        });
        notifyApprovalsChanged();

        return response;
    },

    getUatApprovalMatrix: async (id) => {
        return apiFetch(`${BASE_URL}/projects/${id}/uat-approval-matrix`);
    },

    restartUatApprovalRound: async (id) => {
        const response = await apiFetch(`${BASE_URL}/projects/${id}/uat-approval-rounds`, {
            method: 'POST',
        });
        notifyApprovalsChanged();

        return response;
    },

    syncUatApprovalRound: async (id) => {
        const response = await apiFetch(`${BASE_URL}/projects/${id}/uat-approval-rounds/sync`, {
            method: 'POST',
        });
        notifyApprovalsChanged();

        return response;
    },

    generateUatApprovalLink: async (id, approverId) => {
        return apiFetch(`${BASE_URL}/projects/${id}/uat-approvers/${approverId}/link`, { method: 'POST' });
    },

    submitUatApproval: async (id, approverId, decision, note = '') => {
        const response = await apiFetch(`${BASE_URL}/projects/${id}/uat-approvers/${approverId}/decision`, {
            method: 'POST',
            body: JSON.stringify({ decision, note }),
        });
        notifyApprovalsChanged();

        return response;
    },

    // Snapshot hasil UAT Tahap 2 per skenario; kesimpulan dihitung server.
    // Kesimpulannya menentukan putaran persetujuan: hasil tanpa revisi Mayor membuka
    // putaran baru, sedangkan revisi Mayor membatalkan putaran yang berjalan. Keduanya
    // mengubah isi inbox penanda tangan, jadi lencananya ikut disegarkan.
    submitUatExecution: async (id, payload) => {
        const response = await apiFetch(`${BASE_URL}/projects/${id}/uat-execution`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        notifyApprovalsChanged();

        return response;
    },

    saveUatExecutionDraft: async (id, payload) => {
        return apiFetch(`${BASE_URL}/projects/${id}/uat-execution/draft`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
    },

    /*
     * Change Request UAT kini selalu lahir dari Eksekusi Pengujian UAT (Tahap 2):
     * skenario yang ditandai "revisi" beserta jenisnya minor/mayor dikirim lewat
     * `submitUatExecution`, dan backend-lah yang mencatat entri
     * `sit_uat_data.uat_change_requests`. Endpoint pengajuan manual
     * `POST /projects/{id}/uat-change-request` sudah dihapus bersama layarnya,
     * sehingga wrapper `submitUatChangeRequest` di sini juga dihapus — wrapper itu
     * tinggal menunjuk rute yang menjawab 404. Jalur keputusannya tetap hidup.
     */

    // Putuskan Change Request UAT (approve/reject)
    decideUatChangeRequest: async (id, payload) => {
        return apiFetch(`${BASE_URL}/projects/${id}/uat-change-request/decision`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },
};

// ──────────────────────────────────────────────────────────
// TASK SERVICE
// ──────────────────────────────────────────────────────────
export const taskService = {
    getByProject: async (projectId) => {
        return apiFetch(`${BASE_URL}/projects/${projectId}/tasks`);
    },

    create: async (projectId, taskData) => {
        return apiFetch(`${BASE_URL}/projects/${projectId}/tasks`, {
            method: 'POST',
            body: JSON.stringify(taskData),
        });
    },

    update: async (taskId, updates) => {
        return apiFetch(`${BASE_URL}/tasks/${taskId}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    },

    delete: async (taskId) => {
        return apiFetch(`${BASE_URL}/tasks/${taskId}`, {
            method: 'DELETE',
        });
    },

    requestRevision: async (taskId, revisionNote) => {
        return apiFetch(`${BASE_URL}/tasks/${taskId}/request-revision`, {
            method: 'POST',
            body: JSON.stringify({ revision_note: revisionNote }),
        });
    },
};

// ──────────────────────────────────────────────────────────
// TESTING TRACK SERVICE (QA & CYBER)
// ──────────────────────────────────────────────────────────
/**
 * Pembuat service untuk satu jalur pengujian.
 *
 * Kedua jalur memakai empat langkah dengan bentuk permintaan yang identik, sehingga
 * definisinya dibuat satu kali. Sebelumnya keduanya ditulis terpisah dan hanya memiliki
 * `create` yang menggabungkan laporan pelaksana dengan keputusan Lead.
 */
const createTestingTrackService = (resource) => ({
    /** Daftar laporan pengujian jalur ini, tersaring visibilitas proyek. */
    getAll: async (projectId = null) => {
        const query = projectId ? `?project_id=${projectId}` : '';
        return apiFetch(`${BASE_URL}/${resource}${query}`);
    },

    /** Langkah 1 — PM mengajukan proyek ke jalur ini. */
    submitRequest: async (payload) => {
        return apiFetch(`${BASE_URL}/${resource}/submit`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    /** Langkah 2 — Lead mendisposisikan pengujian kepada pelaksana. */
    assign: async (payload) => {
        return apiFetch(`${BASE_URL}/${resource}/assign`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    /** Langkah 3 — pelaksana mengirim laporan; jalur berhenti di REVIEW. */
    submitReport: async (payload) => {
        return apiFetch(`${BASE_URL}/${resource}/report`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    /** Langkah 4 — Lead memutuskan lulus, atau mengembalikan ke pengembangan. */
    signOff: async (payload) => {
        return apiFetch(`${BASE_URL}/${resource}/sign-off`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },
});

export const qaRequestService = createTestingTrackService('qa-requests');

export const cyberRequestService = createTestingTrackService('cyber-requests');

// ──────────────────────────────────────────────────────────
// USER SERVICE
// ──────────────────────────────────────────────────────────
export const userService = {
    // Cache module-level untuk daftar user (jarang berubah). TTL 5 menit.
    // Menghindari request GET /users berulang setiap kali halaman dibuka.
    _cache: null,
    _cacheAt: null,
    CACHE_TTL_MS: 5 * 60 * 1000,

    getAll: async (force = false) => {
        const now = Date.now();
        if (!force && userService._cache && userService._cacheAt && (now - userService._cacheAt < userService.CACHE_TTL_MS)) {
            return userService._cache;
        }
        const res = await apiFetch(`${BASE_URL}/users`);
        // Cache hanya jika sukses (res.data berupa array)
        if (res && Array.isArray(res.data)) {
            userService._cache = res;
            userService._cacheAt = now;
        }
        return res;
    },

    // Paksa refresh cache (misal setelah create/update user)
    invalidateCache: () => {
        userService._cache = null;
        userService._cacheAt = null;
    },

    // Beban aktif lintas-fase per pengguna (Perencanaan + QA + Siber), dihitung
    // server-side. Sengaja TIDAK di-cache: angkanya berubah tiap disposisi/laporan dan
    // dropdown disposisi harus menampilkan beban terkini. Bentuk: [{id, name, active_load}].
    workload: async () => apiFetch(`${BASE_URL}/users/workload`),

    create: async (userData) => {
        const res = await apiFetch(`${BASE_URL}/users`, {
            method: 'POST',
            body: JSON.stringify(userData),
        });
        userService.invalidateCache();
        return res;
    },

    update: async (id, updates) => {
        const res = await apiFetch(`${BASE_URL}/users/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
        userService.invalidateCache();
        return res;
    },

    delete: async (id) => {
        const res = await apiFetch(`${BASE_URL}/users/${id}`, {
            method: 'DELETE',
        });
        userService.invalidateCache();
        return res;
    },
};

// ──────────────────────────────────────────────────────────
// NOTIFICATION SERVICE
//
// Kotak masuk notifikasi persisten milik pengguna (tabel `notifications`), yang
// ditulis backend saat status proyek berpindah dan saat jalur pengujian
// bergerak. Berbeda dengan `NotificationContext` di frontend, yang menyimpan
// pemberitahuan sesaat hasil aksi pengguna sendiri di localStorage dan tidak
// pernah dikirim ke server.
//
// Ketiga fungsi mengembalikan envelope utuh `{ status, message, data, meta? }`,
// sama seperti service lain di berkas ini — pemanggil yang menempuh `.data`.
// ──────────────────────────────────────────────────────────
export const notificationService = {
    /**
     * Halaman pertama kotak masuk, terbaru lebih dulu.
     *
     * `data` berisi array notifikasi (`id`, `title`, `message`, `type`,
     * `is_read`, `created_at`), dan `meta` membawa pagination beserta
     * `unread_count` untuk seluruh kotak masuk — bukan hanya halaman ini.
     *
     * `perPage` divalidasi backend (integer 1..100); nilai di luar rentang
     * dibalas 422, jadi jangan meneruskan masukan pengguna mentah ke sini.
     */
    getAll: async ({ perPage } = {}) => {
        const query = perPage ? `?per_page=${encodeURIComponent(perPage)}` : '';
        return apiFetch(`${BASE_URL}/notifications${query}`);
    },

    /**
     * Tandai satu notifikasi sudah dibaca.
     *
     * Id milik pengguna lain (dan id yang tidak ada) dibalas 403, bukan 404 —
     * backend sengaja tidak membedakan keduanya.
     */
    markRead: async (id) => {
        return apiFetch(`${BASE_URL}/notifications/${id}/read`, {
            method: 'PATCH',
        });
    },

    /** Tandai seluruh notifikasi belum dibaca milik pengguna sekaligus. */
    markAllRead: async () => {
        return apiFetch(`${BASE_URL}/notifications/read-all`, {
            method: 'PATCH',
        });
    },
};

// ──────────────────────────────────────────────────────────
// DOCUMENT SERVICE (upload/download pakai raw fetch karena FormData + blob)
export const documentService = {
    getAll: async (projectId) => {
        const url = projectId
            ? `${BASE_URL}/documents?project_id=${projectId}`
            : `${BASE_URL}/documents`;
        return apiFetch(url);
    },

    upload: async (file, metadata) => {
        const formData = new FormData();
        formData.append('file', file);
        Object.entries(metadata).forEach(([k, v]) => {
            if (v !== undefined && v !== null) formData.append(k, v);
        });
        const headers = { ...authHeaders() };
        // `Content-Type` harus dibuang agar peramban menuliskannya sendiri beserta
        // boundary multipart. Header penjaga sesi tetap dipertahankan.
        delete headers['Content-Type'];
        await ensureFreshToken();
        const res = await fetch(`${BASE_URL}/documents`, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: formData,
        });
        return handleResponse(res);
    },

    download: async (id) => {
        await ensureFreshToken();
        const res = await fetch(`${BASE_URL}/documents/${id}/download`, {
            credentials: 'include',
            headers: authHeaders(),
        });
        if (!res.ok) throw new Error(`Gagal mengunduh dokumen (HTTP ${res.status})`);
        return res.blob();
    },

    delete: async (id) => apiFetch(`${BASE_URL}/documents/${id}`, { method: 'DELETE' }),
};

export const externalUatApprovalService = {
    preview: async (token) => {
        const res = await fetch(`${BASE_URL}/uat-approvals/${encodeURIComponent(token)}`, {
            headers: { Accept: 'application/json' },
        });
        return handlePublicResponse(res);
    },

    verify: async (token, phone) => {
        const res = await fetch(`${BASE_URL}/uat-approvals/${encodeURIComponent(token)}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ phone }),
        });
        return handlePublicResponse(res);
    },

    detail: async (token, accessToken) => {
        const res = await fetch(`${BASE_URL}/uat-approvals/${encodeURIComponent(token)}/detail`, {
            headers: { Accept: 'application/json', 'X-UAT-Approval-Access': accessToken },
        });
        return handlePublicResponse(res);
    },

    decide: async (token, accessToken, decision, note = '') => {
        const res = await fetch(`${BASE_URL}/uat-approvals/${encodeURIComponent(token)}/decision`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-UAT-Approval-Access': accessToken,
            },
            body: JSON.stringify({ decision, note }),
        });
        return handlePublicResponse(res);
    },

    downloadDocument: async (token, accessToken, documentId) => {
        const res = await fetch(`${BASE_URL}/uat-approvals/${encodeURIComponent(token)}/documents/${documentId}/download`, {
            headers: { 'X-UAT-Approval-Access': accessToken },
        });
        if (!res.ok) throw new Error(`Gagal mengunduh dokumen (HTTP ${res.status})`);
        return res.blob();
    },
};

export const internalUatApprovalService = {
    getMyAssignments: async () => apiFetch(`${BASE_URL}/me/uat-approvals`),
};

/**
 * Inbox persetujuan SIT lintas proyek milik akun yang sedang masuk.
 *
 * Isi `data` langsung dikembalikan (`{ pending_count, items }`) karena bentuk itulah
 * yang disepakati sebagai kontrak halaman "Persetujuan Saya" dan lencana sidebar —
 * berbeda dengan `internalUatApprovalService` di atas yang masih meneruskan seluruh
 * envelope. Akun yang tidak memegang slot persetujuan SIT tetap dijawab sukses oleh
 * backend dengan `pending_count: 0`, jadi keadaan "tidak berhak" bukan sebuah error
 * dan tidak perlu dibedakan oleh pemanggil.
 */
export const internalSitApprovalService = {
    getMyAssignments: async () => {
        const response = await apiFetch(`${BASE_URL}/me/sit-approvals`);
        return response?.data ?? { pending_count: 0, items: [] };
    },
};

export const activityLogService = {
    getAll: async (filters = {}) => {
        const params = new URLSearchParams(filters).toString();
        return apiFetch(`${BASE_URL}/activity-logs?${params}`);
    },
    // Log aktivitas untuk satu proyek (filter metadata.project_id)
    getByProject: async (projectId, perPage = 100) => {
        const params = new URLSearchParams({ project_id: projectId, per_page: perPage }).toString();
        return apiFetch(`${BASE_URL}/activity-logs?${params}`);
    },
    // Log aktivitas untuk satu task (filter subject_type + subject_id)
    getByTask: async (taskId, perPage = 50) => {
        const params = new URLSearchParams({ task_id: taskId, per_page: perPage }).toString();
        return apiFetch(`${BASE_URL}/activity-logs?${params}`);
    },
    getSummary: async () => apiFetch(`${BASE_URL}/activity-logs/summary`),
};

// ──────────────────────────────────────────
// CHAT SERVICE (per proyek)
// ──────────────────────────────────────────
export const chatService = {
    getByProject: async (projectId) => {
        return apiFetch(`${BASE_URL}/projects/${projectId}/chat`);
    },
    // Tipe pesan ditentukan server, bukan klien: hanya kode server yang boleh
    // membuat pesan bertipe `system`.
    send: async (projectId, message) => {
        return apiFetch(`${BASE_URL}/projects/${projectId}/chat`, {
            method: 'POST',
            body: JSON.stringify({ message }),
        });
    },
};

// Grup kerja: pengelompokan role, bukan gerbang otorisasi. Memindahkan role antar grup
// mengubah pengelompokan dan tampilan, bukan hak transisi status — hak itu tetap
// ditentukan nama role di backend (`ProjectWorkflowService`, `ProjectAccessService`).
export const groupService = {
    getAll: async () => apiFetch(`${BASE_URL}/groups`),
    create: async (groupData) => apiFetch(`${BASE_URL}/groups`, { method: 'POST', body: JSON.stringify(groupData) }),
    update: async (id, updates) => apiFetch(`${BASE_URL}/groups/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    delete: async (id) => apiFetch(`${BASE_URL}/groups/${id}`, { method: 'DELETE' }),
};

export const roleService = {
    getAll: async () => apiFetch(`${BASE_URL}/roles`),
    create: async (roleData) => apiFetch(`${BASE_URL}/roles`, { method: 'POST', body: JSON.stringify(roleData) }),
    update: async (id, updates) => apiFetch(`${BASE_URL}/roles/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    delete: async (id) => apiFetch(`${BASE_URL}/roles/${id}`, { method: 'DELETE' }),
};

export const divisionService = {
    getAll: async () => apiFetch(`${BASE_URL}/divisions`),
    create: async (divData) => apiFetch(`${BASE_URL}/divisions`, { method: 'POST', body: JSON.stringify(divData) }),
    update: async (id, updates) => apiFetch(`${BASE_URL}/divisions/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    delete: async (id) => apiFetch(`${BASE_URL}/divisions/${id}`, { method: 'DELETE' }),
};

export const dashboardService = {
    getSummary: async () => apiFetch(`${BASE_URL}/dashboard/summary`),
    getAnalytics: async () => apiFetch(`${BASE_URL}/dashboard/analytics`),
};

export const qualityGateService = {
    getQueue: async () => apiFetch(`${BASE_URL}/quality-gate/queue`),
    approve: async (projectId, notes = '') => apiFetch(`${BASE_URL}/quality-gate/approve`, {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, notes }),
    }),
    // Penolakan rilis punya endpoint sendiri: alasannya wajib, tercatat pada baris
    // pengajuan rilis beserta penolaknya, dan transisi statusnya melewati
    // ProjectWorkflowService. Sebelumnya layar Quality Gate menolak lewat
    // `PATCH /projects/{id}` tanpa alasan dan tanpa jejak siapa yang menolak.
    reject: async (projectId, reason) => apiFetch(`${BASE_URL}/quality-gate/reject`, {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, reason }),
    }),
};

export const releaseRequestService = {
    getAll: async () => apiFetch(`${BASE_URL}/release-requests`),
    create: async (data) => apiFetch(`${BASE_URL}/release-requests`, {
        method: 'POST',
        body: JSON.stringify(data),
    }),
};
