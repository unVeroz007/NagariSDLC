import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import RBBBadge from '../../components/RBBBadge';
import toast from 'react-hot-toast';
import {
    FileCheck,
    ShieldCheck,
    CheckCircle2,
    CheckCircle,
    ArrowRight,
    Inbox,
    Building,
    Calendar,
    Copy,
    Eye,
    Download,
    FileText,
    X,
    Rocket,
    Shield,
    Bug,
    AlertTriangle,
    Clock,
    User,
    FolderOpen,
    ChevronRight,
    Star,
    Zap,
} from 'lucide-react';

// Status badge config
const STATUS_CONFIG = {
    QA_PASSED:     { label: 'Lulus QA ✅', bg: 'bg-blue-100',   text: 'text-blue-800'   },
    CYBER_PASSED:  { label: 'Lulus QA + Cyber ✅', bg: 'bg-emerald-100', text: 'text-emerald-800' },
    QA_IN_PROGRESS: { label: 'QA Sedang Berjalan', bg: 'bg-purple-100', text: 'text-purple-800' },
    CYBER_IN_PROGRESS: { label: 'Cyber Sedang Berjalan', bg: 'bg-orange-100', text: 'text-orange-800' },
    RETURN_TO_DEV: { label: 'Dikembalikan ke Dev', bg: 'bg-red-100', text: 'text-red-800' },
};

export default function ReviewDocs() {
    const navigate = useNavigate();
    const { projects } = useProjects();
    const { addNotification } = useNotifications();
    const rightPanelRef = useRef(null);

    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedDocPreview, setSelectedDocPreview] = useState(null);

    // Proyek yang dikembalikan dari QA Lead atau Cyber Lead ke Tim Dev/PM.
    const receivedProjects = useMemo(() => {
        let list = (projects || []).filter(p =>
            ['QA_PASSED', 'CYBER_PASSED'].includes(p.status)
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


    const activeProject = selectedProject || receivedProjects[0] || null;

    const scrollToTop = () => {
        if (rightPanelRef.current) rightPanelRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    useEffect(() => {
        if (activeProject) scrollToTop();
    }, [activeProject?.id]);

    // Dokumen SDLC yang diterima bersama sign-off
    const projectDocuments = useMemo(() => {
        if (!activeProject) return [];
        const docs = [
            {
                id: 1, name: `BRD_${activeProject.id}_Business_Requirement.pdf`,
                type: 'BRD (Business Requirement Document)', size: '2.4 MB', author: 'Analyst TI',
                content: `DOKUMEN BRD - ${activeProject.name}\nDivisi: ${activeProject.division || 'Divisi TI Bank Nagari'}\nStatus Terakhir: ${activeProject.status}`,
            },
            {
                id: 2, name: `FSD_${activeProject.id}_Functional_Spec.pdf`,
                type: 'FSD (Functional Specification Document)', size: '3.8 MB', author: 'System Analyst',
                content: `DOKUMEN FSD - ${activeProject.name}\nStaging URL: ${activeProject.stagingUrl}`,
            },
        ];
        if (activeProject.qaSignOff) {
            docs.push({
                id: 3, name: `QA_SignOff_${activeProject.id}_Approved.pdf`,
                type: '📋 Lembar Sign-Off Resmi Lead QA', size: '1.9 MB', author: activeProject.qaSignOff.leadName,
                content: `LEMBAR SIGN-OFF QA\nBank Nagari IT Governance\n\nProyek: ${activeProject.name}\nLead QA: ${activeProject.qaSignOff.leadName}\nTanggal Sign-Off: ${activeProject.qaSignOff.signOffDate}\nKeputusan: ${activeProject.qaSignOff.decision}\n\nCatatan:\n${activeProject.qaSignOff.notes}`,
            });
        }
        if (activeProject.cyberSignOff) {
            docs.push({
                id: 4, name: `Cyber_SignOff_${activeProject.id}_Cleared.pdf`,
                type: '🛡️ Lembar Sign-Off Resmi Lead Cyber Security', size: '2.1 MB', author: activeProject.cyberSignOff.leadName,
                content: `LEMBAR SIGN-OFF CYBER SECURITY\nBank Nagari IT Governance\n\nProyek: ${activeProject.name}\nLead Cyber: ${activeProject.cyberSignOff.leadName}\nTanggal Sign-Off: ${activeProject.cyberSignOff.signOffDate}\nKeputusan: ${activeProject.cyberSignOff.decision}\nTingkat Risiko: ${activeProject.cyberSignOff.riskLevel}\n\nCatatan:\n${activeProject.cyberSignOff.notes}`,
            });
        }
        return docs;
    }, [activeProject]);

    const qaOk = activeProject?.qaSignOff != null;
    const cyberOk = activeProject?.cyberSignOff != null;
    const bothDone = qaOk && cyberOk;
    const isReadyForInfra = activeProject?.status === 'CYBER_PASSED';

    const handleSubmitToInfra = () => {
        navigate('/pm/release-request');
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            {/* Header */}
            <div className="mb-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-extrabold text-gray-800">Penerimaan Dokumen QA &amp; Cyber</h2>
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                            <FileCheck size={14} /> Fase 3 → Fase 4 Handover
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                        Tinjau hasil sign-off dari Lead QA &amp; Lead Cyber Security yang dikembalikan ke Tim Pengembangan,
                        kemudian ajukan paket migrasi ke Grup INFRA bila semua dokumen sudah lengkap.
                    </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold shrink-0">
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                        <FileCheck size={14} /> QA Sign-Off
                    </div>
                    <ChevronRight size={14} className="text-gray-400" />
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-700 rounded-xl border border-orange-100">
                        <ShieldCheck size={14} /> Cyber Sign-Off
                    </div>
                    <ChevronRight size={14} className="text-gray-400" />
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-[#1a365d] text-white rounded-xl">
                        <Rocket size={14} /> Pengajuan ke INFRA
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LIST PANEL (Panel Kiri) */}
                <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[calc(100vh-220px)] overflow-hidden">
                    <div className="text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Inbox size={14} />
                        Kotak Masuk Hasil Pengujian ({receivedProjects.length})
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {receivedProjects.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                                <Inbox size={32} className="mx-auto mb-2 text-gray-300" />
                                Belum ada proyek yang dikembalikan dari QA/Cyber.
                            </div>
                        ) : (
                            receivedProjects.map(p => {
                                const hasQA = !!p.qaSignOff;
                                const hasCyber = !!p.cyberSignOff;
                                const isActive = activeProject?.id === p.id;
                                return (
                                    <div
                                        key={p.id}
                                        onClick={() => { setSelectedProject(p); scrollToTop(); }}
                                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                            isActive
                                                ? 'border-2 border-[#1a365d] bg-blue-50/40 shadow-sm'
                                                : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-1.5">
                                            <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{p.id}</span>
                                            <RBBBadge type={p.type} />
                                        </div>
                                        <h4 className="font-bold text-gray-800 text-sm line-clamp-1 mb-2">{p.name}</h4>

                                        {/* Badge Status Kelengkapan */}
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${hasQA ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                                                <Bug size={10} /> QA {hasQA ? '✓' : '–'}
                                            </span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${hasCyber ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                                                <Shield size={10} /> Cyber {hasCyber ? '✓' : '–'}
                                            </span>
                                            {hasQA && hasCyber && (
                                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-[#1a365d] text-white flex items-center gap-1">
                                                    <Rocket size={9} /> Siap INFRA
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* DETAIL PANEL (Panel Kanan) */}
                <div ref={rightPanelRef} className="lg:col-span-8 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-y-auto h-[calc(100vh-220px)] scroll-smooth">
                    {!activeProject ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20">
                            <Inbox size={48} className="mb-3 text-gray-300" />
                            <p className="font-bold text-gray-600">Pilih proyek dari kotak masuk</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Header Proyek */}
                            <div className="pb-4 border-b border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">{activeProject.id}</span>
                                    <RBBBadge type={activeProject.type} />
                                </div>
                                <h3 className="text-xl font-extrabold text-gray-800">{activeProject.name}</h3>
                                <div className="flex items-center gap-4 text-xs text-gray-500 mt-1.5 flex-wrap">
                                    <span className="flex items-center gap-1"><Building size={13} /> {activeProject.division}</span>
                                    <span className="flex items-center gap-1"><Calendar size={13} /> Target: <strong className="text-gray-700">{activeProject.targetDate}</strong></span>
                                    <span className="flex items-center gap-1"><User size={13} /> PM: <strong className="text-gray-700">{activeProject.pm?.name}</strong></span>
                                </div>
                            </div>

                            {/* Progress Handover Banner */}
                            <div className={`p-4 rounded-2xl border-2 flex items-center gap-4 ${isReadyForInfra ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-200'}`}>
                                {isReadyForInfra ? (
                                    <>
                                        <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                                            <Rocket size={22} />
                                        </div>
                                        <div>
                                            <div className="font-extrabold text-emerald-800 text-sm">Semua Pengujian Selesai — Siap Diajukan ke Grup INFRA!</div>
                                            <div className="text-xs text-emerald-700 mt-0.5">QA Sign-Off ✅ &amp; Cyber Security Sign-Off ✅ sudah diterima. PM dapat mengajukan paket migrasi ke Grup INFRA.</div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-11 h-11 rounded-xl bg-amber-400 text-white flex items-center justify-center shrink-0 shadow-sm">
                                            <Clock size={22} />
                                        </div>
                                        <div>
                                            <div className="font-extrabold text-amber-800 text-sm">Sebagian Pengujian Selesai — Menunggu Sisa Sign-Off</div>
                                            <div className="text-xs text-amber-700 mt-0.5">
                                                {qaOk ? 'QA Sign-Off ✅ sudah diterima.' : 'QA Sign-Off ⏳ belum selesai.'}
                                                {' '}
                                                {cyberOk ? 'Cyber Sign-Off ✅ sudah diterima.' : 'Cyber Sign-Off ⏳ belum selesai.'}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* QA & Cyber Sign-off Cards (Side by Side) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* QA Sign-Off Card */}
                                <div className={`p-4 rounded-2xl border-2 space-y-3 ${qaOk ? 'border-blue-200 bg-blue-50/50' : 'border-dashed border-gray-200 bg-gray-50/50'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${qaOk ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                                                <Bug size={16} />
                                            </div>
                                            <span className="font-extrabold text-sm text-gray-800">Hasil QA Testing</span>
                                        </div>
                                        {qaOk ? (
                                            <span className="text-[10px] font-extrabold bg-blue-600 text-white px-2 py-0.5 rounded-full">SIGN-OFF ✓</span>
                                        ) : (
                                            <span className="text-[10px] font-extrabold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">MENUNGGU</span>
                                        )}
                                    </div>
                                    {qaOk ? (
                                        <div className="space-y-1.5 text-xs">
                                            <div className="bg-white rounded-lg p-3 border border-blue-100 space-y-1.5">
                                                <div className="text-gray-500">Lead QA: <strong className="text-gray-800">{activeProject.qaSignOff.leadName}</strong></div>
                                                <div className="text-gray-500">Tanggal: <strong className="text-gray-800">{activeProject.qaSignOff.signOffDate}</strong></div>
                                                <div className="text-gray-500">Keputusan: <span className="font-extrabold text-blue-700">{activeProject.qaSignOff.decision}</span></div>
                                                <div className="mt-2 bg-blue-50 p-2 rounded-lg text-gray-700 leading-relaxed">
                                                    {activeProject.qaSignOff.notes}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-400 text-center py-4">
                                            Belum ada sign-off dari Lead QA.
                                        </div>
                                    )}
                                </div>

                                {/* Cyber Sign-Off Card */}
                                <div className={`p-4 rounded-2xl border-2 space-y-3 ${cyberOk ? 'border-emerald-200 bg-emerald-50/50' : 'border-dashed border-gray-200 bg-gray-50/50'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cyberOk ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                                                <Shield size={16} />
                                            </div>
                                            <span className="font-extrabold text-sm text-gray-800">Hasil Cyber Pentest</span>
                                        </div>
                                        {cyberOk ? (
                                            <span className="text-[10px] font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded-full">SIGN-OFF ✓</span>
                                        ) : (
                                            <span className="text-[10px] font-extrabold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">MENUNGGU</span>
                                        )}
                                    </div>
                                    {cyberOk ? (
                                        <div className="space-y-1.5 text-xs">
                                            <div className="bg-white rounded-lg p-3 border border-emerald-100 space-y-1.5">
                                                <div className="text-gray-500">Lead Cyber: <strong className="text-gray-800">{activeProject.cyberSignOff.leadName}</strong></div>
                                                <div className="text-gray-500">Tanggal: <strong className="text-gray-800">{activeProject.cyberSignOff.signOffDate}</strong></div>
                                                <div className="text-gray-500">Keputusan: <span className="font-extrabold text-emerald-700">{activeProject.cyberSignOff.decision}</span></div>
                                                <div className="text-gray-500">Risk Level: <span className="font-extrabold text-emerald-700">{activeProject.cyberSignOff.riskLevel}</span></div>
                                                <div className="mt-2 bg-emerald-50 p-2 rounded-lg text-gray-700 leading-relaxed">
                                                    {activeProject.cyberSignOff.notes}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-400 text-center py-4">
                                            Belum ada sign-off dari Lead Cyber Security.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Dokumen SDLC yang Diterima */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <FolderOpen size={15} className="text-[#1a365d]" />
                                    Dokumen SDLC yang Diterima ({projectDocuments.length})
                                </h4>
                                <div className="space-y-2.5">
                                    {projectDocuments.map(doc => (
                                        <div key={doc.id} className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between hover:border-blue-200 transition-all">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
                                                    <FileText size={17} />
                                                </div>
                                                <div className="overflow-hidden">
                                                    <h5 className="font-bold text-gray-800 text-xs truncate">{doc.name}</h5>
                                                    <p className="text-[10px] text-gray-500 mt-0.5">{doc.type} • {doc.size} • {doc.author}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSelectedDocPreview(doc)}
                                                className="px-3 py-1.5 bg-[#1a365d] hover:bg-[#0f2342] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                                            >
                                                <Eye size={13} /> Pratinjau
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Action: Ajukan ke INFRA */}
                            <div className={`p-5 rounded-2xl border-2 space-y-4 ${isReadyForInfra ? 'bg-[#1a365d] border-[#1a365d]' : 'bg-gray-100 border-gray-200'}`}>
                                {isReadyForInfra ? (
                                    <>
                                        <div className="flex items-center gap-2 text-white">
                                            <Rocket size={18} />
                                            <span className="font-extrabold text-sm">Langkah Berikutnya: Ajukan Paket Migrasi ke Grup INFRA</span>
                                        </div>
                                        <p className="text-blue-100 text-xs leading-relaxed">
                                            Semua dokumen sign-off QA dan Cyber Security telah diterima. PM sekarang dapat mengajukan
                                            <strong> Paket Migrasi Lengkap</strong> (SQL Script, Binary Package, Rollback Plan)
                                            ke <strong>Grup INFRA (Tim Infrastruktur)</strong> melalui Halaman Pengajuan Rilis untuk mendapatkan
                                            persetujuan Go-Live ke server produksi.
                                        </p>
                                        <button
                                            onClick={handleSubmitToInfra}
                                            className="w-full py-3.5 bg-white hover:bg-gray-100 text-[#1a365d] rounded-xl font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <Rocket size={16} />
                                            Buka Halaman Pengajuan Rilis ke Grup INFRA →
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <Clock size={18} />
                                            <span className="font-extrabold text-sm text-gray-700">Menunggu Kelengkapan Sign-Off Sebelum ke INFRA</span>
                                        </div>
                                        <p className="text-gray-500 text-xs leading-relaxed">
                                            Proyek ini belum dapat diajukan ke Grup INFRA karena masih ada sign-off yang belum diterima.
                                            Pastikan <strong>QA Sign-Off ✅</strong> dan <strong>Cyber Security Sign-Off ✅</strong> keduanya sudah lengkap.
                                        </p>
                                        <button disabled className="w-full py-3.5 bg-gray-200 text-gray-400 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 cursor-not-allowed">
                                            <Rocket size={16} />
                                            Pengajuan ke INFRA Belum Tersedia
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL PRATINJAU DOKUMEN */}
            {selectedDocPreview && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-scale-up overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-gray-100 my-8 space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#1a365d] text-white font-bold flex items-center justify-center text-sm">BN</div>
                                <div>
                                    <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Dokumen Resmi SDLC Bank Nagari</div>
                                    <h3 className="font-extrabold text-gray-800 text-base mt-0.5">{selectedDocPreview.name}</h3>
                                </div>
                            </div>
                            <button onClick={() => setSelectedDocPreview(null)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg cursor-pointer"><X size={20} /></button>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl max-h-[60vh] overflow-y-auto font-mono text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                            {selectedDocPreview.content}
                        </div>
                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                            <button
                                onClick={() => toast.success(`Dokumen ${selectedDocPreview.name} berhasil diunduh!`)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                                <Download size={14} /> Unduh Dokumen (PDF)
                            </button>
                            <button onClick={() => setSelectedDocPreview(null)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold transition-all cursor-pointer">
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
