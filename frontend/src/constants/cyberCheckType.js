/**
 * Jenis pemeriksaan pada jalur Audit Keamanan Siber.
 *
 * ⚠️  Nilai string di sini HARUS cocok 100% dengan enum `CyberCheckType.php` di backend.
 *
 * PM memilih salah satu saat mengajukan proyek ke Audit Keamanan Siber, dan pilihan itu
 * menentukan masukan apa yang wajib disertakan:
 *
 *   pentest      alamat web yang boleh diuji (`cyber_target_url`)
 *   secure_code  rujukan kode sumber yang akan ditelaah (`cyber_source_code_ref`)
 *
 * Jenis pemeriksaan tidak menentukan daftar skenario yang wajib dikerjakan. Ruang lingkup
 * nyata sebuah audit keamanan berbeda pada tiap proyek, sehingga pelaksana menuliskan
 * lingkup dan temuannya sebagai narasi pada laporan, bukan mencentang daftar tetap.
 */

export const CYBER_CHECK_TYPE = {
    PENTEST: 'pentest',
    SECURE_CODE: 'secure_code',
};

export const CYBER_CHECK_TYPE_LABEL = {
    [CYBER_CHECK_TYPE.PENTEST]: 'Penetration Test',
    [CYBER_CHECK_TYPE.SECURE_CODE]: 'Secure Code Review',
};

export const CYBER_CHECK_TYPE_DESCRIPTION = {
    [CYBER_CHECK_TYPE.PENTEST]:
        'Pengujian keamanan terhadap aplikasi yang sudah berjalan. Menyerang aplikasi dari luar untuk menemukan celah yang dapat dieksploitasi.',
    [CYBER_CHECK_TYPE.SECURE_CODE]:
        'Telaah keamanan terhadap kode sumber. Membaca kode untuk menemukan pola tidak aman sebelum aplikasi terpapar ke jaringan.',
};

/**
 * Opsi siap pakai untuk kelompok radio button pada layar pengajuan PM.
 */
export const CYBER_CHECK_TYPE_OPTIONS = [
    {
        value: CYBER_CHECK_TYPE.PENTEST,
        label: CYBER_CHECK_TYPE_LABEL[CYBER_CHECK_TYPE.PENTEST],
        description: CYBER_CHECK_TYPE_DESCRIPTION[CYBER_CHECK_TYPE.PENTEST],
        inputLabel: 'Alamat Web yang Diuji',
        inputPlaceholder: 'https://staging.banknagari.co.id/nama-aplikasi',
        inputHelp: 'Alamat lengkap termasuk https://. Pastikan aplikasi dapat diakses tim Keamanan Siber.',
    },
    {
        value: CYBER_CHECK_TYPE.SECURE_CODE,
        label: CYBER_CHECK_TYPE_LABEL[CYBER_CHECK_TYPE.SECURE_CODE],
        description: CYBER_CHECK_TYPE_DESCRIPTION[CYBER_CHECK_TYPE.SECURE_CODE],
        inputLabel: 'Rujukan Kode Sumber',
        inputPlaceholder: 'Contoh: repo git internal, branch, atau lokasi berkas arsip kode',
        inputHelp: 'Sebutkan lokasi kode beserta branch atau versinya agar telaah dilakukan pada kode yang benar.',
    },
];

/**
 * Normalisasi nilai dari API atau form ke salah satu nilai enum, atau null.
 */
export const normalizeCyberCheckType = (value) => {
    const normalized = String(value ?? '').trim().toLowerCase();

    return Object.values(CYBER_CHECK_TYPE).includes(normalized) ? normalized : null;
};

export const getCyberCheckTypeLabel = (value) => {
    const normalized = normalizeCyberCheckType(value);

    return normalized ? CYBER_CHECK_TYPE_LABEL[normalized] : null;
};

export const getCyberCheckTypeOption = (value) => {
    const normalized = normalizeCyberCheckType(value);

    return CYBER_CHECK_TYPE_OPTIONS.find((option) => option.value === normalized) ?? null;
};

/**
 * Masukan wajib pengajuan menurut jenis pemeriksaan yang dipilih.
 */
export const requiresTargetUrl = (value) =>
    normalizeCyberCheckType(value) === CYBER_CHECK_TYPE.PENTEST;

export const requiresSourceCodeRef = (value) =>
    normalizeCyberCheckType(value) === CYBER_CHECK_TYPE.SECURE_CODE;

/*
 * Catatan sejarah: modul ini pernah mengekspor `CYBER_CHECKLIST_ITEMS` dan
 * `getCyberChecklistItems()` — dua daftar tetap berisi enam skenario yang wajib dicentang
 * Pentester. Keduanya dihapus atas keputusan pengguna (25 Agustus 2026) karena audit
 * keamanan nyata tidak selalu menempuh skenario yang sama, sehingga daftar tetap justru
 * memaksa pelaksana mencentang hal yang di luar ruang lingkupnya.
 *
 * Kolom `test_reports.checklist` sengaja dipertahankan sebagai kolom warisan: laporan lama
 * kedua jalur menyimpan enam key tersebut sebagai jejak audit. Jalur Pengujian QA kini juga
 * memakai catatan bebas `test_reports.tested_scenarios`, sama seperti jalur Siber yang tidak
 * lagi memakai daftar tetap. Jangan menghapus kolom `checklist`, dan jangan menghidupkan
 * kembali daftar tetap di jalur mana pun.
 */
