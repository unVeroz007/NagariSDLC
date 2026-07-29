// src/contexts/ProjectContext.jsx
import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { projectService } from '../services/api';
import { mockProjects, mockDocuments } from '../data/mockData';

const ProjectContext = createContext();

const MODE = import.meta.env.VITE_API_MODE || 'mock';
const STORAGE_PROJECTS_KEY = 'nagari_sdlc_projects';
const STORAGE_DOCS_KEY = 'nagari_sdlc_documents';

const defaultFields = {
    priority: 'Medium',
    submittedAt: new Date().toISOString(),
    documents: [
        { type: 'brd', name: 'BRD_Document.pdf', size: '2.4 MB' },
        { type: 'fsd', name: 'FSD_Technical.docx', size: '1.1 MB' }
    ],
    phases: [
        { name: 'Fase 1: Inisiasi & Persetujuan', completed: true, items: [] },
        { name: 'Fase 2: Desain & Arsitektur', completed: false, items: [] },
        { name: 'Fase 3: Pengembangan & Testing', completed: false, items: [] }
    ],
    goLiveDate: 'TBD',
    downtime: '0 Menit',
    rollbackPlan: 'Tidak ada',
    team: []
};

const normalizeProject = (p) => {
    if (!p) return p;
    return {
        ...defaultFields,
        ...p,
        name: p.title || p.name || 'Proyek Tanpa Judul',
        reqId: p.req_id || p.reqId || `REQ-${p.id}`,
        id: p.id,
        division: typeof p.division === 'object' ? (p.division?.name || 'Divisi TI') : (p.division || 'Divisi TI'),
        pm: typeof p.pm === 'object' && p.pm ? p.pm : { name: p.pmName || 'Belum Dialokasi', initial: 'BD' },
        type: p.type || 'Non-RBB',
        targetDate: p.target_date || p.targetDate || 'TBD',
    };
};

const getMockProjects = () => {
    const saved = localStorage.getItem(STORAGE_PROJECTS_KEY);
    if (saved) {
        try { return JSON.parse(saved); } catch { localStorage.removeItem(STORAGE_PROJECTS_KEY); }
    }
    return mockProjects.map(p => ({
        ...defaultFields, ...p,
        documents: p.documents || defaultFields.documents,
        phases: p.phases || defaultFields.phases
    }));
};

const getMockDocs = () => {
    const saved = localStorage.getItem(STORAGE_DOCS_KEY);
    if (saved) {
        try { return JSON.parse(saved); } catch { localStorage.removeItem(STORAGE_DOCS_KEY); }
    }
    return mockDocuments || [];
};

export function ProjectProvider({ children }) {
    const [projects, setProjects] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [meta, setMeta] = useState(null);

    // ─────────────────────────────────────────────────────────
    // DATA LOADING (Support Silent Realtime Refresh)
    // ─────────────────────────────────────────────────────────
    const loadProjects = useCallback(async (showSpinner = false) => {
        if (showSpinner) setIsLoading(true);
        try {
            if (MODE === 'api') {
                const res = await projectService.getAll();
                const list = res?.data ?? [];
                setProjects(list.map(normalizeProject));
                setMeta(res?.meta ?? null);
            } else {
                if (showSpinner) await new Promise(r => setTimeout(r, 200));
                setProjects(getMockProjects().map(normalizeProject));
                setDocuments(getMockDocs());
            }
            setLastUpdated(new Date());
        } catch (err) {
            console.error('[ProjectContext] Failed to load projects from API:', err);
            if (MODE === 'api') {
                setProjects([]);
            } else {
                setProjects(getMockProjects().map(normalizeProject));
            }
        } finally {
            if (showSpinner) setIsLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        loadProjects(true);
    }, [loadProjects]);

    // ─────────────────────────────────────────────────────────
    // MOCK helpers (localStorage sync — used in mock mode only)
    // ─────────────────────────────────────────────────────────
    const saveProjects = (newProjects) => {
        setProjects(newProjects);
        localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(newProjects));
        setLastUpdated(new Date());
    };

    const saveDocuments = (newDocs) => {
        setDocuments(newDocs);
        localStorage.setItem(STORAGE_DOCS_KEY, JSON.stringify(newDocs));
        setLastUpdated(new Date());
    };

    // ─────────────────────────────────────────────────────────
    // CRUD Proyek (Maju / Mundur Status Instant Update)
    // ─────────────────────────────────────────────────────────
    const addProject = async (projectData) => {
        if (MODE === 'api') {
            const res = await projectService.create({
                title: projectData.name || projectData.title,
                description: projectData.description || '',
                division_id: projectData.division_id || 1,
                target_date: projectData.targetDate || projectData.target_date || null,
            });
            await loadProjects(false);
            return res;
        }
        const newProject = normalizeProject(projectData);
        const updated = [newProject, ...projects];
        saveProjects(updated);
    };

    const updateProject = async (id, updates) => {
        if (MODE === 'api') {
            let res;
            if (updates.status) {
                res = await projectService.updateStatus(id, updates.status, updates.notes || updates.rejection_reason || '');
            } else {
                res = await projectService.update(id, updates);
            }
            const updated = normalizeProject(res?.data ?? updates);
            setProjects(prev => prev.map(p => (p.id === id ? { ...p, ...updated } : p)));
            await loadProjects(false);
            return res;
        }
        const updated = projects.map(p => p.id === id ? { ...p, ...updates } : p);
        saveProjects(updated);
    };

    const updateProjectStatus = async (id, newStatus, notes = '') => {
        if (MODE === 'api') {
            const res = await projectService.updateStatus(id, newStatus, notes);
            const updatedProject = normalizeProject(res?.data ?? {});
            setProjects(prev => prev.map(p => (p.id === id ? { ...p, ...updatedProject } : p)));
            await loadProjects(false);
            return res;
        }
        const updated = projects.map(p => p.id === id ? { ...p, status: newStatus } : p);
        saveProjects(updated);
    };

    const deleteProject = async (id) => {
        if (MODE === 'api') {
            await projectService.delete(id);
            setProjects(prev => prev.filter(p => p.id !== id));
            await loadProjects(false);
            return;
        }
        const updated = projects.filter(p => p.id !== id);
        saveProjects(updated);
    };

    const getProjectById = (id) => projects.find(p => String(p.id) === String(id));

    const getProjectsByStatus = (status) => projects.filter(p => p.status === status);

    // ─────────────────────────────────────────────────────────
    // CRUD Dokumen
    // ─────────────────────────────────────────────────────────
    const addDocument = (doc) => {
        const updated = [doc, ...documents];
        saveDocuments(updated);
    };

    const deleteDocument = (id) => {
        const updated = documents.filter(d => d.id !== id);
        saveDocuments(updated);
    };

    // ─────────────────────────────────────────────────────────
    // Refresh & Reset
    // ─────────────────────────────────────────────────────────
    const refreshData = () => loadProjects(true);

    const resetToDefaultData = () => {
        localStorage.removeItem(STORAGE_PROJECTS_KEY);
        localStorage.removeItem(STORAGE_DOCS_KEY);
        loadProjects(true);
    };

    return (
        <ProjectContext.Provider
            value={{
                projects,
                documents,
                users,
                isLoading,
                lastUpdated,
                meta,
                addProject,
                updateProject,
                updateProjectStatus,
                deleteProject,
                getProjectById,
                getProjectsByStatus,
                addDocument,
                deleteDocument,
                refreshData,
                resetToDefaultData,
            }}
        >
            {children}
        </ProjectContext.Provider>
    );
}

export function useProjects() {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error('useProjects must be used within a ProjectProvider');
    }
    return context;
}