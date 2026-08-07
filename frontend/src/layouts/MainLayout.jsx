import { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProjects } from '../contexts/ProjectContext';
import { menuSections, getDefaultRouteForRole } from '../data/menuConfig';
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
    const { projects } = useProjects();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileOpen, setIsMobileOpen] = useState(false);

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
        logout();
        navigate('/login');
    };

    const sections = user ? menuSections[user.role] || [] : [];
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

                        {/* User Avatar */}
                        <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-[#D4A017] text-[#001838] flex items-center justify-center font-bold text-xs md:text-sm shadow-xs">
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto overflow-x-hidden w-full relative">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
