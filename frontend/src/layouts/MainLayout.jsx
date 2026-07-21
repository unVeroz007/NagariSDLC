import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { menuSections } from '../data/menuConfig';
import {
    LayoutDashboard,
    List,
    Folders,
    PlusCircle,
    UserCheck,
    Clock,
    Users,
    Kanban,
    ClipboardList,
    Send,
    Bug,
    Shield,
    ShieldCheck,
    CheckSquare,
    Lock,
    Rocket,
    Verified,
    History,
    BarChart,
    Settings,
    Search,
    Bell,
    ChevronRight,
    FileText,
    LogOut,
} from 'lucide-react';

// Map ikon untuk sidebar
const iconMap = {
    LayoutDashboard,
    List,
    Folders,
    PlusCircle,
    UserCheck,
    Clock,
    Users,
    Kanban,
    ClipboardList,
    Send,
    Bug,
    Shield,
    ShieldCheck,
    CheckSquare,
    Lock,
    Rocket,
    Verified,
    History,
    BarChart,
    Settings,
    FileText,
};

// Warna badge per seksi
const sectionBadgeColor = {
    'UTAMA': 'bg-blue-500/20 text-blue-200',
    'FASE 1 (INISIASI & REVIEW)': 'bg-amber-500/20 text-amber-200',
    'FASE 2 (PENGEMBANGAN IT)': 'bg-purple-500/20 text-purple-200',
    'FASE 3 (PENGUJIAN)': 'bg-red-500/20 text-red-200',
    'FASE 4 (RILIS & KEPATUHAN)': 'bg-emerald-500/20 text-emerald-200',
    'ADMINISTRASI': 'bg-gray-500/20 text-gray-300',
};

export default function MainLayout() {
    const { user } = useAuth();
    const location = useLocation();
    const sections = user ? menuSections[user.role] || [] : [];

    const renderIcon = (iconName) => {
        const Icon = iconMap[iconName];
        return Icon ? <Icon size={18} /> : null;
    };

    // Buat breadcrumb dari pathname
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbLabels = {
        'dashboard': 'Dashboard Utama',
        'projects': 'Daftar Proyek',
        'new': 'Proyek Baru',
        'documents': 'Manajemen Dokumen',
        'workspace': 'Workspace',
        'lead': 'Disposisi Analis',
        'analyst': 'Antrean Review',
        'pm': 'Project Manager',
        'allocation': 'Alokasi Tim',
        'kanban': 'Kanban Board',
        'tasks': 'Manajemen Task',
        'admin': 'Admin',
        'users': 'Manajemen User',
        'audit': 'Audit Trail',
        'analytics': 'Analitik',
    };

    return (
        <div className="flex h-screen overflow-hidden bg-[#f8f9fb]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

            {/* ======== SIDEBAR ======== */}
            <aside className="fixed left-0 top-0 h-full w-[264px] flex flex-col z-50 overflow-hidden"
                style={{ background: 'linear-gradient(180deg, #003a73 0%, #002255 50%, #001838 100%)' }}>

                {/* Decorative background orb */}
                <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle, #4A90D9 0%, transparent 70%)' }} />
                <div className="absolute bottom-32 -left-12 w-32 h-32 rounded-full opacity-5"
                    style={{ background: 'radial-gradient(circle, #D4A017 0%, transparent 70%)' }} />

                {/* Branding */}
                <div className="h-16 flex items-center px-5 border-b border-white/10 shrink-0 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-md shrink-0 overflow-hidden p-1">
                            <img src="/nagari-logo.jpg" alt="Logo Bank Nagari" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <div className="text-white font-bold text-sm leading-tight">SDLC Nagari</div>
                            <div className="text-blue-300/70 text-[10px] font-medium tracking-wide">Enterprise Platform</div>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto py-5 px-3 flex flex-col gap-5 scrollbar-hide relative z-10">
                    {sections.map((section, idx) => {
                        const labelKey = section.label.toUpperCase();
                        const badgeClass = sectionBadgeColor[labelKey] || 'bg-white/10 text-white/50';
                        return (
                            <div key={idx}>
                                <div className="flex items-center gap-2 mb-2 px-2">
                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${badgeClass}`}>
                                        {section.label}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    {section.items.map((item) => (
                                        <NavLink
                                            key={item.path}
                                            to={item.path}
                                            className={({ isActive }) =>
                                                `group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium relative overflow-hidden
                                                ${isActive
                                                    ? 'bg-white/12 text-white font-semibold nav-active-pill'
                                                    : 'text-white/60 hover:text-white hover:bg-white/8'
                                                }`
                                            }
                                        >
                                            {({ isActive }) => (
                                                <>
                                                    {/* Active bg glow */}
                                                    {isActive && (
                                                        <div className="absolute inset-0 rounded-lg opacity-20"
                                                            style={{ background: 'linear-gradient(90deg, rgba(212,160,23,0.4) 0%, transparent 100%)' }} />
                                                    )}
                                                    <span className={`shrink-0 transition-colors duration-200 ${isActive ? 'text-[#D4A017]' : 'text-white/50 group-hover:text-white/80'}`}>
                                                        {renderIcon(item.icon)}
                                                    </span>
                                                    <span className="relative z-10 truncate">{item.label}</span>
                                                    {isActive && (
                                                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#D4A017] shrink-0 animate-pulse" />
                                                    )}
                                                </>
                                            )}
                                        </NavLink>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* User Profile Footer */}
                <div className="relative z-10 p-3 border-t border-white/10 shrink-0">
                    <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/8 transition-colors cursor-pointer group">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#D4A017] to-[#b8861a] flex items-center justify-center font-bold text-[#001838] text-sm shrink-0 shadow-md">
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-white font-semibold text-sm truncate leading-tight">{user?.name}</div>
                            <div className="text-[10px] mt-0.5">
                                <span className="bg-blue-500/20 text-blue-200 px-1.5 py-0.5 rounded font-medium capitalize">
                                    {user?.role?.replace(/_/g, ' ')}
                                </span>
                            </div>
                        </div>
                        <LogOut size={15} className="text-white/30 group-hover:text-white/70 transition-colors shrink-0" />
                    </div>
                </div>
            </aside>

            {/* ======== MAIN CONTENT ======== */}
            <div className="flex-1 ml-[264px] flex flex-col h-screen overflow-hidden">

                {/* Topbar */}
                <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0 z-10 shadow-sm">
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-1 text-sm">
                        <span className="text-gray-400 hover:text-[#1A56DB] cursor-pointer transition-colors font-medium">Beranda</span>
                        {pathSegments.map((seg, i) => {
                            const label = breadcrumbLabels[seg] || seg;
                            const isLast = i === pathSegments.length - 1;
                            return (
                                <span key={i} className="flex items-center gap-1">
                                    <ChevronRight size={14} className="text-gray-300" />
                                    <span className={isLast
                                        ? 'text-[#1A56DB] font-semibold'
                                        : 'text-gray-400 hover:text-gray-600 cursor-pointer transition-colors capitalize'
                                    }>
                                        {label}
                                    </span>
                                </span>
                            );
                        })}
                    </nav>

                    {/* Right actions */}
                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                            <input
                                className="pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB] w-56 hover:w-64 focus:w-72 outline-none transition-all duration-300"
                                placeholder="Cari proyek..."
                                type="text"
                            />
                        </div>

                        {/* Notification */}
                        <button className="relative p-2.5 text-gray-500 hover:text-[#1A56DB] hover:bg-blue-50 rounded-xl transition-all duration-200 group">
                            <Bell size={20} />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
                        </button>

                        {/* Divider */}
                        <div className="w-px h-6 bg-gray-200" />

                        {/* Avatar */}
                        <NavLink to="/profile" className="w-9 h-9 rounded-full bg-[#D4A017] text-[#001838] flex items-center justify-center font-bold text-sm cursor-pointer hover:ring-2 hover:ring-blue-500/30 transition-all">
                            {user?.name?.charAt(0) || 'U'}
                        </NavLink>
                    </div>
                </header>

                {/* Main content area */}
                <main className="flex-1 overflow-y-auto">
                    <div className="animate-fade-in">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}