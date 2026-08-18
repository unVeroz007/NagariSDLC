/**
 * src/services/api.js
 *
 * Service layer untuk komunikasi dengan Backend API NagariSDLC.
 * 100% API calls — tidak ada lagi mock mode.
 * Semua error di-throw dengan pesan yang informatif untuk ditangkap oleh UI.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const TOKEN_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours in ms
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // refresh 5 minutes before expiry

let isRefreshing = false;
let refreshPromise = null;

// ──────────────────────────────────────────────────────────
// Helper: buat headers dengan Bearer token
// ──────────────────────────────────────────────────────────
function authHeaders() {
    const session = localStorage.getItem('nagari_sdlc_session');
    const base = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (!session) return base;
    try {
        const { token } = JSON.parse(session);
        if (!token) return base;
        return { ...base, Authorization: `Bearer ${token}` };
    } catch {
        return base;
    }
}

// ──────────────────────────────────────────────────────────
// Helper: check if token needs refresh
// ──────────────────────────────────────────────────────────
function getTokenIssuedAt() {
    const session = localStorage.getItem('nagari_sdlc_session');
    if (!session) return null;
    try {
        const { issuedAt } = JSON.parse(session);
        return issuedAt || null;
    } catch {
        return null;
    }
}

function shouldRefreshToken() {
    const issuedAt = getTokenIssuedAt();
    if (!issuedAt) return false;
    const elapsed = Date.now() - issuedAt;
    return elapsed > (TOKEN_EXPIRY_MS - REFRESH_THRESHOLD_MS);
}

// ──────────────────────────────────────────────────────────
// Helper: refresh token silently
// ──────────────────────────────────────────────────────────
async function refreshToken() {
    if (isRefreshing && refreshPromise) return refreshPromise;

    isRefreshing = true;
    refreshPromise = (async () => {
        try {
            const session = localStorage.getItem('nagari_sdlc_session');
            if (!session) return null;
            const { token } = JSON.parse(session);
            if (!token) return null;

            const res = await fetch(`${BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!res.ok) return null;

            const data = await res.json();
            if (data.status === 'success' && data.data?.token) {
                const newSession = {
                    token: data.data.token,
                    user: data.data.user,
                    issuedAt: Date.now(),
                };
                localStorage.setItem('nagari_sdlc_session', JSON.stringify(newSession));
                return data.data.token;
            }
            return null;
        } catch {
            return null;
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
    const res = await fetch(url, { ...options, headers });
    return handleResponse(res);
}

// ──────────────────────────────────────────────────────────
// Helper: handle response dari fetch
// ──────────────────────────────────────────────────────────
async function handleResponse(res) {
    if (!res.ok) {
        // 401 → trigger auto-logout via event
        if (res.status === 401) {
            localStorage.removeItem('nagari_sdlc_session');
            window.dispatchEvent(new Event('auth:unauthorized'));
        }

        let errBody = {};
        try {
            errBody = await res.json();
        } catch {
            errBody = { message: `HTTP ${res.status}: Terjadi kesalahan server.` };
        }

        let errMsg = errBody.message || `HTTP ${res.status}`;
        if (errBody.errors && typeof errBody.errors === 'object') {
            const messages = Object.values(errBody.errors).flat().join(', ');
            if (messages) errMsg = `${errMsg}: ${messages}`;
        }
        const error = new Error(errMsg);
        error.status = res.status;
        error.data = errBody;
        throw error;
    }

    // 204 No Content
    if (res.status === 204) return null;
    return res.json();
}

// ──────────────────────────────────────────────────────────
// AUTH SERVICE
// ──────────────────────────────────────────────────────────
export const authService = {
    login: async (email, password) => {
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
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

    logout: async () => {
        try {
            await fetch(`${BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: authHeaders(),
            });
        } catch {
            // Ignore error on logout — we clear session anyway
        }
        localStorage.removeItem('nagari_sdlc_session');
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
export const projectService = {
    getNextReqId: async () => {
        return apiFetch(`${BASE_URL}/projects/next-req-id`);
    },

    getAll: async (filters = {}) => {
        const params = new URLSearchParams(filters).toString();
        return apiFetch(`${BASE_URL}/projects?${params}`);
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
        return apiFetch(`${BASE_URL}/projects/${id}/sit-approval`, {
            method: 'POST',
            body: JSON.stringify({ note }),
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
// QA REQUEST SERVICE
// ──────────────────────────────────────────────────────────
export const qaRequestService = {
    getAll: async () => {
        return apiFetch(`${BASE_URL}/qa-requests`);
    },

    create: async (requestData) => {
        return apiFetch(`${BASE_URL}/qa-requests`, {
            method: 'POST',
            body: JSON.stringify(requestData),
        });
    },

    updateStatus: async (id, status, notes = '') => {
        return apiFetch(`${BASE_URL}/qa-requests/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status, notes }),
        });
    },
};

// ──────────────────────────────────────────────────────────
// CYBER REQUEST SERVICE
// ──────────────────────────────────────────────────────────
export const cyberRequestService = {
    getAll: async () => {
        return apiFetch(`${BASE_URL}/cyber-requests`);
    },

    create: async (requestData) => {
        return apiFetch(`${BASE_URL}/cyber-requests`, {
            method: 'POST',
            body: JSON.stringify(requestData),
        });
    },

    updateStatus: async (id, status, notes = '') => {
        return apiFetch(`${BASE_URL}/cyber-requests/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status, notes }),
        });
    },
};

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
// ──────────────────────────────────────────────────────────
export const notificationService = {
    getAll: async () => {
        return apiFetch(`${BASE_URL}/notifications`);
    },

    markRead: async (id) => {
        return apiFetch(`${BASE_URL}/notifications/${id}/read`, {
            method: 'PATCH',
        });
    },

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
        delete headers['Content-Type'];
        await ensureFreshToken();
        const res = await fetch(`${BASE_URL}/documents`, { method: 'POST', headers, body: formData });
        return handleResponse(res);
    },

    download: async (id) => {
        await ensureFreshToken();
        const res = await fetch(`${BASE_URL}/documents/${id}/download`, { headers: authHeaders() });
        if (!res.ok) throw new Error(`Gagal mengunduh dokumen (HTTP ${res.status})`);
        return res.blob();
    },

    delete: async (id) => apiFetch(`${BASE_URL}/documents/${id}`, { method: 'DELETE' }),
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

export const workspaceService = {
    getByRole: async (role) => apiFetch(`${BASE_URL}/workspace/${role}`),
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
};

export const releaseRequestService = {
    getAll: async () => apiFetch(`${BASE_URL}/release-requests`),
    create: async (data) => apiFetch(`${BASE_URL}/release-requests`, {
        method: 'POST',
        body: JSON.stringify(data),
    }),
};
