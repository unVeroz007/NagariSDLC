// src/contexts/ActivityContext.jsx
import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { activityLogService } from '../services/api';

const ActivityContext = createContext();

export function ActivityProvider({ children }) {
    const [activities, setActivities] = useState([]);
    // Pemuatan pertama berjalan otomatis pada mount, jadi status awalnya "memuat".
    // Dengan begitu efek di bawah tidak perlu memanggil setState secara sinkron
    // (penyebab cascading render) hanya untuk menyalakan indikator.
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [summary, setSummary] = useState(null);

    // Ambil data aktivitas dari API. Dipakai untuk pemuatan pertama (effect di
    // bawah) dan refresh manual dari UI.
    const refreshData = useCallback(async (filters = {}) => {
        setIsLoading(true);
        try {
            const [logRes, summaryRes] = await Promise.all([
                activityLogService.getAll({ per_page: 100, ...filters }).catch(() => null),
                activityLogService.getSummary().catch(() => null),
            ]);

            if (logRes && logRes.data && Array.isArray(logRes.data)) {
                setActivities(logRes.data);
            }

            if (summaryRes && summaryRes.data) {
                setSummary(summaryRes.data);
            }

            setLastUpdated(new Date().toISOString());
        } catch {
            // Aktivitas hanya data pendukung tampilan; kegagalan memuatnya tidak
            // boleh memunculkan galat ke pengguna. Data lama tetap dipertahankan
            // dan akan diperbarui pada polling berikutnya.
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Pemuatan pertama saat provider dipasang. Aturan react-hooks melarang
    // setState sinkron di dalam effect, tetapi pengambilan data awal memang perlu
    // dipicu di sini (tidak ada data server yang di-inject dari luar) dan
    // refreshData menyalakan indikator sebelum menunggu jaringan. Pola ini
    // disengaja, bukan turunan state yang bisa dihitung saat render.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan awal dari API, lihat catatan di atas
        refreshData();
    }, [refreshData]);

    const clearActivities = () => {
        setActivities([]);
    };

    return (
        <ActivityContext.Provider value={{
            activities,
            isLoading,
            refreshData,
            lastUpdated,
            summary,
            clearActivities,
        }}>
            {children}
        </ActivityContext.Provider>
    );
}

export function useActivities() {
    return useContext(ActivityContext);
}

export function useActivityLog() {
    const ctx = useContext(ActivityContext);
    if (!ctx) throw new Error('useActivityLog must be used within an ActivityProvider');
    return ctx;
}