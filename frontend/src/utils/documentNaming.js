/**
 * generateDocumentName(projectReqId, docTypeCode, projectName)
 *
 * Format: XXX/GPTD/{TIPE}/DD-BulanYYYY_{PROJECT_NAME}
 * Contoh: 001/GPTD/BRD/08-August2026_Migrasi
 *
 * @param {string} projectReqId - req_id proyek (misal "REQ-5" atau "REQ-2026-001")
 * @param {string} docTypeCode  - kode tipe dokumen (misal "BRD", "MEMO", "LAMPIRAN", "FSD", dll)
 * @param {string} projectName  - nama proyek singkat
 * @returns {string} nama dokumen terformat
 */
export function generateDocumentName(projectReqId, docTypeCode, projectName) {
    const now = new Date();
    const bulan = String(now.getMonth() + 1).padStart(2, '0');
    const tahun = now.getFullYear();
    const tanggal = String(now.getDate()).padStart(2, '0');

    // Ekstrak nomor urut dari req_id (misal REQ-2026-001 -> 001, atau REQ-5 -> 005)
    let nomorProyek = '001';
    if (projectReqId) {
        const match = String(projectReqId).match(/(\d+)$/);
        if (match) {
            nomorProyek = match[1].padStart(3, '0');
        }
    }

    // Format nama bulan Indonesia
    const namaBulan = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    const bulanLabel = namaBulan[now.getMonth()];

    // Bersihkan nama project: hapus karakter spesial, ambil max 30 karakter
    const cleanName = (projectName || 'Proyek')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .substring(0, 30);

    return `${nomorProyek}/GPTD/${docTypeCode}/${tanggal}-${bulanLabel}${tahun}_${cleanName}`;
}

/**
 * Tipe dokumen yang diizinkan di seluruh tahap SDLC
 */
export const DOCUMENT_TYPES = {
    // Fase 1 — Inisiasi
    BRD: { code: 'BRD', label: 'BRD (Business Requirement Document)', color: 'bg-red-50 text-red-700 border-red-200' },
    MEMO: { code: 'MEMO', label: 'Memo Pengajuan Proyek', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    LAMPIRAN: { code: 'LAMPIRAN', label: 'Lampiran Pendukung', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    LAINNYA: { code: 'LAINNYA', label: 'Lainnya', color: 'bg-gray-50 text-gray-700 border-gray-200' },

    // Fase 2 — Pengembangan
    FSD: { code: 'FSD', label: 'FSD (Functional Specification Document)', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    ARSITEKTUR: { code: 'ARSITEKTUR', label: 'Arsitektur & Desain Sistem', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    SIT_PLAN: { code: 'SIT_PLAN', label: 'Test Plan SIT', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    SIT_RESULT: { code: 'SIT_RESULT', label: 'Hasil Pelaksanaan SIT', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    SIT_SIGNOFF: { code: 'SIT_SIGNOFF', label: 'Berita Acara SIT', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    UAT_PLAN: { code: 'UAT_PLAN', label: 'Skenario UAT', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    UAT_RESULT: { code: 'UAT_RESULT', label: 'Hasil Pelaksanaan UAT', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    UAT_SIGNOFF: { code: 'UAT_SIGNOFF', label: 'Berita Acara UAT', color: 'bg-amber-50 text-amber-700 border-amber-200' },

    // Fase 3 — QA & Cyber
    QA_REPORT: { code: 'QA_REPORT', label: 'Laporan QA Testing', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    QA_SIGNOFF: { code: 'QA_SIGNOFF', label: 'QA Sign-Off Report', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    CYBER_REPORT: { code: 'CYBER_REPORT', label: 'Laporan Pentest Siber', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    CYBER_SIGNOFF: { code: 'CYBER_SIGNOFF', label: 'Cyber Sign-Off Report', color: 'bg-purple-50 text-purple-700 border-purple-200' },

    // Fase 4 — Rilis
    RELEASE_PLAN: { code: 'RELEASE_PLAN', label: 'Rencana Rilis & Rollback', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },

    // Umum
    SPREADSHEET: { code: 'SPREADSHEET', label: 'Data / Spreadsheet', color: 'bg-green-50 text-green-700 border-green-200' },
    GAMBAR: { code: 'GAMBAR', label: 'Gambar / Screenshot', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    ARSIP: { code: 'ARSIP', label: 'Arsip ZIP', color: 'bg-purple-50 text-purple-700 border-purple-200' },
};

/**
 * Tipe dokumen yang diizinkan saat inisiasi proyek (Fase 1)
 */
export const INITIATION_DOC_TYPES = ['BRD', 'MEMO', 'LAMPIRAN', 'LAINNYA'];

/**
 * Ambil info tipe dokumen dari kode
 */
export function getDocumentTypeInfo(code) {
    return DOCUMENT_TYPES[code] || DOCUMENT_TYPES.LAINNYA;
}

/**
 * Format ukuran file untuk display
 */
export function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 KB';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Deteksi tipe dokumen dari nama file (fallback jika user tidak pilih manual)
 */
export function detectDocTypeFromFilename(filename) {
    const fn = (filename || '').toLowerCase();
    if (fn.includes('brd') || fn.includes('requirement')) return 'BRD';
    if (fn.includes('fsd') || fn.includes('spesifikasi')) return 'FSD';
    if (fn.includes('memo')) return 'MEMO';
    if (fn.includes('qa') || fn.includes('test')) return 'QA_REPORT';
    if (fn.includes('uat')) return 'UAT_RESULT';
    if (fn.includes('siber') || fn.includes('cyber') || fn.includes('pentest')) return 'CYBER_REPORT';
    if (fn.includes('arsip') || fn.includes('.zip')) return 'ARSIP';
    if (fn.includes('.xls') || fn.includes('.csv')) return 'SPREADSHEET';
    if (fn.includes('.jpg') || fn.includes('.png') || fn.includes('.jpeg') || fn.includes('.gif')) return 'GAMBAR';
    return 'LAINNYA';
}
