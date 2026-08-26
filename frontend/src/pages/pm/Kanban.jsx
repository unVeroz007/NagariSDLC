import { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import {
    PROJECT_STATUS,
    PROJECT_STATUS_COLOR,
    PROJECT_STATUS_LABEL,
} from '../../constants/projectStatus';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    List,
    Filter,
} from 'lucide-react';

/**
 * Identitas PM sebuah proyek.
 *
 * `pm_id` selalu ada pada respons daftar proyek, sedangkan relasi `pm` hanya terisi
 * bila ikut dimuat — jadi ID dibaca dari relasinya lebih dulu, lalu dari kolomnya.
 * Mengembalikan null bila proyek memang belum punya PM.
 */
const getProjectPmId = (project) => {
    const id = Number(project?.pm?.id ?? project?.pm_id);
    return Number.isFinite(id) && id > 0 ? id : null;
};

/** Nama PM untuk ditampilkan; relasi `pm` adalah satu-satunya sumber namanya. */
const getProjectPmName = (project) => project?.pm?.name || null;

export default function Kanban() {
    const { user } = useAuth();
    const { projects, isLoading } = useProjects();
    const navigate = useNavigate();

    // Nilai awal filter memakai penanda 'MY_PROJECTS', bukan nama pengguna.
    // Sebelumnya nilai awalnya adalah `user.name`, yang membuat filter jatuh ke cabang
    // "filter per PM tertentu" dan mencocokkan proyek berdasarkan nama — sehingga PM
    // dengan nama kosong melihat seluruh proyek, dan PM yang namanya merupakan
    // potongan nama rekannya melihat proyek rekannya juga.
    const [selectedPmFilter, setSelectedPmFilter] = useState(() => (
        user?.role === 'project_manager' ? 'MY_PROJECTS' : 'ALL'
    ));
    const [searchTerm, setSearchTerm] = useState('');

    // Kolom papan Kanban SDLC.
    //
    // Setiap daftar hanya memuat anggota App\Enums\ProjectStatus dan bersifat lengkap:
    // seluruh 27 status enum terpetakan ke tepat satu kolom. Versi sebelumnya memuat
    // status karangan ('DRAFT', 'IN_SPRINT', 'CODING', 'QA_CYBER', 'RELEASED', dsb.)
    // yang tidak pernah cocok, sekaligus melewatkan status nyata SIT_REVISION,
    // UAT_REVISION_SIT, dan UAT_REVISION_DEV sehingga proyek revisi terlempar ke
    // Fase 1 oleh pencocokan potongan kata di bawahnya.
    //
    // Lima kolom ini adalah pemecahan yang lebih halus dari empat fase
    // `getProjectPhaseKey`: kolom Fase 2 dan Fase 3 di sini sama-sama berada di
    // fase 2 pemetaan tersebut. Urutannya tetap sama, jadi keduanya tidak saling
    // bertentangan — tetapi jumlah fase pada layar lain tidak boleh disalin dari sini.
    const sdlcColumns = [
        {
            id: 'phase1',
            title: 'Fase 1: Inisiasi & Review',
            color: 'border-blue-500 bg-blue-50/30',
            statuses: [
                PROJECT_STATUS.PENDING,
                PROJECT_STATUS.IN_REVIEW,
                PROJECT_STATUS.ANALYSIS_APPROVED,
                PROJECT_STATUS.REJECTED,
                PROJECT_STATUS.ON_HOLD,
                PROJECT_STATUS.CANCELLED,
            ],
        },
        {
            id: 'phase2',
            title: 'Fase 2: Analisis & Desain',
            color: 'border-indigo-500 bg-indigo-50/30',
            statuses: [
                PROJECT_STATUS.READY_FOR_DEVELOPMENT,
                PROJECT_STATUS.DEV_ANALYSIS,
                PROJECT_STATUS.DEV_ANALYSIS_DONE,
            ],
        },
        {
            id: 'phase3',
            title: 'Fase 3: Development & SIT/UAT Internal',
            color: 'border-amber-500 bg-amber-50/30',
            statuses: [
                PROJECT_STATUS.IN_DEVELOPMENT,
                PROJECT_STATUS.RETURN_TO_DEV,
                PROJECT_STATUS.SIT_IN_PROGRESS,
                PROJECT_STATUS.SIT_PASSED,
                PROJECT_STATUS.SIT_REVISION,
                PROJECT_STATUS.UAT_IN_PROGRESS,
                PROJECT_STATUS.UAT_REVISION_SIT,
                PROJECT_STATUS.UAT_REVISION_DEV,
                PROJECT_STATUS.UAT_PASSED,
                PROJECT_STATUS.DEV_COMPLETED,
            ],
        },
        {
            id: 'phase4',
            title: 'Fase 4: Pengujian QA & Cyber',
            color: 'border-purple-500 bg-purple-50/30',
            statuses: [
                PROJECT_STATUS.READY_FOR_QA,
                PROJECT_STATUS.QA_IN_PROGRESS,
                PROJECT_STATUS.QA_PASSED,
                PROJECT_STATUS.CYBER_IN_PROGRESS,
                PROJECT_STATUS.CYBER_PASSED,
            ],
        },
        {
            id: 'phase5',
            title: 'Fase 5: Rilis & Quality Gate',
            color: 'border-emerald-500 bg-emerald-50/30',
            statuses: [
                PROJECT_STATUS.READY_FOR_UAT,
                PROJECT_STATUS.PENDING_GOLIVE,
                PROJECT_STATUS.LIVE_PRODUCTION,
            ],
        },
    ];

    // Status di luar enum tidak bisa datang dari API, jadi tidak ada penebakan
    // potongan kata: nilai tak dikenal ditaruh di kolom pertama agar tetap terlihat.
    const getProjectPhaseId = (projectStatus) => {
        const statusUpper = String(projectStatus || '').toUpperCase();
        const column = sdlcColumns.find((col) => col.statuses.includes(statusUpper));
        return column ? column.id : 'phase1';
    };

    // Filter projects for Project SDLC view
    const filteredProjects = useMemo(() => {
        let result = [...(projects || [])];

        // Penyaringan per PM memakai `pm_id`, bukan pencocokan nama.
        //
        // Versi sebelumnya membandingkan nama PM dengan `String.includes()`. Pola itu
        // salah dalam dua arah sekaligus: nama kosong menghasilkan `includes('')` yang
        // selalu benar sehingga seluruh proyek lolos, dan nama yang merupakan potongan
        // nama orang lain ("Budi" di dalam "Budi Santoso") menarik proyek milik PM lain.
        // Nama juga bukan identitas — dua pegawai boleh bernama sama.
        if (selectedPmFilter === 'MY_PROJECTS') {
            const myId = Number(user?.id);
            result = Number.isFinite(myId) && myId > 0
                ? result.filter((p) => getProjectPmId(p) === myId)
                : [];
        } else if (selectedPmFilter !== 'ALL') {
            const pmId = Number(selectedPmFilter);
            result = Number.isFinite(pmId) && pmId > 0
                ? result.filter((p) => getProjectPmId(p) === pmId)
                : result;
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(p =>
                String(p.reqId || p.req_id || p.id || '').toLowerCase().includes(term) ||
                String(p.name || p.title || '').toLowerCase().includes(term) ||
                String(p.division || '').toLowerCase().includes(term)
            );
        }

        return result;
    }, [projects, selectedPmFilter, user, searchTerm]);

    // Pilihan filter PM diturunkan dari data proyek yang ada, bukan daftar nama tetap:
    // daftar tetap ikut usang setiap kali susunan PM berubah dan menampilkan orang yang
    // tidak ada di sistem. Sengaja memakai `projects`, bukan `filteredProjects`, agar
    // pilihannya tidak menyusut karena filter yang sedang aktif. Nilai pilihannya adalah
    // ID PM supaya penyaringannya tidak bergantung pada nama.
    const pmFilterOptions = useMemo(() => {
        const nameById = new Map();

        (projects || []).forEach((project) => {
            const pmId = getProjectPmId(project);
            if (pmId === null || nameById.has(pmId)) return;
            nameById.set(pmId, getProjectPmName(project) || `PM #${pmId}`);
        });

        return [...nameById.entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'id'));
    }, [projects]);

    // Muat pertama dibedakan dari papan yang memang kosong: tanpa pemisahan ini setiap
    // kolom menyatakan "Tidak ada proyek di fase ini" selagi permintaannya masih jalan.
    const totalProjects = (projects || []).length;
    const isFirstLoad = isLoading && totalProjects === 0;

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-extrabold text-gray-800">Kanban Board Status SDLC Proyek</h2>
                    <p className="text-gray-500 text-sm mt-1">Visualisasi posisi seluruh proyek di setiap fase &amp; langkah SDLC Bank Nagari.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Filter Input Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Cari ID / Nama Proyek..."
                            className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] shadow-xs w-64"
                        />
                    </div>
                </div>
            </div>

            {/* Top Filter Bar (PM Scope Selection) */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-[#00529C]" />
                    <span className="text-sm font-bold text-gray-800">Filter Tampilan Kanban Proyek:</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => setSelectedPmFilter('ALL')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            selectedPmFilter === 'ALL'
                                ? 'bg-[#1a365d] text-white shadow-xs'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        🌐 Semua Proyek SDLC ({totalProjects})
                    </button>

                    {user?.role === 'project_manager' && (
                        <button
                            onClick={() => setSelectedPmFilter('MY_PROJECTS')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                selectedPmFilter === 'MY_PROJECTS'
                                    ? 'bg-[#00529C] text-white shadow-xs'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            👤 Proyek PM Saya
                        </button>
                    )}

                    <select
                        value={['ALL', 'MY_PROJECTS'].includes(selectedPmFilter) ? '' : selectedPmFilter}
                        onChange={(e) => setSelectedPmFilter(e.target.value || 'ALL')}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-700 outline-none focus:border-[#00529C]"
                        disabled={pmFilterOptions.length === 0}
                    >
                        <option value="">
                            {pmFilterOptions.length === 0
                                ? '-- Belum ada PM pada data proyek --'
                                : '-- Filter Per Project Manager --'}
                        </option>
                        {pmFilterOptions.map(pm => (
                            <option key={pm.id} value={pm.id}>{pm.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ======================================================== */}
            {/* SDLC PROJECT KANBAN BOARD (ALL PROJECTS PER PHASE)       */}
            {/* ======================================================== */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
                {sdlcColumns.map(col => {
                    const colProjects = filteredProjects.filter(p => getProjectPhaseId(p.status) === col.id);

                    return (
                        <div
                            key={col.id}
                            className={`bg-white p-4 rounded-2xl border-t-4 ${col.color} border-x border-b border-gray-200/70 shadow-sm min-h-[550px] flex flex-col`}
                        >
                            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                                <h3 className="font-bold text-gray-800 text-xs leading-tight">{col.title}</h3>
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 font-extrabold rounded-full text-xs">
                                    {colProjects.length}
                                </span>
                            </div>

                            <div className="flex-1 space-y-3">
                                {colProjects.length === 0 ? (
                                    <div className="h-36 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 text-xs font-medium text-center p-3">
                                        {isFirstLoad ? 'Memuat data proyek...' : 'Tidak ada proyek di fase ini'}
                                    </div>
                                ) : (
                                    colProjects.map(p => (
                                        <div
                                            key={p.id}
                                            className="p-3.5 bg-white hover:bg-blue-50/40 rounded-xl border border-gray-200 shadow-xs hover:shadow-md transition-all group"
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-[11px] font-mono font-bold text-[#00529C]">
                                                    {p.reqId || p.req_id || `REQ-${p.id}`}
                                                </span>
                                                {/* Warna dan label diambil dari peta status bersama. Peta warna
                                                    lokal sebelumnya hanya mengenali 15 dari 27 status, jadi 12
                                                    status sisanya — termasuk seluruh siklus SIT/UAT dan
                                                    DITOLAK/DIBATALKAN — tampil abu-abu seragam dengan kode
                                                    enum mentah sebagai teksnya. */}
                                                <span className={`text-[10px] px-2 py-0.5 font-bold rounded-md border ${PROJECT_STATUS_COLOR[p.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                                    {PROJECT_STATUS_LABEL[p.status] || p.status}
                                                </span>
                                            </div>

                                            <h4 className="font-bold text-gray-800 text-xs mb-2 line-clamp-2 group-hover:text-[#00529C] transition-colors">
                                                {p.name || p.title}
                                            </h4>

                                            <div className="text-[11px] text-gray-500 space-y-1 mb-3 pt-2 border-t border-gray-100">
                                                <div className="flex items-center justify-between">
                                                    <span>Divisi:</span>
                                                    {/* `ProjectContext.normalizeProject` sudah meratakan divisi
                                                        menjadi string, jadi tidak ada lagi pembacaan `.name`
                                                        di sini — cabang itu selalu undefined. */}
                                                    <span className="font-medium text-gray-700">{p.division || 'Tidak Diketahui'}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span>PM:</span>
                                                    {/* Nama PM hanya berasal dari relasi `pm`. Kunci `pmName` dan
                                                        `assignedPM` yang dibaca sebelumnya tidak ada pada
                                                        `ProjectResource` maupun hasil normalisasi konteks. */}
                                                    <span className="font-semibold text-gray-800">
                                                        {getProjectPmName(p) || 'Belum Dialokasi'}
                                                    </span>
                                                </div>
                                            </div>

                                            {['super_admin', 'development_lead', 'dev_analyst', 'project_manager'].includes(user?.role) && (
                                                <button
                                                    onClick={() => navigate(`/pm/tasks/${p.id}`)}
                                                    className="w-full py-2 bg-[#00529C] text-white hover:bg-blue-700 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                                >
                                                    <List size={13} />
                                                    <span>Detail Task &amp; Pekerjaan Dev</span>
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}