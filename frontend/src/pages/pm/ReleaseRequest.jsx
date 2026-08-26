import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useProjects } from '../../contexts/ProjectContext';
import { getProjectRealDocuments } from '../../utils/projectDocuments';
import LoadingSpinner from '../../components/LoadingSpinner';
import RBBBadge from '../../components/RBBBadge';
import ProjectTypeBadge from '../../components/ProjectTypeBadge';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import toast from 'react-hot-toast';
import { generateDocumentName, DOCUMENT_TYPES, formatFileSize } from '../../utils/documentNaming';
import { releaseRequestService, documentService } from '../../services/api';
import {
    PROJECT_STATUS,
    PROJECT_STATUS_LABEL,
    TRACK_STATUS_LABEL,
    canRequestGoLive,
    getCyberTrackStatus,
    getQaTrackStatus,
    isTrackPassed,
} from '../../constants/projectStatus';
import {
    Rocket,
    Search,
    ShieldCheck,
    CloudUpload,
    CheckCircle,
    AlertTriangle,
    Calendar,
    Clock,
    FileText,
    X,
    Server,
    Building,
    User,
    Eye,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';

// Panel kiri menampilkan paling banyak lima proyek sekaligus; sisanya dijangkau lewat
// tombol halaman. Angka kecil dipilih supaya proyek yang sudah live — yang menetap di
// daftar sebagai riwayat — tidak mendorong proyek yang masih butuh aksi keluar layar.
const PROJECTS_PER_PAGE = 5;

export default function ReleaseRequest() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { addNotification } = useNotifications();
    const { projects, refreshData, isLoading } = useProjects();
    const rightPanelRef = useRef(null);

    // Filter proyek siap diajukan ke Grup INFRA.
    // Syarat: kedua jalur pengujian (QA & Keamanan Siber) sudah dinyatakan lulus,
    // dibaca dari kolom jalur qa_status/cyber_status — bukan dari status utama —
    // supaya urutan siapa yang sign-off lebih dulu tidak mengubah hasilnya.
    // PENDING_GOLIVE tetap ditampilkan karena sudah diajukan ke INFRA dan sedang
    // menunggu proses quality gate. LIVE_PRODUCTION juga ditampilkan sebagai riwayat
    // rilis yang sudah tuntas — keduanya tampil read-only, formulirnya terkunci.
    // Keduanya disebut eksplisit, bukan mengandalkan canRequestGoLive: proyek terminal
    // pun lulus dua jalur, jadi tanpa penyebutan ini status live yang datanya tidak
    // lengkap bisa lolos sebagai "siap diajukan" dan memicu 422 saat dikirim.
    const readyProjects = useMemo(() => {
        let list = projects.filter(p => {
            const st = String(p.status || '').toUpperCase();
            return canRequestGoLive(p)
                || st === PROJECT_STATUS.PENDING_GOLIVE
                || st === PROJECT_STATUS.LIVE_PRODUCTION;
        });

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


    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [previewDocument, setPreviewDocument] = useState(null);

    const [formData, setFormData] = useState({
        releaseDate: '',
        // Nilai bawaan wajib sama dengan salah satu <option value> pada select di
        // bawah. Nilai lama '30 Menit (Pemeliharaan Terjadwal)' tidak cocok dengan
        // opsi mana pun, sehingga select tampil kosong sementara nilai yang terkirim
        // ke backend tetap teks yang tidak pernah dipilih pengguna.
        downtime: '30 Menit',
        releaseNotes: '',
        rollbackProcedure: '',
    });
    const [uploadedFile, setUploadedFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    // Kotak pencarian sebelumnya tidak menyaring apa pun: nilainya tersimpan di state
    // tetapi daftar proyek yang dirender tetap `readyProjects` utuh.
    const visibleProjects = useMemo(() => {
        const keyword = searchTerm.trim().toLowerCase();
        if (keyword === '') return readyProjects;

        return readyProjects.filter((p) =>
            [p.name, p.reqId, p.id, p.division].some((field) =>
                String(field ?? '').toLowerCase().includes(keyword)
            )
        );
    }, [readyProjects, searchTerm]);

    // Paginasi panel kiri. Pencarian menyaring lebih dulu (visibleProjects), lalu daftar
    // itu dipotong lima proyek per halaman. `safePage` menjaga nomor halaman tetap sah
    // saat daftar menyusut — mis. setelah sebuah pengajuan tersimpan — tanpa perlu
    // menulis ulang state di tengah render.
    const totalPages = Math.max(1, Math.ceil(visibleProjects.length / PROJECTS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const pagedProjects = useMemo(
        () => visibleProjects.slice((safePage - 1) * PROJECTS_PER_PAGE, safePage * PROJECTS_PER_PAGE),
        [visibleProjects, safePage]
    );

    // Setiap pencarian baru mengembalikan tampilan ke halaman pertama, supaya hasil yang
    // cocok tidak tersembunyi di halaman yang kebetulan sedang dibuka sebelumnya. Reset
    // dilakukan pada handler pencarian, bukan lewat useEffect, agar tidak memicu render
    // beruntun.
    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    // Pilihan disimpan sebagai id, bukan salinan objek proyek. Menyimpan objeknya
    // membuat panel kanan menampilkan data basi setiap kali polling menyegarkan daftar
    // proyek — termasuk setelah pengajuan rilis sendiri tersimpan.
    const selectedProject = useMemo(() => {
        if (visibleProjects.length === 0) return null;

        return visibleProjects.find((p) => String(p.id) === String(selectedProjectId))
            || visibleProjects[0];
    }, [visibleProjects, selectedProjectId]);

    // Proyek yang sudah lewat titik pengajuan tetap ditampilkan sebagai riwayat, tetapi
    // formulirnya dikunci. Ada dua keadaan terkunci yang berbeda:
    //   - PENDING_GOLIVE: sudah diajukan, sedang menunggu Quality Gate. Backend menolak
    //     transisi PENDING_GOLIVE ke PENDING_GOLIVE, dan pengajuan ganda hanya mengisi
    //     antrean Quality Gate dengan entri kembar.
    //   - LIVE_PRODUCTION: rilis sudah tuntas. Ini status terminal tanpa transisi keluar,
    //     jadi mengajukannya lagi memicu 422 "transisi tidak diperbolehkan".
    const currentStatus = String(selectedProject?.status || '').toUpperCase();
    const isPendingGolive = currentStatus === PROJECT_STATUS.PENDING_GOLIVE;
    const isLive = currentStatus === PROJECT_STATUS.LIVE_PRODUCTION;
    const isLocked = isPendingGolive || isLive;

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

    // Panel kanan digulirkan ke atas setiap kali proyek yang dipilih berganti.
    // Ketergantungannya adalah id-nya, bukan objek proyeknya, supaya penyegaran daftar
    // proyek oleh polling tidak menggulirkan halaman saat pengguna sedang mengisi form.
    const selectedProjectKey = selectedProject?.id ?? null;

    useEffect(() => {
        if (selectedProjectKey === null) return;
        scrollPageToTop();
    }, [selectedProjectKey]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const MAX_SIZE = 5 * 1024 * 1024;
            if (file.size > MAX_SIZE) {
                toast.error(`Dokumen "${file.name}" ditolak karena ukurannya melebihi batas maksimal 5MB!`);
                e.target.value = '';
                return;
            }
            const ext = file.name.split('.').pop() || '';
            const autoName = generateDocumentName(
                selectedProject?.req_id || selectedProject?.id,
                DOCUMENT_TYPES.RELEASE_PLAN.code,
                selectedProject?.title || selectedProject?.name
            ) + '.' + ext;
            // Berkas belum diunggah di titik ini — hanya dipilih. Unggahannya terjadi
            // setelah pengajuan rilis tersimpan (lihat handleSubmit), karena API dokumen
            // membutuhkan project_id dan berkas rencana rilis tidak boleh masuk vault
            // untuk pengajuan yang batal terkirim.
            setUploadedFile({
                name: autoName,
                originalName: file.name,
                size: formatFileSize(file.size),
                rawFile: file,
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedProject) {
            toast.error('Pilih proyek yang akan diajukan ke Grup INFRA terlebih dahulu!');
            return;
        }
        if (String(selectedProject.status || '').toUpperCase() === PROJECT_STATUS.PENDING_GOLIVE) {
            toast.error('Proyek ini sudah diajukan dan sedang menunggu Quality Gate Grup INFRA.');
            return;
        }
        if (String(selectedProject.status || '').toUpperCase() === PROJECT_STATUS.LIVE_PRODUCTION) {
            toast.error('Proyek ini sudah live di produksi — proses rilisnya telah selesai.');
            return;
        }
        if (!canRequestGoLive(selectedProject)) {
            toast.error('Pengujian QA dan Audit Keamanan Siber harus dinyatakan lulus sebelum pengajuan rilis.');
            return;
        }
        if (!formData.releaseDate) {
            toast.error('Tentukan target tanggal rilis / deployment produksi!');
            return;
        }
        if (!formData.rollbackProcedure.trim()) {
            toast.error('Prosedur pemulihan (rollback plan) wajib diisi!');
            return;
        }

        setIsSubmitting(true);
        try {
            // Pengajuan rilis punya endpoint sendiri: baris `release_requests` dan
            // transisi status ke PENDING_GOLIVE dibuat dalam satu transaksi backend.
            // Halaman ini sengaja tidak lagi menembak updateProject() karena kolom
            // rencana rilis (downtime, rollback) bukan field tabel `projects` dan
            // perubahan status wajib melewati ProjectWorkflowService.
            await releaseRequestService.create({
                project_id: selectedProject.id,
                target_release_date: formData.releaseDate,
                downtime_estimate: formData.downtime,
                rollback_plan: formData.rollbackProcedure,
                notes: formData.releaseNotes,
            });

            // Berkas paket rilis diunggah ke Document Vault sebagai RELEASE_PLAN milik
            // proyek ini. Sebelumnya berkas pilihan pengguna hanya disimpan di state dan
            // tidak pernah dikirim ke mana pun, padahal antarmuka sudah menyatakannya
            // "berhasil diunggah". Kegagalan unggah tidak membatalkan pengajuan yang
            // sudah tersimpan — pengguna diberi tahu agar dapat mengunggah ulang lewat
            // Document Vault.
            if (uploadedFile?.rawFile) {
                try {
                    await documentService.upload(
                        new File([uploadedFile.rawFile], uploadedFile.name, { type: uploadedFile.rawFile.type }),
                        {
                            project_id: selectedProject.id,
                            document_type: DOCUMENT_TYPES.RELEASE_PLAN.code,
                        }
                    );
                    setUploadedFile(null);
                } catch (uploadErr) {
                    toast.error(
                        `Pengajuan tersimpan, tetapi berkas ${uploadedFile.name} gagal diunggah: ${uploadErr.message}`
                    );
                }
            }

            // Status proyek berubah di backend, jadi daftar lokal harus dimuat ulang
            // agar proyek ini langsung tampil sebagai "Menunggu Go-Live".
            await refreshData();

            addNotification(
                'Pengajuan Migrasi INFRA Berhasil',
                `Proyek ${selectedProject.name} telah diajukan ke Grup INFRA (Quality Gate).`,
                'info',
                '/quality-gate'
            );
            toast.success(`Pengajuan migrasi ke Grup INFRA untuk ${selectedProject.name} berhasil!`);
            navigate('/quality-gate');
        } catch (err) {
            // Pesan 422 dari backend (mis. jalur pengujian belum lulus atau bukan PM
            // pemegang disposisi) ditampilkan apa adanya supaya PM tahu penyebabnya.
            toast.error(err.message || 'Gagal mengajukan rilis ke Grup INFRA.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Dokumen yang benar-benar tersimpan pada Document Vault proyek ini.
    //
    // Daftar sebelumnya dikarang seluruhnya: nama berkas, ukuran, nomor laporan, sampai
    // nama penandatangan. Isinya selalu sama untuk proyek apa pun dan tidak pernah ada
    // di basis data, sehingga PM mengirim ke Grup Infrastruktur daftar lampiran yang
    // tidak dapat dibuka.
    const projectDocsList = useMemo(
        () => getProjectRealDocuments(selectedProject),
        [selectedProject]
    );

    // Status verifikasi kedua jalur pengujian dibaca dari kolom jalurnya, bukan
    // ditampilkan sebagai badge hijau tetap. Ketiga badge lama ("QA Verified",
    // "Cyber Verified", "Infra Topology Verified") selalu hijau tanpa memandang data,
    // padahal halaman ini juga menampilkan proyek yang salah satu jalurnya belum lulus.
    const trackVerifications = useMemo(() => {
        if (!selectedProject) return [];

        const qaStatus = getQaTrackStatus(selectedProject);
        const cyberStatus = getCyberTrackStatus(selectedProject);

        return [
            {
                key: 'qa',
                icon: CheckCircle,
                label: 'Pengujian QA',
                status: qaStatus,
                statusLabel: TRACK_STATUS_LABEL[qaStatus] || 'Belum Diajukan',
                detail: selectedProject.qaReport?.reviewer_name
                    ? `Sign-off Lead QA: ${selectedProject.qaReport.reviewer_name}`
                    : 'Sign-off Lead QA belum tercatat',
            },
            {
                key: 'cyber',
                icon: ShieldCheck,
                label: 'Audit Keamanan Siber',
                status: cyberStatus,
                statusLabel: TRACK_STATUS_LABEL[cyberStatus] || 'Belum Diajukan',
                detail: selectedProject.cyberReport?.reviewer_name
                    ? `Sign-off Lead Siber: ${selectedProject.cyberReport.reviewer_name}`
                    : 'Sign-off Lead Siber belum tercatat',
                subDetail: selectedProject.cyberCheckTypeLabel
                    ? `Jenis pemeriksaan: ${selectedProject.cyberCheckTypeLabel}`
                    : 'Jenis pemeriksaan belum dipilih',
            },
        ];
    }, [selectedProject]);

    if (isLoading) {
        return <LoadingSpinner text="Memuat Laman Pengajuan Rilis INFRA..." />;
    }

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            {/* Header Laman */}
            <div className="mb-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-extrabold text-gray-800">Form Pengajuan Migrasi &amp; Rilis ke Grup INFRA</h2>
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                            <Rocket size={14} /> SDLC Phase 4 Infrastructure Release
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                        Kirimkan paket dokumen SDLC yang sudah diverifikasi oleh Lead QA &amp; Lead Cyber ke Tim Infrastruktur untuk proses Quality Gate &amp; Go-Live Production.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LIST PANEL: Proyek Siap Migrasi (Panel Kiri) */}
                <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[calc(100vh-210px)] overflow-hidden">
                    <div className="shrink-0 pb-3 border-b border-gray-100 space-y-3 mb-3">
                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            <Server size={16} className="text-emerald-600" />
                            Pilih Proyek Selesai QA &amp; Cyber ({visibleProjects.length})
                        </h3>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={handleSearchChange}
                                placeholder="Cari ID / Nama Proyek..."
                                className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-200"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {visibleProjects.length === 0 && (
                            <p className="text-xs text-gray-500 py-6 text-center">
                                {readyProjects.length === 0
                                    ? 'Belum ada proyek yang lulus kedua jalur pengujian.'
                                    : `Tidak ada proyek yang cocok dengan pencarian "${searchTerm}".`}
                            </p>
                        )}
                        {pagedProjects.map(p => (
                            <div
                                key={p.id}
                                onClick={() => setSelectedProjectId(p.id)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                    selectedProject?.id === p.id
                                        ? 'border-2 border-emerald-600 bg-emerald-50/40 shadow-sm'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-1.5">
                                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{p.id}</span>
                                    <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={p.type} /><ProjectTypeBadge type={p.project_type} /></div>
                                </div>
                                <h4 className="font-bold text-gray-800 text-xs line-clamp-1 mb-1.5">{p.name}</h4>
                                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-gray-100">
                                    <span>{p.division}</span>
                                    {(() => {
                                        const st = String(p.status || '').toUpperCase();
                                        const tint = st === PROJECT_STATUS.LIVE_PRODUCTION
                                            ? 'text-gray-600 bg-gray-100'
                                            : st === PROJECT_STATUS.PENDING_GOLIVE
                                                ? 'text-amber-700 bg-amber-50'
                                                : 'text-emerald-700 bg-emerald-50';
                                        return (
                                            <span className={`font-bold px-2 py-0.5 rounded ${tint}`}>
                                                {PROJECT_STATUS_LABEL[st] || p.status}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Navigasi halaman — hanya muncul bila daftar melebihi satu halaman.
                        Tombol dinonaktifkan di ujung daftar; nomor halaman memakai safePage
                        supaya cocok dengan potongan yang sedang dirender. */}
                    {totalPages > 1 && (
                        <div className="shrink-0 pt-3 mt-3 border-t border-gray-100 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={safePage <= 1}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                            >
                                <ChevronLeft size={14} />
                                Sebelumnya
                            </button>
                            <span className="text-xs font-semibold text-gray-500">
                                Halaman {safePage} dari {totalPages}
                            </span>
                            <button
                                type="button"
                                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={safePage >= totalPages}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                            >
                                Berikutnya
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    )}
                </div>

                {/* FORM PANEL: Form Pengajuan ke Grup INFRA (Panel Kanan) */}
                <div ref={rightPanelRef} className="lg:col-span-8 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-y-auto h-[calc(100vh-210px)] scroll-smooth">
                    {!selectedProject ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm py-20">
                            <Rocket size={48} className="mb-3 text-gray-300" />
                            <p className="font-bold text-gray-600">Pilih Proyek di Panel Kiri</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Header Proyek */}
                            <div className="pb-4 border-b border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">
                                        {selectedProject.id}
                                    </span>
                                    <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={selectedProject.type} deadline={selectedProject.rbbDeadline} /><ProjectTypeBadge type={selectedProject.project_type} /></div>
                                </div>
                                <h3 className="text-xl font-extrabold text-gray-800">{selectedProject.name}</h3>
                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                    <Building size={14} className="text-gray-400" />
                                    <span>Divisi: <strong className="text-gray-700">{selectedProject.division}</strong></span>
                                    <span>•</span>
                                    <User size={14} className="text-gray-400" />
                                    <span>PM: <strong className="text-gray-700">{(typeof selectedProject.pm === 'object' ? selectedProject.pm?.name : selectedProject.pm) || 'Belum ditugaskan'}</strong></span>
                                </p>
                            </div>

                            {/* Status verifikasi kedua jalur pengujian — apa adanya dari data jalur */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <ShieldCheck size={15} className="text-emerald-600" />
                                    Status Verifikasi Sign-Off Laporan SDLC
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {trackVerifications.map((track) => {
                                        const passed = isTrackPassed(track.status);
                                        const TrackIcon = passed ? track.icon : AlertTriangle;
                                        return (
                                            <div
                                                key={track.key}
                                                className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                                                    passed
                                                        ? 'bg-emerald-50 border-emerald-200'
                                                        : 'bg-amber-50 border-amber-200'
                                                }`}
                                            >
                                                <TrackIcon
                                                    size={18}
                                                    className={`shrink-0 mt-0.5 ${passed ? 'text-emerald-600' : 'text-amber-600'}`}
                                                />
                                                <div>
                                                    <span className={`text-xs font-bold block ${passed ? 'text-emerald-900' : 'text-amber-900'}`}>
                                                        {track.label} — {track.statusLabel}
                                                    </span>
                                                    <span className={`text-[10px] block ${passed ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                        {track.detail}
                                                    </span>
                                                    {track.subDetail && (
                                                        <span className={`text-[10px] block ${passed ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                            {track.subDetail}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Dokumen Terlampir yang Diserahkan ke Tim Infra */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <FileText size={15} className="text-[#1a365d]" />
                                        Dokumen SDLC &amp; Sign-Off yang Diserahkan ke Tim Infra ({projectDocsList.length})
                                    </span>
                                </h4>
                                <div className="space-y-2">
                                    {projectDocsList.length === 0 && (
                                        <p className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                                            Belum ada dokumen tersimpan pada Document Vault proyek ini. Grup
                                            Infrastruktur tidak akan menerima lampiran apa pun bila pengajuan dikirim
                                            sekarang.
                                        </p>
                                    )}
                                    {projectDocsList.map(doc => (
                                        <div key={doc.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                                            <div className="flex items-center gap-2.5 overflow-hidden">
                                                <FileText size={16} className="text-emerald-600 shrink-0" />
                                                <div className="truncate">
                                                    <span className="font-bold text-gray-800 text-xs truncate block">{doc.name}</span>
                                                    <span className="text-[10px] text-gray-500">
                                                        {doc.type}
                                                        {doc.size ? ` • ${doc.size}` : ''}
                                                        {doc.author ? ` • ${doc.author}` : ''}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setPreviewDocument(doc)}
                                                className="px-3 py-1 bg-[#1a365d] text-white rounded-lg text-xs font-bold hover:bg-[#0f2342] transition-all flex items-center gap-1 cursor-pointer shrink-0"
                                            >
                                                <Eye size={12} />
                                                Pratinjau
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Parameter Rilis & Migrasi Infrastruktur */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                                        Target Tanggal Go-Live Production <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="date"
                                            name="releaseDate"
                                            value={formData.releaseDate}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                                        Estimasi Downtime Window Server
                                    </label>
                                    <select
                                        name="downtime"
                                        value={formData.downtime}
                                        onChange={handleChange}
                                        className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                    >
                                        <option value="Zero Downtime">Zero Downtime (Tanpa Penghentian Layanan)</option>
                                        <option value="15 Menit">15 Menit (Pemeliharaan Terjadwal Malam Hari)</option>
                                        <option value="30 Menit">30 Menit (Pemeliharaan Server Database)</option>
                                        <option value="60 Menit">60 Menit (Major Core System Deployment)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Rencana Pemulihan (Rollback Plan) */}
                            <div>
                                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                                    Prosedur Pemulihan (Rollback Plan Procedure) <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    name="rollbackProcedure"
                                    rows={3}
                                    value={formData.rollbackProcedure}
                                    onChange={handleChange}
                                    placeholder="Tuliskan prosedur rollback jika terjadi kegagalan sistem saat deployment di server produksi..."
                                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                    required
                                />
                            </div>

                            {/* Upload Paket Binary / Script Migrasi SQL */}
                            <div>
                                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                                    Unggah File Paket Binary / Script SQL Migrasi Database
                                </label>
                                <div className="border-2 border-dashed border-gray-200 hover:border-emerald-400 bg-gray-50/50 rounded-2xl p-5 text-center transition-all">
                                    <CloudUpload size={32} className="text-emerald-600 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-gray-700">Tarik &amp; lepas berkas paket rilis di sini, atau klik untuk memilih</p>
                                    {/* Daftar format harus sama dengan atribut accept di bawah, bukan daftar
                                        yang lebih luas: berkas .tar.gz atau .sql akan ditolak pemilih berkas. */}
                                    <p className="text-[10px] text-gray-400 mt-1">Format yang diterima: PDF, XLS/XLSX, JPG/PNG, ZIP (maksimal 5 MB)</p>
                                    <input
                                        type="file"
                                        accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        id="release-file-input"
                                    />
                                    <label
                                        htmlFor="release-file-input"
                                        className="mt-3 inline-block px-4 py-2 bg-white border border-gray-300 hover:border-emerald-600 text-gray-700 font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-all"
                                    >
                                        Pilih File Paket Migrasi
                                    </label>
                                </div>

                                {uploadedFile && (
                                    <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <FileText size={16} className="text-emerald-600" />
                                            <span className="font-bold text-gray-800">{uploadedFile.name}</span>
                                            <span className="text-gray-500">({uploadedFile.size})</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setUploadedFile(null)}
                                            className="text-red-500 hover:text-red-700 p-1"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Action Button Submit ke Grup INFRA */}
                            <div className="pt-4 border-t border-gray-100">
                                <button
                                    type="submit"
                                    disabled={isSubmitting || isLocked}
                                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLive ? <CheckCircle size={18} /> : isPendingGolive ? <Clock size={18} /> : <Rocket size={18} />}
                                    <span>
                                        {isLive
                                            ? 'Proyek Sudah Live di Produksi — Rilis Selesai'
                                            : isPendingGolive
                                                ? 'Sudah Diajukan — Menunggu Quality Gate Grup INFRA'
                                                : 'Kirim Pengajuan Migrasi ke Grup INFRA (Quality Gate)'}
                                    </span>
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            {/* PRATINJAU DOKUMEN SDLC — berkas asli dari Document Vault.
                Modal sebelumnya menampilkan teks laporan karangan dan tombol unduh yang
                hanya memunculkan toast "berhasil diunduh" tanpa mengunduh apa pun. */}
            {previewDocument && (
                <DocumentViewerModal
                    doc={previewDocument}
                    project={selectedProject}
                    onClose={() => setPreviewDocument(null)}
                />
            )}
        </div>
    );
}