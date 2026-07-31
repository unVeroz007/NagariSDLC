import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { projectService, documentService } from '../services/api';
import { mockProjects, mockDocuments } from '../data/mockData';
import { useAuth } from './AuthContext';

const ProjectContext = createContext();

const MODE = import.meta.env.VITE_API_MODE || 'mock';
const STORAGE_PROJECTS_KEY = 'nagari_sdlc_projects';
const STORAGE_DOCS_KEY = 'nagari_sdlc_documents';

if (typeof window !== 'undefined') {
    window.__nagariFileStore = window.__nagariFileStore || new Map();
}

export const saveFileToStore = (key, url) => {
    if (typeof window !== 'undefined' && window.__nagariFileStore && key && url) {
        window.__nagariFileStore.set(String(key), url);
    }
};

export const getFileFromStore = (key) => {
    if (typeof window !== 'undefined' && window.__nagariFileStore && key) {
        return window.__nagariFileStore.get(String(key));
    }
    return null;
};

const defaultFields = {
    priority: 'Medium',
    submittedAt: new Date().toISOString(),
    documents: [],
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

const normalizeProject = (p, storedDocs = []) => {
    if (!p) return p;
    const pId = p.id;
    const pTitle = (p.title || p.name || '').toLowerCase();

    const matchedDocs = (storedDocs || []).filter(d =>
        (d.projectId && String(d.projectId) === String(pId)) ||
        (d.project_name && d.project_name.toLowerCase() === pTitle) ||
        (d.project && d.project.toLowerCase() === pTitle)
    );

    const existingDocs = Array.isArray(p.documents) ? p.documents : [];
    const mergedDocs = [...existingDocs, ...matchedDocs];

    const uniqueDocs = [];
    const seen = new Set();
    mergedDocs.forEach(d => {
        const key = d.id || `${d.name || d.file_name}-${d.size}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueDocs.push(d);
        }
    });

    const fsdDoc = p.fsdDocument || uniqueDocs.find(d => d.type === 'fsd' || d.doc_type === 'fsd' || (d.name && d.name.toLowerCase().includes('fsd'))) || null;
    const fsdDevDoc = p.fsdDevDocument || uniqueDocs.find(d => d.type === 'fsd_dev' || d.doc_type === 'fsd_dev' || (d.name && d.name.toLowerCase().includes('arsitektur'))) || null;

    const analystNotes = p.analystNotes || p.analyst_notes || p.analystResult?.notes || null;
    const analystDecision = p.analystDecision || p.analyst_decision || p.analystResult?.decision || null;

    const devAnalystNotes = p.devAnalystNotes || p.dev_analyst_notes || p.devAnalystResult?.notes || null;
    const devAnalystDecision = p.devAnalystDecision || p.dev_analyst_decision || p.devAnalystResult?.decision || null;
    const techStack = p.techStack || p.tech_stack || p.devAnalystResult?.techStack || null;

    return {
        ...defaultFields,
        ...p,
        name: p.title || p.name || 'Proyek Tanpa Judul',
        reqId: p.req_id || p.reqId || `REQ-${p.id}`,
        id: p.id,
        division: typeof p.division === 'object' ? (p.division?.name || 'Divisi TI') : (p.division || 'Divisi TI'),
        pm: typeof p.pm === 'object' && p.pm ? p.pm : { name: p.pmName || 'Belum Dialokasi', initial: 'BD' },
        type: (() => {
            const rawType = p.type || p.project_type;
            if (rawType && String(rawType).toUpperCase().includes('NON')) return 'Non-RBB';
            if (rawType && String(rawType).toUpperCase().includes('RBB')) return 'RBB';
            return 'RBB'; // Default presisi RBB dari awal inisiasi divisi
        })(),
        targetDate: p.target_date || p.targetDate || 'TBD',
        documents: uniqueDocs,
        fsdDocument: fsdDoc,
        fsdDevDocument: fsdDevDoc,
        analystNotes: analystNotes,
        analystDecision: analystDecision,
        analystResult: p.analystResult || (analystNotes ? { decision: analystDecision, notes: analystNotes, fsdFile: fsdDoc?.name, fsdUrl: fsdDoc?.url } : null),
        devAnalystNotes: devAnalystNotes,
        devAnalystDecision: devAnalystDecision,
        techStack: techStack,
        devAnalystResult: p.devAnalystResult || (devAnalystNotes ? { decision: devAnalystDecision, techStack: techStack, notes: devAnalystNotes, estimation: p.devAnalystResult?.estimation || '30 Hari Kerja', analystName: p.devAnalystResult?.analystName || 'System Analyst Dev' } : null),
    };
};

const getMockProjects = () => {
    const saved = localStorage.getItem(STORAGE_PROJECTS_KEY);
    if (saved) {
        try { 
            const parsed = JSON.parse(saved); 
            if (Array.isArray(parsed)) return parsed;
        } catch { localStorage.removeItem(STORAGE_PROJECTS_KEY); }
    }
    return MODE === 'api' ? [] : (mockProjects || []);
};

const getMockDocs = () => {
    const saved = localStorage.getItem(STORAGE_DOCS_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) return parsed;
        } catch { localStorage.removeItem(STORAGE_DOCS_KEY); }
    }
    return [];
};

export function ProjectProvider({ children }) {
    const { isLoggedIn } = useAuth();
    const [projects, setProjects] = useState(() => {
        const cached = getMockProjects();
        const docs = getMockDocs();
        return cached.map(p => normalizeProject(p, docs));
    });
    const [documents, setDocuments] = useState(() => getMockDocs());
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [meta, setMeta] = useState(null);

    // ─────────────────────────────────────────────────────────
    // DATA LOADING (Silent Realtime Background Refresh — Instant UI)
    // ─────────────────────────────────────────────────────────
    // Data loading dengan penggabungan cerdas (API + Cache Lokal)
    const loadProjects = useCallback(async (showSpinner = false) => {
        if (showSpinner) setIsLoading(true);
        try {
            const storedDocs = getMockDocs();
            setDocuments(storedDocs);

            if (MODE === 'api') {
                // Pastikan session/token sudah ada sebelum panggil API
                const session = localStorage.getItem('nagari_sdlc_session');
                const token = session ? JSON.parse(session)?.token : null;
                if (!token) {
                    setIsLoading(false);
                    return;
                }

                try {
                    const res = await projectService.getAll();
                    const apiList = res?.data ?? [];
                    if (Array.isArray(apiList)) {
                        const normalized = apiList.map(p => normalizeProject(p, storedDocs));
                        setProjects(normalized);
                        if (normalized.length === 0) {
                            localStorage.removeItem(STORAGE_PROJECTS_KEY);
                        } else {
                            try {
                                const sanitized = normalized.map(p => ({
                                    ...p,
                                    documents: Array.isArray(p.documents) ? p.documents.map(d => ({
                                        ...d,
                                        url: (d.url && String(d.url).startsWith('data:')) ? null : d.url
                                    })) : []
                                }));
                                localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(sanitized));
                            } catch (e) {
                                console.warn('[ProjectContext] Failed to save projects to localStorage:', e);
                            }
                        }
                        setMeta(res?.meta ?? null);
                    }
                } catch (apiErr) {
                    console.warn('[ProjectContext] API load failed:', apiErr.message);
                }
            } else {
                const localProjects = getMockProjects();
                setProjects(localProjects.map(p => normalizeProject(p, storedDocs)));
            }
            setLastUpdated(new Date());
        } catch (err) {
            console.error('[ProjectContext] Load projects error:', err);
        } finally {
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Initial load silently
    useEffect(() => {
        const session = localStorage.getItem('nagari_sdlc_session');
        if (session || isLoggedIn || MODE !== 'api') {
            loadProjects(false);
        }
    }, [loadProjects, isLoggedIn]);


    // ─────────────────────────────────────────────────────────
    // MOCK helpers (localStorage sync)
    // ─────────────────────────────────────────────────────────
    const saveProjects = (newProjects) => {
        setProjects(newProjects);
        try {
            const sanitized = newProjects.map(p => ({
                ...p,
                documents: Array.isArray(p.documents) ? p.documents.map(d => ({
                    ...d,
                    url: (d.url && String(d.url).startsWith('data:')) ? null : d.url
                })) : []
            }));
            localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(sanitized));
        } catch (e) {
            console.warn('[ProjectContext] saveProjects localStorage error:', e);
        }
        setLastUpdated(new Date());
    };

    const saveDocuments = (newDocs) => {
        setDocuments(newDocs);
        try {
            const sanitized = newDocs.map(d => ({
                ...d,
                url: (d.url && String(d.url).startsWith('data:')) ? null : d.url
            }));
            localStorage.setItem(STORAGE_DOCS_KEY, JSON.stringify(sanitized));
        } catch (e) {
            console.warn('[ProjectContext] saveDocuments localStorage error:', e);
        }
        setLastUpdated(new Date());
    };

    // ─────────────────────────────────────────────────────────
    // CRUD Proyek (Maju / Mundur Status Instant Update)
    // ─────────────────────────────────────────────────────────
    const addProject = async (projectData) => {
        const uploadedDocs = (projectData.documents || []).map((doc, idx) => ({
            id: doc.id || `DOC-UP-${Date.now()}-${idx}`,
            name: doc.name || doc.file_name || 'Dokumen.pdf',
            size: doc.size || doc.file_size || '1.5 MB',
            type: doc.type || 'brd',
            url: doc.url || doc.fileUrl || null,
            project: projectData.name || projectData.title,
            projectId: null,
            uploadedBy: 'PIC Proyek',
            date: new Date().toISOString(),
        }));

        if (MODE === 'api') {
            const rawTargetDate = projectData.targetDate || projectData.target_date;
            let validTargetDate = (rawTargetDate && rawTargetDate !== 'TBD') ? rawTargetDate : null;
            if (!validTargetDate) {
                const defaultDate = new Date();
                defaultDate.setDate(defaultDate.getDate() + 30);
                validTargetDate = defaultDate.toISOString().split('T')[0];
            }
            const res = await projectService.create({
                title: projectData.name || projectData.title,
                description: projectData.description || '',
                division: projectData.division,
                division_id: projectData.division_id,
                target_date: validTargetDate,
                type: projectData.type || 'RBB',
                status: projectData.status || 'PENDING',
            });
            const created = res?.data;
            if (created) {
                if (Array.isArray(projectData.documents) && projectData.documents.length > 0) {
                    for (const doc of projectData.documents) {
                        if (doc.rawFile) {
                            try {
                                await documentService.upload(doc.rawFile, {
                                    project_id: created.id,
                                    document_type: doc.type || doc.doc_type || 'brd'
                                });
                            } catch (upErr) {
                                console.warn('[ProjectContext] DB Document Upload notice:', upErr.message);
                            }
                        }
                    }
                }
                const normCreated = normalizeProject(created, uploadedDocs);
                setProjects(prev => [normCreated, ...prev]);
                if (uploadedDocs.length > 0) {
                    const docsWithProjectId = uploadedDocs.map(d => ({ ...d, projectId: created.id }));
                    const currentDocs = getMockDocs();
                    saveDocuments([...docsWithProjectId, ...currentDocs]);
                }
            }
            // Trigger background reload without delaying caller
            loadProjects(false);
            return res;
        } else {
            const newProject = normalizeProject(projectData, uploadedDocs);
            const updatedProjects = [newProject, ...projects];
            saveProjects(updatedProjects);
            if (uploadedDocs.length > 0) {
                const currentDocs = getMockDocs();
                saveDocuments([...uploadedDocs, ...currentDocs]);
            }
        }
    };



    const updateProject = async (id, updates) => {
        // Cache FSD document URL in file store if present
        if (updates.fsdDocument && updates.fsdDocument.url) {
            saveFileToStore(updates.fsdDocument.name, updates.fsdDocument.url);
            saveFileToStore(updates.fsdDocument.id, updates.fsdDocument.url);
            if (id) saveFileToStore(`fsd_${id}`, updates.fsdDocument.url);
        }
        if (updates.analystResult && updates.analystResult.fsdUrl) {
            saveFileToStore(updates.analystResult.fsdFile, updates.analystResult.fsdUrl);
        }
        if (Array.isArray(updates.documents)) {
            updates.documents.forEach(doc => {
                if (doc.url && doc.name) saveFileToStore(doc.name, doc.url);
            });
        }

        let updatedList = [];
        setProjects(prev => {
            updatedList = prev.map(p => (String(p.id) === String(id) || p.reqId === id ? { ...p, ...updates } : p));
            saveProjects(updatedList);
            return updatedList;
        });

        if (MODE === 'api') {
            try {
                if (updates.status) {
                    await projectService.updateStatus(id, updates.status, updates.notes || updates.analystNotes || updates.rejection_reason || '');
                } else {
                    await projectService.update(id, updates);
                }
            } catch (e) {
                console.warn('[ProjectContext] API update fallback to local:', e);
            }

            try {
                const res = await projectService.getAll();
                const apiList = res?.data ?? [];
                if (Array.isArray(apiList)) {
                    const storedDocs = getMockDocs();
                    const merged = apiList.map(apiP => {
                        const localMatch = updatedList.find(lp => String(lp.id) === String(apiP.id));
                        const norm = normalizeProject(apiP, storedDocs);
                        return {
                            ...norm,
                            analystNotes: localMatch?.analystNotes || norm.analystNotes || null,
                            analystDecision: localMatch?.analystDecision || norm.analystDecision || null,
                            analystResult: localMatch?.analystResult || norm.analystResult || null,
                            fsdDocument: localMatch?.fsdDocument || norm.fsdDocument || null,
                            devAnalystNotes: localMatch?.devAnalystNotes || norm.devAnalystNotes || null,
                            devAnalystDecision: localMatch?.devAnalystDecision || norm.devAnalystDecision || null,
                            devAnalystResult: localMatch?.devAnalystResult || norm.devAnalystResult || null,
                            techStack: localMatch?.techStack || norm.techStack || null,
                            fsdDevDocument: localMatch?.fsdDevDocument || norm.fsdDevDocument || null,
                        };
                    });
                    setProjects(merged);
                    saveProjects(merged);
                }
            } catch (loadErr) {
                console.warn('[ProjectContext] Reload after update error:', loadErr.message);
            }
        }
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