import { useEffect, useState } from 'react';
import { apiClient } from '../../api';
import type { User } from '../../types';
import { Search, Shield, User as UserIcon } from 'lucide-react';

export function UserManagement() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            // Pagination TODO
            const data = await apiClient.getAllUsers(100, 0);
            setUsers(data);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId: string, currentRole: string) => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        if (!confirm(`Are you sure you want to change role to ${newRole}?`)) return;

        try {
            await apiClient.updateUserRole(userId, newRole);
            // Optimistic update
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch {
            alert('Failed to update role');
        }
    };

    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.id.includes(search)
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-white">User Management</h2>
                    <p className="text-zinc-500">Manage access and roles</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500 w-64"
                    />
                </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-zinc-800/50 text-zinc-400 font-medium border-b border-zinc-700/50">
                        <tr>
                            <th className="p-4">User</th>
                            <th className="p-4">Role</th>
                            <th className="p-4">Tier</th>
                            <th className="p-4">Joined</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center text-zinc-500">Loading users...</td></tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-zinc-500">No users found</td></tr>
                        ) : (
                            filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-zinc-800/30 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white uppercase">
                                                {user.email[0]}
                                            </div>
                                            <div>
                                                <div className="text-white font-medium">{user.email}</div>
                                                <div className="text-xs text-zinc-500 font-mono">{user.id.substring(0, 8)}...</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {user.role === 'admin' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/10 text-purple-400 text-xs font-medium border border-purple-500/20">
                                                <Shield size={12} /> Admin
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-700/30 text-zinc-400 text-xs font-medium border border-zinc-700/50">
                                                <UserIcon size={12} /> User
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <span className={`capitalize text-sm ${user.tier === 'pro' ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                            {user.tier}
                                        </span>
                                    </td>
                                    <td className="p-4 text-zinc-400 text-sm">
                                        {/* Simple date fallback */}
                                        {user.createdAt ? user.createdAt.substring(0, 10) : '-'}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => handleRoleChange(user.id, user.role || 'user')}
                                            className="text-xs text-zinc-500 hover:text-white underline decoration-zinc-700 hover:decoration-white transition-all"
                                        >
                                            {user.role === 'admin' ? 'Demote' : 'Promote'}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
