// Data dummy untuk proyek (Dibersihkan untuk pengujian dari awal)
export const mockProjects = [];

// Fungsi untuk mendapatkan statistik
export const getProjectStats = (projects) => {
    const total = projects.length;
    const inProgress = projects.filter(p =>
        p.status.includes('Development') || p.status.includes('In Progress') || p.status === 'IN_DEVELOPMENT'
    ).length;
    const pendingReview = projects.filter(p =>
        p.status.includes('Review') || p.status.includes('Inisiasi') || p.status === 'PENDING'
    ).length;
    const completed = projects.filter(p =>
        p.status.includes('Gate') || p.status.includes('Passed') || p.status.includes('Selesai') || p.status === 'LIVE_PRODUCTION'
    ).length;
    return { total, inProgress, pendingReview, completed };
};

export const mockDocuments = [];

// Fungsi untuk mendapatkan statistik dokumen
export const getDocumentStats = (docs) => {
    const total = docs.length;
    const byType = {};
    docs.forEach(doc => {
        const typeKey = doc.doc_type || doc.type || 'LAINNYA';
        byType[typeKey] = (byType[typeKey] || 0) + 1;
    });
    return { total, byType };
};

export const queueProjects = [];

// Daftar analis untuk dropdown
export const analysts = [
    { id: 1, name: 'Citra Kirana', workload: 'Rendah' },
    { id: 2, name: 'Fajar Ramadhan', workload: 'Sedang' },
    { id: 3, name: 'Eka Putra', workload: 'Tinggi' },
];

export const reviewQueue = [];
export const dispositionQueue = [];
export const allocationProjects = [];

// Data dummy untuk kandidat PM
export const pmCandidates = [
    { id: 1, name: 'Budi Santoso', department: 'IT Core', workload: 2 },
    { id: 2, name: 'Dewi Lestari', department: 'Digital Banking', workload: 3 },
    { id: 3, name: 'Andi Pratama', department: 'IT Infrastructure', workload: 1 },
];

export const developerCandidates = [
    { id: 1, name: 'Dimas Anggara', skill: 'Backend (Java)', workload: 1 },
    { id: 2, name: 'Eka Putri', skill: 'Frontend (React)', workload: 2 },
    { id: 3, name: 'Fani Wijaya', skill: 'QA Engineer', workload: 3 },
    { id: 4, name: 'Gilang Pratama', skill: 'Security', workload: 4 },
];

// Data dummy untuk tim developer
export const teamMembers = [
    { id: 1, name: 'Dimas Anggara', role: 'Backend Dev (Java)', workload: 1, workloadLabel: 'Rendah', workloadColor: 'bg-emerald-100 text-emerald-700' },
    { id: 2, name: 'Eka Putri', role: 'Frontend Dev (React)', workload: 2, workloadLabel: 'Rendah', workloadColor: 'bg-emerald-100 text-emerald-700' },
    { id: 3, name: 'Fani Wijaya', role: 'QA Engineer', workload: 3, workloadLabel: 'Sedang', workloadColor: 'bg-amber-100 text-amber-700' },
    { id: 4, name: 'Gilang Pratama', role: 'Security Analyst', workload: 5, workloadLabel: 'Tinggi', workloadColor: 'bg-red-100 text-red-700' },
    { id: 5, name: 'Rina Wati', role: 'Backend Dev (Node.js)', workload: 1, workloadLabel: 'Rendah', workloadColor: 'bg-emerald-100 text-emerald-700' },
    { id: 6, name: 'Budi Santoso', role: 'DevOps Engineer', workload: 2, workloadLabel: 'Rendah', workloadColor: 'bg-emerald-100 text-emerald-700' },
];

export const kanbanStages = [
    { id: 'inisiasi', type: 'RBB', rbbDeadline: '2026-08-02', label: 'Inisiasi', color: 'bg-slate-400' },
    { id: 'analisis', type: 'NON_RBB', rbbDeadline: null, label: 'Analisis', color: 'bg-blue-400' },
    { id: 'desain', type: 'RBB', rbbDeadline: '2026-08-02', label: 'Desain', color: 'bg-[#1A56DB]' },
    { id: 'pembangunan', type: 'NON_RBB', rbbDeadline: null, label: 'Pembangunan', color: 'bg-purple-400' },
    { id: 'pengujian', type: 'RBB', rbbDeadline: '2026-08-02', label: 'Pengujian', color: 'bg-orange-400' },
    { id: 'deployment', type: 'NON_RBB', rbbDeadline: null, label: 'Deployment', color: 'bg-green-400' },
];

export const taskProjects = [];
export const kanbanTasks = [];

export const qaQueue = [];
export const myQaTasks = [];

// Helper untuk memproses hasil QA & Pengembalian Proyek ke Dev
export const processQaResult = (taskId, qaResult, qaNotes) => {
    const task = myQaTasks.find(t => t.id === taskId);
    if (task) {
        task.qaResult = qaResult;
        task.qaNotes = qaNotes;
        if (qaResult === 'Failed') {
            task.status = 'Dikembalikan ke Dev (QA Failed)';
        } else {
            task.status = 'Selesai (QA Passed)';
        }
    }
};

export const rejectQaRequest = (requestId, reason) => {
    const qaItem = qaQueue.find(q => q.id === requestId);
    if (qaItem) {
        qaItem.status = 'Dikembalikan ke Dev (QA Rejected)';
        qaItem.notes = reason;
    }
};

// Data dummy untuk QA testers (anggota tim)
export const qaTesters = [
    { id: 1, name: 'Dimas Anggara', initial: 'DA' },
    { id: 2, name: 'Siti Rahmawati', initial: 'SR' },
    { id: 3, name: 'Fajar Setiawan', initial: 'FS' },
];

export const cyberQueue = [];
export const cyberTasks = [];

// Data dummy untuk pentester
export const pentesters = [
    { id: 1, name: 'Rizal Pratama', role: 'Senior Pentester' },
    { id: 2, name: 'Sari Indah', role: 'Security Analyst' },
    { id: 3, name: 'Budi Santoso', role: 'Junior Pentester' },
];

// Data dummy untuk Quality Gate
export const qualityGateQueue = [];

// Data dummy untuk Manajemen User
export const users = [
    { id: 'USR-001', name: 'Budi Santoso', type: 'RBB', email: 'budi.santoso@banknagari.co.id', role: 'Project Manager', department: 'Divisi TI', status: 'Aktif', initial: 'BS', avatarBg: 'bg-tertiary-container/20' },
    { id: 'USR-002', name: 'Citra Kirana', type: 'NON_RBB', email: 'citra.kirana@banknagari.co.id', role: 'System Analyst', department: 'Divisi TI', status: 'Aktif', initial: 'CK', avatarBg: 'bg-secondary-container/20' },
    { id: 'USR-003', name: 'Dimas Anggara', type: 'RBB', email: 'dimas.anggara@banknagari.co.id', role: 'QA Tester', department: 'Divisi TI', status: 'Aktif', initial: 'DA', avatarBg: 'bg-error-container/20' },
    { id: 'USR-004', name: 'Rizal Pratama', type: 'NON_RBB', email: 'rizal.pratama@banknagari.co.id', role: 'Pentester', department: 'Divisi Kepatuhan', status: 'Aktif', initial: 'RP', avatarBg: 'bg-primary-container/20' },
    { id: 'USR-005', name: 'Siti Rahmawati', type: 'RBB', email: 'siti.rahmawati@banknagari.co.id', role: 'QA Automation', department: 'Divisi TI', status: 'Non-Aktif', initial: 'SR', avatarBg: 'bg-surface-variant' },
];

export const auditLogs = [];

export const analyticsData = {
    avgCycleTime: { value: 0, change: 0, unit: 'Hari' },
    successRate: { value: 100, change: 0, unit: '%' },
    bugDensity: { value: 0, unit: '/ modul' },
    velocity: { value: 0, unit: '%' },
    divisions: [],
    delays: [],
    releaseTrend: [],
};

export const mockNotifications = [];

export default mockProjects;