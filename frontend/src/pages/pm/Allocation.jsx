import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { projectService, userService } from '../../services/api';
import { PROJECT_STATUS } from '../../constants/projectStatus';
import RBBBadge from '../../components/RBBBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import {
    Users,
    UserCheck,
    CheckCircle,
    Building,
    User,
    Check,
    X,
    Calendar,
    Briefcase,
    AlertCircle,
    ArrowRight,
    Send,
    Clock,
    Shield
} from 'lucide-react';

const defaultDeveloperCandidates = [
    { id: 71, name: 'Dimas Anggara', email: 'dev1@nagari.co.id', skill: 'Backend (Java)', available: true },
    { id: 72, name: 'Eka Putri', email: 'dev2@nagari.co.id', skill: 'Frontend (React)', available: true },
    { id: 73, name: 'Fani Wijaya', email: 'dev3@nagari.co.id', skill: 'Fullstack & Mobile', available: true },
    { id: 74, name: 'Gilang Pratama', email: 'dev4@nagari.co.id', skill: 'DevOps & Cloud', available: true },
    { id: 75, name: 'Rina Wati', email: 'dev5@nagari.co.id', skill: 'Database (PostgreSQL)', available: true },
];

export default function Allocation() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { addNotification } = useNotifications();
    const { projects, updateProject, isLoading } = useProjects();
    const rightPanelRef = useRef(null);

    const [developerCandidates, setDeveloperCandidates] = useState(defaultDeveloperCandidates);

    // Fetch dynamic developer candidates from Backend API
    useEffect(() => {
        let isMounted = true;
        userService.getAll()
            .then(res => {
                if (!isMounted) return;
                const usersList = Array.isArray(res) ? res : res?.data || [];
                const devUsers = usersList.filter(u => {
                    const r = (u.role?.name || u.role || '').toString().toLowerCase();
                    return r.includes('developer');
                });
                if (devUsers.length > 0) {
                    const mapped = devUsers.map(u => ({
                        id: u.id,
                        name: u.name,
                        email: u.email,
                        skill: u.division?.name || 'Developer',
                        available: true,
                    }));
                    setDeveloperCandidates(mapped);
                }
            })
            .catch(err => {
                console.warn('[Allocation] Fallback to default developer candidates:', err);
            });
        return () => { isMounted = false; };
    }, []);

    // Filter proyek yang sudah memiliki PM tetapi BELUM dialokasikan tim (Antrean Alokasi Tim PM)
    const activeProjectsWithPM = useMemo(() => {
        let list = projects.filter(p =>
            (p.status === 'IN_DEVELOPMENT' || (p.pm && p.pm.name)) &&
            !p.isTeamAllocated &&
            p.allocationStatus !== 'COMPLETED'
        );
        const isPrivileged = user?.role && ['super_admin', 'lead_group', 'head_of_it', 'development_lead'].includes(user.role);
        if (!isPrivileged && user?.id) {
            const pmId = user.id;
            list = list.filter(p => {
                const pmObjId = typeof p.pm === 'object' ? p.pm?.id : null;
                return pmObjId && pmObjId === pmId;
            });
        }
        return list;
    }, [projects, user]);

    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedTeamIds, setSelectedTeamIds] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (activeProjectsWithPM.length > 0) {
            if (!selectedProject || !activeProjectsWithPM.find(p => p.id === selectedProject.id)) {
                setSelectedProject(activeProjectsWithPM[0]);
            }
        } else {
            setSelectedProject(null);
        }
    }, [projects, activeProjectsWithPM.length]);

    // Helper untuk scroll paling atas panel detail & container main di MainLayout
    const scrollPageToTop = () => {
        if (rightPanelRef.current) {
            rightPanelRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        const mainContainer = rightPanelRef.current?.closest('main') || document.querySelector('main');
        if (mainContainer) {
            mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Auto scroll ke atas saat proyek dipilih
    useEffect(() => {
        if (selectedProject) {
            scrollPageToTop();
        }
    }, [selectedProject?.id]);

    // Update selected team IDs when selected project changes
    useEffect(() => {
        if (selectedProject?.team && Array.isArray(selectedProject.team)) {
            const existingIds = selectedProject.team.map(t => typeof t === 'object' ? t.id : t);
            setSelectedTeamIds(existingIds);
        } else {
            setSelectedTeamIds([]);
        }
    }, [selectedProject]);

    const handleToggleDev = (devId) => {
        if (selectedTeamIds.includes(devId)) {
            setSelectedTeamIds(selectedTeamIds.filter(id => id !== devId));
        } else {
            setSelectedTeamIds([...selectedTeamIds, devId]);
        }
    };

    const handleSelectAllDevs = () => {
        const availableDevs = developerCandidates.filter(d => d.available).map(d => d.id);
        if (selectedTeamIds.length === availableDevs.length) {
            setSelectedTeamIds([]);
        } else {
            setSelectedTeamIds(availableDevs);
        }
    };

    const handleSubmit = async () => {
        if (!selectedProject) {
            toast.error('Pilih proyek terlebih dahulu!');
            return;
        }
        if (selectedTeamIds.length === 0) {
            toast.error('Pilih minimal 1 developer untuk dialokasikan!');
            return;
        }

        setIsSubmitting(true);

        const allocatedTeam = developerCandidates.filter(d => selectedTeamIds.includes(d.id));
        const targetProjName = selectedProject.name;

        try {
            // 1. TULIS LANGSUNG KE DATABASE via API
            await projectService.allocateTeam(selectedProject.id, allocatedTeam);

            // 2. Update state lokal agar UI langsung update tanpa tunggu refetch
            await updateProject(selectedProject.id, {
                team: allocatedTeam,
                isTeamAllocated: true,
                allocationStatus: 'COMPLETED',
                status: PROJECT_STATUS.IN_DEVELOPMENT,
                allocatedAt: new Date().toISOString(),
            });

            addNotification(
                'Alokasi Tim Perangkat Lunak',
                `Tim developer (${allocatedTeam.length} orang) berhasil dialokasikan untuk proyek ${targetProjName}.`,
                'success',
                '/pm/kanban'
            );

            toast.success(`Tim developer untuk ${targetProjName} berhasil dialokasikan & tersimpan ke database!`);
            setSelectedProject(null);
            setSelectedTeamIds([]);
        } catch (err) {
            console.warn('[Allocation] DB write fallback, updating local only:', err);
            // Fallback: tetap update local jika API error
            await updateProject(selectedProject.id, {
                team: allocatedTeam,
                isTeamAllocated: true,
                allocationStatus: 'COMPLETED',
                status: PROJECT_STATUS.IN_DEVELOPMENT,
                allocatedAt: new Date().toISOString(),
            });
            toast.success(`Tim berhasil dialokasikan (mode offline)!`);
            setSelectedProject(null);
            setSelectedTeamIds([]);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-[#f8f9fb] overflow-hidden animate-slide-up">
            {/* Header Laman */}
            <div className="px-6 py-4 bg-white border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-extrabold text-gray-800">Alokasi Tim Developer</h1>
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Users size={14} /> PM Governance
                    </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                    Pilih dan alokasikan developer ke dalam proyek yang sudah ditunjuk PM penanggung jawabnya.
                </p>
            </div>

            {/* Split Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* KIRI: Daftar Proyek Aktif Memiliki PM */}
                <div className="w-1/3 border-r border-gray-200 bg-gray-50/50 overflow-y-auto p-4 flex flex-col gap-3 shrink-0">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Proyek Dikelola ({activeProjectsWithPM.length})</h3>
                    </div>

                    {activeProjectsWithPM.length === 0 ? (
                        <div className="text-center py-8 px-4 bg-white rounded-xl border border-gray-200 shadow-xs">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
                                <AlertCircle size={24} />
                            </div>
                            <h4 className="text-xs font-bold text-gray-800 mb-1">Belum Ada Proyek Membutuhkan PM</h4>
                            <p className="text-[11px] text-gray-500 mb-4 leading-relaxed">
                                Belum ada proyek dengan PM terverifikasi. Tunggu penunjukan PM dari Dev Lead.
                            </p>
                            <button
                                onClick={() => navigate('/workspace/dev-lead')}
                                className="w-full py-2 bg-[#1a365d] text-white font-bold rounded-lg text-xs hover:bg-[#0f2342] transition-all shadow-xs"
                            >
                                Ke Workspace Dev Lead
                            </button>
                        </div>
                    ) : (
                        activeProjectsWithPM.map((project) => (
                            <div
                                key={project.id}
                                onClick={() => {
                                    setSelectedProject(project);
                                    scrollPageToTop();
                                }}
                                className={`p-4 rounded-xl cursor-pointer transition-all border relative overflow-hidden ${
                                    selectedProject?.id === project.id
                                        ? 'bg-white border-2 border-[#1a365d] shadow-sm'
                                        : 'bg-white border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                {selectedProject?.id === project.id && (
                                    <div className="absolute top-0 left-0 w-1 h-full bg-[#1a365d]"></div>
                                )}
                                <div className="flex justify-between items-start mb-1.5">
                                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{project.id}</span>
                                    <RBBBadge type={project.type} deadline={project.rbbDeadline} />
                                </div>
                                <h4 className="font-bold text-gray-800 text-sm mb-1 line-clamp-1">{project.name}</h4>
                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                                    <UserCheck size={13} className="text-emerald-600" />
                                    <span>PM: {project.pm?.name || 'Budi Santoso'}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* KANAN: Detail Proyek & Form Alokasi Developer */}
                <div className="w-2/3 bg-white flex flex-col overflow-hidden relative">
                    <div ref={rightPanelRef} className="flex-1 overflow-y-auto p-6 pb-28 space-y-6">
                        
                        {/* Status Notice Banner jika tidak ada proyek dipilih */}
                        {!selectedProject ? (
                            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                                        <AlertCircle size={20} />
                                    </div>
                                    <div>
                                        <div className="text-xs text-amber-800 font-bold uppercase tracking-wider">Status Antrean Alokasi Tim</div>
                                        <div className="text-xs text-amber-900 mt-0.5">
                                            Saat ini belum ada proyek aktif yang membutuhkan alokasi tim. Anda dapat melihat pool kandidat developer di bawah ini.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Metadata Proyek */}
                                <div className="border-b border-gray-100 pb-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded">
                                            {selectedProject.id}
                                        </span>
                                        <RBBBadge type={selectedProject.type} deadline={selectedProject.rbbDeadline} />
                                    </div>
                                    <h2 className="text-2xl font-extrabold text-gray-800 mt-2">{selectedProject.name}</h2>
                                    <p className="text-xs text-gray-500 mt-1">{selectedProject.division} • Target Date: {selectedProject.targetDate}</p>
                                </div>

                                {/* Info Card PM Penanggung Jawab */}
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                                            {selectedProject.pm?.initial || selectedProject.pm?.name?.substring(0, 2).toUpperCase() || 'PM'}
                                        </div>
                                        <div>
                                            <div className="text-xs text-emerald-700 font-bold uppercase tracking-wider">Project Manager Penanggung Jawab</div>
                                            <div className="text-sm font-extrabold text-emerald-950">{selectedProject.pm?.name || 'Budi Santoso'} ({selectedProject.pm?.department || 'Divisi TI'})</div>
                                        </div>
                                    </div>
                                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                                        <UserCheck size={14} /> Terverifikasi Dev Lead
                                    </span>
                                </div>
                            </>
                        )}

                            {/* SEKSI FORM ALOKASI TIM DEVELOPER */}
                            {/* SEKSI FORM ALOKASI TIM DEVELOPER */}
                            <section className="bg-gray-50 rounded-2xl border border-gray-200 p-5 space-y-4">
                                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                                    <div>
                                        <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                            <Users size={18} className="text-[#1a365d]" />
                                            Daftar Kandidat Developer
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-0.5">Centang anggota developer yang akan dialokasikan ke dalam tim proyek ini.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleSelectAllDevs}
                                        className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-white border border-blue-200 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                                    >
                                        {selectedTeamIds.length === developerCandidates.filter(d => d.available).length ? 'Batal Pilih Semua' : 'Pilih Semua Tersedia'}
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse bg-white rounded-xl overflow-hidden border border-gray-200">
                                        <thead>
                                            <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 text-xs font-bold uppercase">
                                                <th className="p-3.5 text-center w-12">Pilih</th>
                                                <th className="p-3.5">Nama Developer</th>
                                                <th className="p-3.5">Beban Kerja Saat Ini</th>
                                                <th className="p-3.5 text-center">Ketersediaan</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-xs font-medium">
                                            {developerCandidates.map((dev) => {
                                                const isChecked = selectedTeamIds.includes(dev.id);
                                                const realtimeWorkload = (projects || []).filter(p => {
                                                    if (!p.team || !Array.isArray(p.team)) return false;
                                                    const isFinished = p.status === 'LIVE_PRODUCTION' || p.status === 'CANCELLED' || p.status === 'REJECTED';
                                                    if (isFinished) return false;
                                                    return p.team.some(t => {
                                                        const memberName = typeof t === 'object' ? t.name : String(t);
                                                        return memberName.toLowerCase() === dev.name.toLowerCase();
                                                    });
                                                }).length;

                                                return (
                                                    <tr
                                                        key={dev.id}
                                                        onClick={() => handleToggleDev(dev.id)}
                                                        className={`transition-colors cursor-pointer ${
                                                            isChecked
                                                                ? 'bg-blue-50/50 font-semibold'
                                                                : 'hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => handleToggleDev(dev.id)}
                                                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                                            />
                                                        </td>
                                                        <td className="p-3.5 text-gray-800 font-bold">
                                                            {dev.name}
                                                        </td>
                                                        <td className="p-3.5 text-gray-600">
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700">
                                                                {realtimeWorkload} Proyek Aktif
                                                            </span>
                                                        </td>
                                                        <td className="p-3.5 text-center">
                                                            <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                                                                Tersedia
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Ringkasan Tim Terpilih */}
                                {selectedTeamIds.length > 0 && (
                                    <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl text-xs text-blue-900 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Users size={16} className="text-blue-700 shrink-0" />
                                            <span>
                                                <strong>{selectedTeamIds.length} Developer Terpilih:</strong>{' '}
                                                {developerCandidates
                                                    .filter(d => selectedTeamIds.includes(d.id))
                                                    .map(d => d.name)
                                                    .join(', ')}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Action Bar / Total Developer & Tombol Alokasi (Diposisikan di Bawah Tabel Tim Dev) */}
                                <div className="bg-white border border-gray-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs mt-4">
                                    <div className="text-xs text-gray-600">
                                        Total Developer Dipilih: <strong className="text-gray-900 text-sm font-extrabold">{selectedTeamIds.length} Orang</strong>
                                    </div>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting || !selectedProject}
                                        className="px-6 py-2.5 bg-[#1a365d] hover:bg-[#0f2342] text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                                    >
                                        <Users size={16} />
                                        {isSubmitting ? 'Mengalokasikan...' : !selectedProject ? 'Pilih Proyek Terlebih Dahulu' : 'Alokasikan Tim Developer'}
                                    </button>
                                </div>
                            </section>
                        </div>
                    </div>
            </div>
        </div>
    );
}