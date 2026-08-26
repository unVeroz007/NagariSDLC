import { useState, useMemo, useEffect, useRef } from 'react';
import { useProjects } from '../../contexts/ProjectContext';
import { getProjectRealDocuments } from '../../utils/projectDocuments';
import { useNotifications } from '../../contexts/NotificationContext';
import { userService, qaRequestService } from '../../services/api';
import RBBBadge from '../../components/RBBBadge';
import ProjectTypeBadge from '../../components/ProjectTypeBadge';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import TestReportReviewCard from '../../components/TestReportReviewCard';
import toast from 'react-hot-toast';
import {
    TRACK_STATUS,
    TRACK_STATUS_LABEL,
    getQaTrackStatus,
} from '../../constants/projectStatus';
import { TEST_RESULT } from '../../constants/testResult';
import { PLANNING_QA_GROUP_LABEL, isQaDispositionEligible } from '../../constants/roles';

import {
    FolderOpen,
    Copy,
    Send,
    Ban,
    Calendar,
    Search,
    FileText,
    CheckCircle,
    Eye,
    Inbox,
    UserCheck,
    Building,
    CheckCircle2,
    FileCheck,
    Info,
} from 'lucide-react';

export default function WorkspaceQA() {
    const { projects, refreshData } = useProjects();
    const { addNotification } = useNotifications();

    // 🔄 Pelaksana pengujian diambil dari user API, bukan hardcode.
    // Beban aktif dihitung realtime dari proyek nyata.
    //
    // Daftarnya mencakup SELURUH analis Grup Perencanaan dan Quality Assurance
    // (`constants/roles.js`), bukan hanya `qa_tester`: Perencanaan dan QA adalah satu
    // grup dengan kumpulan orang yang sama, jadi QA Lead boleh mendisposisikan pengujian
    // ke analis Perencanaan juga. Cerminan backend-nya `TestingTrack::QA->testerRoles()`.
    //
    // Penyaring sebelumnya menguji substring `'qa'` pada nama role. Uji itu mustahil
    // menemukan `analyst`, dan sebaliknya akan meloloskan role baru mana pun yang
    // namanya kebetulan memuat "qa".
    const [qaTeamMembers, setQaTeamMembers] = useState([]);
    const [isQaLoading, setIsQaLoading] = useState(true);

    // Beban aktif per pengguna: { [userId]: jumlah }. Dihitung server-side
    // (`GET /users/workload`), lihat catatan panjang di `qaWorkloads` di bawah.
    const [workloadMap, setWorkloadMap] = useState({});

    useEffect(() => {
        let isMounted = true;
        userService.getAll()
            .then(res => {
                if (!isMounted) return;
                const usersList = Array.isArray(res) ? res : res?.data || [];
                const qaUsers = usersList.filter(isQaDispositionEligible);
                setQaTeamMembers(qaUsers.map(u => ({
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    activeLoad: 0,
                })));
            })
            .catch(() => setQaTeamMembers([]))
            .finally(() => { if (isMounted) setIsQaLoading(false); });
        return () => { isMounted = false; };
    }, []);

    // Beban di-refetch setiap daftar proyek context berubah (tik polling atau sesudah
    // aksi disposisi memuat ulang proyek), sehingga angka dropdown tetap terkini.
    useEffect(() => {
        let isMounted = true;
        userService.workload()
            .then(res => {
                if (!isMounted) return;
                const list = Array.isArray(res) ? res : res?.data || [];
                const map = {};
                list.forEach(u => { map[u.id] = u.active_load; });
                setWorkloadMap(map);
            })
            .catch(() => { /* biarkan map apa adanya: beban tampil 0, bukan crash */ });
        return () => { isMounted = false; };
    }, [projects]);

    // 🔢 Beban aktif per anggota QA — total lintas fase dari backend.
    //
    // Dulu dihitung di klien dari `projects`, tetapi itu mustahil benar di layar ini:
    // `applyVisibilityScope()` membatasi proyek yang diterima QA Lead pada fase pengujian
    // saja, sehingga proyek Fase 1 (analisis perencanaan) — yang dipegang orang yang
    // sama, karena Perencanaan & QA adalah satu grup — tidak pernah sampai ke sini dan
    // bebannya selalu terbaca nol. Angka kini datang dari `GET /users/workload` yang
    // menghitung gabungan Perencanaan + QA + Siber dari SELURUH proyek, lalu dicocokkan
    // per id (bukan nama). Pengguna tanpa beban tidak ada di map, jadi jatuh ke 0.
    const qaWorkloads = useMemo(
        () => (qaTeamMembers || []).map(a => ({ ...a, activeLoad: workloadMap[a.id] ?? 0 })),
        [qaTeamMembers, workloadMap]
    );

    const [activeTab, setActiveTab] = useState('DISPOSITION');
    const [projectSearch, setProjectSearch] = useState('');

    const applyProjectSearch = (list) => {
        if (!projectSearch.trim()) return list;
        const term = projectSearch.toLowerCase();
        return list.filter(p =>
            String(p.id || '').toLowerCase().includes(term) ||
            String(p.name || '').toLowerCase().includes(term) ||
            String(p.division || '').toLowerCase().includes(term)
        );
    }; // 'DISPOSITION' | 'REVIEW_LEAD'

    // Tab 1 (Disposisi): proyek yang sudah diajukan PM dan menunggu penunjukan tester.
    //
    // Disaring dari kolom jalur saja. Sebelumnya daftar ini juga mencocokkan
    // `qaAssignee` dengan nama pengguna — padahal proyek yang belum didisposisikan
    // memang belum punya penerima, sehingga antrean Lead selalu tampak kosong.
    const qaProjects = useMemo(
        () => (projects || []).filter(p => getQaTrackStatus(p) === TRACK_STATUS.SUBMITTED),
        [projects]
    );

    // Tab 2 (Review Lead): laporan pelaksana sudah masuk dan menunggu sign-off.
    const reviewLeadProjects = useMemo(
        () => (projects || []).filter(p => getQaTrackStatus(p) === TRACK_STATUS.REVIEW),
        [projects]
    );

    const activeList = activeTab === 'DISPOSITION' ? qaProjects : reviewLeadProjects;

    const [selectedProject, setSelectedProject] = useState(null);
    const activeProject = selectedProject || activeList[0] || null;

    const [assignee, setAssignee] = useState('');
    const [notes, setNotes] = useState('');
    const [leadApprovalNote, setLeadApprovalNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedDocPreview, setSelectedDocPreview] = useState(null);

    const rightPanelRef = useRef(null);

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

    // Gulir ke atas saat proyek yang dibuka atau tab-nya berganti. Yang dipantau
    // id proyeknya, bukan objeknya: objek dibuat ulang setiap polling.
    const activeProjectId = activeProject?.id ?? null;
    useEffect(() => {
        if (activeProjectId) {
            scrollPageToTop();
        }
    }, [activeProjectId, activeTab]);

    // Laporan pelaksana pengujian yang sudah tersimpan di database.
    const qaReport = activeProject?.qaReport || null;

    const handleAssign = async () => {
        if (!activeProject) return;
        if (!assignee) {
            toast.error('Pilih anggota QA Tester!');
            return;
        }
        setIsSubmitting(true);
        try {
            // Disposisi dikirim ke endpoint jalur QA, bukan lewat pembaruan proyek umum.
            // Endpoint inilah yang menuliskan `qa_assignee_id`, memindahkan status jalur
            // ke IN_PROGRESS, mencatat audit, dan memberi tahu tester yang ditunjuk.
            const assigneeName = qaWorkloads.find(a => Number(a.id) === Number(assignee))?.name
                || 'QA Tester';

            await qaRequestService.assign({
                project_id: activeProject.id,
                assignee_id: Number(assignee),
                notes: notes || null,
            });

            toast.success(`Proyek ${activeProject.name} berhasil didisposisikan ke QA Tester (${assigneeName})!`);
            addNotification('Disposisi QA', `Proyek ${activeProject.name} telah didisposisikan ke ${assigneeName}.`, 'info');
            setAssignee('');
            setNotes('');
            refreshData();
        } catch (err) {
            toast.error(err.message || 'Gagal menyimpan disposisi QA.');
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Sign-off Lead QA — keputusan diambil Lead, bukan disimpulkan dari hasil tester.
     *
     * Sebelumnya satu tombol menyimpulkan keputusan dari `testerResult.isPass`, sehingga
     * Lead tidak punya cara mengembalikan proyek ketika ia tidak setuju dengan penilaian
     * pelaksana. Sekarang keputusannya eksplisit: lulus, atau kembalikan ke pengembangan.
     */
    const handleSignOff = async (decision) => {
        if (!activeProject) return;

        const isPass = decision === TEST_RESULT.PASS;

        if (!isPass && !leadApprovalNote.trim()) {
            toast.error('Alasan pengembalian wajib diisi agar tim pengembang tahu apa yang harus diperbaiki.');
            return;
        }

        setIsSubmitting(true);
        try {
            await qaRequestService.signOff({
                project_id: activeProject.id,
                result: decision,
                notes: leadApprovalNote || null,
            });

            const resultLabel = isPass ? TRACK_STATUS_LABEL.PASSED : TRACK_STATUS_LABEL.FAILED;
            toast.success(`Sign-off Lead QA untuk proyek "${activeProject.name}" berhasil! Status: ${resultLabel}.`);
            addNotification(
                isPass ? 'Sign-off Lead QA: LULUS' : 'Sign-off Lead QA: Dikembalikan',
                isPass
                    ? `Proyek ${activeProject.name} lulus Pengujian QA. Hasil dikembalikan ke PM.`
                    : `Proyek ${activeProject.name} dikembalikan ke pengembangan oleh Lead QA.`,
                isPass ? 'success' : 'warning',
                '/pm/release-request'
            );
            setLeadApprovalNote('');
            setSelectedProject(null);
            refreshData();
        } catch (err) {
            toast.error(err.message || 'Gagal memproses sign-off Lead QA.');
        } finally {
            setIsSubmitting(false);
        }
    };


    // Real SDLC Documents List gathered from all phases
    const projectDocuments = useMemo(() => {
        return getProjectRealDocuments(activeProject);
    }, [activeProject]);


    // Papan klip bisa tidak tersedia (konteks non-HTTPS) atau ditolak izinnya, jadi
    // keberhasilannya harus dipastikan sebelum memberi tahu pengguna — bukan melaporkan
    // sukses secara buta atas salinan kosong/gagal. Cermin pola di `pm/QARequest.jsx`.
    const handleCopyStagingUrl = async (url) => {
        const value = String(url || '').trim();
        if (!value) {
            toast.error('Alamat lingkungan uji masih kosong.');
            return;
        }
        try {
            if (!navigator.clipboard?.writeText) {
                throw new Error('Peramban tidak mengizinkan akses papan klip pada halaman ini.');
            }
            await navigator.clipboard.writeText(value);
            toast.success('Staging URL berhasil disalin!');
        } catch (err) {
            toast.error(`Gagal menyalin alamat: ${err.message}`);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            {/* Header Laman */}
            <div className="mb-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-extrabold text-gray-800">Workspace Lead Quality Assurance (QA)</h2>
                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                            <CheckCircle2 size={14} /> QA Governance &amp; Sign-Off
                        </span>
                        {/* Nama grup ditampilkan supaya jelas kumpulan analis di bawah ini
                            sama dengan yang ada di sisi Perencanaan. */}
                        <span className="px-2.5 py-1 rounded-full bg-[#00529C]/10 text-[#00529C] text-[11px] font-bold border border-[#00529C]/20">
                            {PLANNING_QA_GROUP_LABEL}
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                        Disposisikan pengujian ke analis grup ini — sisi QA maupun sisi Perencanaan — tinjau laporan
                        pengujian, lalu berikan Sign-off resmi Lead QA sebelum diserahkan ke Tim Pengembangan.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LIST PANEL DENGAN TAB SWITCHER (Panel Kiri) */}
                <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[calc(100vh-210px)] overflow-hidden">
                    {/* Tab Navigation */}
                    <div className="flex items-center bg-gray-100 p-1 rounded-xl mb-3 shrink-0">
                        <button
                            onClick={() => {
                                setActiveTab('DISPOSITION');
                                setSelectedProject(null);
                            }}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                activeTab === 'DISPOSITION'
                                    ? 'bg-white text-[#1a365d] shadow-xs'
                                    : 'text-gray-500 hover:text-gray-800'
                            }`}
                        >
                            <UserCheck size={14} />
                            <span>1. Disposisi QA ({qaProjects.length})</span>
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('REVIEW_LEAD');
                                setSelectedProject(null);
                            }}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                activeTab === 'REVIEW_LEAD'
                                    ? 'bg-white text-blue-700 shadow-xs'
                                    : 'text-gray-500 hover:text-gray-800'
                            }`}
                        >
                            <FileCheck size={14} />
                            <span>2. Review Lead ({reviewLeadProjects.length})</span>
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="px-1 pb-3 shrink-0">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={projectSearch}
                                onChange={(e) => setProjectSearch(e.target.value)}
                                placeholder="Cari proyek..."
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* List Proyek */}
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {applyProjectSearch(activeList).length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                                Tidak ada proyek dalam tab ini saat ini.
                            </div>
                        ) : (
                            applyProjectSearch(activeList).map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => {
                                        setSelectedProject(p);
                                        scrollPageToTop();
                                    }}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                        activeProject?.id === p.id
                                            ? 'border-2 border-[#1a365d] bg-blue-50/40 shadow-sm'
                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1.5">
                                        <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{p.id}</span>
                                        <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={p.type} /><ProjectTypeBadge type={p.project_type} /></div>
                                    </div>
                                    <h4 className="font-bold text-gray-800 text-sm line-clamp-1 mb-1.5">{p.name || p.title}</h4>
                                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                                        <span>Divisi: <strong className="text-gray-700">{p.division}</strong></span>
                                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                            p.status === 'QA_PASSED' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                                        }`}>
                                            {p.status}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* DETAIL & REVIEW PANEL (Panel Kanan) */}
                <div ref={rightPanelRef} className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-y-auto h-[calc(100vh-210px)] scroll-smooth">
                    {!activeProject ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm py-20">
                            <Inbox size={48} className="mb-3 text-gray-300" />
                            <p className="font-bold text-gray-600">Pilih Proyek dari Antrean</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Header Detail Proyek */}
                            <div className="pb-4 border-b border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">
                                        {activeProject.id}
                                    </span>
                                    <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={activeProject.type} deadline={activeProject.rbbDeadline} /><ProjectTypeBadge type={activeProject.project_type} /></div>
                                </div>
                                <h3 className="text-xl font-extrabold text-gray-800">{activeProject.name || activeProject.title}</h3>
                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                    <Building size={14} className="text-gray-400" />
                                    <span>Divisi: <strong className="text-gray-700">{activeProject.division}</strong></span>
                                    <span>•</span>
                                    <Calendar size={14} className="text-gray-400" />
                                    <span>Target Finish: <strong className="text-gray-700">{activeProject.targetDate || 'TBD'}</strong></span>
                                </p>
                            </div>

                            {/*
                              Alamat lingkungan uji hanya ditampilkan bila proyeknya memang
                              memilikinya. Sebelumnya `VITE_STAGING_URL` dipakai sebagai
                              cadangan, sehingga alamat bawaan lingkungan tampil seolah-olah
                              itu alamat proyek yang sedang diuji.
                            */}
                            {(activeProject.stagingUrl || activeProject.staging_url) && (
                                <div className="bg-blue-50/60 border border-blue-200 p-3.5 rounded-xl flex items-center justify-between gap-2">
                                    <div className="overflow-hidden">
                                        <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Alamat Lingkungan Uji Proyek</div>
                                        <div className="text-xs font-mono text-blue-700 truncate font-semibold">
                                            {activeProject.stagingUrl || activeProject.staging_url}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleCopyStagingUrl(activeProject.stagingUrl || activeProject.staging_url)}
                                        className="p-1.5 bg-white text-blue-600 hover:bg-blue-100 rounded-lg transition-colors shrink-0 shadow-xs cursor-pointer"
                                        title="Salin alamat lingkungan uji"
                                    >
                                        <Copy size={14} />
                                    </button>
                                </div>
                            )}

                            {/* Deskripsi & Scope System */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <FileText size={15} className="text-[#1a365d]" />
                                    Deskripsi &amp; Lingkup Pengujian QA
                                </h4>
                                <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-xs text-gray-700 leading-relaxed font-medium">
                                    {activeProject.description || 'Pengembangan modul aplikasi dan integrasi layanan perbankan digital SDLC Bank Nagari.'}
                                </div>
                            </div>

                            {/* Catatan Teknis PM / Lead */}
                            {(activeProject.qaNotes || activeProject.qa_notes || activeProject.notes) && (
                                <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1">
                                    <h4 className="text-xs font-extrabold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <Info size={14} className="text-blue-600" />
                                        Catatan Teknis Pengajuan (PM / Pengaju Proyek)
                                    </h4>
                                    <p className="text-xs text-blue-950 font-medium leading-relaxed whitespace-pre-wrap">
                                        {activeProject.qaNotes || activeProject.qa_notes || activeProject.notes}
                                    </p>
                                </div>
                            )}

                            {(activeProject.qaLeadNotes || activeProject.qa_lead_notes) && (
                                <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-xl space-y-1">
                                    <h4 className="text-xs font-extrabold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <Info size={14} className="text-purple-600" />
                                        Arahan &amp; Instruksi Disposisi Lead QA
                                    </h4>
                                    <p className="text-xs text-purple-950 font-medium leading-relaxed whitespace-pre-wrap">
                                        {activeProject.qaLeadNotes || activeProject.qa_lead_notes}
                                    </p>
                                </div>
                            )}


                            {/* Dokumen SDLC & Sign-off */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <FolderOpen size={15} className="text-[#1a365d]" />
                                        Dokumen SDLC &amp; Lembar Sign-Off Resmi ({projectDocuments.length})
                                    </span>
                                </h4>

                                <div className="space-y-2.5">
                                    {projectDocuments.map(doc => (
                                        <div key={doc.id} className="p-3.5 bg-white border border-gray-200 rounded-xl flex items-center justify-between hover:border-blue-300 transition-all shadow-xs">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                                    <FileText size={18} />
                                                </div>
                                                <div className="overflow-hidden">
                                                    <h5 className="font-bold text-gray-800 text-xs truncate">{doc.name}</h5>
                                                    <p className="text-[10px] text-gray-500 mt-0.5">
                                                        {doc.type} • {doc.size}
                                                        {doc.author ? ` • Penulis: ${doc.author}` : ''}
                                                    </p>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => setSelectedDocPreview(doc)}
                                                className="px-3 py-1.5 bg-[#1a365d] hover:bg-[#0f2342] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                                            >
                                                <Eye size={13} />
                                                <span>Pratinjau Dokumen</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* KONTEN BERDASARKAN TAB AKTIF */}
                            {activeTab === 'DISPOSITION' ? (
                                /* TAB 1: FORM DISPOSISI QA TESTER */
                                <div className="p-5 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-4 shadow-xs">
                                    <div className="flex items-center gap-2 border-b border-blue-200/80 pb-3">
                                        <UserCheck size={18} className="text-blue-700" />
                                        <h4 className="font-extrabold text-sm text-blue-900">Form Disposisi Penugasan QA Tester</h4>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                Pilih Anggota QA Tester <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={assignee}
                                                onChange={(e) => setAssignee(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-200"
                                            >
                                                <option value="">-- Pilih QA Tester --</option>
                                                {isQaLoading ? (
                                                    <option value="" disabled>Memuat daftar QA...</option>
                                                ) : qaWorkloads.length === 0 ? (
                                                    <option value="" disabled>Belum ada user QA terdaftar</option>
                                                ) : (
                                                    qaWorkloads.map(a => (
                                                        <option key={a.id} value={a.id}>
                                                            {a.name} (Beban: {a.activeLoad} Proyek Aktif)
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">Instruksi Pengujian Fungsional</label>
                                            <textarea
                                                rows={3}
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                placeholder="Misal: Lakukan pengujian skenario transaksi utama, validasi error message form, dan stress test..."
                                                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                                            />
                                        </div>

                                        <button
                                            onClick={handleAssign}
                                            disabled={isSubmitting}
                                            className="w-full py-3 bg-[#1a365d] hover:bg-[#0f2342] text-white rounded-xl font-bold text-xs md:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                        >
                                            <Send size={16} />
                                            <span>Simpan &amp; Disposisikan ke QA Tester</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* TAB 2: REVIEW & APPROVAL LEAD QA — Membaca Laporan Nyata dari Analis */
                                <div className="p-5 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-4 shadow-xs">
                                    <div className="flex items-center justify-between border-b border-emerald-200/80 pb-3">
                                        <div className="flex items-center gap-2">
                                            <FileCheck size={18} className="text-emerald-700" />
                                            <h4 className="font-extrabold text-sm text-emerald-900">Review Laporan Analis QA &amp; Sign-Off Lead QA</h4>
                                        </div>
                                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                            Menunggu Review Lead
                                        </span>
                                    </div>

                                    {/* Laporan pelaksana pengujian, dibaca dari baris test_reports */}
                                    <TestReportReviewCard
                                        report={qaReport}
                                        testerLabel="Analis QA"
                                        severityLabel="Severity"
                                        notesLabel="Catatan Temuan"
                                        evidenceLabel="Bukti Pengujian / Evidence"
                                        emptyMessage="Laporan dari Analis QA belum masuk. Proyek ini belum selesai diuji."
                                        onPreview={setSelectedDocPreview}
                                    />

                                    {/* Action Review Lead QA */}
                                    <div className="space-y-3 pt-2 border-t border-emerald-200">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-800 mb-1.5">Catatan Verifikasi &amp; Approval Lead QA</label>
                                            <textarea
                                                rows={2}
                                                value={leadApprovalNote}
                                                onChange={(e) => setLeadApprovalNote(e.target.value)}
                                                placeholder="Tuliskan catatan verifikasi & keputusan sign-off Lead QA sebelum dikembalikan ke PM..."
                                                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                            />
                                        </div>

                                        {/*
                                          Dua tombol terpisah, bukan satu tombol yang menyimpulkan keputusan
                                          dari penilaian pelaksana. Lead memang berwenang menolak laporan yang
                                          menyatakan LULUS, dan tanpa tombol kedua ia tidak punya cara
                                          mengembalikan proyek ke pengembangan.
                                        */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            <button
                                                onClick={() => handleSignOff(TEST_RESULT.PASS)}
                                                disabled={isSubmitting || !qaReport}
                                                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs md:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                            >
                                                <CheckCircle size={18} />
                                                <span>Sign-Off LULUS Pengujian QA</span>
                                            </button>
                                            <button
                                                onClick={() => handleSignOff(TEST_RESULT.FAIL)}
                                                disabled={isSubmitting || !qaReport}
                                                className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-extrabold text-xs md:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                            >
                                                <Ban size={18} />
                                                <span>Kembalikan ke Development</span>
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-gray-400 text-center">
                                            Sign-off LULUS diteruskan ke PM Proyek; jika jalur QA dan Audit Keamanan Siber
                                            keduanya LULUS, PM bisa ajukan ke Infrastruktur. Pengembalian wajib menyertakan
                                            alasan agar tim pengembang tahu apa yang harus diperbaiki.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL PRATINJAU DOKUMEN SDLC RESMI */}
            {selectedDocPreview && (
                <DocumentViewerModal
                    doc={selectedDocPreview}
                    project={activeProject}
                    onClose={() => setSelectedDocPreview(null)}
                />
            )}

        </div>
    );
}