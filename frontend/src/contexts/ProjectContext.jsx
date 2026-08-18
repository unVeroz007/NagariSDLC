import { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { projectService, documentService } from '../services/api';
import { useAuth } from './AuthContext';
import { generateDocumentName } from '../utils/documentNaming';
import toast from 'react-hot-toast';

const ProjectContext = createContext();

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

/**
 * Ekstrak dokumen dari objek proyek untuk ditampilkan di antarmuka.
 * Backend mengembalikan dokumen via relasi `documents` pada ProjectResource.
 */
export const getProjectRealDocuments = (project) => {
    if (!project) return [];
    
    // API mode: documents already embedded in project from backend
    if (Array.isArray(project.documents)) {
        return project.documents.map(d => ({
            id: d.id || `doc-${Math.random()}`,
            name: d.file_name || d.name || 'Dokumen_SDLC.pdf',
            type: d.document_type || d.type || 'Dokumen SDLC',
            size: d.file_size || d.size || 'N/A',
            uploadedAt: d.created_at || d.uploaded_at || 'Terverifikasi',
            author: d.uploader?.name || d.author || 'Tim SDLC',
            url: d.id && !d.url ? `${import.meta.env.VITE_API_URL}/documents/${d.id}/download` : (d.url || null),
        }));
    }
    return [];
};

export function ProjectProvider({ children }) {
    const { isLoggedIn } = useAuth();
    const [projects, setProjects] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [meta, setMeta] = useState(null);

    const loadProjects = useCallback(async (showSpinner = false, silent = false) => {
        if (!isLoggedIn) return;
        if (showSpinner) setIsLoading(true);
        try {
            const session = localStorage.getItem('nagari_sdlc_session');
            if (!session) return;
            
            const res = await projectService.getAll();
            if (res && res.data) {
                // Normalize: API mengembalikan 'title', semua komponen memakai 'name'
                const normalized = res.data.map(p => ({
                    ...p,
                    name: p.name || p.title || 'Tanpa Judul',
                    reqId: p.reqId || p.req_id || null,
                    targetDate: p.targetDate || p.target_date || 'TBD',
                    submittedAt: p.submittedAt || p.created_at || new Date().toISOString(),
                    division: typeof p.division === 'string' ? p.division : (p.division?.name || p.division_detail?.name || null),
                    // Normalisasi key snake_case → camelCase (ProjectResource mengekspos sit_uat_data)
                    sitUatData: p.sitUatData || p.sit_uat_data || {},
                }));
                setProjects(normalized);
                setMeta(res.meta || null);
            }
            setLastUpdated(new Date());
        } catch (err) {
            // Mode silent (polling latar belakang): jangan spam toast error.
            if (!silent && err.status !== 401) {
                toast.error(`Gagal memuat proyek: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    }, [isLoggedIn]);

    useEffect(() => {
        if (isLoggedIn) {
            loadProjects(true);
        }
    }, [loadProjects, isLoggedIn]);

    // ─── AUTO-SYNC DATA PROYEK (Opsi A) ─────────────────────────────
    // Polling periodik + refresh saat tab aktif kembali agar perubahan
    // status/tahapan dari user lain otomatis sinkron tanpa refresh manual.
    const pollingRef = useRef(null);
    const POLL_INTERVAL_MS = 30000; // 30 detik

    // Silent refresh: tanpa spinner & tanpa toast error (fallback manual tetap ada).
    const refreshDataSilent = useCallback(() => {
        loadProjects(false, true);
    }, [loadProjects]);

    useEffect(() => {
        if (!isLoggedIn) {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
            return;
        }

        // 1) Polling periodik di latar belakang
        refreshDataSilent();
        pollingRef.current = setInterval(refreshDataSilent, POLL_INTERVAL_MS);

        // 2) Refresh segera saat tab kembali terlihat / window focus
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') refreshDataSilent();
        };
        const handleFocus = () => refreshDataSilent();
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('focus', handleFocus);

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('focus', handleFocus);
        };
    }, [isLoggedIn, refreshDataSilent]);

    const addProject = async (projectData) => {
        try {
            const res = await projectService.create({
                title: projectData.name || projectData.title,
                description: projectData.description || '',
                division: projectData.division,
                division_id: projectData.division_id,
                target_date: projectData.targetDate || null,
                type: projectData.type || 'RBB',
                project_type: projectData.project_type || 'baru',
            });
            
            if (res && res.data) {
                const project = res.data;
                // Re-upload documents with correct req_id-based filenames
                if (Array.isArray(projectData.documents) && projectData.documents.length > 0) {
                    for (const doc of projectData.documents) {
                        if (doc.rawFile) {
                            try {
                                // Regenerate final filename with real req_id
                                const finalName = generateDocumentName(project.req_id, doc.doc_type || doc.type || 'BRD', project.title);
                                const ext = doc.rawFile.name.split('.').pop();
                                const finalFile = new File([doc.rawFile], `${finalName}.${ext}`, { type: doc.rawFile.type });
                                const uploadRes = await documentService.upload(finalFile, {
                                    project_id: project.id,
                                    document_type: doc.doc_type || doc.type || 'BRD',
                                });
                                // Simpan nama final dari API untuk ditampilkan di success modal
                                if (uploadRes?.data?.file_name) {
                                    doc.finalName = uploadRes.data.file_name;
                                }
                            } catch (err) {
                                toast.error(`Gagal upload dokumen "${doc.originalName}": ${err.message}`);
                            }
                        }
                    }
                }
                toast.success('Proyek berhasil diinisiasi!');
                loadProjects(false);
                return res;
            }
        } catch (err) {
            toast.error(`Gagal membuat proyek: ${err.message}`);
            throw err;
        }
    };

    const updateProject = async (id, updates) => {
        try {
            await projectService.update(id, updates);
            toast.success('Data proyek berhasil diperbarui!');
            loadProjects(false);
        } catch (err) {
            toast.error(`Gagal memperbarui proyek: ${err.message}`);
            throw err;
        }
    };

    const updateProjectStatus = async (id, newStatus, notes = '') => {
        try {
            await projectService.updateStatus(id, newStatus, notes);
            toast.success(`Status proyek diubah menjadi ${newStatus}`);
            loadProjects(false);
        } catch (err) {
            toast.error(`Gagal mengubah status: ${err.message}`);
            throw err;
        }
    };

    const deleteProject = async (id) => {
        try {
            await projectService.delete(id);
            toast.success('Proyek berhasil dihapus!');
            loadProjects(false);
        } catch (err) {
            toast.error(`Gagal menghapus proyek: ${err.message}`);
            throw err;
        }
    };

    const getProjectById = (id) => projects.find(p => String(p.id) === String(id) || p.req_id === id);

    const getProjectsByStatus = (status) => projects.filter(p => p.status === status);

    const refreshData = () => loadProjects(true);
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
                refreshData,
                refreshDataSilent,
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
