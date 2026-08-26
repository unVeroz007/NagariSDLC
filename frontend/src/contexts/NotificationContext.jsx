import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { notificationService } from '../services/api';
import { useVisibilityPolling } from '../hooks/usePolling';
import { POLLING_INTERVAL_MS } from '../constants/polling';

const NotificationContext = createContext();

/**
 * src/contexts/NotificationContext.jsx
 *
 * Satu sumber notifikasi untuk seluruh aplikasi: kotak masuk `GET /notifications`
 * di backend, ditambah jalur terpisah untuk pemberitahuan yang hanya ada di
 * peramban.
 *
 * Sebelumnya provider ini adalah penyimpanan localStorage murni: seluruh isi
 * lonceng dan blok "Aktivitas Terkini" di dashboard berasal dari
 * `addNotification()` yang dipanggil halaman setelah aksinya sendiri berhasil.
 * Akibatnya notifikasi yang ditulis backend — perpindahan status proyek pada
 * `ProjectWorkflowService`, pergerakan jalur pengujian pada `TestingTrackService`
 * — tidak pernah terlihat oleh siapa pun; `notificationService` di `api.js` ada
 * tetapi tidak punya satu pun pemanggil. Sebaliknya, isi lonceng bergantung pada
 * peramban mana yang dipakai: notifikasi tidak muncul di perangkat lain, dan
 * peristiwa yang terjadi saat pengguna tidak sedang membuka aplikasi hilang sama
 * sekali.
 *
 * Pembagian sekarang:
 *
 *   - `source: 'server'` — baris tabel `notifications`. Inilah sumber kebenaran.
 *     Persisten, lintas perangkat, dan status terbacanya disimpan backend.
 *   - `source: 'local'` — hasil `addNotification()`. Umpan balik seketika atas
 *     aksi pengguna sendiri, sebagian membawa `relatedUrl` sebagai pintasan
 *     navigasi. TIDAK dapat dipersistenkan: API tidak menyediakan endpoint untuk
 *     membuat notifikasi (`routes/api.php` hanya punya GET index, PATCH read, dan
 *     PATCH read-all), jadi jalur ini hidup di memori satu sesi tab saja dan
 *     hilang saat halaman dimuat ulang. Itu dapat diterima karena peristiwa alur
 *     kerja yang mendasarinya tetap dicatat backend dan kembali lewat jalur
 *     server.
 *
 * localStorage sengaja tidak lagi dipakai sama sekali. Menyimpan salinan kedua di
 * peramban berarti dua sumber yang saling bersaing tanpa cara merekonsiliasinya:
 * status terbaca di server tidak bisa dicerminkan ke salinan lokal, notifikasi
 * yang sudah ditandai terbaca di perangkat lain akan kembali muncul sebagai belum
 * dibaca, dan — seperti dicatat versi sebelumnya berkas ini — isinya tidak pernah
 * dibersihkan saat logout sehingga lencana "belum dibaca" milik pengguna
 * sebelumnya masih tampil di komputer kerja bersama.
 */

/**
 * Prefiks kunci localStorage versi lama, hanya untuk dibersihkan.
 *
 * Kunci berpola `nagari_sdlc_notifications:<id pengguna>` ditulis oleh versi
 * sebelumnya provider ini dan kini tidak dibaca lagi. Residunya dihapus supaya
 * teks notifikasi — nama proyek dan nama orang di dalamnya — tidak tertinggal
 * tanpa batas waktu di peramban bersama.
 *
 * Kunci tanpa pemilik (`nagari_sdlc_notifications` tanpa akhiran) sengaja tidak
 * disentuh, meneruskan keputusan yang sudah didokumentasikan sebelumnya: isinya
 * tidak dapat lagi dipastikan milik siapa.
 */
const LEGACY_STORAGE_KEY_PREFIX = 'nagari_sdlc_notifications:';

/**
 * Penanda id notifikasi lokal.
 *
 * Id baris server adalah bilangan bulat dari database, sedangkan id lokal selalu
 * string berawalan ini. Dengan begitu `markAsRead(id)` dan `removeNotification(id)`
 * dapat menentukan tujuan panggilannya dari id-nya saja — tanpa membaca state —
 * dan kedua ruang id tidak mungkin bertabrakan.
 */
const LOCAL_ID_PREFIX = 'local:';

/** Halaman pertama kotak masuk sudah cukup untuk lonceng; sisanya tidak ditampilkan. */
const SERVER_PAGE_SIZE = 20;

const isLocalId = (id) => typeof id === 'string' && id.startsWith(LOCAL_ID_PREFIX);

/** Ubah baris API (snake_case) menjadi bentuk yang dipakai komponen. */
const normalizeServerRow = (row) => ({
    id: row.id,
    source: 'server',
    title: row.title,
    message: row.message,
    type: row.type || 'info',
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
    /*
     * Tabel `notifications` tidak memiliki kolom tautan tujuan (lihat migrasi
     * `2026_07_28_070536_create_notifications_table.php`), jadi notifikasi server
     * tidak dapat diklik untuk berpindah halaman. Nilainya ditulis eksplisit null
     * agar konsumen tidak perlu membedakan kedua sumber, dan agar jelas bahwa ini
     * keterbatasan skema — bukan kelalaian.
     */
    relatedUrl: null,
});

/** Urutan gabungan memakai waktu; tanggal yang tidak terbaca dianggap paling tua. */
const toTimestamp = (value) => {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

export function NotificationProvider({ children }) {
    const { user } = useAuth();
    const userId = user?.id ?? null;

    // Baris dari server dan pemberitahuan lokal disimpan terpisah, bukan dalam satu
    // daftar. Setiap polling menimpa seluruh daftar server; bila keduanya bercampur,
    // penimpaan itu ikut menghapus pemberitahuan lokal yang baru saja muncul.
    const [serverItems, setServerItems] = useState([]);
    const [localItems, setLocalItems] = useState([]);

    /*
     * Jumlah belum dibaca untuk SELURUH kotak masuk, diambil dari `meta.unread_count`
     * balasan API. Tidak dihitung dari `serverItems` karena daftar itu hanya halaman
     * pertama: pengguna dengan 30 notifikasi belum dibaca akan melihat lencana "20"
     * bila dihitung dari data yang termuat saja.
     */
    const [serverUnreadCount, setServerUnreadCount] = useState(0);

    // `isLoading` hanya menandai pemuatan pertama untuk pengguna aktif, dan selalu
    // berakhir (blok `finally`), sehingga tidak mungkin meninggalkan pemuat yang
    // berputar selamanya. Polling berikutnya berjalan diam-diam di latar belakang —
    // menyalakan pemuat setiap 30 detik hanya membuat isi lonceng berkedip.
    const [isLoading, setIsLoading] = useState(Boolean(userId));
    const [error, setError] = useState(null);

    // Pembeda id dalam milidetik yang sama. `Date.now()` saja tidak cukup: dua
    // notifikasi yang dibuat pada milidetik yang sama mendapat id identik, sehingga
    // key React bertabrakan dan `markAsRead` menandai keduanya sekaligus.
    const sequenceRef = useRef(0);

    /*
     * Ganti seluruh isi begitu pemiliknya berubah — termasuk saat logout, yang
     * membuat `userId` menjadi null.
     *
     * Penyesuaian dilakukan saat render, bukan di dalam `useEffect`. Bila memakai
     * efek, satu render sempat menampilkan notifikasi pengguna sebelumnya kepada
     * pengguna yang baru masuk sebelum efeknya berjalan. React membuang hasil render
     * ini dan langsung mengulangnya tanpa menampilkan yang lama.
     */
    const [ownerId, setOwnerId] = useState(userId);
    if (ownerId !== userId) {
        setOwnerId(userId);
        setServerItems([]);
        setLocalItems([]);
        setServerUnreadCount(0);
        setError(null);
        setIsLoading(Boolean(userId));
    }

    // Bersihkan sisa cache localStorage versi lama sekali per pemuatan aplikasi.
    useEffect(() => {
        try {
            const staleKeys = [];
            for (let i = 0; i < localStorage.length; i += 1) {
                const key = localStorage.key(i);
                if (key && key.startsWith(LEGACY_STORAGE_KEY_PREFIX)) staleKeys.push(key);
            }
            staleKeys.forEach((key) => localStorage.removeItem(key));
        } catch {
            // localStorage bisa ditolak peramban (mode privat, kuota penuh). Pembersihan
            // ini bersifat kebersihan data, jadi kegagalannya tidak boleh menggagalkan
            // render provider.
        }
    }, []);

    /*
     * Cermin state untuk dibaca di dalam callback tanpa menjadikannya dependensi.
     * `markAsRead` perlu tahu apakah baris yang diklik memang belum dibaca, dan
     * `markAllAsRead` perlu menyimpan keadaan sebelum perubahan optimistis untuk
     * dipulihkan bila permintaannya gagal. Pemeriksaan itu tidak boleh dilakukan di
     * dalam updater `setState`: pada mode pengembangan React menjalankan updater dua
     * kali, sehingga efek samping di dalamnya terhitung ganda — persis bug lencana
     * yang pernah terjadi di berkas ini.
     */
    const serverItemsRef = useRef(serverItems);
    useEffect(() => {
        serverItemsRef.current = serverItems;
    }, [serverItems]);

    const serverUnreadCountRef = useRef(serverUnreadCount);
    useEffect(() => {
        serverUnreadCountRef.current = serverUnreadCount;
    }, [serverUnreadCount]);

    // Pemilik yang sedang berlaku, dipakai membuang balasan yang datang terlambat
    // setelah pengguna berganti (lihat `loadFromServer`).
    const activeOwnerRef = useRef(userId);
    useEffect(() => {
        activeOwnerRef.current = userId;
    }, [userId]);

    const loadFromServer = useCallback(async () => {
        if (!userId) return;

        const requestedFor = userId;
        try {
            const response = await notificationService.getAll({ perPage: SERVER_PAGE_SIZE });

            // Permintaan pengguna sebelumnya bisa selesai setelah pengguna berganti.
            // Memasangnya berarti menampilkan kotak masuk orang lain.
            if (requestedFor !== activeOwnerRef.current) return;

            const rows = Array.isArray(response?.data) ? response.data : [];
            const unreadFromMeta = Number(response?.meta?.unread_count);

            setServerItems(rows.map(normalizeServerRow));
            setServerUnreadCount(
                Number.isFinite(unreadFromMeta)
                    ? unreadFromMeta
                    // Cadangan bila `meta` tidak terkirim: dihitung dari halaman yang
                    // termuat. Angkanya bisa lebih kecil dari kenyataan, tetapi lebih
                    // baik daripada lencana yang hilang sama sekali.
                    : rows.filter((row) => !row.is_read).length,
            );
            setError(null);
        } catch (err) {
            if (requestedFor !== activeOwnerRef.current) return;
            // Sesi kedaluwarsa (401) sudah ditangani terpusat di `api.js` lewat event
            // `auth:unauthorized`, jadi di sini cukup menyimpan pesannya. Galat tidak
            // dilempar ulang: penanganannya sudah selesai di sini dan UI menampilkannya,
            // sehingga tidak perlu ditulis dua kali ke konsol oleh `useVisibilityPolling`.
            setError(err?.message || 'Notifikasi gagal dimuat.');
        } finally {
            if (requestedFor === activeOwnerRef.current) setIsLoading(false);
        }
    }, [userId]);

    // Polling berhenti sendiri saat tab tidak terlihat. `refreshOnReturn` dipakai
    // karena notifikasi adalah hal pertama yang dilihat pengguna begitu ia kembali
    // ke tab, dan `resetKey` memastikan pergantian akun memuat ulang dari nol.
    useVisibilityPolling(loadFromServer, POLLING_INTERVAL_MS.notifications, {
        enabled: Boolean(userId),
        immediate: true,
        refreshOnReturn: true,
        resetKey: userId,
    });

    /**
     * Daftar gabungan, terbaru lebih dulu.
     *
     * Kedua sumber ditampilkan berdampingan karena keduanya memberitahu hal yang
     * berbeda: baris server adalah catatan resmi alur kerja, sedangkan item lokal
     * adalah konfirmasi aksi yang baru saja dilakukan pengguna beserta pintasan ke
     * halaman terkait. Masing-masing membawa `source` agar konsumen dapat
     * membedakannya tanpa menebak dari bentuk id.
     */
    const notifications = useMemo(
        () => [...localItems, ...serverItems].sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt)),
        [localItems, serverItems],
    );

    /**
     * Jumlah notifikasi belum dibaca: kotak masuk server ditambah item lokal.
     *
     * Bagian lokalnya diturunkan dari daftarnya, tidak disimpan sebagai state
     * tersendiri. Sebelumnya angka ini adalah state yang dinaikkan dan diturunkan
     * manual sehingga bisa menyimpang dari kenyataan.
     */
    const unreadCount = useMemo(
        () => serverUnreadCount + localItems.filter((item) => !item.isRead).length,
        [serverUnreadCount, localItems],
    );

    const addNotification = useCallback((title, message, type = 'info', relatedUrl = null) => {
        sequenceRef.current += 1;
        const newNotif = {
            id: `${LOCAL_ID_PREFIX}${Date.now()}-${sequenceRef.current}`,
            source: 'local',
            title,
            message,
            type, // 'info', 'success', 'warning', 'danger'
            isRead: false,
            createdAt: new Date().toISOString(),
            relatedUrl,
        };
        setLocalItems((prev) => [newNotif, ...prev]);

        return newNotif;
    }, []);

    /**
     * Tandai satu notifikasi terbaca. Menerima id lokal maupun id baris server.
     *
     * Untuk baris server perubahannya dipasang optimistis lebih dulu supaya klik
     * terasa langsung, lalu diselaraskan dengan angka resmi dari balasan. Bila
     * permintaannya gagal, tampilannya dikembalikan — notifikasi yang gagal ditandai
     * tidak boleh terlihat seolah sudah tersimpan, karena polling berikutnya akan
     * memunculkannya kembali sebagai belum dibaca.
     */
    const markAsRead = useCallback(async (id) => {
        if (isLocalId(id)) {
            setLocalItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
            return;
        }

        const target = serverItemsRef.current.find((item) => item.id === id);
        // Notifikasi yang sudah terbaca tidak perlu permintaan lagi — lonceng ini
        // dipakai berulang kali dan setiap klik pada daftar akan memanggilnya.
        if (!target || target.isRead) return;

        setServerItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
        setServerUnreadCount((prev) => Math.max(0, prev - 1));

        try {
            const response = await notificationService.markRead(id);
            const unreadFromMeta = Number(response?.meta?.unread_count);
            if (Number.isFinite(unreadFromMeta)) setServerUnreadCount(unreadFromMeta);
            setError(null);
        } catch (err) {
            setServerItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: false } : item)));
            setServerUnreadCount((prev) => prev + 1);
            setError(err?.message || 'Gagal menandai notifikasi sebagai telah dibaca.');
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        setLocalItems((prev) => prev.map((item) => ({ ...item, isRead: true })));

        const previousItems = serverItemsRef.current;
        const previousUnread = serverUnreadCountRef.current;
        // Tidak ada baris server yang belum dibaca — tombolnya bisa saja muncul hanya
        // karena ada item lokal, jadi permintaan ke API dilewati.
        if (previousUnread === 0 && !previousItems.some((item) => !item.isRead)) return;

        setServerItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
        setServerUnreadCount(0);

        try {
            await notificationService.markAllRead();
            setError(null);
        } catch (err) {
            setServerItems(previousItems);
            setServerUnreadCount(previousUnread);
            setError(err?.message || 'Gagal menandai semua notifikasi sebagai telah dibaca.');
        }
    }, []);

    /**
     * Buang satu notifikasi dari daftar.
     *
     * Hanya berlaku untuk item lokal. API tidak punya endpoint hapus notifikasi,
     * sehingga menghilangkan baris server dari state hanya akan memunculkannya
     * kembali pada polling berikutnya — pengguna melihat notifikasi yang "menolak
     * dihapus". Lonceng karena itu tidak menampilkan tombol hapus untuk baris server;
     * peringatan di bawah hanya jaring pengaman bagi pemanggil baru.
     */
    const removeNotification = useCallback((id) => {
        if (isLocalId(id)) {
            setLocalItems((prev) => prev.filter((item) => item.id !== id));
            return;
        }

        console.warn(
            '[NotificationContext] Notifikasi server tidak dapat dihapus: API belum menyediakan endpoint hapus. Gunakan markAsRead().',
        );
    }, []);

    const value = useMemo(() => ({
        notifications,
        unreadCount,
        isLoading,
        error,
        /** Muat ulang kotak masuk server di luar jadwal polling (mis. tombol "Coba lagi"). */
        refresh: loadFromServer,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
    }), [
        notifications,
        unreadCount,
        isLoading,
        error,
        loadFromServer,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
    ]);

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within NotificationProvider');
    }
    return context;
}
