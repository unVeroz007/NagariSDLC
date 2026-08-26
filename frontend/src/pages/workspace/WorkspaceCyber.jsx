import { useState, useMemo, useEffect, useRef } from 'react';
import { useProjects } from '../../contexts/ProjectContext';
import { getProjectRealDocuments } from '../../utils/projectDocuments';
import { useNotifications } from '../../contexts/NotificationContext';
import { userService, cyberRequestService } from '../../services/api';
import RBBBadge from '../../components/RBBBadge';
import ProjectTypeBadge from '../../components/ProjectTypeBadge';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import TestReportReviewCard from '../../components/TestReportReviewCard';
import {
    TRACK_STATUS,
    TRACK_STATUS_LABEL,
    getCyberTrackStatus,
} from '../../constants/projectStatus';
import { CYBER_CHECK_TYPE, getCyberCheckTypeOption } from '../../constants/cyberCheckType';
import { TEST_RESULT } from '../../constants/testResult';
import { isCyberDispositionEligible } from '../../constants/cyberRoles';
import toast from 'react-hot-toast';

import {
    FolderOpen,
    Copy,
    Send,
    Ban,
    Calendar,
    Search,
    FileText,
    Eye,
    Inbox,
    ShieldAlert,
    UserCheck,
    Building,
    FileCheck,
    ShieldCheck,
    Info,
} from 'lucide-react';

export default function WorkspaceCyber() {
    const { projects, refreshData } = useProjects();
    const { addNotification } = useNotifications();

    // 🔄 Anggota audit Keamanan Siber diambil dari user API, bukan hardcode.
    // Beban aktif dihitung realtime dari proyek nyata.
    //
    // Penyaringnya `isCyberDispositionEligible` (`constants/cyberRoles.js`, cermin
    // `TestingTrack::CYBER->testerRoles()`). Uji substring `'cyber'`/`'pentest'` yang
    // dipakai sebelumnya bisa ikut meloloskan role baru mana pun yang namanya kebetulan
    // memuat kata itu — anti-pattern yang sama sudah dibetulkan di Workspace QA.
    const [pentestAuditors, setPentestAuditors] = useState([]);
    const [isCyberLoading, setIsCyberLoading] = useState(true);

    // Beban aktif per pengguna: { [userId]: jumlah }. Dihitung server-side
    // (`GET /users/workload`), lihat catatan panjang di `cyberWorkloads` di bawah.
    const [workloadMap, setWorkloadMap] = useState({});

    useEffect(() => {
        let isMounted = true;
        userService.getAll()
            .then(res => {
                if (!isMounted) return;
                const usersList = Array.isArray(res) ? res : res?.data || [];
                const cyberUsers = usersList.filter(isCyberDispositionEligible);
                setPentestAuditors(cyberUsers.map(u => ({
                    id: u.id,
                    name: u.name,
                    role: u.division_detail?.name || u.division || 'Pentester',
                    email: u.email,
                    activeLoad: 0,
                })));
            })
            .catch(() => setPentestAuditors([]))
            .finally(() => { if (isMounted) setIsCyberLoading(false); });
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

    // 🔢 Beban aktif per pentester — total lintas fase dari backend.
    //
    // Dulu dihitung di klien dari `projects`, tetapi `applyVisibilityScope()` membatasi
    // proyek yang diterima Cyber Lead pada fase pengujian saja. Angka kini datang dari
    // `GET /users/workload` (gabungan Perencanaan + QA + Siber dari SELURUH proyek),
    // dicocokkan per id — bukan nama. Untuk pentester murni komponen Perencanaan & QA
    // biasanya nol sehingga angkanya sama dengan beban audit; endpoint tetap dipakai agar
    // definisi beban seragam dengan layar QA dan lepas dari batas visibilitas Lead.
    const cyberWorkloads = useMemo(
        () => (pentestAuditors || []).map(a => ({ ...a, activeLoad: workloadMap[a.id] ?? 0 })),
        [pentestAuditors, workloadMap]
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

    // Tab 1 (Disposisi): proyek yang sudah diajukan PM dan menunggu penunjukan pentester.
    //
    // Disaring dari kolom jalur saja. Sebelumnya daftar ini juga mencocokkan
    // `cyberAssignee` dengan nama pengguna — padahal proyek yang belum didisposisikan
    // memang belum punya penerima, sehingga antrean Lead selalu tampak kosong.
    const cyberProjects = useMemo(
        () => (projects || []).filter(p => getCyberTrackStatus(p) === TRACK_STATUS.SUBMITTED),
        [projects]
    );

    // Tab 2 (Review Lead): laporan pentester sudah masuk dan menunggu sign-off.
    const reviewLeadProjects = useMemo(
        () => (projects || []).filter(p => getCyberTrackStatus(p) === TRACK_STATUS.REVIEW),
        [projects]
    );

    const activeList = activeTab === 'DISPOSITION' ? cyberProjects : reviewLeadProjects;
    const [selectedProject, setSelectedProject] = useState(null);
    const activeProject = selectedProject || activeList[0] || null;

    const [selectedPentester, setSelectedPentester] = useState('');
    const [instructions, setInstructions] = useState('');
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

    // Laporan pentester yang sudah tersimpan di database.
    const cyberReport = activeProject?.cyberReport || null;

    // Jenis pemeriksaan pilihan PM menentukan istilah dan masukan yang ditampilkan.
    const checkTypeOption = getCyberCheckTypeOption(activeProject?.cyberCheckType);
    const checkTypeInputValue = activeProject?.cyberCheckType === CYBER_CHECK_TYPE.SECURE_CODE
        ? activeProject?.cyberSourceCodeRef
        : activeProject?.cyberTargetUrl;

    const handleAssign = async () => {
        if (!activeProject) return;
        if (!selectedPentester) {
            toast.error('Pilih Pentester / Security Auditor terlebih dahulu!');
            return;
        }
        setIsSubmitting(true);
        try {
            // Disposisi dikirim ke endpoint jalur Siber, bukan lewat pembaruan proyek umum.
            // Endpoint inilah yang menuliskan `cyber_assignee_id`, memindahkan status jalur
            // ke IN_PROGRESS, mencatat audit, dan memberi tahu pentester yang ditunjuk.
            const assigneeName = cyberWorkloads.find(a => Number(a.id) === Number(selectedPentester))?.name
                || 'Security Auditor';

            await cyberRequestService.assign({
                project_id: activeProject.id,
                assignee_id: Number(selectedPentester),
                notes: instructions || null,
            });

            toast.success(`Proyek ${activeProject.name} berhasil didisposisikan ke Security Auditor (${assigneeName})!`);
            addNotification('Disposisi Pentest', `Proyek ${activeProject.name} telah didisposisikan ke ${assigneeName}.`, 'info');
            setSelectedPentester('');
            setInstructions('');
            refreshData();
        } catch (err) {
            toast.error(err.message || 'Gagal menyimpan disposisi Pentester.');
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Sign-off Lead Siber — keputusan diambil Lead, bukan disimpulkan dari hasil pentester.
     *
     * Sebelumnya satu tombol menyimpulkan keputusan dari `auditorResult.isPass`, sehingga
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
            await cyberRequestService.signOff({
                project_id: activeProject.id,
                result: decision,
                notes: leadApprovalNote || null,
            });

            const resultLabel = isPass ? TRACK_STATUS_LABEL.PASSED : TRACK_STATUS_LABEL.FAILED;
            toast.success(`Sign-off Lead Siber untuk proyek "${activeProject.name}" berhasil! Status: ${resultLabel}.`);
            addNotification(
                isPass ? 'Sign-off Lead Siber: LULUS' : 'Sign-off Lead Siber: Dikembalikan',
                isPass
                    ? `Proyek ${activeProject.name} lulus Audit Keamanan Siber. Hasil dikembalikan ke PM.`
                    : `Proyek ${activeProject.name} dikembalikan ke pengembangan oleh Lead Siber.`,
                isPass ? 'success' : 'warning',
                '/pm/release-request'
            );
            setLeadApprovalNote('');
            setSelectedProject(null);
            refreshData();
        } catch (err) {
            toast.error(err.message || 'Gagal memproses sign-off Lead Siber.');
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
    const handleCopyValue = async (value) => {
        const text = String(value || '').trim();
        if (!text) {
            toast.error('Nilai yang akan disalin masih kosong.');
            return;
        }
        try {
            if (!navigator.clipboard?.writeText) {
                throw new Error('Peramban tidak mengizinkan akses papan klip pada halaman ini.');
            }
            await navigator.clipboard.writeText(text);
            toast.success('Berhasil disalin ke papan klip!');
        } catch (err) {
            toast.error(`Gagal menyalin: ${err.message}`);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            {/* Header Laman */}
            <div className="mb-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-extrabold text-gray-800">Workspace Lead Cyber Security</h2>
                        <span className="bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                            <ShieldAlert size={14} /> Cybersecurity Governance &amp; Sign-Off
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                        Disposisikan Penetration Tester, tinjau temuan celah keamanan, dan berikan persetujuan Sign-off resmi Lead Cyber sebelum diserahkan ke Tim Pengembangan.
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
                                    ? 'bg-white text-orange-700 shadow-xs'
                                    : 'text-gray-500 hover:text-gray-800'
                            }`}
                        >
                            <UserCheck size={14} />
                            <span>1. Disposisi Pentest ({cyberProjects.length})</span>
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('REVIEW_LEAD');
                                setSelectedProject(null);
                            }}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                activeTab === 'REVIEW_LEAD'
                                    ? 'bg-white text-[#1a365d] shadow-xs'
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
                                            ? 'border-2 border-orange-600 bg-orange-50/40 shadow-sm'
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
                                            p.status === 'CYBER_PASSED' ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
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
                                    <span>Target Finish: <strong className="text-gray-700">{activeProject.targetDate || '2026-10-01'}</strong></span>
                                </p>
                            </div>

                            {/*
                              Jenis pemeriksaan yang dipilih PM beserta masukannya.
                              Pentest menguji aplikasi yang berjalan (butuh alamat web),
                              Secure Code Review menelaah kode (butuh rujukan kode sumber),
                              jadi blok ini menampilkan tepat satu di antaranya.
                            */}
                            <div className="bg-orange-50/60 border border-orange-200 p-3.5 rounded-xl space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">
                                        Jenis Pemeriksaan Keamanan Siber
                                    </div>
                                    <span className="bg-orange-600 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0">
                                        {checkTypeOption?.label || 'Belum Ditentukan'}
                                    </span>
                                </div>

                                {checkTypeOption ? (
                                    <>
                                        <p className="text-[11px] text-orange-950/80 leading-relaxed">
                                            {checkTypeOption.description}
                                        </p>
                                        <div className="flex items-center justify-between gap-2 bg-white border border-orange-200 rounded-lg px-3 py-2">
                                            <div className="overflow-hidden">
                                                <div className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">
                                                    {checkTypeOption.inputLabel}
                                                </div>
                                                <div className="text-xs font-mono text-orange-700 truncate font-semibold">
                                                    {checkTypeInputValue || 'Belum diisi PM'}
                                                </div>
                                            </div>
                                            {checkTypeInputValue && (
                                                <button
                                                    onClick={() => handleCopyValue(checkTypeInputValue)}
                                                    className="p-1.5 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors shrink-0 cursor-pointer"
                                                    title={`Salin ${checkTypeOption.inputLabel}`}
                                                >
                                                    <Copy size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-[11px] text-orange-950/80 leading-relaxed">
                                        PM belum memilih jenis pemeriksaan pada pengajuan ini. Konfirmasikan ke PM
                                        sebelum disposisi agar pentester menguji hal yang benar.
                                    </p>
                                )}
                            </div>

                            {/* Deskripsi & Scope System */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <FileText size={15} className="text-[#1a365d]" />
                                    Deskripsi &amp; Lingkup Sistem yang Di-Audit
                                </h4>
                                <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-xs text-gray-700 leading-relaxed font-medium">
                                    {activeProject.description || 'Pengembangan sistem perbankan digital Bank Nagari. Wajib melalui audit pengerasan jaringan (hardening) dan tes penetration test.'}
                                </div>
                            </div>

                            {/* Catatan Teknis PM / Lead */}
                            {(activeProject.cyberNotes || activeProject.cyber_notes || activeProject.notes) && (
                                <div className="p-4 bg-orange-50/80 border border-orange-200 rounded-xl space-y-1">
                                    <h4 className="text-xs font-extrabold text-orange-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <Info size={14} className="text-orange-600" />
                                        Catatan Teknis Pengajuan (PM / Pengaju Proyek)
                                    </h4>
                                    <p className="text-xs text-orange-950 font-medium leading-relaxed whitespace-pre-wrap">
                                        {activeProject.cyberNotes || activeProject.cyber_notes || activeProject.notes}
                                    </p>
                                </div>
                            )}

                            {(activeProject.cyberLeadNotes || activeProject.cyber_lead_notes) && (
                                <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-xl space-y-1">
                                    <h4 className="text-xs font-extrabold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <Info size={14} className="text-purple-600" />
                                        Arahan &amp; Instruksi Disposisi Lead Siber
                                    </h4>
                                    <p className="text-xs text-purple-950 font-medium leading-relaxed whitespace-pre-wrap">
                                        {activeProject.cyberLeadNotes || activeProject.cyber_lead_notes}
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
                                        <div key={doc.id} className="p-3.5 bg-white border border-gray-200 rounded-xl flex items-center justify-between hover:border-orange-300 transition-all shadow-xs">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
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
                                /* TAB 1: FORM DISPOSISI PENTESTER */
                                <div className="p-5 bg-orange-50/60 rounded-2xl border border-orange-200 space-y-4 shadow-xs">
                                    <div className="flex items-center gap-2 border-b border-orange-200/80 pb-3">
                                        <UserCheck size={18} className="text-orange-700" />
                                        <h4 className="font-extrabold text-sm text-orange-900">Form Disposisi Penetration Tester (Security Auditor)</h4>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                Pilih Security Auditor / Pentester <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={selectedPentester}
                                                onChange={(e) => setSelectedPentester(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-200"
                                            >
                                                <option value="">-- Pilih Security Auditor --</option>
                                                {isCyberLoading ? (
                                                    <option value="" disabled>Memuat daftar pentester...</option>
                                                ) : cyberWorkloads.length === 0 ? (
                                                    <option value="" disabled>Belum ada user Cyber terdaftar</option>
                                                ) : (
                                                    cyberWorkloads.map(a => (
                                                        <option key={a.id} value={a.id}>
                                                            {a.name} - {a.role} (Beban: {a.activeLoad} Proyek Aktif)
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">Instruksi Khusus &amp; Scope Pentest</label>
                                            <textarea
                                                rows={3}
                                                value={instructions}
                                                onChange={(e) => setInstructions(e.target.value)}
                                                placeholder="Misal: Lakukan uji penetration test pada endpoint API login, pengujian otentikasi JWT, SQL Injection..."
                                                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                                            />
                                        </div>

                                        <button
                                            onClick={handleAssign}
                                            disabled={isSubmitting}
                                            className="w-full py-3 bg-[#1a365d] hover:bg-[#0f2342] text-white rounded-xl font-bold text-xs md:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                        >
                                            <Send size={16} />
                                            <span>Simpan &amp; Disposisikan Audit Pentest</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* TAB 2: REVIEW & APPROVAL LEAD CYBER — Membaca Laporan Nyata dari Pentester */
                                <div className="p-5 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-4 shadow-xs">
                                    <div className="flex items-center justify-between border-b border-emerald-200/80 pb-3">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck size={18} className="text-emerald-700" />
                                            <h4 className="font-extrabold text-sm text-emerald-900">Review Laporan Pentest &amp; Sign-Off Lead Cyber</h4>
                                        </div>
                                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                            Menunggu Review Lead
                                        </span>
                                    </div>

                                    {/* Laporan pentester, dibaca dari baris test_reports */}
                                    <TestReportReviewCard
                                        report={cyberReport}
                                        testerLabel="Auditor"
                                        severityLabel="Tingkat Risiko"
                                        notesLabel="Catatan Temuan Kerentanan"
                                        evidenceLabel="Laporan & Evidence Pentest"
                                        emptyMessage="Laporan dari Pentester belum masuk. Proyek ini belum selesai diaudit."
                                        onPreview={setSelectedDocPreview}
                                    />

                                    {/* Action Review Lead Cyber */}
                                    <div className="space-y-3 pt-2 border-t border-emerald-200">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-800 mb-1.5">Catatan Verifikasi &amp; Approval Lead Cyber Security</label>
                                            <textarea
                                                rows={2}
                                                value={leadApprovalNote}
                                                onChange={(e) => setLeadApprovalNote(e.target.value)}
                                                placeholder="Tuliskan catatan verifikasi & keputusan sign-off Lead Cyber sebelum dikembalikan ke PM..."
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
                                                disabled={isSubmitting || !cyberReport}
                                                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs md:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                            >
                                                <ShieldCheck size={18} />
                                                <span>Sign-Off LULUS Audit Keamanan</span>
                                            </button>
                                            <button
                                                onClick={() => handleSignOff(TEST_RESULT.FAIL)}
                                                disabled={isSubmitting || !cyberReport}
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