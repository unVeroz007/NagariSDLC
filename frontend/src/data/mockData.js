// Fungsi untuk mendapatkan statistik proyek
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
