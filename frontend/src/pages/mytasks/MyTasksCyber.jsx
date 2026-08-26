import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useProjects } from "../../contexts/ProjectContext";
import { getProjectRealDocuments } from "../../utils/projectDocuments";
import { useNotifications } from "../../contexts/NotificationContext";
import RBBBadge from "../../components/RBBBadge";
import ProjectTypeBadge from "../../components/ProjectTypeBadge";
import DocumentViewerModal from "../../components/DocumentViewerModal";
import EvidenceUploader from "../../components/EvidenceUploader";
import toast from "react-hot-toast";
import { cyberRequestService, documentService } from "../../services/api";
import { DOCUMENT_TYPES } from "../../utils/documentNaming";
import { uploadEvidenceFiles } from "../../utils/evidenceUpload";
import { TRACK_STATUS, TRACK_STATUS_LABEL, getCyberTrackStatus } from "../../constants/projectStatus";
import { TEST_RESULT, TESTER_RESULT_OPTIONS, testResultRequiresNotes } from "../../constants/testResult";
import {
    CYBER_CHECK_TYPE,
    getCyberCheckTypeOption,
} from "../../constants/cyberCheckType";
import {
    Shield, FileText, Eye, AlertTriangle,
    User, FolderOpen, Copy, ShieldAlert, Building,
    Info, Send, Download, Calendar,
    ShieldCheck, Search, Filter
} from "lucide-react";

/**
 * Peran yang boleh mengirim laporan audit untuk proyek yang bukan disposisinya.
 *
 * Cerminan `TestingTrackService::assertActorMaySubmitReport()` untuk jalur Siber. Berbeda
 * dari jalur QA, `lead_group` sengaja tidak termasuk: wewenang jalur Keamanan Siber
 * memang lebih sempit pada matriks backend.
 */
const CYBER_PRIVILEGED_ROLES = ['cyber_lead', 'super_admin'];

export default function MyTasksCyber() {
    const { user } = useAuth();
    const { projects, refreshData } = useProjects();
    const { addNotification } = useNotifications();

    // Lead Keamanan Siber dan Super Admin melihat seluruh antrean audit yang sedang
    // berjalan; pelaksana lain hanya melihat disposisi miliknya sendiri.
    const isPrivileged = CYBER_PRIVILEGED_ROLES.includes(user?.role);

    // Penyaring daftar milik pengguna: teks pencarian dan — khusus role yang melihat
    // seluruh antrean — pilihan pelaksana tertentu. Keduanya hanya mempersempit tugas
    // yang sudah menjadi hak pengguna; tak satu pun melebarkan visibilitasnya.
    const [searchTerm, setSearchTerm] = useState('');
    const [assigneeFilter, setAssigneeFilter] = useState('ALL');

    /**
     * Tugas audit aktif milik pengguna ini.
     *
     * Disaring dari kolom jalur `cyber_status` dan ID penerima disposisi, bukan dari
     * pencocokan nama pada `cyberAssignee` seperti sebelumnya.
     */
    const cyberTasks = useMemo(() => {
        const inProgress = (projects || []).filter(
            (project) => getCyberTrackStatus(project) === TRACK_STATUS.IN_PROGRESS
        );

        if (isPrivileged) return inProgress;

        return inProgress.filter(
            (project) => Number(project.cyberAssigneeId) === Number(user?.id)
        );
    }, [projects, user, isPrivileged]);

    /**
     * Pilihan pelaksana untuk dropdown filter, diturunkan dari tugas yang sedang
     * berjalan dan berkunci pada ID penerima disposisi supaya penyaringannya tidak
     * bergantung pada nama yang bisa sama antar pegawai. Hanya berarti bagi role yang
     * melihat seluruh antrean.
     */
    const assigneeOptions = useMemo(() => {
        const nameById = new Map();
        cyberTasks.forEach((task) => {
            const id = Number(task.cyberAssigneeId);
            if (!Number.isFinite(id) || id <= 0 || nameById.has(id)) return;
            nameById.set(id, task.cyberAssignee || `Pelaksana #${id}`);
        });
        return [...nameById.entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'id'));
    }, [cyberTasks]);

    /**
     * Daftar yang benar-benar ditampilkan: tugas milik pengguna, dipersempit filter
     * pelaksana (bila aktif) lalu teks pencarian pada ID, nama, dan divisi proyek.
     */
    const visibleTasks = useMemo(() => {
        let result = cyberTasks;

        if (isPrivileged && assigneeFilter !== 'ALL') {
            const id = Number(assigneeFilter);
            result = result.filter((task) => Number(task.cyberAssigneeId) === id);
        }

        const term = searchTerm.trim().toLowerCase();
        if (term) {
            result = result.filter((task) =>
                String(task.reqId || task.id || '').toLowerCase().includes(term) ||
                String(task.name || task.title || '').toLowerCase().includes(term) ||
                String(task.division || '').toLowerCase().includes(term)
            );
        }

        return result;
    }, [cyberTasks, isPrivileged, assigneeFilter, searchTerm]);

    const hasActiveFilter = searchTerm.trim() !== '' || (isPrivileged && assigneeFilter !== 'ALL');
    const emptyListMessage = hasActiveFilter
        ? 'Tidak ada tugas yang cocok dengan pencarian atau filter.'
        : isPrivileged
            ? 'Belum ada tugas audit keamanan siber yang sedang berjalan saat ini.'
            : 'Tidak ada tugas audit keamanan siber yang didisposisikan kepada Anda saat ini.';

    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const activeTask = useMemo(
        () => visibleTasks.find((task) => task.id === selectedTaskId) || visibleTasks[0] || null,
        [visibleTasks, selectedTaskId]
    );

    const [testResult, setTestResult] = useState('');
    const [cyberNotes, setCyberNotes] = useState('');
    const [riskLevel, setRiskLevel] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedDocPreview, setSelectedDocPreview] = useState(null);
    const [evidenceFiles, setEvidenceFiles] = useState([]);
    const rightPanelRef = useRef(null);

    // Cakupan pemeriksaan ditulis bebas oleh pelaksana, bukan dipilih dari daftar tetap.
    // Backend menyimpannya di `test_reports.tested_scenarios` — kolom yang sama dengan
    // jalur QA. Sebelumnya jalur Siber tidak pernah mengirim field ini, sehingga laporan
    // audit tidak mencatat ruang lingkup yang benar-benar dijalankan.
    const [testedScenarios, setTestedScenarios] = useState('');

    /**
     * Jenis pemeriksaan pilihan Analis Pengembangan menentukan masukan mana yang
     * ditampilkan di layar ini: alamat web untuk Penetration Test, atau rujukan kode
     * sumber untuk Secure Code Review.
     *
     * Jenis pemeriksaan sengaja tidak menentukan daftar skenario wajib. Ruang lingkup
     * audit keamanan berbeda pada tiap proyek, sehingga pelaksana menarasikan lingkup
     * dan temuannya pada catatan laporan.
     */
    const checkTypeOption = getCyberCheckTypeOption(activeTask?.cyberCheckType);
    const checkTypeInputValue = activeTask?.cyberCheckType === CYBER_CHECK_TYPE.SECURE_CODE
        ? activeTask?.cyberSourceCodeRef
        : activeTask?.cyberTargetUrl;

    // Isi formulir adalah draf milik satu tugas. Saat tugas aktif atau jenis
    // pemeriksaannya berganti, draf disusun ulang pada render yang sama (pola
    // "sesuaikan state saat prop berubah"). Sebelumnya dua effect melakukannya
    // setelah render, sehingga layar sempat menampilkan jawaban tugas sebelumnya.
    const draftKey = `${activeTask?.id ?? ''}:${activeTask?.cyberCheckType ?? ''}`;
    const [syncedDraftKey, setSyncedDraftKey] = useState(draftKey);
    if (draftKey !== syncedDraftKey) {
        setSyncedDraftKey(draftKey);
        setTestResult('');
        setCyberNotes('');
        setRiskLevel('');
        setEvidenceFiles([]);
        setTestedScenarios('');
    }

    const scrollPageToTop = () => {
        if (rightPanelRef.current) rightPanelRef.current.scrollTo({ top: 0, behavior: "smooth" });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Gulir ke atas hanya saat task yang dibuka berganti — objek task dibuat ulang
    // setiap polling, jadi yang dipantau id-nya.
    const activeTaskId = activeTask?.id ?? null;
    useEffect(() => { if (activeTaskId) scrollPageToTop(); }, [activeTaskId]);

    const notesRequired = testResult !== '' && testResultRequiresNotes(testResult);

    /** Unduh dokumen lewat service yang menyertakan token — endpoint unduhan memeriksa hak akses. */
    const handleDownload = async (doc) => {
        try {
            const blob = await documentService.download(doc.id);
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = objectUrl;
            anchor.download = String(doc.name || `dokumen-${doc.id}`).replace(/[\\/]/g, '-');
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(objectUrl);
        } catch (err) {
            toast.error(err.message || 'Gagal mengunduh dokumen.');
        }
    };

    /**
     * Kirim laporan audit keamanan siber.
     *
     * Berkas laporan pentest diunggah lebih dulu ke lemari dokumen proyek sebagai tipe
     * CYBER_EVIDENCE, lalu ID dokumennya dirujuk laporan. Laporan berhenti di status
     * REVIEW — keputusan lulus atau kembali ke pengembangan tetap milik Lead Keamanan
     * Siber pada sign-off.
     */
    const handleSubmitReport = async () => {
        if (!activeTask) return;

        if (!testResult) {
            toast.error('Pilih penilaian hasil audit lebih dulu.');
            return;
        }

        if (testResultRequiresNotes(testResult) && !cyberNotes.trim()) {
            toast.error('Catatan temuan wajib diisi untuk hasil selain "Lulus".');
            return;
        }

        setIsSubmitting(true);

        try {
            const uploadedEvidence = evidenceFiles.length > 0
                ? await uploadEvidenceFiles(evidenceFiles, {
                    projectId: activeTask.id,
                    documentType: DOCUMENT_TYPES.CYBER_EVIDENCE.code,
                    // Penanda konteks memakai jenis pemeriksaan agar nama dokumen bukti
                    // langsung menunjukkan ruang lingkup temuannya.
                    contextLabel: activeTask.cyberCheckType === CYBER_CHECK_TYPE.SECURE_CODE
                        ? 'SECURE-CODE'
                        : 'PENTEST',
                })
                : [];

            await cyberRequestService.submitReport({
                project_id: activeTask.id,
                result: testResult,
                notes: cyberNotes.trim() || null,
                severity: riskLevel || null,
                tested_scenarios: testedScenarios.trim() || null,
                evidence_document_ids: uploadedEvidence.map((item) => item.id),
            });

            const resultLabel = TESTER_RESULT_OPTIONS.find(o => o.value === testResult)?.label || testResult;

            toast.success(`Laporan Audit Keamanan Siber (${resultLabel}) untuk "${activeTask.name}" berhasil dikirim.`);
            addNotification(
                'Laporan Audit Keamanan Menunggu Review',
                `Laporan dari ${user?.name || 'Pentester'} untuk ${activeTask.name} menunggu sign-off Lead Keamanan Siber.`,
                testResult === TEST_RESULT.FAIL ? 'warning' : 'success',
                '/workspace/cyber'
            );

            setTestResult(''); setCyberNotes(''); setRiskLevel(''); setTestedScenarios('');
            setEvidenceFiles([]);
            setSelectedTaskId(null);
            refreshData();
        } catch (err) {
            toast.error(err.message || 'Gagal mengirim laporan audit keamanan siber.');
        } finally {
            setIsSubmitting(false);
        }
    };

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

    const projectDocsList = useMemo(() => getProjectRealDocuments(activeTask), [activeTask]);

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            <div className="mb-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-extrabold text-gray-800">Tugas Audit Keamanan Siber</h2>
                        <span className="bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                            <ShieldCheck size={14} /> Pelaksanaan Pemeriksaan Keamanan
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">Kerjakan pemeriksaan sesuai jenis yang diminta, tuliskan ruang lingkup dan temuannya, unggah laporan, lalu kirim ke Lead Keamanan Siber untuk sign-off.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[calc(100vh-210px)] overflow-hidden">
                    <div className="shrink-0 pb-3 border-b border-gray-100 mb-3 space-y-3">
                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            <Shield size={16} className="text-orange-600" /> Daftar Tugas Audit Siber ({visibleTasks.length})
                        </h3>

                        {/* Pencarian daftar — tersedia untuk semua pelaksana */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Cari ID / nama proyek / divisi..."
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
                            />
                        </div>

                        {/* Filter per pelaksana — hanya untuk role yang melihat seluruh antrean */}
                        {isPrivileged && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setAssigneeFilter('ALL')}
                                    className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${assigneeFilter === 'ALL' ? 'bg-[#1a365d] text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    <Filter size={12} /> Semua ({cyberTasks.length})
                                </button>
                                <select
                                    value={assigneeFilter === 'ALL' ? '' : assigneeFilter}
                                    onChange={(e) => setAssigneeFilter(e.target.value || 'ALL')}
                                    disabled={assigneeOptions.length === 0}
                                    className="flex-1 min-w-0 px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-gray-200 bg-white text-gray-700 outline-none focus:border-orange-500 disabled:bg-gray-50 disabled:text-gray-400"
                                >
                                    <option value="">
                                        {assigneeOptions.length === 0 ? '-- Belum ada disposisi --' : '-- Filter per pelaksana --'}
                                    </option>
                                    {assigneeOptions.map((a) => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {visibleTasks.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                                <Shield size={36} className="mx-auto mb-2 text-gray-200" />
                                {emptyListMessage}
                            </div>
                        ) : visibleTasks.map(t => (
                            <div key={t.id} onClick={() => { setSelectedTaskId(t.id); scrollPageToTop(); }}
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${activeTask?.id === t.id ? "border-2 border-[#1a365d] bg-orange-50/40 shadow-sm" : "border-gray-200 hover:border-gray-300 bg-white"}`}>
                                <div className="flex justify-between items-start mb-1.5">
                                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{t.reqId || t.id}</span>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <RBBBadge type={t.type} />
                                        <ProjectTypeBadge type={t.project_type} />
                                    </div>
                                </div>
                                <h4 className="font-bold text-gray-800 text-sm line-clamp-1 mb-1.5">{t.name || t.title}</h4>
                                {t.cyberCheckTypeLabel && (
                                    <span className="inline-block mb-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                        {t.cyberCheckTypeLabel}
                                    </span>
                                )}
                                <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                                    <span>Divisi: <strong className="text-gray-700">{t.division}</strong></span>
                                    <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-orange-100 text-orange-800">
                                        {TRACK_STATUS_LABEL[getCyberTrackStatus(t)] || getCyberTrackStatus(t)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div ref={rightPanelRef} className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-y-auto h-[calc(100vh-210px)] scroll-smooth">
                    {!activeTask ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm py-20">
                            <FolderOpen size={48} className="mb-3 text-gray-300" />
                            <p className="font-bold text-gray-600">Pilih Tugas Audit dari Panel Kiri</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="pb-4 border-b border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">{activeTask.reqId || activeTask.id}</span>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <RBBBadge type={activeTask.type} deadline={activeTask.rbbDeadline} />
                                        <ProjectTypeBadge type={activeTask.project_type} />
                                    </div>
                                </div>
                                <h3 className="text-xl font-extrabold text-gray-800">{activeTask.name || activeTask.title}</h3>
                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                                    <Building size={14} className="text-gray-400" />
                                    <span>Divisi: <strong className="text-gray-700">{activeTask.division}</strong></span>
                                    <span className="text-gray-300 mx-1">|</span>
                                    <Calendar size={14} className="text-gray-400" />
                                    <span>Target: <strong className="text-gray-700">{activeTask.targetDate || "TBD"}</strong></span>
                                    {activeTask.cyberAssignee && (<><span className="text-gray-300 mx-1">|</span><User size={14} className="text-gray-400" /><span>Ditugaskan: <strong className="text-orange-700">{activeTask.cyberAssignee}</strong></span></>)}
                                </p>
                            </div>

                            {/*
                              Ruang lingkup pemeriksaan. Hanya satu masukan yang ditampilkan —
                              yang relevan dengan jenis pemeriksaan pilihan pengaju — supaya
                              pelaksana tidak mengerjakan ruang lingkup yang salah.
                            */}
                            {checkTypeOption ? (
                                <div className="bg-orange-50/60 border border-orange-200 p-4 rounded-xl space-y-3">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">Jenis Pemeriksaan Diminta</span>
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-orange-600 text-white">
                                            {checkTypeOption.label}
                                        </span>
                                    </div>
                                    <p className="text-xs text-orange-950 leading-relaxed font-medium">{checkTypeOption.description}</p>
                                    <div className="bg-white border border-orange-200 rounded-xl p-3 flex items-center justify-between gap-3">
                                        <div className="overflow-hidden">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{checkTypeOption.inputLabel}</div>
                                            <div className="text-xs font-mono text-orange-700 font-bold mt-0.5 break-all">
                                                {checkTypeInputValue || <span className="italic font-sans font-normal text-gray-400">Belum diisi pengaju.</span>}
                                            </div>
                                        </div>
                                        {checkTypeInputValue && (
                                            <button onClick={() => handleCopyValue(checkTypeInputValue)}
                                                className="px-3 py-1.5 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-lg transition-colors text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1.5">
                                                <Copy size={13} /><span>Salin</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-900 font-medium flex items-start gap-2">
                                    <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                                    <span>
                                        Jenis pemeriksaan belum tercatat pada proyek ini, sehingga ruang lingkup yang
                                        diminta pengaju tidak dapat ditampilkan. Minta pengaju mengajukan ulang dengan
                                        memilih jenis pemeriksaan sebelum audit dikerjakan.
                                    </span>
                                </div>
                            )}

                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <FileText size={15} className="text-[#1a365d]" /> Lingkup &amp; Spesifikasi Kebutuhan Audit
                                </h4>
                                <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-xs text-gray-700 leading-relaxed font-medium">
                                    {activeTask.description || "Tidak ada deskripsi kebutuhan yang dilampirkan pada proyek ini."}
                                </div>
                            </div>

                            {(activeTask.cyberNotes || activeTask.cyber_notes) && (
                                <div className="p-4 bg-orange-50/80 border border-orange-200 rounded-xl space-y-1">
                                    <h4 className="text-xs font-extrabold text-orange-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <Info size={14} className="text-orange-600" /> Catatan Teknis Pengajuan (Analis Pengembangan)
                                    </h4>
                                    <p className="text-xs text-orange-950 font-medium leading-relaxed whitespace-pre-wrap">{activeTask.cyberNotes || activeTask.cyber_notes}</p>
                                </div>
                            )}

                            {(activeTask.cyberLeadNotes || activeTask.cyber_lead_notes) && (
                                <div className="p-4 bg-red-50/80 border-2 border-red-300 rounded-xl space-y-1">
                                    <h4 className="text-xs font-extrabold text-red-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <ShieldAlert size={14} className="text-red-600" /> Arahan &amp; Instruksi Khusus dari Lead Keamanan Siber
                                    </h4>
                                    <p className="text-xs text-red-950 font-medium leading-relaxed whitespace-pre-wrap">
                                        {activeTask.cyberLeadNotes || activeTask.cyber_lead_notes}
                                    </p>
                                </div>
                            )}

                            {/* Dokumen Prasyarat */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <FolderOpen size={15} className="text-[#1a365d]" /> Dokumen SDLC Prasyarat Terlampir ({projectDocsList.length})
                                </h4>
                                <div className="space-y-2">
                                    {projectDocsList.length === 0 ? (
                                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-400 italic text-center">Belum ada dokumen prasyarat terlampir.</div>
                                    ) : projectDocsList.map(doc => (
                                        <div key={doc.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between hover:border-orange-300 transition-all">
                                            <div className="flex items-center gap-2.5 overflow-hidden">
                                                <FileText size={16} className="text-orange-600 shrink-0" />
                                                <div className="truncate">
                                                    <span className="font-bold text-gray-800 text-xs truncate block">{doc.name}</span>
                                                    <span className="text-[10px] text-gray-500">{doc.type} • {doc.size}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button type="button" onClick={() => setSelectedDocPreview(doc)}
                                                    className="px-2.5 py-1 bg-[#1a365d] text-white rounded-lg text-xs font-bold hover:bg-[#0f2342] transition-all flex items-center gap-1 cursor-pointer">
                                                    <Eye size={12} /> Pratinjau
                                                </button>
                                                <button type="button" onClick={() => handleDownload(doc)}
                                                    className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-1 cursor-pointer">
                                                    <Download size={12} /> Unduh
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Ruang lingkup ditulis bebas: cakupan audit keamanan berbeda tiap
                                proyek, jadi pelaksana menarasikan skenario yang dijalankan alih-alih
                                mencentang daftar tetap. Tersimpan di `test_reports.tested_scenarios`,
                                sejajar dengan kolom "Skenario yang Diuji" pada jalur QA. */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <ShieldCheck size={15} className="text-[#1a365d]" /> Skenario / Ruang Lingkup yang Diuji
                                </h4>
                                <textarea
                                    value={testedScenarios}
                                    onChange={(e) => setTestedScenarios(e.target.value)}
                                    rows={5}
                                    maxLength={5000}
                                    placeholder={'Tuliskan skenario atau ruang lingkup audit yang Anda jalankan, satu per baris. Contoh:\n- Uji injeksi SQL pada formulir login\n- Pemeriksaan header keamanan HTTP\n- Review kontrol akses endpoint transaksi'}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition resize-y"
                                />
                                <p className="text-[11px] text-gray-500 mt-1.5">
                                    Catatan ini melekat pada laporan dan dibaca Lead Keamanan Siber saat sign-off serta PM saat review dokumen rilis.
                                </p>
                            </div>

                            {/* Form Hasil Audit */}
                            <div className="p-5 bg-orange-50/60 rounded-2xl border border-orange-200 space-y-5 shadow-xs">
                                <h4 className="font-extrabold text-sm text-orange-900 border-b border-orange-200/80 pb-3 flex items-center gap-2">
                                    <ShieldAlert size={16} className="text-orange-700" /> Input Hasil Pemeriksaan &amp; Temuan Kerentanan
                                </h4>

                                <div className="space-y-4">
                                    {/*
                                      Tiga penilaian, sama dengan enum TestResult di backend. Keputusan akhir
                                      jalur tetap biner dan menjadi wewenang Lead Keamanan Siber.
                                    */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Penilaian Hasil Pemeriksaan *</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                            {TESTER_RESULT_OPTIONS.map(option => {
                                                const isSelected = testResult === option.value;
                                                const selectedClass = option.value === TEST_RESULT.FAIL
                                                    ? 'bg-red-600 text-white border-red-600'
                                                    : option.value === TEST_RESULT.CONDITIONAL_PASS
                                                        ? 'bg-amber-500 text-white border-amber-500'
                                                        : 'bg-emerald-600 text-white border-emerald-600';

                                                return (
                                                    <button key={option.value} type="button" onClick={() => setTestResult(option.value)}
                                                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${isSelected ? `${selectedClass} shadow-sm` : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}>
                                                        <span className="block text-xs font-extrabold">{option.label}</span>
                                                        <span className={`block text-[10px] mt-0.5 leading-snug ${isSelected ? 'text-white/85' : 'text-gray-400'}`}>{option.hint}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Tingkat Risiko Temuan (Risk Rating)</label>
                                        <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-200">
                                            <option value="">Tidak Ada Temuan</option>
                                            <option value="Low">Low Risk (Minor Advisory)</option>
                                            <option value="Medium">Medium Risk (Perlu Perhatian)</option>
                                            <option value="High">High Risk (Wajib Diperbaiki)</option>
                                            <option value="Critical">Critical Risk (Celah Keamanan Fatal)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                            Catatan Audit &amp; Detail Temuan Celah Keamanan {notesRequired && <span className="text-red-600">*</span>}
                                        </label>
                                        <textarea rows={4} value={cyberNotes} onChange={(e) => setCyberNotes(e.target.value)}
                                            placeholder="Tuliskan temuan kerentanan, langkah reproduksi, dan rekomendasi perbaikan..."
                                            className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all" />
                                        {notesRequired && (
                                            <p className="text-[10px] text-gray-400 mt-1">Wajib diisi karena hasil pemeriksaan bukan &quot;Lulus&quot; tanpa syarat.</p>
                                        )}
                                    </div>

                                    <EvidenceUploader
                                        files={evidenceFiles}
                                        onChange={setEvidenceFiles}
                                        accent="red"
                                        disabled={isSubmitting}
                                        label="Unggah Laporan Pemeriksaan &amp; Bukti Temuan"
                                    />

                                    <button onClick={handleSubmitReport} disabled={isSubmitting}
                                        className="w-full py-3.5 bg-[#1a365d] hover:bg-[#0f2342] text-white rounded-xl font-bold text-xs md:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                                        <Send size={16} /><span>{isSubmitting ? "Mengirim laporan..." : "Kirim Laporan ke Lead Keamanan Siber"}</span>
                                    </button>
                                    <p className="text-[10px] text-gray-400 text-center -mt-2">Laporan masuk ke Workspace Lead Keamanan Siber untuk ditinjau. Status jalur berhenti di &quot;Menunggu Review Lead&quot; sampai Lead melakukan sign-off.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {selectedDocPreview && (<DocumentViewerModal doc={selectedDocPreview} project={activeTask} onClose={() => setSelectedDocPreview(null)} />)}
        </div>
    );
}
