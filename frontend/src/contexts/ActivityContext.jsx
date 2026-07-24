// src/contexts/ActivityContext.jsx
import { createContext, useState, useContext, useEffect } from 'react';

const ActivityContext = createContext();

// Data dummy awal untuk activity log
const initialActivities = [
    {
        id: 1,
        user: 'Ahmad Fauzi',
        userAvatar: 'AF',
        role: 'Super Admin',
        action: 'approve_release',
        actionLabel: 'Menyetujui Rilis',
        project: 'Aplikasi LOS Baru',
        projectId: 'PRJ-2026-088',
        description: 'Menyetujui rilis REL-REQ-2026-0015 ke produksi',
        timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        ip: '192.168.1.50',
        status: 'success',
        details: {
            releaseId: 'REL-REQ-2026-0015',
            environment: 'Production',
            notes: 'All tests passed',
        },
    },
    {
        id: 2,
        user: 'Budi Santoso',
        userAvatar: 'BS',
        role: 'Project Manager',
        action: 'assign_team',
        actionLabel: 'Alokasi Tim',
        project: 'QRIS Mobile Banking',
        projectId: 'PRJ-2026-089',
        description: 'Mengalokasikan tim untuk proyek QRIS Mobile Banking',
        timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
        ip: '192.168.1.45',
        status: 'success',
        details: {
            pm: 'Andi Pratama',
            members: ['Dimas Anggara', 'Eka Putri', 'Fani Wijaya'],
        },
    },
    {
        id: 3,
        user: 'Siti Aminah',
        userAvatar: 'SA',
        role: 'System Analyst',
        action: 'upload_document',
        actionLabel: 'Unggah Dokumen',
        project: 'Aplikasi LOS Baru',
        projectId: 'PRJ-2026-088',
        description: 'Mengunggah dokumen FSD Aplikasi LOS',
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        ip: '192.168.1.22',
        status: 'success',
        details: {
            document: 'FSD_Aplikasi_LOS_v1.8.docx',
            size: '1.8 MB',
        },
    },
    {
        id: 4,
        user: 'System',
        userAvatar: 'SY',
        role: 'System',
        action: 'auto_quality_gate',
        actionLabel: 'Quality Gate Otomatis',
        project: 'Core Banking Upgrade',
        projectId: 'PRJ-2026-093',
        description: 'Menyelesaikan Quality Gate otomatis untuk Core Banking Upgrade',
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        ip: 'System',
        status: 'system',
        details: {
            checks: ['Security', 'Performance', 'Compliance'],
            passed: true,
        },
    },
    {
        id: 5,
        user: 'Ahmad Fauzi',
        userAvatar: 'AF',
        role: 'Super Admin',
        action: 'create_project',
        actionLabel: 'Inisiasi Proyek Baru',
        project: 'Sistem HRIS Terintegrasi',
        projectId: 'PRJ-2026-097',
        description: 'Membuat inisiasi proyek baru Sistem HRIS Terintegrasi',
        timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        ip: '192.168.1.1',
        status: 'success',
        details: {
            division: 'Divisi SDM',
            targetDate: '2026-10-15',
        },
    },
    {
        id: 6,
        user: 'Citra Kirana',
        userAvatar: 'CK',
        role: 'System Analyst',
        action: 'reject_project',
        actionLabel: 'Menolak Proyek',
        project: 'Dashboard HRIS',
        projectId: 'PRJ-2026-092',
        description: 'Menolak proyek Dashboard HRIS karena dokumentasi kurang lengkap',
        timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
        ip: '192.168.1.33',
        status: 'warning',
        details: {
            reason: 'Dokumentasi tidak lengkap',
            suggestion: 'Lengkapi BRD dengan flow diagram',
        },
    },
    {
        id: 7,
        user: 'Rizal Pratama',
        userAvatar: 'RP',
        role: 'Pentester',
        action: 'upload_report',
        actionLabel: 'Upload Laporan Pentest',
        project: 'Aplikasi LOS Baru',
        projectId: 'PRJ-2026-088',
        description: 'Mengupload laporan pentest untuk Aplikasi LOS',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        ip: '192.168.1.12',
        status: 'success',
        details: {
            report: 'Pentest_Report_LOS_v2.1.pdf',
            findings: 3,
            critical: 0,
        },
    },
    {
        id: 8,
        user: 'Hendra Setiawan',
        userAvatar: 'HS',
        role: 'Head of IT',
        action: 'approve_golive',
        actionLabel: 'Approve Go-Live',
        project: 'Core Banking Upgrade',
        projectId: 'PRJ-2026-093',
        description: 'Menyetujui Go-Live untuk Core Banking Upgrade',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
        ip: '192.168.1.5',
        status: 'success',
        details: {
            environment: 'Production',
            version: 'v2.4',
        },
    },
];

// Mapping aksi ke ikon dan warna
export const actionMap = {
    approve_release: { icon: 'verified', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    approve_golive: { icon: 'rocket_launch', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    assign_team: { icon: 'group_add', color: 'text-blue-600', bg: 'bg-blue-50' },
    upload_document: { icon: 'upload_file', color: 'text-amber-600', bg: 'bg-amber-50' },
    upload_report: { icon: 'description', color: 'text-purple-600', bg: 'bg-purple-50' },
    auto_quality_gate: { icon: 'verified', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    create_project: { icon: 'add_box', color: 'text-blue-600', bg: 'bg-blue-50' },
    reject_project: { icon: 'block', color: 'text-red-600', bg: 'bg-red-50' },
    update_task: { icon: 'edit', color: 'text-cyan-600', bg: 'bg-cyan-50' },
    login: { icon: 'login', color: 'text-gray-600', bg: 'bg-gray-50' },
    logout: { icon: 'logout', color: 'text-gray-600', bg: 'bg-gray-50' },
};

export function ActivityProvider({ children }) {
    const [activities, setActivities] = useState(initialActivities);
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    // Simulasi real-time update dinonaktifkan agar tidak flooding 'System'
    useEffect(() => {
        // const interval = setInterval(() => {
        //     const newActivity = {
        //         id: activities.length + 1,
        //         user: 'System',
        //         userAvatar: 'SY',
        //         role: 'System',
        //         action: 'auto_quality_gate',
        //         actionLabel: 'Auto-Update',
        //         project: 'Sistem Anti-Fraud',
        //         projectId: 'PRJ-2026-041',
        //         description: 'Sistem melakukan auto-update status proyek',
        //         timestamp: new Date().toISOString(),
        //         ip: 'System',
        //         status: 'system',
        //         details: { auto: true },
        //     };
        //     setActivities(prev => [newActivity, ...prev]);
        //     setLastUpdated(new Date());
        // }, 30000);
        // return () => clearInterval(interval);
    }, [activities.length]);

    // Tambah aktivitas dari aksi user
    const addActivity = (activity) => {
        const newActivity = {
            id: activities.length + 1,
            timestamp: new Date().toISOString(),
            status: 'success',
            ...activity,
        };
        setActivities(prev => [newActivity, ...prev]);
        setLastUpdated(new Date());
        return newActivity;
    };

    // Fungsi untuk menghubungkan dengan NotifikasiContext (otomatis)
    const logFromNotification = (notification) => {
        const actionMap = {
            'Tugas Review Baru': { action: 'assign_team', actionLabel: 'Disposisi Tugas' },
            'Review Proyek': { action: 'upload_document', actionLabel: 'Review Proyek' },
            'Alokasi Tim Baru': { action: 'assign_team', actionLabel: 'Alokasi Tim' },
            'Rilis': { action: 'approve_release', actionLabel: 'Approval Rilis' },
        };
        const mapped = actionMap[notification.title?.split(' ')[0]] || { action: 'update_task', actionLabel: 'Aktivitas' };
        addActivity({
            user: notification.title || 'System',
            userAvatar: 'SY',
            role: 'System',
            action: mapped.action,
            actionLabel: mapped.actionLabel,
            project: notification.message?.substring(0, 30) || 'Sistem',
            projectId: 'SYSTEM',
            description: notification.message || 'Aktivitas sistem',
            ip: 'System',
            status: notification.type || 'info',
            details: { fromNotification: true },
        });
    };

    const refreshData = () => {
        setIsLoading(true);
        setTimeout(() => {
            setActivities(prev => [...prev]);
            setLastUpdated(new Date());
            setIsLoading(false);
        }, 300);
    };

    return (
        <ActivityContext.Provider
            value={{
                activities,
                isLoading,
                lastUpdated,
                addActivity,
                logFromNotification,
                refreshData,
            }}
        >
            {children}
        </ActivityContext.Provider>
    );
}

export function useActivityLog() {
    const context = useContext(ActivityContext);
    if (!context) {
        throw new Error('useActivityLog must be used within an ActivityProvider');
    }
    return context;
}