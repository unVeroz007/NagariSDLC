// src/contexts/ProjectContext.jsx
import { createContext, useState, useContext, useEffect } from 'react';
import { mockProjects, mockDocuments } from '../data/mockData';

const ProjectContext = createContext();

const STORAGE_PROJECTS_KEY = 'nagari_sdlc_projects';
const STORAGE_DOCS_KEY = 'nagari_sdlc_documents';

export function ProjectProvider({ children }) {
    const [projects, setProjects] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);

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

    const getInitialProjects = () => {
        const saved = localStorage.getItem(STORAGE_PROJECTS_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                localStorage.removeItem(STORAGE_PROJECTS_KEY);
            }
        }
        return mockProjects.map(p => ({
            ...defaultFields,
            ...p,
            documents: p.documents || defaultFields.documents,
            phases: p.phases || defaultFields.phases
        }));
    };

    const getInitialDocs = () => {
        const saved = localStorage.getItem(STORAGE_DOCS_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                localStorage.removeItem(STORAGE_DOCS_KEY);
            }
        }
        return mockDocuments || [];
    };

    // Load initial data
    useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => {
            const initialProjects = getInitialProjects();
            const initialDocs = getInitialDocs();
            setProjects(initialProjects);
            setDocuments(initialDocs);
            setLastUpdated(new Date());
            setIsLoading(false);
        }, 300);
        return () => clearTimeout(timer);
    }, []);

    // Sync to localStorage on updates
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

    // CRUD Proyek
    const addProject = (project) => {
        const updated = [project, ...projects];
        saveProjects(updated);
    };

    const updateProject = (id, updates) => {
        const updated = projects.map(p => p.id === id ? { ...p, ...updates } : p);
        saveProjects(updated);
    };

    const deleteProject = (id) => {
        const updated = projects.filter(p => p.id !== id);
        saveProjects(updated);
    };

    const getProjectById = (id) => {
        return projects.find(p => p.id === id);
    };

    const getProjectsByStatus = (status) => {
        return projects.filter(p => p.status === status);
    };

    // CRUD Dokumen
    const addDocument = (doc) => {
        const updated = [doc, ...documents];
        saveDocuments(updated);
    };

    const deleteDocument = (id) => {
        const updated = documents.filter(d => d.id !== id);
        saveDocuments(updated);
    };

    // Refresh & Reset data
    const refreshData = () => {
        setIsLoading(true);
        setTimeout(() => {
            const initialProjects = getInitialProjects();
            const initialDocs = getInitialDocs();
            setProjects(initialProjects);
            setDocuments(initialDocs);
            setLastUpdated(new Date());
            setIsLoading(false);
        }, 300);
    };

    const resetToDefaultData = () => {
        localStorage.removeItem(STORAGE_PROJECTS_KEY);
        localStorage.removeItem(STORAGE_DOCS_KEY);
        refreshData();
    };

    return (
        <ProjectContext.Provider
            value={{
                projects,
                documents,
                users,
                isLoading,
                lastUpdated,
                addProject,
                updateProject,
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