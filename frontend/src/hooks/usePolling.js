import { useEffect, useRef } from 'react';

/**
 * Polling periodik yang berhenti saat tab tidak terlihat.
 *
 * @param {() => void | Promise<void>} callback  Aksi pengambilan data.
 * @param {number} intervalMs                    Selang polling (lihat `constants/polling.js`).
 * @param {object} [options]
 * @param {boolean} [options.enabled=true]       Matikan saat belum login / data belum siap.
 * @param {boolean} [options.immediate=false]    Jalankan sekali segera saat aktif.
 * @param {boolean} [options.refreshOnReturn=false] Jalankan lagi saat tab kembali terlihat/fokus.
 * @param {*} [options.resetKey]                 Mulai ulang timer saat sumber data berubah.
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
             * Tangkap error sinkron maupun Promise agar timer tetap berjalan. Callback
             * menentukan pesan pengguna; hook mencatat error latar belakang ke konsol.
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
