import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { menuSections } from '../data/menuConfig';
import NotificationBell from '../components/NotificationBell';
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
    ChevronRight,
    FileText,
    LogOut
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
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    
    const handleLogout = () => {
        logout();
        navigate('/login');
    };
    const sections = user ? menuSections[user.role] || [] : [];

    // Cari section dan item yang aktif berdasarkan URL saat ini
    let activeSectionLabel = 'Utama';
    let activeItemLabel = 'Dashboard Utama';

    for (const section of sections) {
        const found = section.items.find(item => location.pathname === item.path || location.pathname.startsWith(item.path + '/'));
        if (found) {
            // Bersihkan label section yang ada "FASE 1 (...)" menjadi hanya "Fase 1" atau yang sesuai jika diinginkan.
            activeSectionLabel = section.label;
            activeItemLabel = found.label;
            break;
        }
    }

    const renderIcon = (iconName) => {
        const Icon = iconMap[iconName];
        return Icon ? <Icon size={20} /> : null;
    };

    return (
        <div className="flex h-screen overflow-hidden bg-[#f8f9fb] font-sans">
            {/* Sidebar - sama seperti sebelumnya */}
            <aside className="fixed left-0 top-0 h-full w-[270px] bg-gradient-to-b from-[#003a73] to-[#001838] flex flex-col shadow-lg z-50">
                {/* Branding */}
                <div className="h-16 flex items-center px-6 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded p-1 flex items-center justify-center">
                            <span className="text-[#003a73] font-bold text-lg">BN</span>
                        </div>
                        <div className="text-white">
                            <h1 className="font-bold text-sm leading-tight">SDLC Nagari<br />Enterprise</h1>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-6 scrollbar-hide">
                    {sections.map((section, idx) => (
                        <div key={idx}>
                            <h2 className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-3 px-3">
                                {section.label}
                            </h2>
                            <div className="flex flex-col gap-1">
                                {section.items.map((item) => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium ${isActive
                                                ? 'bg-white/10 border-l-4 border-[#D4A017] text-white font-bold rounded-r-lg'
                                                : 'text-white/70 hover:text-white hover:bg-white/5'
                                            }`
                                        }
                                    >
                                        <span className="text-[20px]">{renderIcon(item.icon)}</span>
                                        <span>{item.label}</span>
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
                            <div className="w-10 h-10 rounded-full bg-[#D4A017] text-[#001838] flex items-center justify-center font-bold">
                                {user?.name?.charAt(0) || 'U'}
                            </div>
                            <div>
                                <div className="text-white font-medium text-sm truncate max-w-[120px]">{user?.name}</div>
                                <div className="text-white/60 text-xs">{user?.role}</div>
                            </div>
                        </div>
                        <button 
                            onClick={handleLogout}
                            className="p-2 text-white/50 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                            title="Keluar"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <div className="flex-1 ml-[270px] flex flex-col h-screen overflow-hidden">
                {/* Topbar - dengan NotificationBell */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 z-10">
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                        <span className="hover:text-[#1A56DB] cursor-pointer">Beranda</span>
                        <ChevronRight size={16} />
                        <span className="hover:text-[#1A56DB] cursor-pointer capitalize">{activeSectionLabel.split('(')[0].trim().toLowerCase()}</span>
                        <ChevronRight size={16} />
                        <span className="text-[#1A56DB] font-semibold">{activeItemLabel}</span>
                    </div>
                    <div className="flex items-center gap-5">
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                className="pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-[#f8f9fb] text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-[280px] outline-none transition-all"
                                placeholder="Cari proyek..."
                                type="text"
                            />
                        </div>

                        {/* Ganti button bell dengan NotificationBell */}
                        <NotificationBell />

                        <div className="w-9 h-9 rounded-full bg-[#D4A017] text-[#001838] flex items-center justify-center font-bold text-sm cursor-pointer hover:ring-2 hover:ring-blue-500/30 transition-all">
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto w-full relative">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
