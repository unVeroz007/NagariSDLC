/**
 * Prioritas proyek — satu daftar nilai, label, dan gaya lencana untuk seluruh layar.
 *
 * ⚠️  Nilai string di sini HARUS cocok dengan yang tersimpan pada kolom
 * `projects.priority` dan divalidasi `StoreProjectRequest`. Kosakatanya sengaja
 * dibuat sama dengan `project_tasks.priority` yang sudah lebih dulu ada, agar
 * aplikasi tidak menyimpan dua vokabulari prioritas yang berbeda.
 *
 * Latar masalahnya: form pengajuan sebelumnya menawarkan `Rendah | Medium | Urgent`
 * sementara setiap layar pembaca membandingkan dengan `High | Medium | Low`. Dua dari
 * tiga pilihan pengaju karena itu tidak pernah cocok dengan pembacanya, dan setiap
 * layar menuliskan sendiri peta label serta warnanya.
 */

export const PROJECT_PRIORITY = {
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
};

/** Nilai bawaan bila pengaju tidak memilih apa pun. */
export const DEFAULT_PROJECT_PRIORITY = PROJECT_PRIORITY.MEDIUM;

export const PROJECT_PRIORITY_LABEL = {
    [PROJECT_PRIORITY.HIGH]: 'Tinggi',
    [PROJECT_PRIORITY.MEDIUM]: 'Sedang',
    [PROJECT_PRIORITY.LOW]: 'Rendah',
};

/**
 * Label pendek berikut penandanya, dipakai pada lencana yang sempit.
 */
export const PROJECT_PRIORITY_BADGE_LABEL = {
    [PROJECT_PRIORITY.HIGH]: '🔴 Tinggi',
    [PROJECT_PRIORITY.MEDIUM]: '🟡 Sedang',
    [PROJECT_PRIORITY.LOW]: '🟢 Rendah',
};

export const PROJECT_PRIORITY_CLASS = {
    [PROJECT_PRIORITY.HIGH]: 'bg-red-500/10 text-red-600 border-red-200',
    [PROJECT_PRIORITY.MEDIUM]: 'bg-amber-500/10 text-amber-600 border-amber-200',
    [PROJECT_PRIORITY.LOW]: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
};

/** Gaya lencana saat pilihan aktif pada form pengajuan. */
export const PROJECT_PRIORITY_ACTIVE_CLASS = {
    [PROJECT_PRIORITY.HIGH]: 'bg-red-600 text-white border-red-600',
    [PROJECT_PRIORITY.MEDIUM]: 'bg-[#00529C] text-white border-[#00529C]',
    [PROJECT_PRIORITY.LOW]: 'bg-gray-200 text-gray-700 border-gray-300',
};

/**
 * Urutan pilihan pada form: paling mendesak lebih dulu.
 */
export const PROJECT_PRIORITY_OPTIONS = [
    PROJECT_PRIORITY.HIGH,
    PROJECT_PRIORITY.MEDIUM,
    PROJECT_PRIORITY.LOW,
].map((value) => ({
    value,
    label: PROJECT_PRIORITY_LABEL[value],
}));

/**
 * Padanan label lama ke nilai kanonis.
 *
 * Proyek yang diajukan sebelum kolom `projects.priority` ada tidak menyimpan nilai apa
 * pun, tetapi label lama masih bisa muncul dari draft lokal atau dari data yang
 * diketik manual. Memetakan padanannya di sini membuat layar tetap menampilkan
 * prioritas yang benar alih-alih jatuh ke keadaan "tidak diketahui".
 */
const PRIORITY_ALIAS = {
    high: PROJECT_PRIORITY.HIGH,
    tinggi: PROJECT_PRIORITY.HIGH,
    urgent: PROJECT_PRIORITY.HIGH,
    mendesak: PROJECT_PRIORITY.HIGH,
    medium: PROJECT_PRIORITY.MEDIUM,
    sedang: PROJECT_PRIORITY.MEDIUM,
    normal: PROJECT_PRIORITY.MEDIUM,
    low: PROJECT_PRIORITY.LOW,
    rendah: PROJECT_PRIORITY.LOW,
};

/**
 * Normalisasi nilai apa pun ke salah satu nilai kanonis, atau null bila tidak dikenali.
 *
 * Mengembalikan null — bukan `Medium` — supaya layar dapat membedakan "prioritas
 * sedang" dari "prioritas belum tercatat". Menyamakan keduanya membuat proyek lama
 * tampil seolah pengajunya pernah memilih, padahal tidak.
 */
export const normalizeProjectPriority = (value) => {
    const key = String(value ?? '').trim().toLowerCase();

    return PRIORITY_ALIAS[key] ?? null;
};

export const getProjectPriorityLabel = (value) => {
    const normalized = normalizeProjectPriority(value);

    return normalized ? PROJECT_PRIORITY_LABEL[normalized] : 'Belum ditentukan';
};

export const getProjectPriorityBadgeLabel = (value) => {
    const normalized = normalizeProjectPriority(value);

    return normalized ? PROJECT_PRIORITY_BADGE_LABEL[normalized] : '⚪ Belum ditentukan';
};

export const getProjectPriorityClass = (value) => {
    const normalized = normalizeProjectPriority(value);

    return normalized
        ? PROJECT_PRIORITY_CLASS[normalized]
        : 'bg-gray-100 text-gray-600 border-gray-200';
};

/**
 * Prioritas ini menuntut perhatian lebih cepat daripada proyek lain.
 */
export const isHighProjectPriority = (value) =>
    normalizeProjectPriority(value) === PROJECT_PRIORITY.HIGH;
