/**
 * src/constants/polling.js
 *
 * Satu tempat untuk seluruh selang waktu polling frontend.
 *
 * Aplikasi ini belum memakai WebSocket, jadi kesegaran data bergantung pada
 * beberapa timer periodik. Sebelumnya tiap layar menulis angkanya sendiri
 * (10000, 15000, 20000, 30000) tanpa keterangan, sehingga tidak ada yang bisa
 * menilai beban permintaan gabungan ke API atau menyetelnya secara serentak.
 *
 * Semua nilai dalam milidetik. Naikkan bila beban server terlalu tinggi;
 * turunkan hanya untuk data yang benar-benar perlu tampak seketika.
 *
 * Catatan: semua polling dijalankan lewat `useVisibilityPolling`
 * (`src/hooks/usePolling.js`) sehingga berhenti saat tab tidak terlihat.
 */
export const POLLING_INTERVAL_MS = {
    /** Daftar proyek beserta status jalur pengujian — dipakai hampir semua layar. */
    projects: 30000,

    /**
     * Jumlah persetujuan internal yang menunggu, tampil sebagai lencana sidebar
     * "Persetujuan Saya".
     *
     * Namanya dahulu `uatApprovals`, dari masa ketika lencana itu hanya menghitung
     * inbox UAT internal. Satu halaman `/approvals` kini memuat SIT dan UAT
     * sekaligus dan `MainLayout` memakai selang yang sama untuk kedua permintaan,
     * jadi nama lamanya menyesatkan pembaca call site-nya.
     */
    internalApprovals: 30000,

    /**
     * Kotak masuk notifikasi pada lonceng topbar.
     *
     * Lebih lambat daripada chat: notifikasi menandai peristiwa alur kerja yang
     * tidak menuntut reaksi dalam hitungan detik, dan lonceng ini hidup di
     * `MainLayout` sehingga polling-nya berjalan di SETIAP layar sepanjang sesi —
     * bukan hanya saat halaman tertentu dibuka. Selangnya disamakan dengan
     * `internalApprovals` karena keduanya mengisi lencana pada kerangka yang sama.
     */
    notifications: 30000,

    /** Pesan diskusi proyek. Paling cepat karena percakapan terasa rusak bila tertunda. */
    chatMessages: 10000,

    /** Data wizard SIT/UAT pada satu proyek (`projects.sit_uat_data`). */
    sitUatData: 20000,

    /** Jejak kegiatan (activity log) pada halaman detail task. */
    activityLog: 15000,
};
