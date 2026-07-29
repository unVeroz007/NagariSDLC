import { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { menuSections } from '../data/menuConfig';
import NotificationBell from '../components/NotificationBell';
import {
    Search,
    ChevronRight,
    LogOut,
    Menu,
    X,
} from 'lucide-react';

export default function MainLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileOpen, setIsMobileOpen] = useState(false);

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
                {/* Branding */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
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
                                        onClick={() => setIsMobileOpen(false)}
                                        className={({ isActive }) =>
                                            `block px-3 py-1.5 rounded-lg transition-all text-sm ${isActive
                                                ? 'bg-white/15 border-l-4 border-[#D4A017] text-white font-bold shadow-xs'
                                                : 'text-white/75 hover:text-white hover:bg-white/10 font-medium'
                                            }`
                                        }
                                    >
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
                            className="lg:hidden p-2 text-gray-600 hover:text-[#1A56DB] hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            <Menu size={22} />
                        </button>

                        {/* Breadcrumbs */}
                        <div className="hidden sm:flex items-center gap-2 text-gray-500 text-xs md:text-sm">
                            <span className="hover:text-[#1A56DB] cursor-pointer font-medium">Beranda</span>
                            <ChevronRight size={14} />
                            <span className="hover:text-[#1A56DB] cursor-pointer capitalize font-medium">{activeSectionLabel.split('(')[0].trim().toLowerCase()}</span>
                            <ChevronRight size={14} />
                            <span className="text-[#1A56DB] font-bold">{activeItemLabel}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 md:gap-5">
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                className="pl-9 pr-4 py-1.5 rounded-xl border border-gray-200 bg-[#f8f9fb] text-xs md:text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-[200px] lg:w-[260px] outline-none transition-all"
                                placeholder="Cari proyek..."
                                type="text"
                            />
                        </div>

                        {/* Notification Bell */}
                        <NotificationBell />

                        {/* User Avatar */}
                        <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-[#D4A017] text-[#001838] flex items-center justify-center font-bold text-xs md:text-sm shadow-xs">
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
