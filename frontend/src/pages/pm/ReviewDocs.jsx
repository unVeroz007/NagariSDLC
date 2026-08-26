import { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { getProjectRealDocuments } from '../../utils/projectDocuments';
import RBBBadge from '../../components/RBBBadge';
import ProjectTypeBadge from '../../components/ProjectTypeBadge';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import {
    TRACK_STATUS_LABEL,
    canRequestGoLive,
    getCyberTrackStatus,
    getQaTrackStatus,
    isTrackPassed,
} from '../../constants/projectStatus';
import {
    FileCheck,
    ShieldCheck,
    Inbox,
    Building,
    Calendar,
    Eye,
    FileText,
    Rocket,
    Shield,
    Bug,
    Clock,
    User,
    FolderOpen,
    ChevronRight,
} from 'lucide-react';

const formatDateTime = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

/**
 * Ringkasan satu jalur pengujian untuk kartu sign-off.
 *
 * Kartu ini sebelumnya membaca `project.qaSignOff` dan `project.cyberSignOff` —
 * dua key yang tidak pernah dikirim API dan tidak pernah dibentuk normalizeProject,
 * sehingga kartunya selalu "MENUNGGU" dan lencana kelengkapan di kotak masuk selalu
 * kosong meski Lead sudah menandatangani laporannya. Sumber yang benar adalah kolom
 * status jalur (`qa_status` / `cyber_status`) beserta laporan terakhirnya
 * (`qa_report` / `cyber_report`), keduanya dipaparkan ProjectResource.
 */
const buildTrackSummary = (project, trackKey) => {
    const isQa = trackKey === 'qa';
    const status = isQa ? getQaTrackStatus(project) : getCyberTrackStatus(project);
    const report = isQa ? project?.qaReport : project?.cyberReport;

    return {
        key: trackKey,
        status,
        statusLabel: TRACK_STATUS_LABEL[status] || 'Belum Diajukan',
        isPassed: isTrackPassed(status),
        isSignedOff: Boolean(report?.is_reviewed),
        reviewerName: report?.reviewer_name || null,
        reviewedAt: formatDateTime(report?.reviewed_at),
        decisionLabel: report?.reviewed_result_label || null,
        reviewNotes: report?.review_notes || null,
        testerName: report?.tester_name || null,
        testerResultLabel: report?.result_label || null,
        severity: report?.severity || null,
        testedScenarios: report?.tested_scenarios || null,

        // Hanya terisi pada laporan sebelum cakupan pengujian diubah menjadi catatan bebas.
        checklistSummary: report?.checklist_summary || null,
    };
};

export default function ReviewDocs() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { projects } = useProjects();
    const rightPanelRef = useRef(null);

    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [previewDocument, setPreviewDocument] = useState(null);

    // Kotak masuk hasil pengujian: proyek yang salah satu jalurnya sudah dinyatakan
    // lulus Lead. Filter lama memakai `status` utama (QA_PASSED / CYBER_PASSED), padahal
    // status utama hanya memegang satu penunjuk siklus — proyek yang QA-nya lulus
    // sementara jalur Siber masih berjalan tidak pernah muncul di sini.
    const receivedProjects = useMemo(() => {
        let list = (projects || []).filter(
            (p) => isTrackPassed(getQaTrackStatus(p)) || isTrackPassed(getCyberTrackStatus(p))
        );

        const isPrivileged = user?.role
            && ['super_admin', 'lead_group', 'head_of_it', 'development_lead'].includes(user.role);

        if (!isPrivileged && user?.id) {
            list = list.filter((p) => {
                const pmObjId = typeof p.pm === 'object' ? p.pm?.id : null;
                return pmObjId && pmObjId === user.id;
            });
        }

        return list;
    }, [projects, user]);

    // Pilihan disimpan sebagai id supaya panel kanan selalu membaca data proyek terbaru
    // setelah polling menyegarkan daftar, bukan salinan objek saat proyek diklik.
    const activeProject = useMemo(() => {
        if (receivedProjects.length === 0) return null;

        return receivedProjects.find((p) => String(p.id) === String(selectedProjectId))
            || receivedProjects[0];
    }, [receivedProjects, selectedProjectId]);

    const scrollToTop = () => {
        if (rightPanelRef.current) rightPanelRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const activeProjectKey = activeProject?.id ?? null;

    useEffect(() => {
        if (activeProjectKey === null) return;
        scrollToTop();
    }, [activeProjectKey]);

    // Dokumen nyata milik proyek pada Document Vault.
    //
    // Daftar sebelumnya dikarang: nama berkas, ukuran, penulis, sampai isi dokumen
    // dibentuk dari template di berkas ini, sehingga PM meninjau "dokumen serah terima"
    // yang tidak pernah diunggah siapa pun.
    const projectDocuments = useMemo(
        () => getProjectRealDocuments(activeProject),
        [activeProject]
    );

    const qaTrack = useMemo(() => buildTrackSummary(activeProject, 'qa'), [activeProject]);
    const cyberTrack = useMemo(() => buildTrackSummary(activeProject, 'cyber'), [activeProject]);

    // Gerbang yang sama dengan backend: kedua jalur harus lulus sebelum PM boleh
    // mengajukan migrasi ke Grup Infrastruktur.
    const isReadyForInfra = activeProject ? canRequestGoLive(activeProject) : false;

    const handleSubmitToInfra = () => {
        navigate('/pm/release-request');
    };

    const renderTrackCard = (track) => {
        const isQa = track.key === 'qa';
        const TrackIcon = isQa ? Bug : Shield;
        const accent = isQa
            ? { border: 'border-blue-200 bg-blue-50/50', badge: 'bg-blue-600', chip: 'border-blue-100', note: 'bg-blue-50', value: 'text-blue-700' }
            : { border: 'border-emerald-200 bg-emerald-50/50', badge: 'bg-emerald-600', chip: 'border-emerald-100', note: 'bg-emerald-50', value: 'text-emerald-700' };

        return (
            <div
                className={`p-4 rounded-2xl border-2 space-y-3 ${
                    track.isSignedOff ? accent.border : 'border-dashed border-gray-200 bg-gray-50/50'
                }`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                track.isSignedOff ? `${accent.badge} text-white` : 'bg-gray-200 text-gray-400'
                            }`}
                        >
                            <TrackIcon size={16} />
                        </div>
                        <span className="font-extrabold text-sm text-gray-800">
                            {isQa ? 'Hasil Pengujian QA' : 'Hasil Audit Keamanan Siber'}
                        </span>
                    </div>
                    <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            track.isPassed
                                ? `${accent.badge} text-white`
                                : 'bg-gray-200 text-gray-600'
                        }`}
                    >
                        {track.statusLabel.toUpperCase()}
                    </span>
                </div>

                {track.isSignedOff ? (
                    <div className={`bg-white rounded-lg p-3 border ${accent.chip} space-y-1.5 text-xs`}>
                        <div className="text-gray-500">
                            {isQa ? 'Lead QA' : 'Lead Keamanan Siber'}:{' '}
                            <strong className="text-gray-800">{track.reviewerName || 'Tidak tercatat'}</strong>
                        </div>
                        <div className="text-gray-500">
                            Tanggal sign-off:{' '}
                            <strong className="text-gray-800">{track.reviewedAt || 'Tidak tercatat'}</strong>
                        </div>
                        <div className="text-gray-500">
                            Keputusan Lead:{' '}
                            <span className={`font-extrabold ${accent.value}`}>
                                {track.decisionLabel || 'Tidak tercatat'}
                            </span>
                        </div>
                        <div className="text-gray-500">
                            Pelaksana:{' '}
                            <strong className="text-gray-800">{track.testerName || 'Tidak tercatat'}</strong>
                            {track.testerResultLabel ? ` — ${track.testerResultLabel}` : ''}
                        </div>
                        {track.severity && (
                            <div className="text-gray-500">
                                Tingkat severitas temuan:{' '}
                                <span className={`font-extrabold ${accent.value}`}>{track.severity}</span>
                            </div>
                        )}
                        {track.testedScenarios && (
                            <div className="text-gray-500">
                                Skenario yang diuji:
                                <span className="block mt-1 text-gray-800 leading-relaxed whitespace-pre-wrap">{track.testedScenarios}</span>
                            </div>
                        )}
                        {track.checklistSummary && (
                            <div className="text-gray-500">
                                Cakupan skenario: <strong className="text-gray-800">{track.checklistSummary}</strong>
                            </div>
                        )}
                        {track.reviewNotes && (
                            <div className={`mt-2 ${accent.note} p-2 rounded-lg text-gray-700 leading-relaxed whitespace-pre-wrap`}>
                                {track.reviewNotes}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-xs text-gray-500 text-center py-4">
                        Belum ada sign-off {isQa ? 'Lead QA' : 'Lead Keamanan Siber'}. Status jalur saat ini:{' '}
                        <strong>{track.statusLabel}</strong>.
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            {/* Header */}
            <div className="mb-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-extrabold text-gray-800">Penerimaan Dokumen QA &amp; Cyber</h2>
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                            <FileCheck size={14} /> Fase 3 ke Fase 4 Handover
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                        Tinjau hasil sign-off dari Lead QA &amp; Lead Keamanan Siber yang dikembalikan ke Tim
                        Pengembangan, kemudian ajukan paket migrasi ke Grup INFRA bila kedua jalur sudah lulus.
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
                                Belum ada jalur pengujian yang dinyatakan lulus Lead.
                            </div>
                        ) : (
                            receivedProjects.map((p) => {
                                const hasQA = isTrackPassed(getQaTrackStatus(p));
                                const hasCyber = isTrackPassed(getCyberTrackStatus(p));
                                const isActive = String(activeProject?.id) === String(p.id);
                                return (
                                    <div
                                        key={p.id}
                                        onClick={() => setSelectedProjectId(p.id)}
                                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                            isActive
                                                ? 'border-2 border-[#1a365d] bg-blue-50/40 shadow-sm'
                                                : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-1.5">
                                            <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                {p.reqId || p.id}
                                            </span>
                                            <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={p.type} /><ProjectTypeBadge type={p.project_type} /></div>
                                        </div>
                                        <h4 className="font-bold text-gray-800 text-sm line-clamp-1 mb-2">{p.name}</h4>

                                        {/* Lencana kelengkapan sign-off — dibaca dari status jalur */}
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${hasQA ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                                <Bug size={10} /> QA {hasQA ? 'Lulus' : TRACK_STATUS_LABEL[getQaTrackStatus(p)]}
                                            </span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${hasCyber ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                                <Shield size={10} /> Siber {hasCyber ? 'Lulus' : TRACK_STATUS_LABEL[getCyberTrackStatus(p)]}
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
                                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">
                                        {activeProject.reqId || activeProject.id}
                                    </span>
                                    <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={activeProject.type} /><ProjectTypeBadge type={activeProject.project_type} /></div>
                                </div>
                                <h3 className="text-xl font-extrabold text-gray-800">{activeProject.name}</h3>
                                <div className="flex items-center gap-4 text-xs text-gray-500 mt-1.5 flex-wrap">
                                    <span className="flex items-center gap-1">
                                        <Building size={13} /> {activeProject.division || 'Belum ada data divisi'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Calendar size={13} /> Target: <strong className="text-gray-700">{activeProject.targetDate}</strong>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <User size={13} /> PM:{' '}
                                        <strong className="text-gray-700">
                                            {(typeof activeProject.pm === 'object' ? activeProject.pm?.name : activeProject.pm) || 'Belum ditugaskan'}
                                        </strong>
                                    </span>
                                </div>
                            </div>

                            {/* Banner kelengkapan handover */}
                            <div className={`p-4 rounded-2xl border-2 flex items-center gap-4 ${isReadyForInfra ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-200'}`}>
                                <div
                                    className={`w-11 h-11 rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm ${
                                        isReadyForInfra ? 'bg-emerald-500' : 'bg-amber-400'
                                    }`}
                                >
                                    {isReadyForInfra ? <Rocket size={22} /> : <Clock size={22} />}
                                </div>
                                <div>
                                    <div className={`font-extrabold text-sm ${isReadyForInfra ? 'text-emerald-800' : 'text-amber-800'}`}>
                                        {isReadyForInfra
                                            ? 'Kedua jalur pengujian lulus — siap diajukan ke Grup INFRA'
                                            : 'Menunggu kelengkapan sign-off kedua jalur pengujian'}
                                    </div>
                                    <div className={`text-xs mt-0.5 ${isReadyForInfra ? 'text-emerald-700' : 'text-amber-700'}`}>
                                        Pengujian QA: <strong>{qaTrack.statusLabel}</strong>. Audit Keamanan Siber:{' '}
                                        <strong>{cyberTrack.statusLabel}</strong>.
                                    </div>
                                </div>
                            </div>

                            {/* Kartu sign-off kedua jalur */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {renderTrackCard(qaTrack)}
                                {renderTrackCard(cyberTrack)}
                            </div>

                            {/* Dokumen SDLC yang Diterima */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <FolderOpen size={15} className="text-[#1a365d]" />
                                    Dokumen SDLC pada Document Vault ({projectDocuments.length})
                                </h4>
                                <div className="space-y-2.5">
                                    {projectDocuments.length === 0 ? (
                                        <p className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                                            Belum ada dokumen tersimpan untuk proyek ini. Laporan QA dan Audit Keamanan
                                            Siber beserta lampirannya diunggah pelaksana pengujian melalui halaman
                                            tugasnya masing-masing.
                                        </p>
                                    ) : (
                                        projectDocuments.map((doc) => (
                                            <div key={doc.id} className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between hover:border-blue-200 transition-all">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
                                                        <FileText size={17} />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <h5 className="font-bold text-gray-800 text-xs truncate">{doc.name}</h5>
                                                        <p className="text-[10px] text-gray-500 mt-0.5">
                                                            {doc.type}
                                                            {doc.size ? ` • ${doc.size}` : ''}
                                                            {doc.author ? ` • ${doc.author}` : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewDocument(doc)}
                                                    className="px-3 py-1.5 bg-[#1a365d] hover:bg-[#0f2342] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                                                >
                                                    <Eye size={13} /> Pratinjau
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Action: Ajukan ke INFRA */}
                            <div className={`p-5 rounded-2xl border-2 space-y-4 ${isReadyForInfra ? 'bg-[#1a365d] border-[#1a365d]' : 'bg-gray-100 border-gray-200'}`}>
                                {isReadyForInfra ? (
                                    <>
                                        <div className="flex items-center gap-2 text-white">
                                            <Rocket size={18} />
                                            <span className="font-extrabold text-sm">Langkah berikutnya: ajukan paket migrasi ke Grup INFRA</span>
                                        </div>
                                        <p className="text-blue-100 text-xs leading-relaxed">
                                            Sign-off Lead QA dan Lead Keamanan Siber sudah tercatat. PM dapat mengisi
                                            target tanggal rilis, estimasi downtime, dan prosedur rollback pada halaman
                                            Pengajuan Rilis untuk diteruskan ke Quality Gate Grup INFRA.
                                        </p>
                                        <button
                                            onClick={handleSubmitToInfra}
                                            className="w-full py-3.5 bg-white hover:bg-gray-100 text-[#1a365d] rounded-xl font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <Rocket size={16} />
                                            Buka Halaman Pengajuan Rilis ke Grup INFRA
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <Clock size={18} />
                                            <span className="font-extrabold text-sm text-gray-700">Menunggu kelengkapan sign-off sebelum ke INFRA</span>
                                        </div>
                                        <p className="text-gray-500 text-xs leading-relaxed">
                                            Backend menolak pengajuan rilis selama kedua jalur pengujian belum berstatus
                                            Lulus. Pengujian QA: <strong>{qaTrack.statusLabel}</strong>. Audit Keamanan
                                            Siber: <strong>{cyberTrack.statusLabel}</strong>.
                                        </p>
                                        <button disabled className="w-full py-3.5 bg-gray-200 text-gray-400 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 cursor-not-allowed">
                                            <Rocket size={16} />
                                            Pengajuan ke INFRA belum tersedia
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* PRATINJAU DOKUMEN — berkas asli dari Document Vault, bukan teks contoh */}
            {previewDocument && (
                <DocumentViewerModal
                    doc={previewDocument}
                    project={activeProject}
                    onClose={() => setPreviewDocument(null)}
                />
            )}
        </div>
    );
}
