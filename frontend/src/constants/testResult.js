/**
 * Hasil satu laporan pengujian pada jalur QA atau Audit Keamanan Siber.
 *
 * ⚠️  Nilai string di sini HARUS cocok 100% dengan enum `TestResult.php` di backend,
 * karena dikirim apa adanya sebagai field `result` ke endpoint `/report` dan `/sign-off`.
 *
 * Pembagian pemakaiannya:
 *
 *   TESTER_RESULT_OPTIONS   penilaian pelaksana pengujian — tiga pilihan, termasuk
 *                           "Lulus dengan Catatan" untuk temuan yang tidak menghalangi.
 *   LEAD_DECISION_OPTIONS   keputusan Lead saat sign-off — hanya lulus atau kembalikan
 *                           ke pengembangan, karena alur kerja tidak punya jalur untuk
 *                           keadaan ketiga.
 */

export const TEST_RESULT = {
    PASS: 'pass',
    CONDITIONAL_PASS: 'conditional_pass',
    FAIL: 'fail',
};

export const TEST_RESULT_LABEL = {
    [TEST_RESULT.PASS]: 'Lulus',
    [TEST_RESULT.CONDITIONAL_PASS]: 'Lulus dengan Catatan',
    [TEST_RESULT.FAIL]: 'Tidak Lulus',
};

/**
 * Pilihan penilaian untuk layar pelaksana pengujian (QA Tester / Pentester).
 */
export const TESTER_RESULT_OPTIONS = [
    {
        value: TEST_RESULT.PASS,
        label: TEST_RESULT_LABEL[TEST_RESULT.PASS],
        hint: 'Tidak ada temuan yang perlu diperbaiki.',
    },
    {
        value: TEST_RESULT.CONDITIONAL_PASS,
        label: TEST_RESULT_LABEL[TEST_RESULT.CONDITIONAL_PASS],
        hint: 'Ada temuan, namun tidak menghalangi rilis.',
    },
    {
        value: TEST_RESULT.FAIL,
        label: TEST_RESULT_LABEL[TEST_RESULT.FAIL],
        hint: 'Ada temuan yang wajib diperbaiki lebih dulu.',
    },
];

/**
 * Pilihan keputusan Lead saat sign-off jalur.
 */
export const LEAD_DECISION_OPTIONS = [
    { value: TEST_RESULT.PASS, label: TEST_RESULT_LABEL[TEST_RESULT.PASS] },
    { value: TEST_RESULT.FAIL, label: TEST_RESULT_LABEL[TEST_RESULT.FAIL] },
];

export const normalizeTestResult = (value) => {
    const normalized = String(value ?? '').trim().toLowerCase();

    return Object.values(TEST_RESULT).includes(normalized) ? normalized : null;
};

export const getTestResultLabel = (value) => {
    const normalized = normalizeTestResult(value);

    return normalized ? TEST_RESULT_LABEL[normalized] : null;
};

/**
 * Catatan wajib untuk semua hasil selain lulus tanpa syarat.
 *
 * Cerminan aturan `required_unless:result,pass` pada `SubmitTestReportRequest`, supaya
 * pengguna diberi tahu sebelum permintaan dikirim dan bukan lewat pesan 422.
 */
export const testResultRequiresNotes = (value) =>
    normalizeTestResult(value) !== TEST_RESULT.PASS;
