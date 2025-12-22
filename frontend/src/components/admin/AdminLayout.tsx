import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, Settings } from 'lucide-react';
import { clearUser } from '../../types';
import { apiClient } from '../../api';

export function AdminLayout() {
    const navigate = useNavigate();

    const handleLogout = () => {
        clearUser();
        apiClient.setToken(null);
        window.dispatchEvent(new CustomEvent('auth:logout'));
        navigate('/');
    };

    const navItemClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
            ? 'bg-blue-600/10 text-blue-400 font-medium'
            : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
        }`;

    return (
        <div className="flex h-screen bg-black text-white font-sans selection:bg-blue-500/30">
            {/* Sidebar */}
            <div className="w-64 border-r border-zinc-800 flex flex-col bg-zinc-900/30 backdrop-blur-xl">
                <div className="p-6 border-b border-zinc-800/50">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        Admin Panel
                    </h1>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <NavLink to="/admin" end className={navItemClass}>
                        <LayoutDashboard size={20} />
                        Overview
                    </NavLink>
                    <NavLink to="/admin/users" className={navItemClass}>
                        <Users size={20} />
                        Users
                    </NavLink>
                    {/* Future Settings */}
                    <div className="pt-4 mt-4 border-t border-zinc-800/50">
                        <button disabled className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-600 cursor-not-allowed">
                            <Settings size={20} />
                            Settings
                        </button>
                    </div>
                </nav>

                <div className="p-4 border-t border-zinc-800/50">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-900/10 transition-colors"
                    >
                        <LogOut size={20} />
                        Logout
                    </button>
                    <button onClick={() => navigate('/')} className="mt-2 text-xs text-zinc-500 hover:text-white w-full text-center">
                        Back to App
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto bg-black">
                <Outlet />
            </div>
        </div>
    );
}
