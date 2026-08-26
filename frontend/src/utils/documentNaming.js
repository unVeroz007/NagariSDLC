/**
 * generateDocumentName(projectReqId, docTypeCode, projectName, discriminators)
 *
 * Format: XXX/GPTD/{TIPE}/DD-BulanYYYY_{PROJECT_NAME}[_{PENANDA}...]
 * Contoh: 001/GPTD/BRD/08-August2026_Migrasi
 * Contoh bukti: 001/GPTD/SIT_TASK_EVIDENCE/08-Agustus2026_Migrasi_TASK-42
 *
 * @param {string} projectReqId - req_id proyek (misal "REQ-5" atau "REQ-2026-001")
 * @param {string} docTypeCode  - kode tipe dokumen (misal "BRD", "MEMO", "LAMPIRAN", "FSD", dll)
 * @param {string} projectName  - nama proyek singkat
 * @param {string[]} [discriminators] - penanda pembeda opsional untuk dokumen bukti
 *                                     (misal ["TASK-42"]); disamakan dengan format server
 * @returns {string} nama dokumen terformat
 */
export function generateDocumentName(projectReqId, docTypeCode, projectName, discriminators = []) {
    const now = new Date();
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

    // Penanda pembeda mengikuti aturan sanitasi server: huruf, angka, tanda hubung.
    const suffix = (Array.isArray(discriminators) ? discriminators : [discriminators])
        .map(part => String(part ?? '').replace(/[^A-Za-z0-9-]/g, '').replace(/^-+|-+$/g, '').toUpperCase())
        .filter(Boolean)
        .map(part => `_${part.substring(0, 24)}`)
        .join('');

    return `${nomorProyek}/GPTD/${docTypeCode}/${tanggal}-${bulanLabel}${tahun}_${cleanName}${suffix}`;
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
    UNDANGAN: { code: 'UNDANGAN', label: 'Undangan', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    UAT_PLAN: { code: 'UAT_PLAN', label: 'Skenario UAT', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    UAT_RESULT: { code: 'UAT_RESULT', label: 'Hasil Pelaksanaan UAT', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    UAT_EVIDENCE: { code: 'UAT_EVIDENCE', label: 'Bukti Temuan UAT', color: 'bg-orange-50 text-orange-700 border-orange-200' },
    UAT_SIGNOFF: { code: 'UAT_SIGNOFF', label: 'Berita Acara UAT', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    SIT_TASK_EVIDENCE: { code: 'SIT_TASK_EVIDENCE', label: 'Bukti Pengujian Task SIT', color: 'bg-orange-50 text-orange-700 border-orange-200' },

    // Fase 3 — QA & Cyber
    QA_REPORT: { code: 'QA_REPORT', label: 'Laporan QA Testing', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    QA_EVIDENCE: { code: 'QA_EVIDENCE', label: 'Bukti Pengujian QA', color: 'bg-orange-50 text-orange-700 border-orange-200' },
    QA_SIGNOFF: { code: 'QA_SIGNOFF', label: 'QA Sign-Off Report', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    CYBER_REPORT: { code: 'CYBER_REPORT', label: 'Laporan Pentest Siber', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    CYBER_EVIDENCE: { code: 'CYBER_EVIDENCE', label: 'Bukti Audit Keamanan Siber', color: 'bg-orange-50 text-orange-700 border-orange-200' },
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
 * Tipe dokumen lampiran BUKTI per item pengujian (task SIT, skenario UAT,
 * skenario QA, temuan Audit Keamanan Siber).
 *
 * Lampiran ini hanya bermakna pada konteks item tempat ia diunggah — panel eksekusi
 * SIT per task, wizard SIT/UAT, atau kartu laporan pengujian pada layar review Lead —
 * bukan sebagai dokumen prasyarat per fase. Karena itu dikecualikan dari daftar
 * dokumen umum yang dibaca lintas fase, mis. prasyarat pengajuan QA & Siber.
 *
 * ⚠️  Daftar ini harus sejalan dengan `DocumentVault::EVIDENCE_TYPES` di backend,
 * yang juga menentukan tipe mana yang namanya diberi penanda unik saat diunggah.
 */
export const EVIDENCE_DOCUMENT_TYPES = ['SIT_TASK_EVIDENCE', 'UAT_EVIDENCE', 'QA_EVIDENCE', 'CYBER_EVIDENCE'];

/**
 * Cek apakah sebuah kode tipe dokumen termasuk lampiran bukti pengujian.
 */
export function isEvidenceDocumentType(code) {
    return EVIDENCE_DOCUMENT_TYPES.includes(String(code || '').toUpperCase());
}

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
 * Label ukuran satu berkas dokumen, atau keterangan bahwa ukurannya tidak tercatat.
 *
 * Backend menyimpan ukuran sebagai jumlah byte (`documents.file_size`). Beberapa layar
 * sebelumnya memakai string tetap ('2.0 MB', '2.4 MB', '1.8 MB') sebagai nilai bawaan,
 * yang tampil di layar seolah data sungguhan. Berkas tanpa catatan ukuran sekarang
 * menyatakan keadaannya apa adanya.
 */
export function formatDocSizeLabel(doc) {
    const raw = doc?.size ?? doc?.file_size ?? null;
    if (raw === null || raw === undefined || raw === '') return 'Ukuran tidak tercatat';
    if (typeof raw === 'number') return formatFileSize(raw);

    // Nilai yang sudah berbentuk label (mis. "1.2 MB") dibiarkan apa adanya.
    const numeric = Number(raw);
    return Number.isFinite(numeric) && String(raw).trim() !== '' ? formatFileSize(numeric) : String(raw);
}

/**
 * Deteksi tipe dokumen dari nama file (fallback jika user tidak pilih manual)
 */
export function detectDocTypeFromFilename(filename) {
    const fn = (filename || '').toLowerCase();
    if (fn.includes('brd') || fn.includes('requirement')) return 'BRD';
    if (fn.includes('fsd') || fn.includes('spesifikasi')) return 'FSD';
    if (fn.includes('memo')) return 'MEMO';
    if (fn.includes('undangan') || fn.includes('invitation')) return 'UNDANGAN';
    if (fn.includes('qa') || fn.includes('test')) return 'QA_REPORT';
    if (fn.includes('uat')) return 'UAT_RESULT';
    if (fn.includes('siber') || fn.includes('cyber') || fn.includes('pentest')) return 'CYBER_REPORT';
    if (fn.includes('arsip') || fn.includes('.zip')) return 'ARSIP';
    if (fn.includes('.xls') || fn.includes('.csv')) return 'SPREADSHEET';
    if (fn.includes('.jpg') || fn.includes('.png') || fn.includes('.jpeg') || fn.includes('.gif')) return 'GAMBAR';
    return 'LAINNYA';
}

/**
 * Ambil label ekstensi dari nama file untuk ikon.
 * Contoh: "dokumen.pdf" → "PDF", "foto.jpg" → "JPG", "arsip.zip" → "ZIP"
 */
export function getDocExtLabel(fileName) {
    if (!fileName) return 'FILE';
    const parts = fileName.split('.');
    if (parts.length < 2) return 'FILE';
    const ext = parts[parts.length - 1].toLowerCase();
    const map = {
        pdf: 'PDF',
        xls: 'XLS',
        xlsx: 'XLSX',
        doc: 'DOC',
        docx: 'DOCX',
        jpg: 'JPG',
        jpeg: 'JPEG',
        png: 'PNG',
        gif: 'GIF',
        svg: 'SVG',
        zip: 'ZIP',
        rar: 'RAR',
        txt: 'TXT',
        csv: 'CSV',
        ppt: 'PPT',
        pptx: 'PPTX',
    };
    return map[ext] || ext.substring(0, 4).toUpperCase();
}

/**
 * Ambil style background + text Tailwind untuk ikon ekstensi file.
 */
export function getDocIconStyle(fileName) {
    if (!fileName) return '';
    const parts = fileName.split('.');
    if (parts.length < 2) return 'bg-gray-100 text-gray-600';
    const ext = parts[parts.length - 1].toLowerCase();
    switch (ext) {
        case 'pdf': return 'bg-red-100 text-red-600';
        case 'xls': case 'xlsx': case 'csv': return 'bg-green-100 text-green-600';
        case 'doc': case 'docx': return 'bg-blue-100 text-blue-600';
        case 'jpg': case 'jpeg': case 'png': case 'gif': case 'svg': return 'bg-purple-100 text-purple-600';
        case 'zip': case 'rar': return 'bg-amber-100 text-amber-700';
        default: return 'bg-gray-100 text-gray-600';
    }
}
