import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
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

const developerCandidates = [
    { id: 1, name: 'Dimas Anggara', skill: 'Backend (Java)', workload: 1, available: true },
    { id: 2, name: 'Eka Putri', skill: 'Frontend (React)', workload: 2, available: true },
    { id: 3, name: 'Fani Wijaya', skill: 'QA Engineer', workload: 3, available: true },
    { id: 4, name: 'Gilang Pratama', skill: 'DevOps', workload: 1, available: true },
    { id: 5, name: 'Rina Wati', skill: 'Database (PostgreSQL)', workload: 2, available: true },
    { id: 6, name: 'Budi Santoso', skill: 'Fullstack (Node.js)', workload: 4, available: false },
];

export default function Allocation() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { addNotification } = useNotifications();
    const { projects, updateProject, isLoading } = useProjects();
    const rightPanelRef = useRef(null);

    // Filter proyek yang sudah memiliki PM (Status IN_DEVELOPMENT atau memiliki objek PM)
    const activeProjectsWithPM = projects.filter(p =>
        p.status === 'IN_DEVELOPMENT' || (p.pm && p.pm.name)
    );

    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedTeamIds, setSelectedTeamIds] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (activeProjectsWithPM.length > 0 && !selectedProject) {
            setSelectedProject(activeProjectsWithPM[0]);
        }
    }, [projects]);

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

    const handleToggleDev = (devId, isAvailable) => {
        if (!isAvailable) {
            toast.error('Developer ini sedang dalam beban kerja penuh (tidak tersedia).');
            return;
        }

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

    const handleSubmit = () => {
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

        setTimeout(() => {
            updateProject(selectedProject.id, {
                team: allocatedTeam,
                allocatedAt: new Date().toISOString(),
            });

            addNotification(
                'Alokasi Tim Perangkat Lunak',
                `Tim developer (${allocatedTeam.length} orang) berhasil dialokasikan untuk proyek ${selectedProject.name}.`,
                'success',
                '/pm/kanban'
            );

            toast.success(`Tim developer untuk ${selectedProject.name} berhasil dialokasikan!`);
            setIsSubmitting(false);
        }, 500);
    };

    if (isLoading) {
        return <LoadingSpinner text="Memuat Laman Alokasi Tim..." />;
    }

    // Kasus jika belum ada proyek yang memiliki PM
    if (activeProjectsWithPM.length === 0) {
        return (
            <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] flex items-center justify-center">
                <div className="text-center py-20 animate-scale-in max-w-md mx-auto">
                    <div className="w-20 h-20 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-5 shadow-sm">
                        <AlertCircle size={40} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Proyek Belum Memiliki PM</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        Proyek belum memiliki PM penanggung jawab. Tunggu penunjukan PM dari Ketua Grup Pengembangan di Laman Workspace Dev Lead.
                    </p>
                    <button
                        onClick={() => navigate('/workspace/dev-lead')}
                        className="px-5 py-2.5 bg-[#1a365d] text-white font-bold rounded-xl text-xs hover:bg-[#0f2342] transition-all shadow-sm"
                    >
                        Ke Workspace Dev Lead
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-[#f8f9fb] overflow-hidden animate-slide-up">
            {/* Header Laman */}
            <div className="px-6 py-4 bg-white border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-extrabold text-gray-800">Pilih Tim Developer</h1>
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Users size={14} /> PM Governance
                    </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                    Pilih developer yang akan bergabung dalam tim proyek ini.
                </p>
            </div>

            {/* Split Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* KIRI: Daftar Proyek Aktif Memiliki PM */}
                <div className="w-1/3 border-r border-gray-200 bg-gray-50/50 overflow-y-auto p-4 flex flex-col gap-3 shrink-0">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Proyek Dikelola ({activeProjectsWithPM.length})</h3>
                    </div>

                    {activeProjectsWithPM.map((project) => (
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
                    ))}
                </div>

                {/* KANAN: Detail Proyek & Form Alokasi Developer */}
                {selectedProject && (
                    <div className="w-2/3 bg-white flex flex-col overflow-hidden relative">
                        <div ref={rightPanelRef} className="flex-1 overflow-y-auto p-6 pb-28 space-y-6">
                            
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
                                                return (
                                                    <tr
                                                        key={dev.id}
                                                        onClick={() => handleToggleDev(dev.id, dev.available)}
                                                        className={`transition-colors cursor-pointer ${
                                                            !dev.available
                                                                ? 'opacity-60 bg-gray-50 cursor-not-allowed'
                                                                : isChecked
                                                                ? 'bg-blue-50/50 font-semibold'
                                                                : 'hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                disabled={!dev.available}
                                                                onChange={() => handleToggleDev(dev.id, dev.available)}
                                                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                                                            />
                                                        </td>
                                                        <td className="p-3.5 text-gray-800 font-bold">
                                                            {dev.name}
                                                        </td>
                                                        <td className="p-3.5 text-gray-600">
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700">
                                                                {dev.workload} Proyek Aktif
                                                            </span>
                                                        </td>
                                                        <td className="p-3.5 text-center">
                                                            {dev.available ? (
                                                                <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                                                                    Tersedia
                                                                </span>
                                                            ) : (
                                                                <span className="bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                                                                    Penuh
                                                                </span>
                                                            )}
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
                                        disabled={isSubmitting}
                                        className="px-6 py-2.5 bg-[#1a365d] hover:bg-[#0f2342] text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
                                    >
                                        <Users size={16} />
                                        {isSubmitting ? 'Mengalokasikan...' : 'Alokasikan Tim Developer'}
                                    </button>
                                </div>
                            </section>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}