import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProjects } from '../contexts/ProjectContext';
import { menuSections, getDefaultRouteForRole, filterSectionsByMenuAccess } from '../data/menuConfig';
import { APPROVALS_CHANGED_EVENT, internalSitApprovalService, internalUatApprovalService } from '../services/api';
import { useVisibilityPolling } from '../hooks/usePolling';
import { POLLING_INTERVAL_MS } from '../constants/polling';
import {
    PROJECT_STATUS,
    TRACK_STATUS,
    getQaTrackStatus,
    getCyberTrackStatus,
    isTrackActive,
    isTrackPassed,
    canStartQaTrack,
    canStartCyberTrack,
} from '../constants/projectStatus';
import NotificationBell from '../components/NotificationBell';
import {
    Search,
    ChevronRight,
    LogOut,
    Menu,
    X,
    UserCircle,
    AlertTriangle,
} from 'lucide-react';

const INTERNAL_UAT_APPROVER_ROLES = new Set([
    'super_admin', 'head_of_it', 'lead_group', 'analyst',
    'development_lead', 'project_manager', 'dev_analyst', 'developer',
]);

// Role yang melihat SELURUH tugas pada jalur pengujian, bukan hanya disposisinya sendiri.
// Cermin daftar privileged pada MyTasksQA.jsx dan MyTasksCyber.jsx: jalur Keamanan Siber
// sengaja lebih sempit (tanpa lead_group), sesuai matriks wewenang backend.
const QA_TASK_PRIVILEGED_ROLES = new Set(['qa_lead', 'lead_group', 'super_admin']);
const CYBER_TASK_PRIVILEGED_ROLES = new Set(['cyber_lead', 'super_admin']);

export default function MainLayout() {
    const { user, logout } = useAuth();
    const { projects } = useProjects();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    // Kedua sumber persetujuan disimpan terpisah supaya kegagalan jaringan pada salah
    // satunya tidak menghapus angka milik sumber yang lain dari lencana.
    const [pendingSitApprovalCount, setPendingSitApprovalCount] = useState(0);
    const [pendingUatApprovalCount, setPendingUatApprovalCount] = useState(0);
    const profileMenuRef = useRef(null);

    const pendingProjectsCount = (projects || []).filter(p => p.status === 'PENDING').length;
    const incomingDevLeadCount = (projects || []).filter(p => p.status === 'READY_FOR_DEVELOPMENT').length;
    // Personalisasi: masing-masing analis hanya lihat notifikasi proyek tugasnya sendiri
    const analystPlanCount = useMemo(() => (projects || []).filter(p => {
        if (p.status !== 'IN_REVIEW') return false;
        if (user?.role === 'super_admin' || user?.role === 'lead_group') return true;
        const assignedId = p.analyst_id || (typeof p.analyst === 'object' ? p.analyst?.id : null) || (typeof p.assignedAnalyst === 'object' ? p.assignedAnalyst?.id : null);
        if (!assignedId || !user?.id) return false;
        return Number(assignedId) === Number(user.id);
    }).length, [projects, user]);
    // Analis Pengembangan = PM. Penugasannya ada di `pm_id`, bukan `analyst_id`
    // (kolom itu milik System Analyst Fase 1), sehingga lonceng ini hanya berbunyi
    // untuk PM yang benar-benar memegang proyeknya.
    const devAnalystCount = useMemo(() => (projects || []).filter(p => {
        if (p.status !== 'DEV_ANALYSIS') return false;
        if (user?.role === 'super_admin' || user?.role === 'development_lead') return true;
        if (!user?.id) return false;
        const pmId = p.pm_id
            || (p.pm && typeof p.pm === 'object' ? p.pm.id : null);
        return Number(pmId) === Number(user.id);
    }).length, [projects, user]);

    // ── Fase 3 (Pengujian): lencana antrean QA & Keamanan Siber ──
    // Tiap angka memakai penyaring yang SAMA PERSIS dengan halaman tujuannya, sehingga
    // lencana tidak pernah menjanjikan pekerjaan yang tidak ada saat halaman dibuka.

    // (1) Pengajuan QA — proyek yang boleh diajukan ke jalur QA. Cermin `readyProjects`
    // di QARequest.jsx: status utama mengizinkan mulai jalur DAN jalur QA belum berjalan
    // atau lulus. Selain Super Admin, hanya proyek milik PM ini yang dihitung.
    const qaRequestCount = useMemo(() => {
        const isPrivileged = user?.role === 'super_admin';
        return (projects || []).filter(p => {
            const st = String(p.status || '').toUpperCase();
            const qaSt = getQaTrackStatus(p);
            const alreadySubmitted = isTrackActive(qaSt) || isTrackPassed(qaSt)
                || st === PROJECT_STATUS.READY_FOR_QA
                || st === PROJECT_STATUS.QA_IN_PROGRESS
                || st === PROJECT_STATUS.QA_PASSED;
            if (!canStartQaTrack(st) || alreadySubmitted) return false;
            if (isPrivileged) return true;
            const pmId = typeof p.pm === 'object' ? p.pm?.id : null;
            return Boolean(pmId) && Number(pmId) === Number(user?.id);
        }).length;
    }, [projects, user]);

    // (2) Workspace QA — proyek yang menunggu didisposisi ke analis. Cermin `qaProjects`
    // di WorkspaceQA.jsx: jalur QA berstatus SUBMITTED.
    const qaWorkspaceCount = useMemo(
        () => (projects || []).filter(p => getQaTrackStatus(p) === TRACK_STATUS.SUBMITTED).length,
        [projects]
    );

    // (3) Tugas QA Saya — tugas QA aktif milik pengguna ini. Cermin `qaTasks` di
    // MyTasksQA.jsx: jalur QA IN_PROGRESS; role penilik melihat semuanya, selain itu hanya
    // proyek yang didisposisikan kepadanya (`qaAssigneeId`).
    const qaMyTasksCount = useMemo(() => {
        const inProgress = (projects || []).filter(p => getQaTrackStatus(p) === TRACK_STATUS.IN_PROGRESS);
        if (QA_TASK_PRIVILEGED_ROLES.has(user?.role)) return inProgress.length;
        return inProgress.filter(p => Number(p.qaAssigneeId) === Number(user?.id)).length;
    }, [projects, user]);

    // (4) Pengajuan Cyber — kembar (1) untuk jalur Keamanan Siber. Cermin `readyProjects`
    // di CyberRequest.jsx.
    const cyberRequestCount = useMemo(() => {
        const isPrivileged = user?.role === 'super_admin';
        return (projects || []).filter(p => {
            const st = String(p.status || '').toUpperCase();
            const cyberSt = getCyberTrackStatus(p);
            const alreadySubmitted = isTrackActive(cyberSt) || isTrackPassed(cyberSt)
                || st === PROJECT_STATUS.CYBER_IN_PROGRESS
                || st === PROJECT_STATUS.CYBER_PASSED;
            if (!canStartCyberTrack(st) || alreadySubmitted) return false;
            if (isPrivileged) return true;
            const pmId = typeof p.pm === 'object' ? p.pm?.id : null;
            return Boolean(pmId) && Number(pmId) === Number(user?.id);
        }).length;
    }, [projects, user]);

    // (5) Workspace Cyber — kembar (2). Cermin `cyberProjects` di WorkspaceCyber.jsx:
    // jalur Siber berstatus SUBMITTED.
    const cyberWorkspaceCount = useMemo(
        () => (projects || []).filter(p => getCyberTrackStatus(p) === TRACK_STATUS.SUBMITTED).length,
        [projects]
    );

    // (6) Tugas Siber Saya — kembar (3). Cermin `cyberTasks` di MyTasksCyber.jsx; daftar
    // penilik jalur Siber lebih sempit (tanpa lead_group).
    const cyberMyTasksCount = useMemo(() => {
        const inProgress = (projects || []).filter(p => getCyberTrackStatus(p) === TRACK_STATUS.IN_PROGRESS);
        if (CYBER_TASK_PRIVILEGED_ROLES.has(user?.role)) return inProgress.length;
        return inProgress.filter(p => Number(p.cyberAssigneeId) === Number(user?.id)).length;
    }, [projects, user]);

    // (7) Putaran Pengembalian — proyek yang punya putaran pengembalian MASIH TERBUKA,
    // yaitu perbaikan yang belum diajukan ulang. Cermin sisi "menunggu perbaikan" pada
    // ReturnRounds.jsx (`round.is_open`); putaran yang sudah diajukan ulang tidak lagi
    // menahan perhatian sehingga tidak dihitung. Tidak disaring kepemilikan PM — sama
    // seperti halamannya, yang menampilkan seluruh proyek yang boleh dibaca dan
    // menyerahkan pembatasan cakupan pada backend.
    const returnRoundsCount = useMemo(
        () => (projects || []).filter(p => {
            const rounds = Array.isArray(p.return_rounds) ? p.return_rounds : [];
            return rounds.some(r => r.is_open);
        }).length,
        [projects]
    );

    // Lencana "Persetujuan Saya" hanya relevan bagi role penyetuju internal. Daftar
    // role di atas sudah memuat seluruh penyetuju SIT (`developer`, `dev_analyst`,
    // `project_manager`, `development_lead`), jadi penggabungan SIT ke halaman ini
    // tidak menuntut pelebaran daftarnya.
    // Selang polling dipusatkan di `constants/polling.js` dan berhenti otomatis
    // saat tab tidak terlihat.
    const isInternalApprover = Boolean(user?.role && INTERNAL_UAT_APPROVER_ROLES.has(user.role));

    // Satu halaman kini memuat SIT dan UAT sekaligus, sehingga lencananya menjumlahkan
    // keduanya. Penjumlahan dilakukan saat render, bukan disimpan sebagai satu state
    // gabungan, agar tiap sumber tetap bisa diperbarui sendiri-sendiri.
    const pendingApprovalCount = pendingSitApprovalCount + pendingUatApprovalCount;

    const loadPendingApprovals = useCallback(async () => {
        // `allSettled`, bukan `all`: kedua inbox berdiri sendiri, jadi satu endpoint yang
        // gagal tidak boleh menjatuhkan angka milik endpoint lainnya. Sumber yang gagal
        // sengaja dibiarkan memakai angka terakhir yang diketahui — mengosongkannya akan
        // membuat lencana terlihat seolah pekerjaan sudah habis padahal hanya jaringannya
        // yang sedang terganggu.
        //
        // Akun yang tidak memiliki slot pada salah satu jalur tetap dijawab sukses dengan
        // `pending_count: 0` oleh backend, sehingga keadaan itu tidak perlu ditangani khusus.
        const [sitResult, uatResult] = await Promise.allSettled([
            internalSitApprovalService.getMyAssignments(),
            internalUatApprovalService.getMyAssignments(),
        ]);

        // Bentuk kembalian kedua service memang berbeda: `internalSitApprovalService`
        // sudah membuka envelope dan langsung memberi `{ pending_count, items }`,
        // sementara `internalUatApprovalService` masih meneruskan seluruh envelope
        // `{ status, message, data }`. Karena itu hanya jalur UAT yang menempuh `.data`.
        if (sitResult.status === 'fulfilled') {
            setPendingSitApprovalCount(sitResult.value?.pending_count || 0);
        }
        if (uatResult.status === 'fulfilled') {
            setPendingUatApprovalCount(uatResult.value?.data?.pending_count || 0);
        }
    }, []);

    // Muat sekali saat pengguna aktif berubah lalu polling berkala, supaya lencana
    // tidak membawa jumlah milik pengguna sebelumnya. `refreshOnReturn` dipakai karena
    // penandatangan biasanya berpindah tab untuk membaca lampiran lalu kembali —
    // menunggu satu putaran penuh membuat lencana tampak tertinggal.
    useVisibilityPolling(loadPendingApprovals, POLLING_INTERVAL_MS.internalApprovals, {
        enabled: isInternalApprover,
        immediate: true,
        refreshOnReturn: true,
        resetKey: user?.id ?? null,
    });

    // Selain polling, lencana disegarkan seketika begitu sebuah keputusan persetujuan
    // tersimpan. Keputusannya dikirim dari halaman `/approvals` maupun dari wizard
    // SIT/UAT — keduanya di luar pohon komponen ini — sehingga tanpa isyarat ini
    // lencana masih menyala sampai putaran polling berikutnya dan terbaca sebagai
    // pekerjaan yang belum dikerjakan.
    useEffect(() => {
        if (!isInternalApprover) return undefined;

        const onApprovalsChanged = () => { loadPendingApprovals(); };
        window.addEventListener(APPROVALS_CHANGED_EVENT, onApprovalsChanged);

        return () => window.removeEventListener(APPROVALS_CHANGED_EVENT, onApprovalsChanged);
    }, [isInternalApprover, loadPendingApprovals]);

    useEffect(() => {
        const onDocClick = (e) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
                setIsProfileMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    // Search Bar State & Functionality
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    const filteredProjects = searchQuery.trim()
        ? projects.filter(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.division.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : [];

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/projects?search=${encodeURIComponent(searchQuery.trim())}`);
            setIsSearchOpen(false);
        }
    };

    const handleLogout = () => {
        setIsLogoutModalOpen(true);
    };

    const confirmLogout = () => {
        setIsLogoutModalOpen(false);
        logout();
        navigate('/login');
    };

    // Susunan menu berasal dari kode (`menuSections`), lalu disaring pembatasan menu yang
    // disimpan Super Admin pada `roles.menu_access`. Penyaringan bersifat MENGURANGI:
    // tidak ada path baru yang bisa muncul dari basis data, dan menyembunyikan sebuah
    // menu tidak menutup rutenya — gerbangnya tetap `ProtectedRoute` di frontend serta
    // middleware `role:` dan service otorisasi di backend.
    //
    // Daftar pembatasan yang kosong atau tidak ada berarti tanpa pembatasan, sama seperti
    // di backend, sehingga role tidak pernah kehilangan seluruh menunya karena Super
    // Admin tidak mencentang apa pun.
    const sections = user
        ? filterSectionsByMenuAccess(menuSections[user.role] || [], user.role_detail?.menu_access)
        : [];
    const homeRoute = getDefaultRouteForRole(user?.role);

    // Cari section dan item yang aktif berdasarkan URL saat ini
    let activeSectionLabel = 'Utama';
    let activeItemLabel = 'Workspace';

    for (const section of sections) {
        const found = section.items.find(item => location.pathname === item.path || location.pathname.startsWith(item.path + '/'));
        if (found) {
            activeSectionLabel = section.label;
            activeItemLabel = found.label;
            break;
        }
    }

    return (
        <div className="flex h-screen overflow-hidden bg-[#f8f9fb] font-sans">
            {/* Mobile Backdrop Overlay */}
            {isMobileOpen && (
                <div
                    onClick={() => setIsMobileOpen(false)}
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
                />
            )}

            {/* Sidebar (Responsive Mobile Drawer & Desktop Fixed) */}
            <aside
                className={`fixed left-0 top-0 h-full w-[270px] bg-gradient-to-b from-[#003a73] to-[#001838] flex flex-col shadow-lg z-50 transition-transform duration-300 ${
                    isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                }`}
            >
                {/* Branding (Klik Mengarah ke Landing Page Role) */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 shrink-0">
                    <div
                        onClick={() => navigate(homeRoute)}
                        className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
                    >
                        <div className="w-10 h-10 bg-white rounded p-1 flex items-center justify-center shadow-xs">
                            <span className="text-[#003a73] font-extrabold text-lg">BN</span>
                        </div>
                        <div className="text-white">
                            <h1 className="font-bold text-sm leading-tight">SDLC Nagari<br />Enterprise</h1>
                        </div>
                    </div>
                    {/* Close Mobile Drawer */}
                    <button
                        onClick={() => setIsMobileOpen(false)}
                        className="lg:hidden text-white/70 hover:text-white p-1 rounded-lg"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation (Larger Font, Balanced Spacing) */}
                <div className="flex-1 overflow-y-auto py-4 px-4 flex flex-col gap-4 scrollbar-hide">
                    {sections.length === 0 && (
                        // Role tanpa peta menu. Peran adalah baris tabel `roles` yang dapat
                        // ditambah Super Admin lewat `POST /roles`, jadi keadaan ini bisa
                        // benar-benar terjadi. Sebelumnya sidebar-nya kosong tanpa
                        // keterangan apa pun, dan pengguna hanya melihat panel biru hampa
                        // tanpa tahu apa yang harus dilakukan.
                        //
                        // Sebab kedua yang mungkin: pembatasan `roles.menu_access` menunjuk
                        // path yang tidak lagi ada pada peta menu role ini.
                        <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-xs leading-relaxed text-white/70">
                            <p className="font-bold text-white/90 mb-1">Menu belum tersedia</p>
                            <p>
                                Peran akun Anda{user?.role ? ` (${user.role})` : ''} belum memiliki peta menu yang aktif.
                                Hubungi Super Admin untuk penyesuaian hak akses.
                            </p>
                        </div>
                    )}
                    {sections.map((section, idx) => (
                        <div key={idx} className="space-y-1">
                            <h2 className="text-xs font-bold text-white/50 uppercase tracking-wider px-2 py-0.5">
                                {section.label}
                            </h2>
                            <div className="flex flex-col gap-0.5 pl-3">
                                {section.items.map((item) => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        end={item.end ?? false}
                                        onClick={() => setIsMobileOpen(false)}
                                        className={({ isActive }) =>
                                            `block px-3 py-1.5 rounded-lg transition-all text-sm ${isActive
                                                ? 'bg-white/15 border-l-4 border-[#D4A017] text-white font-bold shadow-xs'
                                                : 'text-white/75 hover:text-white hover:bg-white/10 font-medium'
                                            }`
                                        }
                                    >
                                        <span className="flex items-center gap-2">
                                            {item.label}
                                            {item.path === '/workspace/lead' && pendingProjectsCount > 0 && (
                                                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-extrabold leading-none animate-pulse">
                                                    {pendingProjectsCount}
                                                </span>
                                            )}
                                            {item.path === '/workspace/dev-lead' && incomingDevLeadCount > 0 && (
                                                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold leading-none animate-pulse">
                                                    {incomingDevLeadCount}
                                                </span>
                                            )}
                                            {item.path === '/workspace/analyst' && analystPlanCount > 0 && (
                                                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-500 text-white text-[10px] font-extrabold leading-none animate-pulse">
                                                    {analystPlanCount}
                                                </span>
                                            )}
                                            {item.path === '/workspace/dev-analyst' && devAnalystCount > 0 && (
                                                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-cyan-500 text-white text-[10px] font-extrabold leading-none animate-pulse">
                                                    {devAnalystCount}
                                                </span>
                                            )}
                                            {item.path === '/approvals' && pendingApprovalCount > 0 && (
                                                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-extrabold leading-none text-white">
                                                    {pendingApprovalCount}
                                                </span>
                                            )}
                                            {item.path === '/pm/qa-request' && qaRequestCount > 0 && (
                                                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-purple-500 text-white text-[10px] font-extrabold leading-none animate-pulse">
                                                    {qaRequestCount}
                                                </span>
                                            )}
                                            {item.path === '/workspace/qa' && qaWorkspaceCount > 0 && (
                                                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-purple-500 text-white text-[10px] font-extrabold leading-none animate-pulse">
                                                    {qaWorkspaceCount}
                                                </span>
                                            )}
                                            {item.path === '/my-tasks/qa' && qaMyTasksCount > 0 && (
                                                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-purple-500 text-white text-[10px] font-extrabold leading-none animate-pulse">
                                                    {qaMyTasksCount}
                                                </span>
                                            )}
                                            {item.path === '/pm/cyber-request' && cyberRequestCount > 0 && (
                                                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-extrabold leading-none animate-pulse">
                                                    {cyberRequestCount}
                                                </span>
                                            )}
                                            {item.path === '/workspace/cyber' && cyberWorkspaceCount > 0 && (
                                                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-extrabold leading-none animate-pulse">
                                                    {cyberWorkspaceCount}
                                                </span>
                                            )}
                                            {item.path === '/my-tasks/cyber' && cyberMyTasksCount > 0 && (
                                                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-extrabold leading-none animate-pulse">
                                                    {cyberMyTasksCount}
                                                </span>
                                            )}
                                            {item.path === '/pm/return-rounds' && returnRoundsCount > 0 && (
                                                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold leading-none animate-pulse">
                                                    {returnRoundsCount}
                                                </span>
                                            )}
                                        </span>
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* User Profile Footer */}
                <div className="p-4 bg-white/5 border-t border-white/10 mt-auto shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#D4A017] text-[#001838] flex items-center justify-center font-extrabold text-sm shadow-xs">
                                {user?.name?.charAt(0) || 'U'}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-white font-semibold text-xs truncate max-w-[120px]">{user?.name}</div>
                                <div className="text-white/60 text-[11px] truncate">{user?.role}</div>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 text-white/60 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
                            title="Keluar"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <div className="flex-1 lg:ml-[270px] ml-0 flex flex-col h-screen overflow-hidden min-w-0">
                {/* Topbar Header */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-10">
                    <div className="flex items-center gap-3">
                        {/* Hamburger Button for Mobile */}
                        <button
                            onClick={() => setIsMobileOpen(true)}
                            className="lg:hidden p-2 text-gray-600 hover:text-[#00529C] hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            <Menu size={22} />
                        </button>

                        {/* Breadcrumbs */}
                        <div className="hidden sm:flex items-center gap-2 text-gray-500 text-xs md:text-sm">
                            <span className="hover:text-[#00529C] cursor-pointer font-medium">Beranda</span>
                            <ChevronRight size={14} />
                            <span className="hover:text-[#00529C] cursor-pointer capitalize font-medium">{activeSectionLabel.split('(')[0].trim().toLowerCase()}</span>
                            <ChevronRight size={14} />
                            <span className="text-[#00529C] font-bold">{activeItemLabel}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 md:gap-5">
                        <form onSubmit={handleSearchSubmit} className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setIsSearchOpen(true);
                                }}
                                onFocus={() => setIsSearchOpen(true)}
                                className="pl-9 pr-4 py-1.5 rounded-xl border border-gray-200 bg-[#f8f9fb] text-xs md:text-sm focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] w-[200px] lg:w-[260px] outline-none transition-all"
                                placeholder="Cari nama atau ID proyek..."
                                type="text"
                            />

                            {/* Dropdown Hasil Pencarian Realtime */}
                            {isSearchOpen && searchQuery.trim() && (
                                <div className="absolute right-0 top-full mt-2 w-[320px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-50 animate-scale-up">
                                    <div className="flex justify-between items-center px-3 py-1.5 border-b border-gray-100">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                            Hasil Pencarian Proyek ({filteredProjects.length})
                                        </span>
                                        <button type="button" onClick={() => setIsSearchOpen(false)} className="text-gray-400 hover:text-gray-600">
                                            <X size={14} />
                                        </button>
                                    </div>
                                    <div className="max-h-[260px] overflow-y-auto space-y-1 py-1">
                                        {filteredProjects.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-gray-400">Tidak ada proyek yang sesuai</div>
                                        ) : (
                                            filteredProjects.map((p) => (
                                                <div
                                                    key={p.id}
                                                    onClick={() => {
                                                        navigate('/projects');
                                                        setIsSearchOpen(false);
                                                        setSearchQuery('');
                                                    }}
                                                    className="p-2.5 rounded-xl hover:bg-blue-50/60 cursor-pointer transition-colors flex items-center justify-between group"
                                                >
                                                    <div>
                                                        <span className="text-[10px] font-bold text-[#00529C] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{p.id}</span>
                                                        <p className="text-xs font-bold text-gray-800 line-clamp-1 mt-0.5 group-hover:text-[#00529C]">{p.name}</p>
                                                        <p className="text-[10px] text-gray-500">{p.division}</p>
                                                    </div>
                                                    <ChevronRight size={14} className="text-gray-400 shrink-0 group-hover:text-[#00529C]" />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </form>

                        {/* Notification Bell */}
                        <NotificationBell />

                        {/* User Avatar & Dropdown Menu */}
                        <div ref={profileMenuRef} className="relative">
                            <button
                                onClick={() => setIsProfileMenuOpen(prev => !prev)}
                                className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-[#D4A017] text-[#001838] flex items-center justify-center font-bold text-xs md:text-sm shadow-xs hover:scale-105 hover:shadow-md transition-all cursor-pointer"
                                title="Menu Pengguna"
                            >
                                {user?.name?.charAt(0) || 'U'}
                            </button>
                            {isProfileMenuOpen && (
                                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 animate-scale-up">
                                    <div className="px-4 py-3 border-b border-gray-100">
                                        <p className="text-xs text-gray-400">Masuk sebagai</p>
                                        <p className="text-sm font-bold text-gray-800 truncate">{user?.name}</p>
                                        <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                                        <p className="text-[10px] text-white bg-[#00529C] inline-block px-2 py-0.5 rounded-full mt-1 font-bold uppercase tracking-wide">{user?.role?.replace('_', ' ')}</p>
                                    </div>
                                    <button
                                        onClick={() => { navigate('/profile'); setIsProfileMenuOpen(false); }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-[#00529C] transition-colors cursor-pointer"
                                    >
                                        <UserCircle size={18} /> Profil Saya
                                    </button>
                                    <button
                                        onClick={() => { handleLogout(); setIsProfileMenuOpen(false); }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                    >
                                        <LogOut size={18} /> Keluar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto overflow-x-hidden w-full relative">
                    <Outlet />
                </main>
            </div>

            {/* Modal Konfirmasi Logout */}
            {isLogoutModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100]">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 animate-scale-up text-center">
                        <div className="w-14 h-14 rounded-full bg-red-100 text-red-500 flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle size={28} />
                        </div>
                        <h3 className="text-lg font-extrabold text-gray-800 mb-2">Konfirmasi Keluar</h3>
                        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                            Apakah Anda yakin ingin keluar dari sesi <strong className="text-gray-700">{user?.name}</strong>?<br />
                            Semua perubahan yang belum disimpan akan hilang.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsLogoutModalOpen(false)}
                                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-all cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                onClick={confirmLogout}
                                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                            >
                                <LogOut size={16} />
                                Keluar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
