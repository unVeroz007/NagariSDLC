import { useEffect, useRef } from 'react';

/**
 * src/hooks/usePolling.js
 *
 * Polling periodik yang berhenti saat tab tidak terlihat.
 *
 * Semua layar sebelumnya menulis pasangan `setInterval` + `clearInterval`
 * sendiri, dan sebagian tidak memeriksa `document.visibilityState` sehingga
 * tetap memukul API meski tab ditinggalkan berjam-jam. Hook ini menyatukan
 * perilakunya: satu timer, berhenti saat tersembunyi, dan opsi menyegarkan
 * data begitu pengguna kembali ke tab.
 *
 * @param {() => void | Promise<void>} callback  Aksi pengambilan data.
 * @param {number} intervalMs                    Selang polling (lihat `constants/polling.js`).
 * @param {object} [options]
 * @param {boolean} [options.enabled=true]       Matikan saat belum login / data belum siap.
 * @param {boolean} [options.immediate=false]    Jalankan sekali segera saat aktif.
 * @param {boolean} [options.refreshOnReturn=false] Jalankan lagi saat tab kembali terlihat/fokus.
 * @param {*} [options.resetKey]                 Bila nilainya berubah, timer dimulai ulang dan
 *        pengambilan `immediate` dijalankan lagi. Pakai untuk identitas sumber data
 *        (misal id proyek atau id pengguna) supaya data lama tidak ikut tertahan.
 */
export function useVisibilityPolling(callback, intervalMs, options = {}) {
    const { enabled = true, immediate = false, refreshOnReturn = false, resetKey = null } = options;

    // Simpan callback terbaru di ref supaya timer tidak dibuat ulang setiap
    // render hanya karena identitas fungsinya berubah.
    const callbackRef = useRef(callback);
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!enabled) return undefined;

        const runIfVisible = () => {
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

            /*
             * Callback boleh mengembalikan Promise (lihat JSDoc), dan sebelumnya
             * hasilnya diabaikan begitu saja. Satu penolakan — token kedaluwarsa,
             * jaringan putus, backend 500 — menjadi unhandled promise rejection pada
             * SETIAP putaran polling, di setiap layar yang memakai hook ini. Di
             * peramban hal itu memenuhi konsol dengan galat yang tidak bisa
             * ditelusuri asalnya, dan pada penampung uji berbasis Node prosesnya
             * bisa ikut berhenti.
             *
             * Galatnya ditangkap, tetapi TIDAK ditelan: menelan diam-diam membuat
             * kerusakan nyata (endpoint mati, token tidak lagi sah) tampak seperti
             * layar yang sekadar tidak pernah menyegarkan data. `console.error`
             * dipilih sebagai jalan tengah — cukup terlihat bagi pengembang dan
             * terbawa ke pelaporan galat peramban, tanpa memaksa pemanggil
             * menangani sesuatu yang bersifat latar belakang. Penanganan yang
             * terlihat pengguna tetap menjadi tanggung jawab callback: ia yang tahu
             * apakah kegagalan tersebut layak ditampilkan sebagai pesan galat atau
             * cukup dibiarkan memakai data terakhir yang berhasil dimuat.
             *
             * Callback sinkron yang melempar juga ikut tertangkap lewat `try`, jadi
             * satu galat tidak menghentikan timer untuk putaran-putaran berikutnya.
             */
            try {
                const result = callbackRef.current();
                if (result && typeof result.then === 'function') {
                    result.catch((error) => {
                        console.error('[useVisibilityPolling] callback polling gagal:', error);
                    });
                }
            } catch (error) {
                console.error('[useVisibilityPolling] callback polling gagal:', error);
            }
        };

        if (immediate) runIfVisible();

        const timer = window.setInterval(runIfVisible, intervalMs);

        let handleReturn;
        if (refreshOnReturn) {
            handleReturn = () => runIfVisible();
            document.addEventListener('visibilitychange', handleReturn);
            window.addEventListener('focus', handleReturn);
        }

        return () => {
            window.clearInterval(timer);
            if (handleReturn) {
                document.removeEventListener('visibilitychange', handleReturn);
                window.removeEventListener('focus', handleReturn);
            }
        };
    }, [enabled, immediate, intervalMs, refreshOnReturn, resetKey]);
}
