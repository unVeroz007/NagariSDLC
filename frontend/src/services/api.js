/**
 * src/services/api.js
 *
 * Service layer abstraksi untuk komunikasi dengan Backend API.
 * Saat ini menggunakan data mock (import langsung dari mockData.js).
 *
 * SAAT BE SIAP: Ganti fungsi-fungsi di bawah dengan `fetch()` atau `axios` ke endpoint nyata.
 * Karena semua komponen memanggil service ini (bukan langsung context/mock),
 * pergantian ke BE hanya perlu dilakukan di FILE INI SAJA.
 *
 * Contoh penggantian:
 *   SEKARANG: return mockProjects;
 *   NANTI: const res = await fetch(`${BASE_URL}/projects`, { headers: authHeaders() });
 *          return res.json();
 */

// Base URL (dari environment variable Vite)
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// ──────────────────────────────────────────────────────────
// Helper: buat headers dengan JWT token
// ──────────────────────────────────────────────────────────
function authHeaders() {
    const session = localStorage.getItem('nagari_sdlc_session');
    if (!session) return { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    try {
        const { token } = JSON.parse(session);
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    } catch {
        return { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    }
}

// ──────────────────────────────────────────────────────────
// Helper: handle response dari fetch
// ──────────────────────────────────────────────────────────
async function handleResponse(res) {
    if (!res.ok) {
        if (res.status === 401) {
            localStorage.removeItem('nagari_sdlc_session');
        }
        const err = await res.json().catch(() => ({ message: 'Terjadi kesalahan server.' }));
        throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.json();
}

// ──────────────────────────────────────────────────────────
// MODE: 'mock' atau 'api'
// Set ke 'api' saat backend sudah siap
// ──────────────────────────────────────────────────────────
const MODE = import.meta.env.VITE_API_MODE || 'mock';

// ──────────────────────────────────────────────────────────
// AUTH SERVICE
// ──────────────────────────────────────────────────────────
export const authService = {
    /**
     * Login user.
     * @returns {{ user, token }} atau throw Error
     */
    login: async (email, password) => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            return handleResponse(res);
        }
        // MOCK: dilakukan di AuthContext langsung
        throw new Error('Mock login handled in AuthContext');
    },

    logout: async () => {
        if (MODE === 'api') {
            await fetch(`${BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: authHeaders(),
            });
        }
        localStorage.removeItem('nagari_sdlc_session');
    },

    getCurrentUser: async () => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/auth/me`, { headers: authHeaders() });
            return handleResponse(res);
        }
        const session = localStorage.getItem('nagari_sdlc_session');
        return session ? JSON.parse(session) : null;
    },
};

// ──────────────────────────────────────────────────────────
// PROJECT SERVICE
// ──────────────────────────────────────────────────────────
export const projectService = {
    /**
     * Ambil semua proyek.
     * @param {{ status?: string, type?: string, pm_id?: number }} filters
     */
    getAll: async (filters = {}) => {
        if (MODE === 'api') {
            const params = new URLSearchParams(filters).toString();
            const res = await fetch(`${BASE_URL}/projects?${params}`, { headers: authHeaders() });
            return handleResponse(res);
        }
        // MOCK: ProjectContext yang handle
        return [];
    },

    getById: async (id) => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/projects/${id}`, { headers: authHeaders() });
            return handleResponse(res);
        }
        return null;
    },

    create: async (projectData) => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/projects`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(projectData),
            });
            return handleResponse(res);
        }
        return null;
    },

    /**
     * Update data proyek (general).
     */
    update: async (id, updates) => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/projects/${id}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify(updates),
            });
            return handleResponse(res);
        }
        return null;
    },

    /**
     * Update status proyek — endpoint khusus untuk transisi status.
     * Backend bisa memvalidasi apakah transisi status valid.
     */
    updateStatus: async (id, newStatus, notes = '') => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/projects/${id}/status`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify({ status: newStatus, notes }),
            });
            return handleResponse(res);
        }
        return null;
    },

    delete: async (id) => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/projects/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            return handleResponse(res);
        }
        return null;
    },
};

// ──────────────────────────────────────────────────────────
// TASK SERVICE
// ──────────────────────────────────────────────────────────
export const taskService = {
    getByProject: async (projectId) => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/projects/${projectId}/tasks`, { headers: authHeaders() });
            return handleResponse(res);
        }
        return [];
    },

    create: async (projectId, taskData) => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/projects/${projectId}/tasks`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(taskData),
            });
            return handleResponse(res);
        }
        return null;
    },

    update: async (taskId, updates) => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/tasks/${taskId}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify(updates),
            });
            return handleResponse(res);
        }
        return null;
    },

    delete: async (taskId) => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/tasks/${taskId}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            return handleResponse(res);
        }
        return null;
    },
};

// ──────────────────────────────────────────────────────────
// QA REQUEST SERVICE
// ──────────────────────────────────────────────────────────
export const qaRequestService = {
    getAll: async () => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/qa-requests`, { headers: authHeaders() });
            return handleResponse(res);
        }
        return [];
    },

    create: async (requestData) => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/qa-requests`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(requestData),
            });
            return handleResponse(res);
        }
        return null;
    },

    updateStatus: async (id, status, notes = '') => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/qa-requests/${id}/status`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify({ status, notes }),
            });
            return handleResponse(res);
        }
        return null;
    },
};

// ──────────────────────────────────────────────────────────
// CYBER REQUEST SERVICE
// ──────────────────────────────────────────────────────────
export const cyberRequestService = {
    getAll: async () => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/cyber-requests`, { headers: authHeaders() });
            return handleResponse(res);
        }
        return [];
    },

    create: async (requestData) => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/cyber-requests`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(requestData),
            });
            return handleResponse(res);
        }
        return null;
    },

    updateStatus: async (id, status, notes = '') => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/cyber-requests/${id}/status`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify({ status, notes }),
            });
            return handleResponse(res);
        }
        return null;
    },
};

// ──────────────────────────────────────────────────────────
// USER SERVICE
// ──────────────────────────────────────────────────────────
export const userService = {
    getAll: async () => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/users`, { headers: authHeaders() });
            return handleResponse(res);
        }
        return [];
    },

    create: async (userData) => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/users`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(userData),
            });
            return handleResponse(res);
        }
        return null;
    },

    update: async (id, updates) => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/users/${id}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify(updates),
            });
            return handleResponse(res);
        }
        return null;
    },

    delete: async (id) => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/users/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            return handleResponse(res);
        }
        return null;
    },
};

// ──────────────────────────────────────────────────────────
// NOTIFICATION SERVICE
// ──────────────────────────────────────────────────────────
export const notificationService = {
    getAll: async () => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/notifications`, { headers: authHeaders() });
            return handleResponse(res);
        }
        return [];
    },

    markRead: async (id) => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/notifications/${id}/read`, {
                method: 'PATCH',
                headers: authHeaders(),
            });
            return handleResponse(res);
        }
        return null;
    },

    markAllRead: async () => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/notifications/read-all`, {
                method: 'PATCH',
                headers: authHeaders(),
            });
            return handleResponse(res);
        }
        return null;
    },
};

// ──────────────────────────────────────────────────────────
// DOCUMENT SERVICE
// ──────────────────────────────────────────────────────────
export const documentService = {
    getAll: async (projectId) => {
        if (MODE === 'api') {
            const url = projectId
                ? `${BASE_URL}/documents?project_id=${projectId}`
                : `${BASE_URL}/documents`;
            const res = await fetch(url, { headers: authHeaders() });
            return handleResponse(res);
        }
        return [];
    },

    upload: async (file, metadata) => {
        if (MODE === 'api') {
            const formData = new FormData();
            formData.append('file', file);
            Object.entries(metadata).forEach(([k, v]) => formData.append(k, v));
            const res = await fetch(`${BASE_URL}/documents`, {
                method: 'POST',
                headers: { Authorization: authHeaders().Authorization },
                body: formData,
            });
            return handleResponse(res);
        }
        return null;
    },

    delete: async (id) => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/documents/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            return handleResponse(res);
        }
        return null;
    },
};

// ──────────────────────────────────────────────────────────
// ACTIVITY LOG SERVICE
// ──────────────────────────────────────────────────────────
export const activityLogService = {
    getAll: async (filters = {}) => {
        if (MODE === 'api') {
            const params = new URLSearchParams(filters).toString();
            const res = await fetch(`${BASE_URL}/activity-logs?${params}`, { headers: authHeaders() });
            return handleResponse(res);
        }
        return [];
    },
};

// ──────────────────────────────────────────────────────────
// WORKSPACE SERVICE
// Mengambil item kerja per role — endpoint: GET /workspace/{role}
// ──────────────────────────────────────────────────────────
export const workspaceService = {
    getByRole: async (role) => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/workspace/${role}`, { headers: authHeaders() });
            return handleResponse(res);
        }
        return { data: { projects: [], assigned_tasks: [] } };
    },
};

// ──────────────────────────────────────────────────────────
// ROLE SERVICE
// ──────────────────────────────────────────────────────────
export const roleService = {
    getAll: async () => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/roles`, { headers: authHeaders() });
            return handleResponse(res);
        }
        // Mock fallback
        return {
            status: 'success',
            data: [
                { id: 1, name: 'super_admin', display_name: 'Super Admin' },
                { id: 2, name: 'head_of_it', display_name: 'Head of IT' },
                { id: 3, name: 'lead_group', display_name: 'Lead Group / Kadiv' },
                { id: 4, name: 'analyst', display_name: 'System Analyst' },
                { id: 5, name: 'development_lead', display_name: 'Development Lead' },
                { id: 6, name: 'project_manager', display_name: 'Project Manager' },
                { id: 7, name: 'developer', display_name: 'Developer' },
                { id: 8, name: 'qa_lead', display_name: 'QA Lead' },
                { id: 9, name: 'qa_tester', display_name: 'QA Tester' },
                { id: 10, name: 'cyber_lead', display_name: 'Cyber Security Lead' },
                { id: 11, name: 'pentester', display_name: 'Pentester' },
                { id: 12, name: 'business_user', display_name: 'Business User / Pemohon' },
            ],
        };
    },
};

// ──────────────────────────────────────────────────────────
// DIVISION SERVICE
// ──────────────────────────────────────────────────────────
export const divisionService = {
    getAll: async () => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/divisions`, { headers: authHeaders() });
            return handleResponse(res);
        }
        // Mock fallback
        return {
            status: 'success',
            data: [
                { id: 1, code: 'IT-DEV', name: 'IT Development' },
                { id: 2, code: 'IT-OPS', name: 'IT Operations' },
                { id: 3, code: 'IT-SEC', name: 'IT Security' },
                { id: 4, code: 'IT-QA', name: 'IT Quality Assurance' },
                { id: 5, code: 'DSI', name: 'Divisi Sistem Informasi' },
            ],
        };
    },
};

// ──────────────────────────────────────────────────────────
// QUALITY GATE SERVICE
// ──────────────────────────────────────────────────────────
export const qualityGateService = {
    /**
     * Ambil daftar proyek PENDING_GOLIVE (menunggu persetujuan Head of IT)
     */
    getQueue: async () => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/quality-gate/queue`, { headers: authHeaders() });
            return handleResponse(res);
        }
        return { status: 'success', data: [] };
    },

    /**
     * Head of IT menyetujui rilis proyek ke produksi
     */
    approve: async (projectId, notes = '') => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/quality-gate/approve`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ project_id: projectId, notes }),
            });
            return handleResponse(res);
        }
        return null;
    },
};

// ──────────────────────────────────────────────────────────
// RELEASE REQUEST SERVICE
// ──────────────────────────────────────────────────────────
export const releaseRequestService = {
    getAll: async () => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/release-requests`, { headers: authHeaders() });
            return handleResponse(res);
        }
        return [];
    },

    store: async (data) => {
        if (MODE === 'api') {
            const res = await fetch(`${BASE_URL}/release-requests`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(data),
            });
            return handleResponse(res);
        }
        return null;
    },
};

