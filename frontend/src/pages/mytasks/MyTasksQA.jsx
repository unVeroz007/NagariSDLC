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
import { documentService, qaRequestService } from "../../services/api";
import { DOCUMENT_TYPES } from "../../utils/documentNaming";
import { uploadEvidenceFiles } from "../../utils/evidenceUpload";
import { TRACK_STATUS, TRACK_STATUS_LABEL, getQaTrackStatus } from "../../constants/projectStatus";
import { TEST_RESULT, TESTER_RESULT_OPTIONS, testResultRequiresNotes } from "../../constants/testResult";
import { PLANNING_QA_GROUP_LABEL } from "../../constants/roles";
import {
    Send, Eye, Calendar, Info, FileText, Download,
    Building, User, CheckCircle2, FolderOpen,
    ClipboardList, Copy, Search, Filter
} from "lucide-react";

/**
 * Peran yang boleh mengirim laporan QA untuk proyek yang bukan disposisinya.
 *
 * Cerminan `TestingTrackService::assertActorMaySubmitReport()`: selain penerima
 * disposisi, hanya Lead jalur QA dan super admin yang diterima backend. Menampilkan
 * daftar tugas yang lebih longgar dari itu hanya menghasilkan penolakan saat kirim.
 */
const QA_PRIVILEGED_ROLES = ['qa_lead', 'lead_group', 'super_admin'];

export default function MyTasksQA() {
    const { user } = useAuth();
    const { projects, refreshData } = useProjects();
    const { addNotification } = useNotifications();

    // Lead QA, Kadiv, dan Super Admin melihat seluruh antrean pengujian yang sedang
    // berjalan; pelaksana lain hanya melihat disposisi miliknya sendiri.
    const isPrivileged = QA_PRIVILEGED_ROLES.includes(user?.role);

    // Penyaring daftar milik pengguna: teks pencarian dan — khusus role yang melihat
    // seluruh antrean — pilihan pelaksana tertentu. Keduanya hanya mempersempit tugas
    // yang sudah menjadi hak pengguna; tak satu pun melebarkan visibilitasnya.
    const [searchTerm, setSearchTerm] = useState('');
    const [assigneeFilter, setAssigneeFilter] = useState('ALL');

    /**
     * Tugas pengujian aktif milik pengguna ini.
     *
     * Disaring dari kolom jalur `qa_status` dan ID penerima disposisi — bukan dari
     * `projects.status` atau pencocokan nama. Sebelumnya daftar ini mencocokkan nama
     * pengguna dengan teks `qaAssignee`, sehingga tugas bisa muncul di layar orang lain
     * yang namanya mirip dan hilang begitu nama ditulis berbeda.
     */
    const qaTasks = useMemo(() => {
        const inProgress = (projects || []).filter(
            (project) => getQaTrackStatus(project) === TRACK_STATUS.IN_PROGRESS
        );

        if (isPrivileged) return inProgress;

        return inProgress.filter(
            (project) => Number(project.qaAssigneeId) === Number(user?.id)
        );
    }, [projects, user, isPrivileged]);

    /**
     * Pilihan pelaksana untuk dropdown filter, diturunkan dari tugas yang sedang
     * berjalan — bukan daftar nama tetap — dan berkunci pada ID penerima disposisi
     * supaya penyaringannya tidak bergantung pada nama yang bisa sama antar pegawai.
     * Hanya berarti bagi role yang melihat seluruh antrean.
     */
    const assigneeOptions = useMemo(() => {
        const nameById = new Map();
        qaTasks.forEach((task) => {
            const id = Number(task.qaAssigneeId);
            if (!Number.isFinite(id) || id <= 0 || nameById.has(id)) return;
            nameById.set(id, task.qaAssignee || `Pelaksana #${id}`);
        });
        return [...nameById.entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'id'));
    }, [qaTasks]);

    /**
     * Daftar yang benar-benar ditampilkan: tugas milik pengguna, dipersempit filter
     * pelaksana (bila aktif) lalu teks pencarian pada ID, nama, dan divisi proyek.
     */
    const visibleTasks = useMemo(() => {
        let result = qaTasks;

        if (isPrivileged && assigneeFilter !== 'ALL') {
            const id = Number(assigneeFilter);
            result = result.filter((task) => Number(task.qaAssigneeId) === id);
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
    }, [qaTasks, isPrivileged, assigneeFilter, searchTerm]);

    const hasActiveFilter = searchTerm.trim() !== '' || (isPrivileged && assigneeFilter !== 'ALL');
    const emptyListMessage = hasActiveFilter
        ? 'Tidak ada tugas yang cocok dengan pencarian atau filter.'
        : isPrivileged
            ? 'Belum ada tugas pengujian QA yang sedang berjalan saat ini.'
            : 'Tidak ada tugas pengujian QA yang didisposisikan kepada Anda saat ini.';

    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const activeTask = useMemo(
        () => visibleTasks.find((task) => task.id === selectedTaskId) || visibleTasks[0] || null,
        [visibleTasks, selectedTaskId]
    );

    const [testResult, setTestResult] = useState('');
    const [defectSeverity, setDefectSeverity] = useState('');
    const [qaNotes, setQaNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedDocPreview, setSelectedDocPreview] = useState(null);
    const [evidenceFiles, setEvidenceFiles] = useState([]);
    const rightPanelRef = useRef(null);

    // Cakupan pengujian ditulis bebas oleh penguji, bukan dipilih dari daftar tetap.
    // Backend menyimpannya di `test_reports.tested_scenarios`.
    const [testedScenarios, setTestedScenarios] = useState('');

    // Isi formulir dan centang skenario adalah draf milik satu tugas. Saat tugas aktif
    // berganti, draf disusun ulang pada render yang sama (pola "sesuaikan state saat
    // prop berubah"), bukan lewat effect yang menyisakan satu render berisi jawaban
    // tugas sebelumnya.
    const [syncedTaskId, setSyncedTaskId] = useState(activeTask?.id ?? null);
    if ((activeTask?.id ?? null) !== syncedTaskId) {
        setSyncedTaskId(activeTask?.id ?? null);
        setTestResult('');
        setQaNotes('');
        setDefectSeverity('');
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

    /**
     * Unduh dokumen lewat service yang menyertakan token.
     *
     * Berkas dokumen tidak punya URL publik: endpoint unduhannya memeriksa hak akses
     * pengguna, jadi tautan langsung selalu ditolak 401.
     */
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
     * Kirim laporan pengujian QA.
     *
     * Dua langkah, berurutan, dan tidak boleh dibalik:
     *
     *   1. Berkas bukti diunggah ke lemari dokumen proyek sebagai tipe QA_EVIDENCE.
     *   2. ID dokumen hasil unggahan dirujuk laporan lewat `evidence_document_ids`.
     *
     * Laporan berhenti di status REVIEW. Keputusan lulus atau kembali ke pengembangan
     * tetap milik Lead QA pada sign-off, jadi layar ini tidak pernah menyentuh status
     * utama proyek.
     */
    const handleSubmitReport = async () => {
        if (!activeTask) return;

        if (!testResult) {
            toast.error('Pilih penilaian hasil pengujian lebih dulu.');
            return;
        }

        if (testResultRequiresNotes(testResult) && !qaNotes.trim()) {
            toast.error('Catatan temuan wajib diisi untuk hasil selain "Lulus".');
            return;
        }

        setIsSubmitting(true);

        try {
            const uploadedEvidence = evidenceFiles.length > 0
                ? await uploadEvidenceFiles(evidenceFiles, {
                    projectId: activeTask.id,
                    documentType: DOCUMENT_TYPES.QA_EVIDENCE.code,
                    contextLabel: 'QA',
                })
                : [];

            await qaRequestService.submitReport({
                project_id: activeTask.id,
                result: testResult,
                notes: qaNotes.trim() || null,
                severity: defectSeverity || null,
                tested_scenarios: testedScenarios.trim() || null,
                evidence_document_ids: uploadedEvidence.map((item) => item.id),
            });

            const resultLabel = TESTER_RESULT_OPTIONS.find(o => o.value === testResult)?.label || testResult;

            toast.success(`Laporan QA (${resultLabel}) untuk "${activeTask.name}" berhasil dikirim.`);
            addNotification(
                'Laporan QA Menunggu Review',
                `Laporan dari ${user?.name || 'Analis QA'} untuk ${activeTask.name} menunggu sign-off Lead QA.`,
                testResult === TEST_RESULT.FAIL ? 'warning' : 'success',
                '/workspace/qa'
            );

            setTestResult(''); setQaNotes(''); setDefectSeverity('');
            setEvidenceFiles([]); setTestedScenarios('');
            setSelectedTaskId(null);
            refreshData();
        } catch (err) {
            toast.error(err.message || 'Gagal mengirim laporan QA.');
        } finally {
            setIsSubmitting(false);
        }
    };

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
            toast.success('Berhasil disalin ke papan klip!');
        } catch (err) {
            toast.error(`Gagal menyalin alamat: ${err.message}`);
        }
    };

    const projectDocsList = useMemo(() => getProjectRealDocuments(activeTask), [activeTask]);

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            <div className="mb-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-extrabold text-gray-800">Tugas Pengujian Quality Assurance (QA)</h2>
                        <span className="bg-purple-100 text-purple-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                            <CheckCircle2 size={14} /> QA Testing Execution
                        </span>
                        {/* Halaman ini terbuka untuk seluruh analis grup, termasuk analis
                            Perencanaan yang menerima disposisi pengujian. */}
                        <span className="px-2.5 py-1 rounded-full bg-[#00529C]/10 text-[#00529C] text-[11px] font-bold border border-[#00529C]/20">
                            {PLANNING_QA_GROUP_LABEL}
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">Lakukan pengujian fungsional, catat skenario yang diuji, unggah bukti pengujian, lalu kirim laporan ke Lead QA untuk sign-off.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[calc(100vh-210px)] overflow-hidden">
                    <div className="shrink-0 pb-3 border-b border-gray-100 mb-3 space-y-3">
                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            <FolderOpen size={16} className="text-purple-600" /> Daftar Tugas Pengujian QA ({visibleTasks.length})
                        </h3>

                        {/* Pencarian daftar — tersedia untuk semua pelaksana */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Cari ID / nama proyek / divisi..."
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] transition"
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
                                    <Filter size={12} /> Semua ({qaTasks.length})
                                </button>
                                <select
                                    value={assigneeFilter === 'ALL' ? '' : assigneeFilter}
                                    onChange={(e) => setAssigneeFilter(e.target.value || 'ALL')}
                                    disabled={assigneeOptions.length === 0}
                                    className="flex-1 min-w-0 px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-gray-200 bg-white text-gray-700 outline-none focus:border-[#00529C] disabled:bg-gray-50 disabled:text-gray-400"
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
                                <FolderOpen size={36} className="mx-auto mb-2 text-gray-200" />
                                {emptyListMessage}
                            </div>
                        ) : visibleTasks.map(t => (
                            <div key={t.id} onClick={() => { setSelectedTaskId(t.id); scrollPageToTop(); }}
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${activeTask?.id === t.id ? "border-2 border-[#1a365d] bg-purple-50/40 shadow-sm" : "border-gray-200 hover:border-gray-300 bg-white"}`}>
                                <div className="flex justify-between items-start mb-1.5">
                                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{t.reqId || t.id}</span>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <RBBBadge type={t.type} />
                                        <ProjectTypeBadge type={t.project_type} />
                                    </div>
                                </div>
                                <h4 className="font-bold text-gray-800 text-sm line-clamp-1 mb-1.5">{t.name || t.title}</h4>
                                <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                                    <span>Divisi: <strong className="text-gray-700">{t.division}</strong></span>
                                    <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-purple-100 text-purple-800">
                                        {TRACK_STATUS_LABEL[getQaTrackStatus(t)] || getQaTrackStatus(t)}
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
                            <p className="font-bold text-gray-600">Pilih Tugas Pengujian dari Panel Kiri</p>
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
                                    {activeTask.qaAssignee && (<><span className="text-gray-300 mx-1">|</span><User size={14} className="text-gray-400" /><span>Ditugaskan: <strong className="text-purple-700">{activeTask.qaAssignee}</strong></span></>)}
                                </p>
                            </div>

                            {(activeTask.stagingUrl || activeTask.staging_url) && (
                                <div className="bg-purple-50/60 border border-purple-200 p-4 rounded-xl flex items-center justify-between gap-3">
                                    <div className="overflow-hidden">
                                        <div className="text-[10px] font-bold text-purple-800 uppercase tracking-wider">Target Staging Test Environment URL</div>
                                        <div className="text-xs font-mono text-purple-700 truncate font-bold mt-0.5">{activeTask.stagingUrl || activeTask.staging_url}</div>
                                    </div>
                                    <button onClick={() => handleCopyStagingUrl(activeTask.stagingUrl || activeTask.staging_url)}
                                        className="px-3 py-1.5 bg-white text-purple-700 hover:bg-purple-100 rounded-lg transition-colors text-xs font-bold shrink-0 shadow-xs cursor-pointer flex items-center gap-1.5">
                                        <Copy size={13} /><span>Salin</span>
                                    </button>
                                </div>
                            )}

                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <FileText size={15} className="text-[#1a365d]" /> Lingkup &amp; Spesifikasi Kebutuhan Pengujian
                                </h4>
                                <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-xs text-gray-700 leading-relaxed font-medium">
                                    {activeTask.description || "Tidak ada deskripsi kebutuhan yang dilampirkan pada proyek ini."}
                                </div>
                            </div>

                            {(activeTask.qaNotes || activeTask.qa_notes) && (
                                <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1">
                                    <h4 className="text-xs font-extrabold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <Info size={14} className="text-blue-600" /> Catatan Teknis Pengajuan (Analis Pengembangan)
                                    </h4>
                                    <p className="text-xs text-blue-950 font-medium leading-relaxed whitespace-pre-wrap">{activeTask.qaNotes || activeTask.qa_notes}</p>
                                </div>
                            )}

                            {(activeTask.qaLeadNotes || activeTask.qa_lead_notes) && (
                                <div className="p-4 bg-purple-50/80 border-2 border-purple-300 rounded-xl space-y-1">
                                    <h4 className="text-xs font-extrabold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <ClipboardList size={14} className="text-purple-600" /> Arahan &amp; Instruksi Khusus dari Lead QA
                                    </h4>
                                    <p className="text-xs text-purple-950 font-medium leading-relaxed whitespace-pre-wrap">
                                        {activeTask.qaLeadNotes || activeTask.qa_lead_notes}
                                    </p>
                                </div>
                            )}

                            {/* Dokumen Prasyarat dengan tombol Pratinjau & Unduh */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <FolderOpen size={15} className="text-[#1a365d]" /> Dokumen SDLC Prasyarat Terlampir ({projectDocsList.length})
                                </h4>
                                <div className="space-y-2">
                                    {projectDocsList.length === 0 ? (
                                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-400 italic text-center">Belum ada dokumen prasyarat terlampir.</div>
                                    ) : projectDocsList.map(doc => (
                                        <div key={doc.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between hover:border-purple-300 transition-all">
                                            <div className="flex items-center gap-2.5 overflow-hidden">
                                                <FileText size={16} className="text-purple-600 shrink-0" />
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

                            {/*
                              Cakupan pengujian ditulis penguji sendiri.

                              Sebelumnya bagian ini berupa enam kotak centang skenario tetap. Bentuk
                              itu keliru: cakupan pengujian tiap proyek berbeda, sehingga penguji
                              dipaksa mencentang skenario yang tidak relevan sementara skenario yang
                              benar-benar dijalankan tidak tercatat sama sekali.
                            */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <CheckCircle2 size={15} className="text-[#1a365d]" /> Skenario yang Diuji
                                </h4>
                                <textarea
                                    value={testedScenarios}
                                    onChange={(e) => setTestedScenarios(e.target.value)}
                                    rows={5}
                                    maxLength={5000}
                                    placeholder={'Tuliskan skenario yang Anda jalankan pada pengujian ini, satu per baris. Contoh:\n- Transaksi setoran nominal normal\n- Validasi input nominal minus\n- Regresi modul mutasi rekening'}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-[#00529C] focus:ring-2 focus:ring-[#00529C]/20 outline-none transition resize-y"
                                />
                                <p className="text-[11px] text-gray-500 mt-1.5">
                                    Catatan ini melekat pada laporan dan dibaca Lead QA saat sign-off serta PM saat review dokumen rilis.
                                </p>
                            </div>

                            {/* Form Laporan */}
                            <div className="p-5 bg-purple-50/60 rounded-2xl border border-purple-200 space-y-5 shadow-xs">
                                <h4 className="font-extrabold text-sm text-purple-900 border-b border-purple-200/80 pb-3 flex items-center gap-2">
                                    <ClipboardList size={16} className="text-purple-700" /> Input Laporan Hasil Pengujian QA
                                </h4>

                                <div className="space-y-4">
                                    {/*
                                      Tiga penilaian, sama dengan enum TestResult di backend. "Lulus dengan
                                      Catatan" dipakai untuk temuan yang tidak menghalangi rilis — penilaian
                                      ini milik pelaksana pengujian, sedangkan keputusan akhir jalur tetap
                                      biner di tangan Lead QA.
                                    */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Penilaian Hasil Pengujian *</label>
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
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Tingkat Keparahan Temuan (Defect Severity)</label>
                                        <select value={defectSeverity} onChange={(e) => setDefectSeverity(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-200">
                                            <option value="">Tidak Ada Temuan</option>
                                            <option value="Minor">Minor / Low (Catatan Kosmetik / UI)</option>
                                            <option value="Major">Major / Medium (Perlu Perbaikan Fungsional)</option>
                                            <option value="Critical">Critical (Aplikasi Error / Crash)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                            Catatan Pengujian &amp; Detail Temuan {notesRequired && <span className="text-red-600">*</span>}
                                        </label>
                                        <textarea rows={4} value={qaNotes} onChange={(e) => setQaNotes(e.target.value)}
                                            placeholder="Tuliskan temuan, langkah reproduksi (steps to reproduce), atau catatan rekomendasi hasil pengujian..."
                                            className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all" />
                                        {notesRequired && (
                                            <p className="text-[10px] text-gray-400 mt-1">Wajib diisi karena hasil pengujian bukan &quot;Lulus&quot; tanpa syarat.</p>
                                        )}
                                    </div>

                                    <EvidenceUploader
                                        files={evidenceFiles}
                                        onChange={setEvidenceFiles}
                                        accent="purple"
                                        disabled={isSubmitting}
                                        label="Unggah Bukti Pengujian QA"
                                    />

                                    <button onClick={handleSubmitReport} disabled={isSubmitting}
                                        className="w-full py-3.5 bg-[#1a365d] hover:bg-[#0f2342] text-white rounded-xl font-bold text-xs md:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                                        <Send size={16} /><span>{isSubmitting ? "Mengirim laporan..." : "Kirim Laporan Pengujian ke Lead QA"}</span>
                                    </button>
                                    <p className="text-[10px] text-gray-400 text-center -mt-2">Laporan masuk ke Workspace Lead QA untuk ditinjau. Status jalur QA berhenti di &quot;Menunggu Review Lead&quot; sampai Lead melakukan sign-off.</p>
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
