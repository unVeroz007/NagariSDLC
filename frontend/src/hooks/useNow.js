import { useSyncExternalStore } from 'react';

/**
 * src/hooks/useNow.js
 *
 * Sumber waktu "sekarang" bersama untuk komponen React.
 *
 * Beberapa layar menghitung sisa hari deadline atau label "x menit lalu" dengan
 * memanggil `Date.now()` langsung di dalam render. Cara itu membuat hasil render
 * tidak idempoten: dua render dengan props yang sama bisa menghasilkan angka
 * berbeda, sehingga nilai yang tampil dapat berubah hanya karena komponen
 * kebetulan dirender ulang. Waktu adalah state di luar React, jadi diperlakukan
 * seperti itu — nilainya di-cache, berubah hanya pada tick, dan setiap perubahan
 * memicu render ulang lewat `useSyncExternalStore`.
 *
 * Granularitasnya satu menit karena semua pemakainya menampilkan satuan menit
 * atau hari. Timer hanya hidup selama masih ada komponen yang berlangganan.
 */
const TICK_INTERVAL_MS = 60_000;

let cachedNow = 0;
let timerId = null;
const listeners = new Set();

function readClock() {
    if (cachedNow === 0) cachedNow = Date.now();
    return cachedNow;
}

function tick() {
    cachedNow = Date.now();
    listeners.forEach((listener) => listener());
}

function subscribe(listener) {
    listeners.add(listener);
    if (timerId === null) {
        timerId = window.setInterval(tick, TICK_INTERVAL_MS);
    }
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timerId !== null) {
            window.clearInterval(timerId);
            timerId = null;
        }
    };
}

/**
 * @returns {number} Penanda waktu sekarang dalam milidetik, stabil selama satu render.
 */
export function useNow() {
    return useSyncExternalStore(subscribe, readClock, readClock);
}
