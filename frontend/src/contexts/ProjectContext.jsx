// src/contexts/ProjectContext.jsx
import { createContext, useState, useContext, useEffect } from 'react';
import { mockProjects, mockDocuments } from '../data/mockData';

const ProjectContext = createContext();

export function ProjectProvider({ children }) {
    const [projects, setProjects] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);

    // Simulasi load data dari API
    useEffect(() => {
        const loadData = () => {
            setIsLoading(true);
            // Simulasi delay
            setTimeout(() => {
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

                const enrichedProjects = mockProjects.map(p => ({
                    ...defaultFields,
                    ...p,
                    documents: p.documents || defaultFields.documents,
                    phases: p.phases || defaultFields.phases
                }));

                setProjects(enrichedProjects);
                setDocuments(mockDocuments || []);
                setUsers([]);
                setLastUpdated(new Date());
                setIsLoading(false);
            }, 500);
        };

        loadData();
    }, []);

    // CRUD Proyek
    const addProject = (project) => {
        setProjects(prev => [project, ...prev]);
        setLastUpdated(new Date());
    };

    const updateProject = (id, updates) => {
        setProjects(prev =>
            prev.map(p => p.id === id ? { ...p, ...updates } : p)
        );
        setLastUpdated(new Date());
    };

    const deleteProject = (id) => {
        setProjects(prev => prev.filter(p => p.id !== id));
        setLastUpdated(new Date());
    };

    const getProjectById = (id) => {
        return projects.find(p => p.id === id);
    };

    const getProjectsByStatus = (status) => {
        return projects.filter(p => p.status === status);
    };

    // CRUD Dokumen
    const addDocument = (doc) => {
        setDocuments(prev => [...prev, doc]);
        setLastUpdated(new Date());
    };

    const deleteDocument = (id) => {
        setDocuments(prev => prev.filter(d => d.id !== id));
        setLastUpdated(new Date());
    };

    // Refresh data (simulasi)
    const refreshData = () => {
        setIsLoading(true);
        setTimeout(() => {
            setProjects(mockProjects);
            setDocuments(mockDocuments || []);
            setUsers(mockUsers || []);
            setLastUpdated(new Date());
            setIsLoading(false);
        }, 500);
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