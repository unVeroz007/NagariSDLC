import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { projectService, userService } from '../../services/api';
import RBBBadge from '../../components/RBBBadge';
import ProjectTypeBadge from '../../components/ProjectTypeBadge';
import toast from 'react-hot-toast';
import {
    Users,
    UserCheck,
    Check,
    AlertCircle,
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
    const { projects, refreshData } = useProjects();
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
                        skill: typeof u.division === 'string' ? u.division : (u.division?.name || u.division_detail?.name || 'Developer'),
                        available: true,
                    }));
                    setDeveloperCandidates(mapped);
                }
            })
            .catch(() => {
            });
        return () => { isMounted = false; };
    }, []);

    // Filter proyek yang sudah memiliki PM dan belum selesai dialokasikan tim.
    // Kriteria: berstatus IN_DEVELOPMENT ATAU sudah punya PM, dan belum punya tim (team kosong).
    // Catatan: tidak lagi bergantung pada flag client-only (isTeamAllocated/allocationStatus)
    // yang tidak tersimpan di backend dan hilang saat refetch.
    const activeProjectsWithPM = useMemo(() => {
        const hasTeam = (p) => Array.isArray(p.team) && p.team.length > 0;
        let list = projects.filter(p =>
            (p.status === 'IN_DEVELOPMENT' || (p.pm && (typeof p.pm === 'object' ? p.pm.name : p.pm))) &&
            !hasTeam(p)
        );
        const isPrivileged = user?.role && ['super_admin', 'lead_group', 'head_of_it', 'development_lead'].includes(user.role);
        if (!isPrivileged && user?.id) {
            const pmId = user.id;
            list = list.filter(p => {
                const pmObjId = typeof p.pm === 'object' ? p.pm?.id : null;
                return pmObjId && Number(pmObjId) === Number(pmId);
            });
        }
        return list;
    }, [projects, user]);

    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [selectedTeamIds, setSelectedTeamIds] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Proyek terpilih SELALU di-derive dari data projects terbaru (hindari objek stale).
    const selectedProject = useMemo(() => {
        if (!selectedProjectId) return null;
        return (projects || []).find(p => String(p.id) === String(selectedProjectId)) || null;
    }, [projects, selectedProjectId]);

    // 🔒 Tim yang SUDAH dialokasikan oleh Lead Pengembangan (dari backend project.team).
    // HANYA anggota dengan assigned_by === 'lead' (bukan yang dipilih PM).
    const leadAssignedTeam = useMemo(() => {
        if (selectedProject?.team && Array.isArray(selectedProject.team)) {
            return selectedProject.team
                .filter(t => t && (t.user_id || t.id) && String(t.assigned_by ?? 'lead') !== 'pm')
                .map(t => ({
                    user_id: t.user_id ?? t.id,
                    name: t.name || 'Developer',
                    email: t.email || null,
                    role: t.role || 'Developer',
                    assigned_by: t.assigned_by ?? 'lead',
                }));
        }
        return [];
    }, [selectedProject]);

    // Set user_id yang sudah ditetapkan Lead — developer ini TERKUNCI (tidak bisa dicentang PM)
    const leadAssignedUserIds = useMemo(
        () => new Set(leadAssignedTeam.map(t => Number(t.user_id))),
        [leadAssignedTeam]
    );

    // Developer yang masih bisa dipilih PM (available & belum ditetapkan Lead).
    // Anggota yang sudah dipilih PM sebelumnya tetap bisa di-uncheck (boleh dicabut).
    const selectableDevs = useMemo(
        () => developerCandidates.filter(d => d.available && !leadAssignedUserIds.has(Number(d.id))),
        [developerCandidates, leadAssignedUserIds]
    );

    useEffect(() => {
        if (activeProjectsWithPM.length > 0) {
            if (!selectedProjectId || !activeProjectsWithPM.find(p => String(p.id) === String(selectedProjectId))) {
                setSelectedProjectId(activeProjectsWithPM[0].id);
            }
        } else {
            setSelectedProjectId(null);
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
        if (selectedProjectId) {
            scrollPageToTop();
        }
    }, [selectedProjectId]);

    // Update selected team IDs when selected project changes.
    // Isi awal: hanya anggota yang dipilih PM sebelumnya (assigned_by === 'pm').
    // Tim Lead ditampilkan terpisah dan terkunci (tidak masuk selectedTeamIds).
    useEffect(() => {
        if (selectedProject?.team && Array.isArray(selectedProject.team)) {
            const pmIds = selectedProject.team
                .filter(t => t && t.user_id && String(t.assigned_by) === 'pm')
                .map(t => Number(t.user_id));
            setSelectedTeamIds(pmIds);
        } else {
            setSelectedTeamIds([]);
        }
    }, [selectedProject?.id]);

    const handleToggleDev = (devId) => {
        // 🔒 Blokir toggle untuk developer yang sudah ditetapkan Lead Pengembangan
        if (leadAssignedUserIds.has(Number(devId))) {
            toast.error('Developer ini sudah dipilih oleh Lead Pengembangan dan tidak dapat diubah.');
            return;
        }
        if (selectedTeamIds.includes(devId)) {
            setSelectedTeamIds(selectedTeamIds.filter(id => id !== devId));
        } else {
            setSelectedTeamIds([...selectedTeamIds, devId]);
        }
    };

    const handleSelectAllDevs = () => {
        const availableDevs = selectableDevs.map(d => d.id);
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
        if (isSubmitting) return;
        if (selectedTeamIds.length === 0 && leadAssignedTeam.length === 0) {
            toast.error('Pilih minimal 1 developer untuk dialokasikan!');
            return;
        }

        setIsSubmitting(true);

        // Tim final = tim Lead (terkunci, assigned_by 'lead') + pilihan PM (assigned_by 'pm')
        const additionalTeam = developerCandidates.filter(d => selectedTeamIds.includes(d.id));
        const allocatedTeam = [
            ...leadAssignedTeam.map(t => ({ user_id: t.user_id, skill: t.role || 'Developer', assigned_by: 'lead' })),
            ...additionalTeam.map(d => ({ user_id: d.id, skill: d.skill || 'Developer', assigned_by: 'pm' })),
        ];
        const totalTeam = allocatedTeam.length;
        const targetProjName = selectedProject.name;
        const targetProjectId = selectedProject.id;

        const loadingToastId = toast.loading('Menyimpan alokasi tim...', { duration: Infinity });
        try {
            await projectService.allocateTeam(targetProjectId, allocatedTeam);

            addNotification(
                'Alokasi Tim Perangkat Lunak',
                `Tim developer (${totalTeam} orang) berhasil dialokasikan untuk proyek ${targetProjName}.`,
                'success',
                '/pm/kanban'
            );

            toast.dismiss(loadingToastId);
            toast.success(`Tim developer untuk ${targetProjName} berhasil dialokasikan!`);

            // Muat ulang data proyek dari backend agar tim terbaru tercermin & proyek keluar antrean.
            await refreshData();
            setSelectedTeamIds([]);
            setSelectedProjectId(null);
        } catch (err) {
            toast.dismiss(loadingToastId);
            toast.error('Gagal mengalokasikan tim: ' + (err?.message || 'Terjadi kesalahan.'));
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
                                    setSelectedProjectId(project.id);
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
                                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{project.req_id || project.reqId || project.id}</span>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <RBBBadge type={project.type} deadline={project.rbbDeadline} />
                                        <ProjectTypeBadge type={project.project_type} />
                                    </div>
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
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <RBBBadge type={selectedProject.type} deadline={selectedProject.rbbDeadline} />
                                            <ProjectTypeBadge type={selectedProject.project_type} />
                                        </div>
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
                                        {selectedTeamIds.length === selectableDevs.length && selectableDevs.length > 0 ? 'Batal Pilih Semua' : 'Pilih Semua Tersedia'}
                                    </button>
                                </div>

                                {/* 🔒 TIM SUDAH DITETAPKAN LEAD PENGEMBANGAN (TERKUNCI) */}
                                {leadAssignedTeam.length > 0 && (
                                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center shrink-0">
                                                <Check size={14} />
                                            </span>
                                            <div>
                                                <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Tim Dipilih Lead Pengembangan</p>
                                                <p className="text-[11px] text-indigo-700">Sudah dikunci — tidak dapat diubah/dicabut oleh PM. Gunakan daftar di bawah untuk menambah anggota.</p>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {leadAssignedTeam.map((t, idx) => (
                                                <div key={idx} className="flex items-center gap-3 bg-white rounded-lg border border-indigo-200 px-3 py-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
                                                        {t.name?.substring(0, 2).toUpperCase() || 'DV'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-gray-800">{t.name}</p>
                                                        <p className="text-[11px] text-gray-500">{t.email || '—'}</p>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full shrink-0">
                                                        {t.role || 'Developer'}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 shrink-0">
                                                        <Check size={12} /> Ditunjuk Lead
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

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
                                                const isLocked = leadAssignedUserIds.has(Number(dev.id));
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
                                                        className={`transition-colors ${isLocked ? 'bg-indigo-50/40 cursor-not-allowed' : `cursor-pointer ${isChecked ? 'bg-blue-50/50 font-semibold' : 'hover:bg-gray-50'}`}`}
                                                    >
                                                        <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isLocked ? true : isChecked}
                                                                disabled={isLocked}
                                                                onChange={() => handleToggleDev(dev.id)}
                                                                className={`w-4 h-4 rounded border-gray-300 focus:ring-blue-500 ${isLocked ? 'text-indigo-500 cursor-not-allowed opacity-60' : 'text-blue-600 cursor-pointer'}`}
                                                            />
                                                        </td>
                                                        <td className="p-3.5 text-gray-800 font-bold">
                                                            <span>{dev.name}</span>
                                                            {isLocked && (
                                                                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                                                                    <Check size={11} /> Dipilih Lead
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-3.5 text-gray-600">
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700">
                                                                {realtimeWorkload} Proyek Aktif
                                                            </span>
                                                        </td>
                                                        <td className="p-3.5 text-center">
                                                            {isLocked ? (
                                                                <span className="bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                                                                    Ditetapkan Lead
                                                                </span>
                                                            ) : (
                                                                <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                                                                    Tersedia
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
                                                <strong>{selectedTeamIds.length} Developer Tambahan Terpilih:</strong>{' '}
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
                                        Total Tim Akhir: <strong className="text-gray-900 text-sm font-extrabold">{leadAssignedTeam.length + selectedTeamIds.length} Orang</strong>
                                        {leadAssignedTeam.length > 0 && (
                                            <span className="ml-2 text-indigo-600 font-semibold">({leadAssignedTeam.length} dari Lead + {selectedTeamIds.length} tambahan PM)</span>
                                        )}
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