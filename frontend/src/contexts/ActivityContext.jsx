// src/contexts/ActivityContext.jsx
import { createContext, useState, useContext, useEffect } from 'react';

const ActivityContext = createContext();

export const actionMap = {
    approve_release: { label: 'Menyetujui Rilis', color: 'bg-emerald-100 text-emerald-700' },
    assign_team: { label: 'Alokasi Tim', color: 'bg-blue-100 text-blue-700' },
    upload_document: { label: 'Unggah Dokumen', color: 'bg-purple-100 text-purple-700' },
    auto_quality_gate: { label: 'Quality Gate Otomatis', color: 'bg-indigo-100 text-indigo-700' },
    create_project: { label: 'Inisiasi Proyek Baru', color: 'bg-sky-100 text-sky-700' },
    reject_project: { label: 'Menolak Proyek', color: 'bg-red-100 text-red-700' },
    upload_report: { label: 'Upload Laporan Pentest', color: 'bg-amber-100 text-amber-700' },
};

const initialActivities = [];

export function ActivityProvider({ children }) {
    const [activities, setActivities] = useState(() => {
        const saved = localStorage.getItem('nagari_sdlc_activities');
        if (saved) {
            try { return JSON.parse(saved); } catch { }
        }
        return initialActivities;
    });

    const addActivity = (activity) => {
        const newActivity = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            status: 'success',
            ...activity,
        };
        const updated = [newActivity, ...activities];
        setActivities(updated);
        localStorage.setItem('nagari_sdlc_activities', JSON.stringify(updated));
    };

    const clearActivities = () => {
        setActivities([]);
        localStorage.removeItem('nagari_sdlc_activities');
    };

    return (
        <ActivityContext.Provider value={{ activities, addActivity, clearActivities }}>
            {children}
        </ActivityContext.Provider>
    );
}

export function useActivities() {
    return useContext(ActivityContext);
}

export function useActivityLog() {
    return useContext(ActivityContext);
}