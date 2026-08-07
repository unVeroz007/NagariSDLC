import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useProjects, getProjectRealDocuments, saveFileToStore } from "../../contexts/ProjectContext";
import { useNotifications } from "../../contexts/NotificationContext";
import RBBBadge from "../../components/RBBBadge";
import DocumentViewerModal from "../../components/DocumentViewerModal";
import toast from "react-hot-toast";
import { generateDocumentName, DOCUMENT_TYPES, formatFileSize } from '../../utils/documentNaming';
import {
    Send, Eye, Calendar, CheckCircle, Info, FileText, Download, Upload,
    Trash2, Check, X, Building, User, CheckCircle2, FolderOpen, Zap, Bug,
    Square, CheckSquare, Paperclip, ClipboardList, Copy
} from "lucide-react";

export default function MyTasksQA() {
    const { user } = useAuth();
    const { projects, updateProject } = useProjects();
    const { addNotification } = useNotifications();

    const qaTasks = useMemo(() => {
        let list = (projects || []).filter(p => {
            const qaSt = String(p.qaStatus || p.qa_status || "").toUpperCase();
            return (qaSt === "IN_PROGRESS" || p.status === "QA_IN_PROGRESS") && qaSt !== "PASSED" && qaSt !== "REVIEW";
        });
        const isPrivileged = user?.role && ['super_admin', 'lead_group', 'head_of_it', 'development_lead'].includes(user.role);
        if (!isPrivileged && user?.name) {
            list = list.filter(p => String(p.qaAssignee || "").toLowerCase().includes(user.name.toLowerCase()));
        }
        return list;
    }, [projects, user]);

    const [selectedTask, setSelectedTask] = useState(null);
    const activeTask = selectedTask || qaTasks[0] || null;

    const [qaResult, setQaResult] = useState("");
    const [defectSeverity, setDefectSeverity] = useState("Minor");
    const [qaNotes, setQaNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedDocPreview, setSelectedDocPreview] = useState(null);
    const [evidenceFiles, setEvidenceFiles] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const evidenceInputRef = useRef(null);
    const rightPanelRef = useRef(null);

    const checklistItems = [
        { key: "scenario_positive", label: "Skenario Positif (Happy Path Transactions)" },
        { key: "validation_input", label: "Validasi Input & Error Handling Message" },
        { key: "performance_api", label: "Pengujian Performa & API Timeout Handling" },
        { key: "ui_responsiveness", label: "Kesesuaian Desain UI & Responsivitas Layar" },
        { key: "regression_test", label: "Regression Test Modul yang Terpengaruh" },
        { key: "integration_test", label: "Integrasi Antar Modul & Third-Party API" },
    ];

    const initChecklist = () => Object.fromEntries(checklistItems.map(i => [i.key, false]));
    const [checklist, setChecklist] = useState(initChecklist());

    const scrollPageToTop = () => {
        if (rightPanelRef.current) rightPanelRef.current.scrollTo({ top: 0, behavior: "smooth" });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    useEffect(() => { if (activeTask) scrollPageToTop(); }, [activeTask?.id]);

    useEffect(() => {
        setQaResult(""); setQaNotes(""); setDefectSeverity("Minor");
        setEvidenceFiles([]); setChecklist(initChecklist());
    }, [activeTask?.id]);

    const toggleChecklist = (key) => setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
    const checkedCount = Object.values(checklist).filter(Boolean).length;

    const handleEvidenceFiles = (files) => {
        const newFiles = Array.from(files).map(file => {
            const ext = file.name.split('.').pop() || '';
            const autoName = generateDocumentName(
                activeTask?.req_id || activeTask?.id,
                DOCUMENT_TYPES.QA_REPORT.code,
                activeTask?.title || activeTask?.name
            ) + '.' + ext;
            return {
                id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                name: autoName,
                originalName: file.name,
                size: formatFileSize(file.size),
                type: file.type || "application/octet-stream",
                uploadedAt: new Date().toLocaleString("id-ID"),
                author: user?.name || "QA Analis",
                fileObj: file, dataUrl: null,
            };
        });
        newFiles.forEach(ef => {
            const reader = new FileReader();
            reader.onload = (e) => {
                setEvidenceFiles(prev => prev.map(f => f.id === ef.id ? { ...f, dataUrl: e.target.result } : f));
                if (typeof saveFileToStore === "function") saveFileToStore(ef.name, e.target.result);
            };
            reader.readAsDataURL(ef.fileObj);
        });
        setEvidenceFiles(prev => [...prev, ...newFiles]);
        toast.success(`${newFiles.length} file evidence ditambahkan!`);
    };

    const handleDrop = useCallback((e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) handleEvidenceFiles(e.dataTransfer.files); }, []);
    const handleDragOver = useCallback((e) => { e.preventDefault(); setIsDragging(true); }, []);
    const handleDragLeave = useCallback(() => setIsDragging(false), []);

    const handleDownload = (doc) => {
        const href = doc.url || doc.dataUrl;
        if (href) { const a = document.createElement("a"); a.href = href; a.download = doc.name; a.click(); toast.success(`Mengunduh: ${doc.name}`); }
        else toast.error("File tidak tersedia untuk diunduh.");
    };

    const handleSubmitResult = async () => {
        if (!activeTask) return;
        if (!qaResult) { toast.error("Pilih keputusan hasil QA (PASS / FAIL)!"); return; }
        if (!qaNotes.trim()) { toast.error("Masukkan catatan hasil pengujian QA!"); return; }
        setIsSubmitting(true);
        try {
            const isPass = qaResult === "PASS";
            const testerResult = {
                testerName: user?.name || "QA Analis",
                decision: isPass ? "PASSED (LULUS QA)" : "FAILED (PERLU PERBAIKAN)",
                notes: qaNotes, severity: defectSeverity, qaResult, isPass,
                submittedAt: new Date().toISOString(),
                checklistCompleted: checklist,
                checklistSummary: `${checkedCount}/${checklistItems.length} skenario dicentang`,
                evidence: evidenceFiles.map(ef => ({ id: ef.id, name: ef.name, size: ef.size, type: ef.type, uploadedAt: ef.uploadedAt, author: ef.author, url: ef.dataUrl || null })),
            };
            await updateProject(activeTask.id, { qaStatus: "REVIEW", qa_status: "REVIEW", testerResult });
            toast.success(`Laporan QA (${qaResult}) untuk "${activeTask.name}" berhasil dikirim!`);
            addNotification("Laporan QA Masuk", `Laporan dari ${user?.name || "QA Analis"} untuk ${activeTask.name} menunggu review Lead QA.`, isPass ? "success" : "warning", "/workspace/qa");
            setQaResult(""); setQaNotes(""); setEvidenceFiles("");
        } catch (err) { toast.error(err.message || "Gagal menyimpan laporan QA."); }
        finally { setIsSubmitting(false); }
    };

    const handleCopyStagingUrl = (url) => { navigator.clipboard.writeText(url); toast.success("Staging URL berhasil disalin!"); };
    const projectDocsList = useMemo(() => getProjectRealDocuments(activeTask), [activeTask]);

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            <div className="mb-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-extrabold text-gray-800">Tugas Pengujian Quality Assurance (QA)</h2>
                        <span className="bg-purple-100 text-purple-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                            <CheckCircle2 size={14} /> QA Testing Execution
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">Lakukan pengujian fungsional, centang checklist, upload bukti evidence, dan kirim laporan ke Lead QA.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[calc(100vh-210px)] overflow-hidden">
                    <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center justify-between shrink-0 pb-3 border-b border-gray-100">
                        <span className="flex items-center gap-2"><FolderOpen size={16} className="text-purple-600" /> Daftar Tugas Pengujian QA ({qaTasks.length})</span>
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {qaTasks.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                                <FolderOpen size={36} className="mx-auto mb-2 text-gray-200" />
                                Tidak ada tugas pengujian QA yang ditugaskan saat ini.
                            </div>
                        ) : qaTasks.map(t => (
                            <div key={t.id} onClick={() => { setSelectedTask(t); scrollPageToTop(); }}
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${activeTask?.id === t.id ? "border-2 border-[#1a365d] bg-purple-50/40 shadow-sm" : "border-gray-200 hover:border-gray-300 bg-white"}`}>
                                <div className="flex justify-between items-start mb-1.5">
                                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{t.id}</span>
                                    <RBBBadge type={t.type} />
                                </div>
                                <h4 className="font-bold text-gray-800 text-sm line-clamp-1 mb-1.5">{t.name || t.title}</h4>
                                <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                                    <span>Divisi: <strong className="text-gray-700">{t.division}</strong></span>
                                    <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-purple-100 text-purple-800">{t.qaStatus || t.status}</span>
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
                                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">{activeTask.id}</span>
                                    <RBBBadge type={activeTask.type} deadline={activeTask.rbbDeadline} />
                                </div>
                                <h3 className="text-xl font-extrabold text-gray-800">{activeTask.name || activeTask.title}</h3>
                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                                    <Building size={14} className="text-gray-400" />
                                    <span>Divisi: <strong className="text-gray-700">{activeTask.division}</strong></span>
                                    <span>�</span>
                                    <Calendar size={14} className="text-gray-400" />
                                    <span>Target: <strong className="text-gray-700">{activeTask.targetDate || "2026-09-30"}</strong></span>
                                    {activeTask.qaAssignee && (<><span>�</span><User size={14} className="text-gray-400" /><span>Ditugaskan: <strong className="text-purple-700">{activeTask.qaAssignee}</strong></span></>)}
                                </p>
                            </div>

                            <div className="bg-purple-50/60 border border-purple-200 p-4 rounded-xl flex items-center justify-between gap-3">
                                <div className="overflow-hidden">
                                    <div className="text-[10px] font-bold text-purple-800 uppercase tracking-wider">Target Staging Test Environment URL</div>
                                    <div className="text-xs font-mono text-purple-700 truncate font-bold mt-0.5">{activeTask.stagingUrl || "https://staging-app.banknagari.co.id"}</div>
                                </div>
                                <button onClick={() => handleCopyStagingUrl(activeTask.stagingUrl || "https://staging-app.banknagari.co.id")}
                                    className="px-3 py-1.5 bg-white text-purple-700 hover:bg-purple-100 rounded-lg transition-colors text-xs font-bold shrink-0 shadow-xs cursor-pointer flex items-center gap-1.5">
                                    <Copy size={13} /><span>Salin</span>
                                </button>
                            </div>

                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <FileText size={15} className="text-[#1a365d]" /> Lingkup &amp; Spesifikasi Kebutuhan Pengujian
                                </h4>
                                <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-xs text-gray-700 leading-relaxed font-medium">
                                    {activeTask.description || "Pengembangan modul aplikasi dan integrasi sistem perbankan digital SDLC Bank Nagari."}
                                </div>
                            </div>

                            {(activeTask.qaNotes || activeTask.qa_notes) && (
                                <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1">
                                    <h4 className="text-xs font-extrabold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <Info size={14} className="text-blue-600" /> Catatan Teknis Pengajuan (PM / Pengaju Proyek)
                                    </h4>
                                    <p className="text-xs text-blue-950 font-medium leading-relaxed whitespace-pre-wrap">{activeTask.qaNotes || activeTask.qa_notes}</p>
                                </div>
                            )}

                            {(activeTask.qaLeadNotes || activeTask.qa_lead_notes || activeTask.qaInstructions) && (
                                <div className="p-4 bg-purple-50/80 border-2 border-purple-300 rounded-xl space-y-1">
                                    <h4 className="text-xs font-extrabold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <ClipboardList size={14} className="text-purple-600" /> ? Arahan &amp; Instruksi Khusus dari Lead QA
                                    </h4>
                                    <p className="text-xs text-purple-950 font-medium leading-relaxed whitespace-pre-wrap">
                                        {activeTask.qaLeadNotes || activeTask.qa_lead_notes || activeTask.qaInstructions}
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
                                                    <span className="text-[10px] text-gray-500">{doc.type} � {doc.size}</span>
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

                            {/* Checklist Interaktif */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-[#1a365d]" /> Checklist Skenario Pengujian Fungsional</span>
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${checkedCount === checklistItems.length ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                                        {checkedCount}/{checklistItems.length} selesai
                                    </span>
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {checklistItems.map(item => (
                                        <button key={item.key} type="button" onClick={() => toggleChecklist(item.key)}
                                            className={`p-3 rounded-xl border flex items-center gap-2 text-xs text-left transition-all cursor-pointer font-medium ${checklist[item.key] ? "bg-emerald-50 border-emerald-300 text-emerald-900" : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                                            {checklist[item.key] ? <CheckSquare size={16} className="text-emerald-600 shrink-0" /> : <Square size={16} className="text-gray-400 shrink-0" />}
                                            <span>{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Form Laporan */}
                            <div className="p-5 bg-purple-50/60 rounded-2xl border border-purple-200 space-y-5 shadow-xs">
                                <h4 className="font-extrabold text-sm text-purple-900 border-b border-purple-200/80 pb-3 flex items-center gap-2">
                                    <ClipboardList size={16} className="text-purple-700" /> Input Laporan Hasil Pengujian QA
                                </h4>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Keputusan Hasil QA *</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button type="button" onClick={() => setQaResult("PASS")}
                                                className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border cursor-pointer ${qaResult === "PASS" ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "bg-white text-gray-700 border-gray-200 hover:border-emerald-500"}`}>
                                                <Check size={16} /><span>PASSED (LULUS QA)</span>
                                            </button>
                                            <button type="button" onClick={() => setQaResult("FAIL")}
                                                className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border cursor-pointer ${qaResult === "FAIL" ? "bg-red-600 text-white border-red-600 shadow-sm" : "bg-white text-gray-700 border-gray-200 hover:border-red-500"}`}>
                                                <Bug size={16} /><span>FAILED (DITOLAK / RE-FIX)</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Tingkat Keparahan Bug (Defect Severity)</label>
                                        <select value={defectSeverity} onChange={(e) => setDefectSeverity(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-200">
                                            <option value="Minor">Minor / Low (Catatan Kosmetik / UI)</option>
                                            <option value="Major">Major / Medium (Perlu Perbaikan Fungsional)</option>
                                            <option value="Critical">Critical Bug (Aplikasi Error / Crash)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Catatan Pengujian &amp; Detail Temuan Bug *</label>
                                        <textarea rows={4} value={qaNotes} onChange={(e) => setQaNotes(e.target.value)}
                                            placeholder="Tuliskan temuan bug, langkah reproduksi (steps to reproduce), atau catatan rekomendasi hasil pengujian..."
                                            className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all" />
                                    </div>

                                    {/* Upload Evidence */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-2">
                                            <span className="flex items-center gap-1.5"><Paperclip size={13} className="text-purple-600" /> Upload Bukti Pengujian / Evidence <span className="text-[10px] text-gray-400 font-normal">(screenshot, log, test report, dll.)</span></span>
                                        </label>
                                        <div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onClick={() => evidenceInputRef.current?.click()}
                                            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${isDragging ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-purple-400 bg-gray-50/50 hover:bg-purple-50/30"}`}>
                                            <Upload size={20} className="mx-auto mb-1.5 text-gray-400" />
                                            <p className="text-xs font-semibold text-gray-600">Seret file ke sini atau <span className="text-purple-600 underline">klik untuk pilih file</span></p>
                                            <p className="text-[10px] text-gray-400 mt-0.5">PDF, PNG, JPG, Excel, ZIP (maks. 20 MB per file)</p>
                                            <input ref={evidenceInputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && handleEvidenceFiles(e.target.files)} accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip" />
                                        </div>
                                        {evidenceFiles.length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                {evidenceFiles.map(ef => (
                                                    <div key={ef.id} className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-xl">
                                                        <div className="flex items-center gap-2.5 overflow-hidden">
                                                            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0"><Paperclip size={13} /></div>
                                                            <div className="overflow-hidden">
                                                                <p className="text-xs font-bold text-gray-800 truncate">{ef.name}</p>
                                                                <p className="text-[10px] text-gray-400">{ef.size} � {ef.uploadedAt}</p>
                                                            </div>
                                                        </div>
                                                        <button type="button" onClick={() => setEvidenceFiles(prev => prev.filter(f => f.id !== ef.id))}
                                                            className="p-1 text-gray-400 hover:text-red-500 transition-colors cursor-pointer shrink-0"><X size={14} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <button onClick={handleSubmitResult} disabled={isSubmitting}
                                        className="w-full py-3.5 bg-[#1a365d] hover:bg-[#0f2342] text-white rounded-xl font-bold text-xs md:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                                        <Send size={16} /><span>{isSubmitting ? "Mengirim..." : "Kirim Laporan Pengujian ke Lead QA"}</span>
                                    </button>
                                    <p className="text-[10px] text-gray-400 text-center -mt-2">Laporan akan masuk ke Workspace Lead QA untuk ditinjau dan di-sign-off sebelum dikembalikan ke PM.</p>
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
