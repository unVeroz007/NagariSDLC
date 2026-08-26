import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProjects } from '../contexts/ProjectContext';
import ProjectTypeBadge from '../components/ProjectTypeBadge';
import {
    Search,
    Rocket,
    CheckCircle,
    Code,
    Shield,
    Route,
    FileText,
    Clock,
    Phone,
    AlertCircle,
    Check,
    Circle,
    Eye,
    Info,
    RotateCcw,
    Download,
    ClipboardCheck,
} from 'lucide-react';
import { documentService, projectService } from '../services/api';
import DocumentViewerModal from '../components/DocumentViewerModal';
import { getProjectRealDocuments } from '../utils/projectDocuments';
import { getDocExtLabel, getDocIconStyle } from '../utils/documentNaming';
import { PROJECT_STATUS_LABEL } from '../constants/projectStatus';
import { getProjectJourney } from '../constants/projectJourney';
import { CHANGE_REQUEST_STATUS_LABEL as UAT_CHANGE_REQUEST_STATUS_LABEL } from '../constants/uatChangeRequest';
import toast from 'react-hot-toast';

const statusOptions = ['Semua Status', 'Sedang Berjalan', 'Selesai', 'Ditolak'];

/**
 * Label status change request UAT untuk pemohon proyek.
 *
 * Tabelnya dipakai bersama wizard SIT/UAT lewat `constants/uatChangeRequest.js`:
 * satu status tidak boleh punya dua nama di dua halaman. Sebelumnya halaman ini
 * hanya mengenali `approved` dan `rejected`, sehingga seluruh permintaan yang lahir
 * dari pertemuan UAT — yang justru satu-satunya jalur sekarang — selalu tampil
 * sebagai "Menunggu" meskipun sudah dikerjakan, lulus SIT ulang, atau diverifikasi.
 */
const CHANGE_REQUEST_STATUS_LABEL = UAT_CHANGE_REQUEST_STATUS_LABEL;

/**
 * Label status per penandatangan pada matriks persetujuan UAT.
 *
 * Nilainya berasal dari `App\Enums\UatApprovalStatus`. Status `revoked` tidak
 * pernah sampai ke sini karena backend sudah membuangnya dari matriks, jadi
 * memetakannya di layar hanya akan menyiratkan keadaan yang tidak ada.
 */
const UAT_APPROVER_STATUS_LABEL = {
    pending: { label: 'Menunggu', pillCls: 'bg-amber-100 text-amber-700 border-amber-200' },
    approved: { label: 'Disetujui', pillCls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    rejected: { label: 'Ditolak', pillCls: 'bg-red-100 text-red-700 border-red-200' },
};

/**
 * Tipe dokumen yang relevan sebagai bahan pertimbangan persetujuan UAT.
 *
 * Daftarnya sengaja sempit dan hanya memuat tipe yang memang dibuka untuk
 * pemohon (`DocumentVault::REQUESTER_VISIBLE_TYPES`). Payload proyek sudah
 * disaring backend per pengguna, sehingga saringan di sini hanya menentukan
 * dokumen mana yang ikut ditampilkan berdampingan dengan tombol persetujuan —
 * bukan penentu hak akses.
 */
const UAT_APPROVAL_DOC_TYPES = ['UNDANGAN', 'UAT_PLAN', 'UAT_RESULT', 'UAT_SIGNOFF'];

/**
 * UAT masih menunggu dijalankan ulang dari awal.
 *
 * Revisi Mayor kini mengulang dua siklus sekaligus: SIT ulang atas seluruh task,
 * lalu UAT dari Tahap 1 — bukan lagi melanjutkan Tahap 2 dalam mode verifikasi.
 * Backend menandainya dengan `uat_restart_after_sit`, sedangkan baris yang sudah
 * ada di basis data masih menyimpan kunci lama `uat2_resume_after_sit`. Keduanya
 * dibaca di satu tempat supaya proyek yang sedang mengulang UAT tidak pernah
 * terlihat siap disetujui hanya karena kunci penandanya berbeda versi.
 */
const isUatRestartPending = (sitUatData) => sitUatData?.uat_restart_after_sit === true
    || sitUatData?.uat2_resume_after_sit === true;

/**
 * Cap waktu tahap perjalanan, sudah dalam zona waktu pengguna.
 *
 * Mengembalikan null bila riwayatnya memang tidak ada — tahap yang belum pernah
 * dijalani lebih baik tidak menampilkan apa pun daripada menampilkan "Invalid Date".
 */
const formatJourneyStamp = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;

    return parsed.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export default function Track() {
    const { user } = useAuth();
    const { projects, refreshDataSilent } = useProjects();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [previewDoc, setPreviewDoc] = useState(null);
    const detailPanelRef = useRef(null);
    const navigate = useNavigate();

    const mappedTrackingProjects = useMemo(() => {
        return (projects || []).map(p => ({
            rawId: p.id,
            id: p.reqId || p.req_id || `REQ-${p.id}`,
            name: p.name || p.title || 'Proyek Tanpa Judul',
            status: PROJECT_STATUS_LABEL[p.status] || p.status || 'PENDING',
            statusRaw: p.status || 'PENDING',
            submittedDate: p.created_at ? new Date(p.created_at).toLocaleDateString('id-ID') : 'Terbaru',
            targetDate: p.targetDate || p.target_date || 'TBD',
            contactPhone: p.contactPhone || p.contact_phone || '',
            pm: typeof p.pm === 'object' ? (p.pm?.name || 'Belum Dialokasi') : (p.pm || 'Belum Dialokasi'),
            pmAvatar: (p.pm?.name || 'BD').substring(0, 2).toUpperCase(),
            description: p.description || 'Pengajuan proyek baru.',
            rejectionReason: p.rejection_reason || p.rejectionReason || null,
            // Perjalanan pengajuan dibangun `constants/projectJourney.js` dari status
            // proyek, kolom jalur pengujian, dan riwayat statusnya — sumber yang sama
            // dengan tracker Project Manager, sehingga pemohon dan PM tidak mungkin
            // melihat tahap yang berbeda untuk proyek yang sama. Versi sebelumnya
            // memakai tiga fase karangan yang menilai `p.statusRaw` — kunci yang baru
            // dibuat pada objek ini, jadi selalu undefined: Fase 1 selalu tampak
            // selesai dan dua fase sisanya tidak pernah bergerak.
            journey: getProjectJourney(p),
        }));
    }, [projects]);

    // Pilihan pengguna disimpan sebagai id, bukan objek hasil map. Objeknya selalu
    // dicari ulang dari daftar terbaru supaya detail proyek ikut diperbarui saat
    // polling. Sebelumnya pilihan berupa objek dan sebuah effect menyetel ulang
    // pilihan ke proyek dari URL setiap kali daftar berubah identitas (tiap
    // polling), sehingga proyek yang baru diklik pengguna terlempar kembali.
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('Semua Status');

    const listProjects = mappedTrackingProjects;

    // Proyek tujuan dari navigasi: state router atau query string.
    const targetProjectId = location.state?.projectId || searchParams.get('projectId') || searchParams.get('id') || null;

    // Navigasi baru ke proyek lain harus mengalahkan pilihan manual sebelumnya.
    const [syncedTargetId, setSyncedTargetId] = useState(targetProjectId);
    if (targetProjectId !== syncedTargetId) {
        setSyncedTargetId(targetProjectId);
        setSelectedProjectId(null);
    }

    const activeSelected = useMemo(() => {
        const findById = (value) => listProjects.find(p =>
            String(p.rawId).toLowerCase() === String(value).toLowerCase() ||
            String(p.id).toLowerCase() === String(value).toLowerCase()
        );
        // Urutan prioritas: pilihan manual, proyek dari URL, lalu proyek pertama.
        return (selectedProjectId ? findById(selectedProjectId) : null)
            || (targetProjectId ? findById(targetProjectId) : null)
            || listProjects[0]
            || null;
    }, [listProjects, selectedProjectId, targetProjectId]);

    const scrollPageToTop = () => {
        if (detailPanelRef.current) {
            detailPanelRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        const mainContainer = detailPanelRef.current?.closest('main') || document.querySelector('main');
        if (mainContainer) {
            mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Gulir ke atas hanya saat proyek yang dibuka berganti. Yang dipantau sengaja
    // id-nya, bukan objek proyeknya: objek itu dibuat ulang setiap polling, dan
    // memantaunya akan menggulirkan halaman tiap beberapa detik.
    const activeSelectedId = activeSelected?.id ?? null;
    useEffect(() => {
        if (activeSelectedId) {
            scrollPageToTop();
        }
    }, [activeSelectedId]);

    const filteredProjects = useMemo(() => {
        let result = listProjects;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(p =>
                String(p.id).toLowerCase().includes(term) ||
                String(p.name).toLowerCase().includes(term)
            );
        }

        if (filterStatus === 'Sedang Berjalan') {
            result = result.filter(p => p.statusRaw !== 'LIVE_PRODUCTION' && p.statusRaw !== 'REJECTED');
        } else if (filterStatus === 'Selesai') {
            result = result.filter(p => p.statusRaw === 'LIVE_PRODUCTION');
        } else if (filterStatus === 'Ditolak') {
            result = result.filter(p => p.statusRaw === 'REJECTED' || p.rejectionReason);
        }

        return result;
    }, [listProjects, searchTerm, filterStatus]);

    /**
     * Warna badge status pada daftar dan kartu ringkasan.
     *
     * Kuncinya adalah LABEL, bukan kode status — `listProjects` sudah menerjemahkan
     * `p.status` lewat `PROJECT_STATUS_LABEL` sebelum sampai ke sini.
     */
    const getStatusBadge = (status) => {
        const colors = {
            'Menunggu Review': 'bg-gray-100 text-gray-700',
            'Review Lead Group': 'bg-amber-100 text-amber-700',
            'Disetujui Analis': 'bg-emerald-100 text-emerald-700',
            'Ditolak': 'bg-red-100 text-red-700',
            'Sedang Dikembangkan': 'bg-blue-100 text-blue-700',
            'Live Production': 'bg-emerald-100 text-emerald-700',
            // Kuncinya dibaca dari `PROJECT_STATUS_LABEL`, tidak ditulis ulang sebagai
            // teks: pernah ada dua sebutan berbeda untuk status yang sama, dan begitu
            // label di berkas konstanta berubah, kunci yang ditulis tangan di sini mati
            // tanpa suara — badge-nya diam-diam jatuh ke abu-abu. Warnanya oranye,
            // seragam dengan `PROJECT_STATUS_COLOR` dan dengan keadaan `revision` pada
            // timeline di bawah: pengembalian ke developer adalah pekerjaan ulang, bukan
            // penolakan. Sebelumnya merah, warna yang di halaman ini berarti ditolak.
            [PROJECT_STATUS_LABEL.RETURN_TO_DEV]: 'bg-orange-100 text-orange-700',
        };
        return colors[status] || 'bg-gray-100 text-gray-700';
    };

    /**
     * Tampilan satu keadaan pada timeline.
     *
     * Kuncinya sama dengan nilai `state` yang dihasilkan `getProjectJourney`, jadi
     * penambahan keadaan baru di sana akan langsung terlihat di sini alih-alih
     * jatuh diam-diam ke tampilan "belum dimulai".
     */
    const JOURNEY_STATE_STYLE = {
        completed: {
            icon: Check,
            circleCls: 'bg-emerald-100 border-2 border-emerald-500',
            iconCls: 'text-emerald-600',
            label: 'Selesai',
            pillCls: 'bg-emerald-100 text-emerald-700',
            titleCls: 'text-gray-800',
        },
        active: {
            icon: Code,
            circleCls: 'bg-[#00529C] border-4 border-blue-200 shadow-md',
            iconCls: 'text-white',
            label: 'Sedang Berjalan',
            pillCls: 'bg-blue-100 text-[#00529C]',
            titleCls: 'text-[#00529C]',
            pulse: true,
        },
        revision: {
            icon: RotateCcw,
            circleCls: 'bg-amber-100 border-2 border-amber-500',
            iconCls: 'text-amber-600',
            label: 'Perlu Perbaikan',
            pillCls: 'bg-amber-100 text-amber-700',
            titleCls: 'text-amber-700',
        },
        rejected: {
            icon: AlertCircle,
            circleCls: 'bg-red-100 border-2 border-red-500',
            iconCls: 'text-red-600',
            label: 'Dihentikan',
            pillCls: 'bg-red-100 text-red-700',
            titleCls: 'text-red-700',
        },
        pending: {
            icon: Rocket,
            circleCls: 'bg-gray-100 border-2 border-gray-300',
            iconCls: 'text-gray-400',
            label: 'Belum Dimulai',
            pillCls: 'bg-gray-100 text-gray-500',
            titleCls: 'text-gray-500',
        },
    };

    const getJourneyStyle = (state) => JOURNEY_STATE_STYLE[state] || JOURNEY_STATE_STYLE.pending;

    const getPhaseCircle = (state) => {
        const style = getJourneyStyle(state);
        const StateIcon = style.icon;

        return (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center relative ${style.circleCls}`}>
                {style.pulse && (
                    <div className="absolute inset-0 rounded-full border-2 border-[#00529C] animate-ping opacity-50"></div>
                )}
                <StateIcon size={20} className={style.iconCls} />
            </div>
        );
    };

    /** Ikon kecil untuk setiap tahap di dalam fase. */
    const getMilestoneIcon = (state) => {
        if (state === 'completed') return <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />;
        if (state === 'active') return <Code size={16} className="text-[#00529C] shrink-0 mt-0.5" />;
        if (state === 'revision') return <RotateCcw size={16} className="text-amber-600 shrink-0 mt-0.5" />;
        if (state === 'rejected') return <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />;

        return <Circle size={16} className="text-gray-300 shrink-0 mt-0.5" />;
    };

    const activeProjectObj = projects.find(p => String(p.id) === String(activeSelected?.rawId));

    // ─── Persetujuan UAT pemohon, dikerjakan langsung di aplikasi ───
    // Pemohon proyek selalu punya akun — dialah yang menginisiasi proyeknya — maka
    // `UatApprovalRole::requiredMode()` memaksa posisi `requester` memakai akun
    // internal dan tidak lagi menerima link pribadi berverifikasi nomor HP.
    // Keputusannya diberikan dari halaman yang sudah ia pakai memantau proyek.
    //
    // Matriks disimpan bersama id proyeknya supaya hasil permintaan proyek lain
    // tidak sekejap tampil saat pengguna berpindah pilihan.
    const [uatApprovalMatrix, setUatApprovalMatrix] = useState(null);
    const [uatApprovalNote, setUatApprovalNote] = useState('');
    const [isSubmittingUatApproval, setIsSubmittingUatApproval] = useState(false);
    const [uatApprovalReloadKey, setUatApprovalReloadKey] = useState(0);

    // Hanya proyek yang benar-benar berada pada fase persetujuan UAT yang diambil
    // matriksnya, dan hanya proyek yang sedang dibuka — bukan seluruh daftar.
    // Pemohon bisa memiliki puluhan pengajuan, dan satu permintaan per pengajuan
    // pada setiap kunjungan halaman jauh lebih mahal daripada nilainya.
    const uatApprovalProjectId = user?.role === 'business_user' && activeSelected?.statusRaw === 'UAT_IN_PROGRESS'
        ? activeSelected.rawId
        : null;

    // Catatan opsional selalu milik satu proyek. Penyelarasan dilakukan saat render
    // seperti `syncedTargetId` di atas, bukan lewat effect, agar catatan yang
    // ditulis untuk satu proyek tidak pernah terkirim ke proyek lain.
    const [notedUatProjectId, setNotedUatProjectId] = useState(uatApprovalProjectId);
    if (uatApprovalProjectId !== notedUatProjectId) {
        setNotedUatProjectId(uatApprovalProjectId);
        setUatApprovalNote('');
    }

    // Yang dipantau adalah id proyek dan penanda muat ulang, bukan objek proyeknya:
    // objek itu dibuat ulang setiap tik polling daftar proyek, dan memantaunya akan
    // memukul endpoint matriks tiap beberapa detik.
    useEffect(() => {
        if (!uatApprovalProjectId) return;
        let isStale = false;
        (async () => {
            try {
                const res = await projectService.getUatApprovalMatrix(uatApprovalProjectId);
                if (!isStale) setUatApprovalMatrix({ projectId: uatApprovalProjectId, data: res?.data || null });
            } catch {
                // 403 dan 404 adalah keadaan wajar, bukan kegagalan: putaran approval
                // belum dibuat PM, atau pemohon memang bukan penandatangan pada
                // putaran itu. Panel cukup tidak ditampilkan, tanpa notifikasi.
                if (!isStale) setUatApprovalMatrix({ projectId: uatApprovalProjectId, data: null });
            }
        })();
        return () => { isStale = true; };
    }, [uatApprovalProjectId, uatApprovalReloadKey]);

    // Pemohon hanya punya satu tindakan: menyetujui. Penolakan dan permintaan revisi
    // sudah diajukan serta diaudit saat eksekusi UAT (Tahap 2), jadi tidak ada jalur
    // penolakan kedua atas temuan yang sama — `UatApprovalRole::canReject()` pun
    // menolaknya di backend.
    const handleApproveUat = async (approverId) => {
        if (!uatApprovalProjectId || !approverId || isSubmittingUatApproval) return;
        setIsSubmittingUatApproval(true);
        try {
            await projectService.submitUatApproval(uatApprovalProjectId, approverId, 'approved', uatApprovalNote.trim());
            setUatApprovalNote('');
            // Matriks dimuat ulang agar slot pemohon berpindah ke `approved` dan
            // tombolnya hilang; daftar proyek disegarkan senyap karena putaran yang
            // lengkap dapat menggeser status proyek beserta linimasanya.
            setUatApprovalReloadKey(key => key + 1);
            refreshDataSilent();
            toast.success('Persetujuan hasil UAT Anda berhasil dicatat. Terima kasih.');
        } catch (err) {
            toast.error(`Gagal menyimpan persetujuan: ${err.message}`);
        } finally {
            setIsSubmittingUatApproval(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-screen bg-[#f8f9fb] overflow-hidden">
            <div className="flex-1 flex overflow-hidden">
                <div className="w-1/3 min-w-[320px] max-w-[400px] bg-white border-r border-gray-200 flex flex-col shadow-[4px_0_12px_rgba(0,0,0,0.03)]">
                    <div className="p-4 border-b border-gray-200 bg-gray-50/50 sticky top-0 z-20">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">Pengajuan Anda</h2>
                        <div className="relative mb-4">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Cari ID atau Nama Proyek..."
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none transition-all text-sm"
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {statusOptions.map((opt) => (
                                <button
                                    key={opt}
                                    onClick={() => setFilterStatus(opt)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === opt
                                            ? 'bg-blue-100 text-[#00529C]'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                                        }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/30">
                        {filteredProjects.length > 0 ? (
                            filteredProjects.map((project) => (
                                <div
                                    key={project.id}
                                    onClick={() => setSelectedProjectId(project.rawId ?? project.id)}
                                    className={`bg-white rounded-xl shadow-sm border relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow group ${activeSelected?.id === project.id
                                            ? 'border-[#00529C] ring-1 ring-[#00529C]'
                                            : 'border-gray-200'
                                        }`}
                                >
                                    {activeSelected?.id === project.id && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#D4A017]"></div>
                                    )}
                                    <div className="p-4 pl-5">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-semibold text-gray-500">{project.req_id || project.reqId || project.id}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadge(project.status)}`}>
                                                    {project.status}
                                                </span>
                                            </div>
                                        </div>
                                        <h3 className="font-semibold text-gray-800 text-sm mb-1 group-hover:text-[#00529C] transition-colors line-clamp-1">
                                            {project.name}
                                        </h3>
                                        <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                                            {project.description}
                                        </p>
                                        <div className="flex items-center justify-between text-[11px] text-gray-500 border-t border-gray-100 pt-2">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-5 h-5 rounded-full bg-blue-100 text-[#00529C] flex items-center justify-center font-bold text-[10px]">
                                                    {project.pmAvatar}
                                                </div>
                                                <span className="truncate max-w-[100px]">{typeof project.pm === 'object' ? (project.pm?.name || '—') : (project.pm || '—')}</span>
                                            </div>
                                            <span className="text-gray-400">{project.submittedDate}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-gray-500 text-sm">
                                Tidak ada pengajuan yang sesuai
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 flex flex-col bg-gray-50/30 overflow-hidden">
                    <div ref={detailPanelRef} className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 lg:p-10">
                        <div className="max-w-4xl mx-auto">
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row justify-between items-start gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <span className="px-2.5 py-1 bg-gray-100 rounded-md text-xs font-semibold text-gray-600 border border-gray-200">
                                            {activeSelected?.id}
                                        </span>
                                        {activeSelected?.type && (
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${activeSelected.type === 'RBB' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                {activeSelected.type === 'RBB' ? '🔴 RBB (Wajib Selesai)' : '⚪ Non-RBB (Fleksibel)'}
                                            </span>
                                        )}
                                        <ProjectTypeBadge type={activeSelected?.project_type} />
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getStatusBadge(activeSelected?.status)}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${activeSelected?.status === 'IN DEVELOPMENT' ? 'bg-blue-500 animate-pulse' : 'bg-current'}`}></span>
                                            {activeSelected?.status}
                                        </span>
                                    </div>
                                    <h1 className="text-2xl font-bold text-gray-800">{activeSelected?.name}</h1>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Deskripsi</p>
                                    <p className="text-sm text-gray-700">{activeSelected?.description}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Target Go-Live</p>
                                    <p className="font-semibold text-gray-800 flex items-center">
                                        <Rocket size={16} className="mr-1.5 text-gray-400" />
                                        {activeSelected?.targetDate}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Nomor Telepon Kontak</p>
                                    <p className="font-semibold text-gray-800 flex items-center">
                                        <Phone size={16} className="mr-1.5 text-green-600" />
                                        {activeSelected?.contactPhone || '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Project Manager</p>
                                    <div className="flex items-center">
                                        <div className="w-6 h-6 rounded-full bg-[#00529C] text-white flex items-center justify-center text-[10px] font-bold mr-2">
                                            {activeSelected?.pmAvatar}
                                        </div>
                                        <p className="font-semibold text-gray-800">{typeof activeSelected?.pm === 'object' ? (activeSelected.pm?.name || '—') : (activeSelected?.pm || '—')}</p>
                                    </div>
                                </div>
                            </div>

                            {activeSelected?.rejectionReason && (
                                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 mb-6 animate-scale-up">
                                    <div className="flex items-start gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                                            <AlertCircle size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-extrabold text-red-800 text-sm mb-1">Proyek Ditolak — Perlu Perbaikan</h4>
                                            <p className="text-xs text-red-600 mb-2">
                                                Tim Perencanaan/Analis telah menolak proyek Anda dengan alasan berikut. Silakan perbaiki dan ajukan kembali.
                                            </p>
                                            <div className="bg-white border border-red-200 rounded-xl p-3 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-medium">
                                                {activeSelected.rejectionReason}
                                            </div>
                                        </div>
                                    </div>

                                    {(() => {
                                        const realDocList = getProjectRealDocuments(activeProjectObj);
                                        const initDocs = realDocList.filter(d => {
                                            const t = (d.type || d.doc_type || '').toLowerCase();
                                            const n = (d.name || '').toLowerCase();
                                            // Kode tipe memo yang disimpan backend adalah 'MEMO' (DOCUMENT_TYPES.MEMO),
                                            // jadi pembandingan lama dengan 'mem' tidak pernah cocok — memo hanya ikut
                                            // terbaca bila kebetulan namanya memuat kata "memo".
                                            return t === 'brd' || n.includes('brd') || t === 'memo' || n.includes('memo')
                                                || t === 'fsd' || n.includes('fsd') || n.includes('kajian')
                                                || t === 'lampiran' || n.includes('lampiran')
                                                || t === 'lainnya';
                                        });
                                        if (initDocs.length === 0) return null;
                                        return (
                                            <div className="mt-4 border-t border-red-200 pt-4">
                                                <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-2">
                                                    Dokumen Terlampir (Inisiasi s/d Analisis)
                                                </p>
                                                <div className="space-y-2">
                                                    {initDocs.map((doc, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-2.5 bg-white border border-red-100 rounded-xl text-xs">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 font-bold text-[9px] ${getDocIconStyle(doc.name || '')}`}>
                                                                    {getDocExtLabel(doc.name || '')}
                                                                </div>
                                                                <span className="font-medium text-gray-700 truncate">{doc.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0 ml-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewDoc(doc)}
                                                                    className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <Eye size={12} /> Lihat
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        if (!doc.id) return;
                                                                        try {
                                                                            const blob = await documentService.download(doc.id);
                                                                            const url = URL.createObjectURL(blob);
                                                                            const a = document.createElement('a');
                                                                            a.href = url;
                                                                            a.download = doc.name || 'dokumen.pdf';
                                                                            document.body.appendChild(a);
                                                                            a.click();
                                                                            document.body.removeChild(a);
                                                                            URL.revokeObjectURL(url);
                                                                        } catch {
                                                                            alert('Gagal mengunduh dokumen.');
                                                                        }
                                                                    }}
                                                                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <Download size={12} /> Unduh
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="flex items-center justify-between border-t border-red-200 pt-3 mt-4">
                                        <span className="text-xs text-red-600 font-medium">Status: <strong className="text-red-800">Ditolak</strong></span>
                                        <button
                                            onClick={() => navigate('/projects/new')}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer active:scale-95"
                                        >
                                            <RotateCcw size={14} />
                                            Ajukan Kembali Proyek
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end mb-6">
                                <button
                                    className="shrink-0 flex items-center px-4 py-2.5 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed opacity-60 transition-colors border border-gray-200 font-semibold text-sm"
                                    disabled
                                >
                                    <FileText size={18} className="mr-2" />
                                    Unduh Ringkasan PDF
                                </button>
                            </div>

                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                                <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
                                    <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                                        <Route size={20} className="mr-2 text-[#00529C]" />
                                        Perjalanan Pengajuan
                                    </h2>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-[#00529C]">
                                            Progres {activeSelected?.journey?.progress ?? 0}%
                                        </span>
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getStatusBadge(activeSelected?.status)}`}>
                                            {activeSelected?.journey?.currentStatusLabel || activeSelected?.status}
                                        </span>
                                    </div>
                                </div>

                                {/*
                                  * Simpangan alur (revisi, penundaan, penolakan) diberitakan di atas
                                  * timeline. Tanpa ini, pemohon hanya melihat sebuah tahap berubah
                                  * warna tanpa penjelasan mengapa proyeknya berhenti bergerak.
                                  */}
                                {activeSelected?.journey?.detour && (
                                    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                                        <RotateCcw size={18} className="text-amber-600 shrink-0 mt-0.5" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-amber-800">{activeSelected.journey.detour.label}</p>
                                            <p className="text-[11px] text-amber-700 leading-relaxed mt-0.5">
                                                {activeSelected.journey.detour.description}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="relative px-2">
                                    {(activeSelected?.journey?.phases || []).map((phase, idx) => {
                                        const phaseStyle = getJourneyStyle(phase.state);
                                        const isLastPhase = idx === (activeSelected.journey.phases.length - 1);

                                        return (
                                            <div key={phase.id} className="relative flex gap-6 pb-10 last:pb-0">
                                                {!isLastPhase && (
                                                    <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-gray-200 z-0"></div>
                                                )}

                                                <div className="relative flex flex-col items-center z-10">
                                                    {getPhaseCircle(phase.state)}
                                                </div>

                                                <div className="flex-1 pt-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <h3 className={`font-semibold ${phaseStyle.titleCls}`}>
                                                            {phase.label}: {phase.sublabel}
                                                        </h3>
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${phaseStyle.pillCls}`}>
                                                            {phaseStyle.label}
                                                        </span>
                                                        {/*
                                                          * Dua jalur pengujian berjalan bersamaan, bukan berurutan.
                                                          * Penandanya dipasang di sini supaya pemohon tidak menyangka
                                                          * Fase 3B baru dimulai setelah Fase 3A selesai.
                                                          */}
                                                        {phase.trackKey && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                                Paralel
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-500 mb-4">{phase.description}</p>

                                                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
                                                        {phase.milestones.map(milestone => {
                                                            const stamp = formatJourneyStamp(milestone.at);

                                                            return (
                                                                <div key={milestone.key} className="flex items-start gap-3">
                                                                    {getMilestoneIcon(milestone.state)}
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className={`text-sm font-medium ${milestone.state === 'pending' ? 'text-gray-400' : 'text-gray-700'}`}>
                                                                            {milestone.label}
                                                                            {stamp && <span className="text-xs text-gray-400 font-normal ml-2">({stamp})</span>}
                                                                        </p>
                                                                        <p className={`text-[11px] leading-relaxed mt-0.5 ${milestone.state === 'pending' ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                            {milestone.description}
                                                                        </p>
                                                                        {milestone.by && (
                                                                            <p className="text-[11px] text-gray-500 mt-0.5">
                                                                                Dicatat oleh <strong className="text-gray-600">{milestone.by}</strong>
                                                                            </p>
                                                                        )}
                                                                        {/*
                                                                          * Catatan transisi adalah alasan resmi yang ditulis
                                                                          * pemutus — termasuk alasan penolakan dan arahan
                                                                          * revisi. Justru inilah yang paling dicari pemohon,
                                                                          * jadi ditampilkan apa adanya.
                                                                          */}
                                                                        {milestone.notes && (
                                                                            <div className="mt-2 bg-white border border-gray-200 rounded-lg p-2.5 text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                                                                                {milestone.notes}
                                                                            </div>
                                                                        )}
                                                                        {milestone.detour && (
                                                                            <div className="mt-2 flex items-start gap-2 p-2.5 bg-white rounded-lg border border-amber-200">
                                                                                <Shield size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                                                                <div className="min-w-0">
                                                                                    <span className="font-bold text-[11px] text-amber-800 block">
                                                                                        {milestone.detour.label}
                                                                                    </span>
                                                                                    <span className="text-[11px] text-amber-700 leading-relaxed">
                                                                                        {milestone.detour.description}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── Persetujuan Hasil UAT oleh pemohon, langsung di aplikasi ── */}
                            {(() => {
                                // Matriks yang tersimpan hanya berlaku untuk proyek yang menjadi
                                // sumbernya. Tanpa perbandingan id ini, matriks proyek sebelumnya
                                // akan sekejap tampil di atas proyek yang baru dipilih.
                                const matrix = uatApprovalMatrix && String(uatApprovalMatrix.projectId) === String(activeSelected?.rawId)
                                    ? uatApprovalMatrix.data
                                    : null;
                                const approvers = matrix?.approvers || [];

                                // Slot milik pengguna dikenali dari sisi pemohon, mode akun internal,
                                // dan kesamaan `user_id`. Backend sudah memastikan slot `requester`
                                // selalu akun yang menginisiasi proyek, sehingga layar tidak perlu
                                // menebak dari nama atau nomor telepon.
                                const mySlot = approvers.find(approver =>
                                    approver.side === 'requester'
                                    && approver.approval_mode === 'internal_account'
                                    && String(approver.user_id) === String(user?.id)
                                );
                                // Tidak ada slot berarti tidak ada yang perlu dikerjakan maupun
                                // ditampilkan — panel sama sekali tidak dirender.
                                if (!mySlot) return null;

                                const sd = activeProjectObj?.sitUatData || activeProjectObj?.sit_uat_data || {};
                                // Gerbang ini menyalin `UatApprovalService::assertActiveApprover`.
                                // Menawarkan tombol lebih awal hanya akan memunculkan galat 422 yang
                                // tidak dapat ditindaklanjuti pemohon. Selama UAT masih menunggu
                                // dijalankan ulang, Tahap 3 milik putaran lama sudah tidak berlaku:
                                // persetujuan baru terbuka lagi saat putaran baru mencapai Tahap 3.
                                const isGateOpen = matrix.status === 'active'
                                    && Number(sd.activeUatStep || 1) >= 3
                                    && !isUatRestartPending(sd);
                                const canApproveNow = isGateOpen && mySlot.status === 'pending';
                                const mySlotStatus = UAT_APPROVER_STATUS_LABEL[mySlot.status] || UAT_APPROVER_STATUS_LABEL.pending;
                                const otherApprovers = approvers.filter(approver => approver.id !== mySlot.id);
                                const uatApprovalDocs = getProjectRealDocuments(activeProjectObj)
                                    .filter(doc => UAT_APPROVAL_DOC_TYPES.includes(String(doc.type || '').toUpperCase()));

                                return (
                                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mt-6">
                                        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                                            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                                                <ClipboardCheck size={20} className="mr-2 text-[#00529C]" />
                                                Persetujuan Hasil UAT
                                            </h2>
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-[#00529C]">
                                                {matrix.approved_count ?? 0}/{matrix.required_count ?? 0} tanda tangan
                                            </span>
                                        </div>

                                        {mySlot.status === 'approved' ? (
                                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                                <div className="flex items-start gap-3">
                                                    <CheckCircle size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-emerald-800">Anda sudah menyetujui hasil UAT ini</p>
                                                        <p className="text-[11px] text-emerald-700 mt-1">
                                                            Tercatat sebagai {mySlot.approval_role_label}
                                                            {mySlot.decided_at ? ` pada ${new Date(mySlot.decided_at).toLocaleString('id-ID')}` : ''}.
                                                        </p>
                                                        {mySlot.decision_note && (
                                                            <div className="mt-2 bg-white border border-emerald-200 rounded-xl p-3 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                                                                {mySlot.decision_note}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : canApproveNow ? (
                                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                                                <p className="text-xs font-bold text-blue-800 mb-1">Persetujuan Anda sebagai {mySlot.approval_role_label}</p>
                                                <p className="text-[11px] text-blue-800 leading-relaxed">
                                                    Anda menyetujui langsung di halaman ini menggunakan akun Anda sendiri, tanpa link pribadi maupun verifikasi nomor HP. Periksa dokumen hasil UAT di bawah sebelum menyetujui.
                                                </p>
                                                {/*
                                                  * Hanya ada satu tombol: Setujui. Penolakan dan permintaan
                                                  * revisi dari sisi pemohon sudah diajukan serta diaudit pada
                                                  * pertemuan UAT (Tahap 2), sehingga tidak boleh ada jalur
                                                  * penolakan kedua atas temuan yang sama.
                                                  */}
                                                <p className="mt-3 text-[11px] text-blue-700 flex items-start gap-1.5">
                                                    <Info size={13} className="shrink-0 mt-0.5" /> Penolakan dan permintaan revisi tidak lagi tersedia di tahap ini karena keduanya sudah dicatat tim penguji saat pelaksanaan UAT.
                                                </p>
                                                <label htmlFor="uat-approval-note" className="block text-[11px] font-bold text-blue-800 mt-4 mb-1.5">
                                                    Catatan (opsional)
                                                </label>
                                                <textarea
                                                    id="uat-approval-note"
                                                    rows={3}
                                                    value={uatApprovalNote}
                                                    onChange={(e) => setUatApprovalNote(e.target.value)}
                                                    placeholder="Tambahkan catatan bila ada hal yang perlu dicatat pada berita acara."
                                                    className="w-full px-3 py-2.5 bg-white rounded-lg border border-blue-200 focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none transition-all text-sm resize-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleApproveUat(mySlot.id)}
                                                    disabled={isSubmittingUatApproval}
                                                    className="mt-3 w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-colors cursor-pointer active:scale-95 disabled:active:scale-100"
                                                >
                                                    <Check size={16} />
                                                    {isSubmittingUatApproval ? 'Menyimpan persetujuan...' : 'Setujui'}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                                                <p className="text-xs font-bold text-amber-800 mb-1">Persetujuan Anda sebagai {mySlot.approval_role_label}</p>
                                                <p className="text-[11px] text-amber-800 flex items-start gap-1.5">
                                                    <Clock size={13} className="shrink-0 mt-0.5" />
                                                    {mySlot.status === 'pending'
                                                        ? 'Tombol persetujuan aktif setelah eksekusi UAT mencapai Tahap 3. Bila ada revisi mayor, UAT dijalankan ulang dari Tahap 1 lebih dulu.'
                                                        : `Status persetujuan Anda saat ini: ${mySlotStatus.label}.`}
                                                </p>
                                            </div>
                                        )}

                                        {otherApprovers.length > 0 && (
                                            <div className="mt-4">
                                                {/*
                                                  * Hanya posisi, nama, dan status yang ditampilkan. Nomor telepon
                                                  * tersamar, kesiapan link, serta catatan keputusan pihak lain
                                                  * memang ada di matriks, tetapi tidak ada gunanya bagi pemohon
                                                  * dan tidak perlu keluar dari lingkup tim IT.
                                                  */}
                                                <p className="text-xs font-bold text-gray-700 mb-2">Penandatangan Lain</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {otherApprovers.map(approver => {
                                                        const approverStatus = UAT_APPROVER_STATUS_LABEL[approver.status] || UAT_APPROVER_STATUS_LABEL.pending;
                                                        return (
                                                            <div key={approver.id} className="p-3 rounded-xl border border-gray-200 bg-gray-50 text-xs">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="font-bold text-gray-800 truncate">{approver.name}</span>
                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${approverStatus.pillCls}`}>
                                                                        {approverStatus.label}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[10px] text-gray-500 mt-1">{approver.approval_role_label}</p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {uatApprovalDocs.length > 0 && (
                                            <div className="mt-4 border-t border-gray-100 pt-4">
                                                <p className="text-xs font-bold text-gray-700 mb-2">Dokumen Hasil UAT</p>
                                                <div className="space-y-2">
                                                    {uatApprovalDocs.map(doc => (
                                                        <div key={doc.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 font-bold text-[9px] ${getDocIconStyle(doc.name || '')}`}>
                                                                    {getDocExtLabel(doc.name || '')}
                                                                </div>
                                                                <span className="font-medium text-gray-700 truncate">{doc.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0 ml-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewDoc(doc)}
                                                                    className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <Eye size={12} /> Lihat
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        if (!doc.id) return;
                                                                        try {
                                                                            const blob = await documentService.download(doc.id);
                                                                            const url = URL.createObjectURL(blob);
                                                                            const a = document.createElement('a');
                                                                            a.href = url;
                                                                            a.download = doc.name || 'dokumen.pdf';
                                                                            document.body.appendChild(a);
                                                                            a.click();
                                                                            document.body.removeChild(a);
                                                                            URL.revokeObjectURL(url);
                                                                        } catch {
                                                                            alert('Gagal mengunduh dokumen.');
                                                                        }
                                                                    }}
                                                                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <Download size={12} /> Unduh
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* ── Dokumen Proyek (semua tahap) ── */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mt-6">
                                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                                    <FileText size={20} className="mr-2 text-[#00529C]" />
                                    Dokumen Proyek
                                </h2>
                                {(() => {
                                    const realDocs = getProjectRealDocuments(activeProjectObj);
                                    if (realDocs.length === 0) {
                                        return <p className="text-xs text-gray-400 italic">Belum ada dokumen terlampir.</p>;
                                    }
                                    return (
                                        <div className="space-y-2">
                                            {realDocs.map((doc, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 font-bold text-[9px] ${getDocIconStyle(doc.name || '')}`}>
                                                            {getDocExtLabel(doc.name || '')}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-gray-700 truncate">{doc.name}</p>
                                                            <p className="text-[10px] text-gray-400">
                                                                {doc.size}{doc.author ? ` • ${doc.author}` : ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                                        {doc.id && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewDoc(doc)}
                                                                    className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <Eye size={12} /> Lihat
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        if (!doc.id) return;
                                                                        try {
                                                                            const blob = await documentService.download(doc.id);
                                                                            const url = URL.createObjectURL(blob);
                                                                            const a = document.createElement('a');
                                                                            a.href = url;
                                                                            a.download = doc.name || 'dokumen.pdf';
                                                                            document.body.appendChild(a);
                                                                            a.click();
                                                                            document.body.removeChild(a);
                                                                            URL.revokeObjectURL(url);
                                                                        } catch {
                                                                            alert('Gagal mengunduh dokumen.');
                                                                        }
                                                                    }}
                                                                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <Download size={12} /> Unduh
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* ── Status Pengujian (SIT/UAT) & Riwayat Change Request ── */}
                            {(() => {
                                const sd = activeProjectObj?.sitUatData || activeProjectObj?.sit_uat_data || {};
                                const stRaw = activeSelected?.statusRaw;
                                const isUat = ['UAT_IN_PROGRESS', 'UAT_REVISION_SIT', 'UAT_REVISION_DEV', 'DEV_COMPLETED'].includes(stRaw);
                                const isSit = ['SIT_IN_PROGRESS', 'SIT_REVISION'].includes(stRaw);
                                const crs = sd.uat_change_requests || [];
                                const sitAppr = sd.sit3_approvals || {};
                                if (!isSit && !isUat) return null;
                                return (
                                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mt-6">
                                        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                                            <Shield size={20} className="mr-2 text-[#00529C]" />
                                            Status Pengujian
                                        </h2>

                                        {/* UAT */}
                                        {isUat && (
                                            <div className="space-y-4">
                                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                                                    <p className="text-xs font-bold text-amber-800 mb-2">Persetujuan UAT</p>
                                                    <p className="text-[11px] text-amber-800 leading-relaxed">
                                                        Pemohon proyek menyetujui hasil UAT langsung di halaman ini memakai akunnya sendiri, sehingga tidak lagi dibuatkan link pribadi. Pimpinan grup dan pimpinan divisi pemohon tetap menyetujui melalui link pribadi yang dibuat PM, dengan verifikasi nomor HP terdaftar.
                                                    </p>
                                                    {user?.role === 'business_user' && (Number(sd.activeUatStep || 1) < 3 || isUatRestartPending(sd)) && (
                                                        <p className="mt-3 text-[11px] text-amber-700 font-semibold flex items-start gap-1.5">
                                                            <Clock size={13} className="shrink-0 mt-0.5" /> Persetujuan final tersedia setelah eksekusi UAT mencapai Tahap 3. Revisi mayor membuat UAT dijalankan ulang dari Tahap 1 setelah SIT ulang lulus, jadi persetujuan baru terbuka lagi ketika pelaksanaan ulang itu sampai di Tahap 3.
                                                        </p>
                                                    )}
                                                    {/*
                                                      * Pemohon tidak lagi dapat membuat change request dari halaman ini.
                                                      * Permintaan perubahan hanya sah diajukan pada pertemuan UAT dan
                                                      * dicatat oleh penguji di Tahap 2 wizard SIT/UAT, sehingga setiap
                                                      * permintaan selalu punya konteks skenario dan bukti yang dibahas
                                                      * bersama. Riwayat di bawah tetap ditampilkan agar pemohon dapat
                                                      * memantau tindak lanjut permintaannya.
                                                      */}
                                                    {user?.role === 'business_user' && (
                                                        <p className="mt-3 text-[11px] text-amber-700 flex items-start gap-1.5">
                                                            <Info size={13} className="shrink-0 mt-0.5" /> Permintaan perubahan diajukan langsung pada pertemuan UAT dan dicatat oleh tim penguji. Hasil pencatatannya muncul pada daftar di bawah.
                                                        </p>
                                                    )}
                                                </div>
                                                {crs.length > 0 && (
                                                    <div>
                                                        <p className="text-xs font-bold text-gray-700 mb-2">Change Request dari Pertemuan UAT</p>
                                                        <div className="space-y-2">
                                                            {crs.map(cr => {
                                                                const crStatus = CHANGE_REQUEST_STATUS_LABEL[cr.status] || CHANGE_REQUEST_STATUS_LABEL.pending;
                                                                return (
                                                                    <div key={cr.id} className={`p-3 rounded-xl border text-xs ${crStatus.cardCls}`}>
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <span className="font-bold text-gray-800">{cr.title}</span>
                                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${crStatus.pillCls}`}>
                                                                                {crStatus.label}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-gray-600 mt-1">{cr.detail}</p>
                                                                        <p className="text-[10px] text-gray-400 mt-1">
                                                                            Oleh: {cr.submittedBy}
                                                                            {cr.type ? ` • Tipe ${cr.type === 'mayor' ? 'Mayor' : 'Minor'}` : ''}
                                                                        </p>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* SIT */}
                                        {isSit && (
                                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                                                <p className="text-xs font-bold text-blue-800 mb-2">Persetujuan SIT</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                    <div className={`p-2.5 rounded-lg border text-center ${sitAppr?.developer?.approved ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
                                                        <p className="text-[9px] font-bold text-gray-500 uppercase">Developer</p>
                                                        <p className={`text-[11px] font-bold mt-0.5 ${sitAppr?.developer?.approved ? 'text-emerald-700' : 'text-gray-400'}`}>
                                                            {sitAppr?.developer?.approvedCount ?? 0}/{sitAppr?.developer?.required ?? 0}
                                                        </p>
                                                    </div>
                                                    <div className={`p-2.5 rounded-lg border text-center ${sitAppr?.pm?.approved ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
                                                        <p className="text-[9px] font-bold text-gray-500 uppercase">PM</p>
                                                        <p className={`text-[11px] font-bold mt-0.5 ${sitAppr?.pm?.approved ? 'text-emerald-700' : 'text-gray-400'}`}>
                                                            {sitAppr?.pm?.approved ? '✓' : 'Menunggu'}
                                                        </p>
                                                    </div>
                                                    <div className={`p-2.5 rounded-lg border text-center ${sitAppr?.development_lead?.approved ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
                                                        <p className="text-[9px] font-bold text-gray-500 uppercase">Dev Lead</p>
                                                        <p className={`text-[11px] font-bold mt-0.5 ${sitAppr?.development_lead?.approved ? 'text-emerald-700' : 'text-gray-400'}`}>
                                                            {sitAppr?.development_lead?.approved ? '✓' : 'Menunggu'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {previewDoc && (
                <DocumentViewerModal
                    doc={previewDoc}
                    project={activeProjectObj}
                    onClose={() => setPreviewDoc(null)}
                />
            )}

        </div>
    );
}
