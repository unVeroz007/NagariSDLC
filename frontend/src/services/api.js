/**
 * src/services/api.js
 *
 * Service layer untuk komunikasi dengan Backend API NagariSDLC.
 * 100% API calls — tidak ada lagi mock mode.
 * Semua error di-throw dengan pesan yang informatif untuk ditangkap oleh UI.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

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
        const res = await fetch(`${BASE_URL}/auth/me`, { headers: authHeaders() });
        return handleResponse(res);
    },

    updateProfile: async (name, phoneNumber) => {
        const res = await fetch(`${BASE_URL}/auth/profile`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ name, phone_number: phoneNumber }),
        });
        return handleResponse(res);
    },

    updatePassword: async (currentPassword, newPassword) => {
        const res = await fetch(`${BASE_URL}/auth/password`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
        });
        return handleResponse(res);
    },
};

// ──────────────────────────────────────────────────────────
// PROJECT SERVICE
// ──────────────────────────────────────────────────────────
export const projectService = {
    getAll: async (filters = {}) => {
        const params = new URLSearchParams(filters).toString();
        const res = await fetch(`${BASE_URL}/projects?${params}`, { headers: authHeaders() });
        return handleResponse(res);
    },

    getById: async (id) => {
        const res = await fetch(`${BASE_URL}/projects/${id}`, { headers: authHeaders() });
        return handleResponse(res);
    },

    create: async (projectData) => {
        const res = await fetch(`${BASE_URL}/projects`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(projectData),
        });
        return handleResponse(res);
    },

    update: async (id, updates) => {
        const res = await fetch(`${BASE_URL}/projects/${id}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify(updates),
        });
        return handleResponse(res);
    },

    updateStatus: async (id, newStatus, notes = '') => {
        const res = await fetch(`${BASE_URL}/projects/${id}/status`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ status: newStatus, notes }),
        });
        return handleResponse(res);
    },

    delete: async (id) => {
        const res = await fetch(`${BASE_URL}/projects/${id}`, {
            method: 'DELETE',
            headers: authHeaders(),
        });
        return handleResponse(res);
    },

    allocateTeam: async (projectId, team) => {
        const res = await fetch(`${BASE_URL}/projects/${projectId}/team`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ team }),
        });
        return handleResponse(res);
    },

    getTimeline: async (id) => {
        const res = await fetch(`${BASE_URL}/projects/${id}/timeline`, { headers: authHeaders() });
        return handleResponse(res);
    },
};

// ──────────────────────────────────────────────────────────
// TASK SERVICE
// ──────────────────────────────────────────────────────────
export const taskService = {
    getByProject: async (projectId) => {
        const res = await fetch(`${BASE_URL}/projects/${projectId}/tasks`, { headers: authHeaders() });
        return handleResponse(res);
    },

    create: async (projectId, taskData) => {
        const res = await fetch(`${BASE_URL}/projects/${projectId}/tasks`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(taskData),
        });
        return handleResponse(res);
    },

    update: async (taskId, updates) => {
        const res = await fetch(`${BASE_URL}/tasks/${taskId}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify(updates),
        });
        return handleResponse(res);
    },

    delete: async (taskId) => {
        const res = await fetch(`${BASE_URL}/tasks/${taskId}`, {
            method: 'DELETE',
            headers: authHeaders(),
        });
        return handleResponse(res);
    },
};

// ──────────────────────────────────────────────────────────
// QA REQUEST SERVICE
// ──────────────────────────────────────────────────────────
export const qaRequestService = {
    getAll: async () => {
        const res = await fetch(`${BASE_URL}/qa-requests`, { headers: authHeaders() });
        return handleResponse(res);
    },

    create: async (requestData) => {
        const res = await fetch(`${BASE_URL}/qa-requests`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(requestData),
        });
        return handleResponse(res);
    },

    updateStatus: async (id, status, notes = '') => {
        const res = await fetch(`${BASE_URL}/qa-requests/${id}/status`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ status, notes }),
        });
        return handleResponse(res);
    },
};

// ──────────────────────────────────────────────────────────
// CYBER REQUEST SERVICE
// ──────────────────────────────────────────────────────────
export const cyberRequestService = {
    getAll: async () => {
        const res = await fetch(`${BASE_URL}/cyber-requests`, { headers: authHeaders() });
        return handleResponse(res);
    },

    create: async (requestData) => {
        const res = await fetch(`${BASE_URL}/cyber-requests`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(requestData),
        });
        return handleResponse(res);
    },

    updateStatus: async (id, status, notes = '') => {
        const res = await fetch(`${BASE_URL}/cyber-requests/${id}/status`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ status, notes }),
        });
        return handleResponse(res);
    },
};

// ──────────────────────────────────────────────────────────
// USER SERVICE
// ──────────────────────────────────────────────────────────
export const userService = {
    getAll: async () => {
        const res = await fetch(`${BASE_URL}/users`, { headers: authHeaders() });
        return handleResponse(res);
    },

    create: async (userData) => {
        const res = await fetch(`${BASE_URL}/users`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(userData),
        });
        return handleResponse(res);
    },

    update: async (id, updates) => {
        const res = await fetch(`${BASE_URL}/users/${id}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify(updates),
        });
        return handleResponse(res);
    },

    delete: async (id) => {
        const res = await fetch(`${BASE_URL}/users/${id}`, {
            method: 'DELETE',
            headers: authHeaders(),
        });
        return handleResponse(res);
    },
};

// ──────────────────────────────────────────────────────────
// NOTIFICATION SERVICE
// ──────────────────────────────────────────────────────────
export const notificationService = {
    getAll: async () => {
        const res = await fetch(`${BASE_URL}/notifications`, { headers: authHeaders() });
        return handleResponse(res);
    },

    markRead: async (id) => {
        const res = await fetch(`${BASE_URL}/notifications/${id}/read`, {
            method: 'PATCH',
            headers: authHeaders(),
        });
        return handleResponse(res);
    },

    markAllRead: async () => {
        const res = await fetch(`${BASE_URL}/notifications/read-all`, {
            method: 'PATCH',
            headers: authHeaders(),
        });
        return handleResponse(res);
    },
};

// ──────────────────────────────────────────────────────────
// DOCUMENT SERVICE
// ──────────────────────────────────────────────────────────
export const documentService = {
    getAll: async (projectId) => {
        const url = projectId
            ? `${BASE_URL}/documents?project_id=${projectId}`
            : `${BASE_URL}/documents`;
        const res = await fetch(url, { headers: authHeaders() });
        return handleResponse(res);
    },

    upload: async (file, metadata) => {
        const formData = new FormData();
        formData.append('file', file);
        Object.entries(metadata).forEach(([k, v]) => {
            if (v !== undefined && v !== null) {
                formData.append(k, v);
            }
        });
        const headers = { ...authHeaders() };
        delete headers['Content-Type']; // Let browser set multipart boundary
        const res = await fetch(`${BASE_URL}/documents`, {
            method: 'POST',
            headers,
            body: formData,
        });
        return handleResponse(res);
    },

    download: async (id) => {
        const res = await fetch(`${BASE_URL}/documents/${id}/download`, { headers: authHeaders() });
        if (!res.ok) {
            throw new Error(`Gagal mengunduh dokumen (HTTP ${res.status})`);
        }
        return res.blob();
    },

    delete: async (id) => {
        const res = await fetch(`${BASE_URL}/documents/${id}`, {
            method: 'DELETE',
            headers: authHeaders(),
        });
        return handleResponse(res);
    },
};

// ──────────────────────────────────────────────────────────
// ACTIVITY LOG SERVICE
// ──────────────────────────────────────────────────────────
export const activityLogService = {
    getAll: async (filters = {}) => {
        const params = new URLSearchParams(filters).toString();
        const res = await fetch(`${BASE_URL}/activity-logs?${params}`, { headers: authHeaders() });
        return handleResponse(res);
    },

    getSummary: async () => {
        const res = await fetch(`${BASE_URL}/activity-logs/summary`, { headers: authHeaders() });
        return handleResponse(res);
    },
};

// ──────────────────────────────────────────────────────────
// WORKSPACE SERVICE
// ──────────────────────────────────────────────────────────
export const workspaceService = {
    getByRole: async (role) => {
        const res = await fetch(`${BASE_URL}/workspace/${role}`, { headers: authHeaders() });
        return handleResponse(res);
    },
};

// ──────────────────────────────────────────────────────────
// ROLE SERVICE
// ──────────────────────────────────────────────────────────
export const roleService = {
    getAll: async () => {
        const res = await fetch(`${BASE_URL}/roles`, { headers: authHeaders() });
        return handleResponse(res);
    },

    create: async (roleData) => {
        const res = await fetch(`${BASE_URL}/roles`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(roleData),
        });
        return handleResponse(res);
    },

    update: async (id, updates) => {
        const res = await fetch(`${BASE_URL}/roles/${id}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify(updates),
        });
        return handleResponse(res);
    },

    delete: async (id) => {
        const res = await fetch(`${BASE_URL}/roles/${id}`, {
            method: 'DELETE',
            headers: authHeaders(),
        });
        return handleResponse(res);
    },
};

// ──────────────────────────────────────────────────────────
// DIVISION SERVICE
// ──────────────────────────────────────────────────────────
export const divisionService = {
    getAll: async () => {
        const res = await fetch(`${BASE_URL}/divisions`, { headers: authHeaders() });
        return handleResponse(res);
    },

    create: async (divData) => {
        const res = await fetch(`${BASE_URL}/divisions`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(divData),
        });
        return handleResponse(res);
    },

    update: async (id, updates) => {
        const res = await fetch(`${BASE_URL}/divisions/${id}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify(updates),
        });
        return handleResponse(res);
    },

    delete: async (id) => {
        const res = await fetch(`${BASE_URL}/divisions/${id}`, {
            method: 'DELETE',
            headers: authHeaders(),
        });
        return handleResponse(res);
    },
};

// ──────────────────────────────────────────────────────────
// DASHBOARD / ANALYTICS SERVICE
// ──────────────────────────────────────────────────────────
export const dashboardService = {
    getSummary: async () => {
        const res = await fetch(`${BASE_URL}/dashboard/summary`, { headers: authHeaders() });
        return handleResponse(res);
    },

    getAnalytics: async () => {
        const res = await fetch(`${BASE_URL}/dashboard/analytics`, { headers: authHeaders() });
        return handleResponse(res);
    },
};

// ──────────────────────────────────────────────────────────
// QUALITY GATE SERVICE
// ──────────────────────────────────────────────────────────
export const qualityGateService = {
    getQueue: async () => {
        const res = await fetch(`${BASE_URL}/quality-gate/queue`, { headers: authHeaders() });
        return handleResponse(res);
    },

    approve: async (projectId, notes = '') => {
        const res = await fetch(`${BASE_URL}/quality-gate/approve`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ project_id: projectId, notes }),
        });
        return handleResponse(res);
    },
};

// ──────────────────────────────────────────────────────────
// RELEASE REQUEST SERVICE
// ──────────────────────────────────────────────────────────
export const releaseRequestService = {
    getAll: async () => {
        const res = await fetch(`${BASE_URL}/release-requests`, { headers: authHeaders() });
        return handleResponse(res);
    },

    store: async (data) => {
        const res = await fetch(`${BASE_URL}/release-requests`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(res);
    },
};
