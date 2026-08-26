import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../contexts/ProjectContext';
import {
    PROJECT_STATUS,
    PROJECT_STATUS_COLOR,
    PROJECT_STATUS_LABEL,
    getProjectPhaseKey,
} from '../../constants/projectStatus';
import {
    Search,
    User,
    Clock,
    CheckCircle,
    AlertCircle,
    ArrowUpRight,
    Briefcase,
    Loader2,
} from 'lucide-react';

/**
 * Urutan status untuk dropdown filter, mengikuti urutan deklarasi pada
 * `PROJECT_STATUS` (sudah tersusun per fase). Dipakai untuk mengurutkan status
 * yang benar-benar muncul pada data, bukan untuk menampilkan seluruh 27 status
 * yang sebagian tidak akan pernah ada di daftar proyek yang sedang dibuka.
 */
const STATUS_ORDER = Object.values(PROJECT_STATUS);

/**
 * Status akhir/di luar alur. Untuk proyek berstatus ini, nomor fase tidak punya
 * arti sebagai kemajuan — jadi indikator fase disembunyikan dan hanya badge
 * statusnya yang ditampilkan.
 */
const OUT_OF_FLOW_STATUSES = [
    PROJECT_STATUS.REJECTED,
    PROJECT_STATUS.ON_HOLD,
    PROJECT_STATUS.CANCELLED,
];

/** Jumlah fase yang dikenali `getProjectPhaseKey` (1..4). */
const TOTAL_PHASES = 4;

export default function Tasks() {
    const { projects, isLoading } = useProjects();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const mappedProjects = useMemo(() => {
        return (projects || []).map(p => ({
            reqId: p.reqId || p.req_id || `REQ-${p.id}`,
            realId: p.id,
            name: p.name || p.title || 'Proyek Tanpa Judul',
            pm: typeof p.pm === 'object' ? (p.pm?.name || 'Belum Dialokasi') : (p.pm || 'Belum Dialokasi'),
            status: p.status || PROJECT_STATUS.PENDING,
            // Nomor fase SDLC diturunkan dari status lewat pemetaan tunggal di
            // `projectStatus.js`. Sebelumnya kolom ini berisi persentase karangan
            // (100 untuk LIVE_PRODUCTION, 50 untuk IN_DEVELOPMENT, 25 untuk 25
            // status lainnya) — sebuah proyek yang sudah lulus QA dan Siber tampil
            // sama seperti pengajuan yang baru masuk.
            phaseKey: getProjectPhaseKey(p.status),
            isOutOfFlow: OUT_OF_FLOW_STATUSES.includes(p.status),
        }));
    }, [projects]);

    // Pilihan filter dibangun dari status yang benar-benar ada pada data, bukan
    // dari tiga status yang ditulis tangan. Dengan begitu tidak ada status yang
    // hilang dari dropdown, dan tidak ada pilihan yang pasti berhasil nol baris.
    const availableStatuses = useMemo(() => {
        const present = new Set(mappedProjects.map((p) => p.status));
        return STATUS_ORDER.filter((status) => present.has(status));
    }, [mappedProjects]);

    const filteredProjects = useMemo(() => {
        const keyword = searchTerm.trim().toLowerCase();
        return mappedProjects.filter((project) => {
            const matchSearch = !keyword
                || project.name.toLowerCase().includes(keyword)
                || String(project.reqId).toLowerCase().includes(keyword);
            const matchStatus = statusFilter ? project.status === statusFilter : true;
            return matchSearch && matchStatus;
        });
    }, [mappedProjects, searchTerm, statusFilter]);

    const getStatusIcon = (status) => {
        if (OUT_OF_FLOW_STATUSES.includes(status)) {
            return <AlertCircle size={14} className="shrink-0" />;
        }
        if (status === PROJECT_STATUS.LIVE_PRODUCTION) {
            return <CheckCircle size={14} className="shrink-0" />;
        }
        if (status === PROJECT_STATUS.PENDING || status === PROJECT_STATUS.IN_REVIEW) {
            return <Briefcase size={14} className="shrink-0" />;
        }
        return <Clock size={14} className="shrink-0" />;
    };

    const handleSelectProject = (projectId) => {
        navigate(`/pm/tasks/${projectId}`);
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-gray-800">Manajemen Task</h2>
                <p className="text-gray-500 text-sm mt-1">Pilih proyek dari database backend untuk mengelola task dan sub-task tim development.</p>
            </div>

            {/* Toolbar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-3 mb-6">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Cari ID atau Nama Proyek..."
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] text-sm shadow-sm transition-all"
                    />
                </div>
                <div className="flex gap-2.5 w-full md:w-auto">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="border border-gray-200 rounded-xl px-4 py-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] shadow-sm"
                    >
                        <option value="">Semua Status</option>
                        {availableStatuses.map((status) => (
                            <option key={status} value={status}>
                                {PROJECT_STATUS_LABEL[status] || status}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {isLoading && mappedProjects.length === 0 ? (
                    // Muat pertama dibedakan dari daftar kosong. Sebelumnya keduanya
                    // menampilkan "Tidak ada proyek ditemukan di database." sehingga PM
                    // membaca kegagalan data padahal permintaannya masih berjalan.
                    <div className="col-span-3 bg-white p-8 rounded-2xl border border-gray-200 text-center text-gray-500 font-medium flex items-center justify-center gap-2.5">
                        <Loader2 size={16} className="animate-spin text-[#00529C]" />
                        Memuat daftar proyek...
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="col-span-3 bg-white p-8 rounded-2xl border border-gray-200 text-center text-gray-400 font-medium">
                        {mappedProjects.length === 0
                            ? 'Belum ada proyek yang dapat Anda kelola.'
                            : 'Tidak ada proyek yang cocok dengan pencarian atau filter status.'}
                    </div>
                ) : (
                    filteredProjects.map((project) => (
                        <div key={project.realId} className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start gap-2 mb-3">
                                    <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-mono font-bold shrink-0">
                                        {project.reqId}
                                    </span>
                                    {/* Warna dan label badge diambil dari peta status bersama.
                                        Sebelumnya semua status memakai satu warna hijau —
                                        proyek DITOLAK dan DIBATALKAN pun tampil hijau, dengan
                                        kode mentah sebagai teksnya. */}
                                    <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border text-right ${PROJECT_STATUS_COLOR[project.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                        {getStatusIcon(project.status)}
                                        {PROJECT_STATUS_LABEL[project.status] || project.status}
                                    </span>
                                </div>
                                <h3 className="font-bold text-gray-800 text-base mb-2 line-clamp-1">{project.name}</h3>
                                <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-4">
                                    <User size={13} className="text-gray-400" /> PM: <span className="font-semibold text-gray-700">{project.pm}</span>
                                </p>
                            </div>

                            <div>
                                {/* Indikator fase SDLC, bukan persentase. Tidak ada sumber
                                    kemajuan berbasis persen di aplikasi ini, jadi angka
                                    seperti itu hanya bisa dikarang. Nomor fase sebaliknya
                                    diturunkan langsung dari status proyek. */}
                                <div className="mb-4">
                                    <div className="flex justify-between text-xs font-bold text-gray-600 mb-1.5">
                                        <span>Fase SDLC</span>
                                        <span className={project.isOutOfFlow ? 'text-gray-400' : 'text-[#00529C]'}>
                                            {project.isOutOfFlow ? 'Di luar alur' : `Fase ${project.phaseKey} dari ${TOTAL_PHASES}`}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        {Array.from({ length: TOTAL_PHASES }, (_, i) => i + 1).map((phase) => (
                                            <div
                                                key={phase}
                                                className={`h-2 flex-1 rounded-full ${
                                                    project.isOutOfFlow
                                                        ? 'bg-gray-200'
                                                        : phase <= project.phaseKey
                                                            ? 'bg-[#00529C]'
                                                            : 'bg-gray-100'
                                                }`}
                                            ></div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleSelectProject(project.realId)}
                                    className="w-full py-2.5 px-4 bg-[#00529C] hover:bg-[#004080] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 group cursor-pointer active:scale-95"
                                >
                                    <span>Kelola Task &amp; Pekerjaan Dev</span>
                                    <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}