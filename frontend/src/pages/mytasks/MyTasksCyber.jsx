import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import toast from 'react-hot-toast';
import {
    Shield,
    ChevronRight,
    Search,
    Bell,
    Calendar,
    Link as LinkIcon,
    Send,
    Save,
    CloudUpload,
    Delete,
    CheckCircle,
    FileText,
    FileCheck,
    Eye,
    Lock,
    AlertTriangle,
    Clock,
    User,
    AlertCircle,
    MoreVertical,
    Upload,
    X,
    File,
    ShieldCheck,
    History,
    HelpCircle,
    FolderOpen,
    Copy,
    ShieldAlert,
    ArrowRight,
    Edit3,
} from 'lucide-react';
import { cyberTasks, mockProjects } from '../../data/mockData';

export default function MyTasksCyber() {
    const { user } = useAuth();
    const { addNotification } = useNotifications();
    const [selectedTask, setSelectedTask] = useState(cyberTasks[0]);
    const [securityStatus, setSecurityStatus] = useState('');
    const [notes, setNotes] = useState('');
    const [uploadedFile, setUploadedFile] = useState({
        name: 'Pentest_Report_LOS_Final.pdf',
        size: '3.2 MB',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Confirmation modal state (Pre-submission)
    const [showConfirmRejectModal, setShowConfirmRejectModal] = useState(false);

    // Modal result state (Post-submission)
    const [showResultModal, setShowResultModal] = useState(false);
    const [modalData, setModalData] = useState(null);

    const handleInitialSubmit = () => {
        if (!securityStatus) {
            toast.error('Pilih status hasil audit keamanan!');
            return;
        }
        if (securityStatus === 'vulnerable' && !notes.trim()) {
            toast.error('Masukkan daftar temuan celah keamanan (Vulnerability Report)!');
            return;
        }

        if (securityStatus === 'vulnerable') {
            // Tampilkan modal konfirmasi penolakan siber terlebih dahulu
            setShowConfirmRejectModal(true);
        } else {
            // Lulus langsung eksekusi
            executeSubmit();
        }
    };

    const executeSubmit = () => {
        setIsSubmitting(true);
        setShowConfirmRejectModal(false);

        setTimeout(() => {
            const isVulnerable = securityStatus === 'vulnerable';

            // Update status proyek jika vulnerable (RETURN TO DEV)
            if (selectedTask) {
                const project = mockProjects.find(p => p.name === selectedTask.projectName);
                if (project && isVulnerable) {
                    project.status = 'RETURN TO DEV';
                    project.phase = 'Fase 2: Pengembangan';
                    project.statusColor = 'bg-red-100 text-red-700 border-red-200';
                    project.reworkNotes = `Cyber Audit Failed: ${notes}`;
                }
            }

            addNotification(
                isVulnerable ? 'Audit Siber Ditolak (RETURN TO DEV)' : 'Audit Siber Lulus (SECURE)',
                `Audit siber untuk ${selectedTask?.projectName} selesai: ${isVulnerable ? 'Ditemukan celah keamanan' : 'Sistem Aman'}.`,
                isVulnerable ? 'danger' : 'success',
                '/track'
            );

            toast.success(isVulnerable ? 'Hasil audit dikirim (Ditolak & Remediasi)' : 'Hasil audit dikirim (Sistem Aman)');

            setModalData({
                projectName: selectedTask?.projectName,
                projectId: selectedTask?.id,
                isVulnerable: isVulnerable,
                notes: notes,
            });

            setIsSubmitting(false);
            setShowResultModal(true);
        }, 800);
    };

    const handleCloseResultModal = () => {
        setShowResultModal(false);
        if (selectedTask) {
            const index = cyberTasks.indexOf(selectedTask);
            if (index > -1) cyberTasks.splice(index, 1);
            if (cyberTasks.length > 0) {
                setSelectedTask(cyberTasks[0]);
                setSecurityStatus('');
                setNotes('');
                setUploadedFile(null);
            } else {
                setSelectedTask(null);
            }
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadedFile({
                name: file.name,
                size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
            });
            toast.success(`File ${file.name} berhasil diunggah!`);
        }
    };

    const handleRemoveFile = () => {
        setUploadedFile(null);
    };

    if (!selectedTask) {
        return (
            <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb]">
                <div className="max-w-4xl mx-auto text-center py-20">
                    <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Semua Audit Siber Selesai</h2>
                    <p className="text-gray-500 mt-2">Tidak ada tugas audit penetration test yang menunggu saat ini.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-[#f8f9fb] overflow-hidden">
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-col gap-2 shrink-0">
                    <h1 className="text-2xl font-bold text-gray-800">Eksekusi Audit Siber (Cyber Security)</h1>
                    <p className="text-sm text-gray-500">Daftar tugas Penetration Testing (Pentest) dan pelaporan celah keamanan.</p>
                </div>

                {/* Split Layout */}
                <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
                    {/* LEFT: Task List */}
                    <div className="w-full lg:w-1/3 flex flex-col gap-4 bg-white rounded-xl shadow-sm p-4 overflow-hidden border border-gray-200 shrink-0 lg:shrink">
                        <div className="flex justify-between items-center mb-2 shrink-0">
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                Tugas Siber Saya <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full text-xs font-bold">{cyberTasks.length}</span>
                            </h2>
                        </div>
                        <div className="relative shrink-0">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Filter ID/Nama..."
                                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 mt-2 pr-1 pb-2">
                            {cyberTasks.map((task) => (
                                <div
                                    key={task.id}
                                    onClick={() => {
                                        setSelectedTask(task);
                                        setSecurityStatus('');
                                        setNotes('');
                                    }}
                                    className={`p-4 rounded-lg cursor-pointer transition-all ${selectedTask?.id === task.id
                                            ? 'border-2 border-purple-600 bg-purple-50/50 shadow-sm relative'
                                            : 'border border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white'
                                        }`}
                                >
                                    {selectedTask?.id === task.id && (
                                        <div className="absolute right-0 top-0 w-1 h-full bg-purple-600 rounded-r-lg"></div>
                                    )}
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold text-purple-700 tracking-wider">{task.id}</span>
                                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-700 border border-amber-200 uppercase">
                                            {task.status}
                                        </span>
                                    </div>
                                    <h3 className="font-semibold text-gray-800 mb-3 leading-tight">{task.projectName}</h3>
                                    <div className="flex items-center justify-between mt-auto text-xs text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <Clock size={12} />
                                            {task.deadline}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT: Task Details & Form */}
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                        {/* Task Header */}
                        <div className="p-6 border-b border-gray-200 bg-gray-50/50 flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-bold text-purple-700 tracking-wider uppercase">{selectedTask.id}</span>
                                    <h2 className="text-xl font-bold text-gray-800 mt-1">{selectedTask.projectName}</h2>
                                </div>
                            </div>

                            {/* Staging URL */}
                            <div className="flex items-center gap-2 bg-purple-50/60 p-3 rounded-lg border border-purple-100">
                                <LinkIcon size={16} className="text-purple-700" />
                                <span className="text-xs text-gray-500 font-medium">Staging URL Audit:</span>
                                <a href={selectedTask.stagingUrl} target="_blank" rel="noreferrer" className="text-xs text-purple-700 font-bold hover:underline truncate">
                                    {selectedTask.stagingUrl}
                                </a>
                            </div>

                            {/* Instruction Note */}
                            {selectedTask.leadNote && (
                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-900 flex items-start gap-2">
                                    <Shield size={16} className="text-purple-700 mt-0.5 shrink-0" />
                                    <div>
                                        <span className="font-bold block mb-0.5">Instruksi Pentest (dari Cyber Lead):</span>
                                        {selectedTask.leadNote}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Form Section */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Status radio selection */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-3">
                                    Hasil Audit Keamanan Sistem <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label
                                        className={`relative flex items-center p-4 border rounded-xl cursor-pointer hover:bg-emerald-50/50 transition-colors ${securityStatus === 'aman'
                                                ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20'
                                                : 'border-gray-200'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="cyber_status"
                                            value="aman"
                                            checked={securityStatus === 'aman'}
                                            onChange={(e) => setSecurityStatus(e.target.value)}
                                            className="hidden"
                                        />
                                        <div className="flex items-center gap-3 w-full">
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${securityStatus === 'aman' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                                                }`}>
                                                {securityStatus === 'aman' && <ShieldCheck size={14} className="text-white" />}
                                            </div>
                                            <div>
                                                <span className={`font-bold text-sm block ${securityStatus === 'aman' ? 'text-emerald-700' : 'text-gray-800'}`}>
                                                    Sistem Aman (Clean / Passed)
                                                </span>
                                                <span className="text-[11px] text-gray-500">Tidak ditemukan celah keamanan kritikal</span>
                                            </div>
                                        </div>
                                    </label>

                                    <label
                                        className={`relative flex items-center p-4 border rounded-xl cursor-pointer hover:bg-red-50/60 transition-colors ${securityStatus === 'vulnerable'
                                                ? 'border-red-500 bg-red-50 ring-2 ring-red-500/20'
                                                : 'border-gray-200'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="cyber_status"
                                            value="vulnerable"
                                            checked={securityStatus === 'vulnerable'}
                                            onChange={(e) => setSecurityStatus(e.target.value)}
                                            className="hidden"
                                        />
                                        <div className="flex items-center gap-3 w-full">
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${securityStatus === 'vulnerable' ? 'border-red-500 bg-red-500' : 'border-gray-300'
                                                }`}>
                                                {securityStatus === 'vulnerable' && <X size={14} className="text-white" />}
                                            </div>
                                            <div>
                                                <span className={`font-bold text-sm block ${securityStatus === 'vulnerable' ? 'text-red-600' : 'text-gray-800'}`}>
                                                    Ditemukan Celah (Vulnerable / Failed)
                                                </span>
                                                <span className="text-[11px] text-gray-500">Return to Dev untuk Remediasi Kode</span>
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Notes Textarea */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Laporan Temuan Celah &amp; Rekomendasi Remediasi <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Jelaskan jenis celah (SQLi, XSS, Broken Auth), dampak risiko, dan petunjuk remediasi untuk tim dev..."
                                    rows={4}
                                    className="w-full p-3.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-y bg-white"
                                />
                            </div>

                            {/* Upload Pentest Report */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Berkas Laporan Audit Pentest (PDF)
                                </label>
                                {uploadedFile ? (
                                    <div className="flex items-center justify-between p-3.5 bg-purple-50/50 border border-purple-200 rounded-xl max-w-md">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                                                <FileText size={20} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-800">{uploadedFile.name}</p>
                                                <p className="text-[10px] text-gray-500">{uploadedFile.size} • Upload Berhasil</p>
                                            </div>
                                        </div>
                                        <button onClick={handleRemoveFile} className="p-1 text-gray-400 hover:text-red-500">
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100/60 p-6 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer max-w-md">
                                        <Upload size={24} className="text-purple-600 mb-2" />
                                        <span className="text-xs font-bold text-gray-700">Unggah Berkas Laporan Pentest</span>
                                        <span className="text-[10px] text-gray-400 mt-1">Format PDF (Maks. 10MB)</span>
                                        <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-gray-200 bg-gray-50/50 shrink-0 flex justify-end gap-3">
                            <button
                                onClick={handleInitialSubmit}
                                disabled={isSubmitting}
                                className={`px-6 py-3 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-70 cursor-pointer ${securityStatus === 'vulnerable'
                                        ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                                        : 'bg-purple-700 hover:bg-purple-800 shadow-purple-700/20'
                                    }`}
                            >
                                <Send size={18} />
                                <span>{isSubmitting ? 'Memproses...' : securityStatus === 'vulnerable' ? 'Tolak & Kembalikan ke Dev' : 'Kirim Hasil Audit Siber'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL PRE-SUBMISSION CONFIRMATION CYBER (DAPAT DIBATALKAN UNTUK EDIT/CEK ULANG) */}
            {showConfirmRejectModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
                        <div className="bg-gradient-to-br from-red-600 via-red-700 to-rose-900 p-6 text-white text-center relative">
                            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-3 border border-white/20">
                                <ShieldAlert size={32} className="text-white animate-pulse" />
                            </div>
                            <h3 className="text-lg font-extrabold tracking-tight">KONFIRMASI PENOLAKAN AUDIT SIBER</h3>
                            <p className="text-xs text-white/80 mt-1">Status proyek akan diubah menjadi RETURN TO DEV (Remediasi)</p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="bg-red-50/60 border border-red-100 rounded-xl p-3.5 text-xs text-red-800 space-y-1">
                                <div className="font-bold text-red-900">{selectedTask?.projectName} ({selectedTask?.id})</div>
                                <div className="text-[11px] text-red-700">Jenis Audit: Penetration Testing</div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
                                    <span>Catatan Celah Keamanan (Dapat Diedit Kembali):</span>
                                    <span className="text-purple-700 flex items-center gap-1 font-normal cursor-pointer">
                                        <Edit3 size={12} /> Edit
                                    </span>
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={4}
                                    className="w-full p-3 rounded-xl border border-gray-200 text-xs font-mono bg-gray-50 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-gray-800"
                                />
                            </div>

                            <p className="text-[11px] text-gray-500 leading-relaxed bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                                💡 Klik <strong>Batal / Cek Ulang</strong> untuk memeriksa ulang berkas Pentest Report atau mengedit ulang borang.
                            </p>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmRejectModal(false)}
                                    className="flex-1 py-3 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                    ❌ Batal / Cek Ulang
                                </button>
                                <button
                                    type="button"
                                    onClick={executeSubmit}
                                    disabled={isSubmitting}
                                    className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md shadow-red-600/20 cursor-pointer disabled:opacity-70"
                                >
                                    {isSubmitting ? 'Memproses...' : '🚨 Ya, Konfirmasi Penolakan'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL HASIL AUDIT CYBER (POST-SUBMISSION) */}
            {showResultModal && modalData && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
                        <div className={`p-6 text-white text-center relative ${modalData.isVulnerable
                                ? 'bg-gradient-to-br from-red-600 via-red-700 to-rose-900'
                                : 'bg-gradient-to-br from-purple-700 via-purple-800 to-indigo-900'
                            }`}>
                            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-3 border border-white/20">
                                {modalData.isVulnerable ? (
                                    <ShieldAlert size={36} className="text-white animate-pulse" />
                                ) : (
                                    <ShieldCheck size={36} className="text-white" />
                                )}
                            </div>
                            <h3 className="text-xl font-extrabold tracking-tight">
                                {modalData.isVulnerable ? 'PROYEK DIKEMBALIKAN KE DEV (REMEDIATION)' : 'AUDIT KEAMANAN SIBER LULUS'}
                            </h3>
                            <p className="text-xs text-white/80 mt-1">
                                {modalData.isVulnerable ? 'Hasil Audit: VULNERABLE (Celah Keamanan)' : 'Hasil Audit: CLEAN (Sistem Aman)'}
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/80 space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-500 font-medium">ID / Proyek:</span>
                                    <span className="font-bold text-purple-700">{modalData.projectId}</span>
                                </div>
                                <h4 className="font-bold text-gray-800 text-sm">{modalData.projectName}</h4>
                                <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-xs">
                                    <span className="text-gray-500">Status Terbaru:</span>
                                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${modalData.isVulnerable ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-purple-100 text-purple-700 border border-purple-200'
                                        }`}>
                                        {modalData.isVulnerable ? 'RETURN TO DEV' : 'CYBER SECURE'}
                                    </span>
                                </div>
                            </div>

                            <div className="text-xs text-gray-600 leading-relaxed bg-purple-50/50 p-3.5 rounded-xl border border-purple-100">
                                {modalData.isVulnerable ? (
                                    <>
                                        <strong className="text-red-700 block mb-1">Catatan Celah Keamanan (Pentest Report):</strong>
                                        <span className="italic text-gray-700 block bg-white p-2 rounded border border-gray-200 font-mono text-[11px] mb-2">
                                            "{modalData.notes}"
                                        </span>
                                        <p>
                                            Proyek dialihkan ke status <strong>RETURN TO DEV (Remediasi Kode)</strong>. Laporan celah keamanan telah diteruskan ke PM dan Dev Lead.
                                        </p>
                                    </>
                                ) : (
                                    <p>
                                        Audit Penetration Testing telah selesai dan terverifikasi aman. Proyek siap diajukan ke <strong>Quality Gate (Fase 4: Rilis &amp; Kepatuhan)</strong>.
                                    </p>
                                )}
                            </div>

                            <button
                                onClick={handleCloseResultModal}
                                className={`w-full py-3 px-4 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${modalData.isVulnerable
                                        ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                                        : 'bg-purple-700 hover:bg-purple-800 shadow-purple-700/20'
                                    }`}
                            >
                                <span>Mengerti &amp; Selesai</span>
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}