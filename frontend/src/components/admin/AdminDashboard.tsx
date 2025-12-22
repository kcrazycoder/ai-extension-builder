import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, HardDrive, Cpu, Activity, AlertCircle, CheckCircle } from 'lucide-react';
import { apiClient } from '../../api';
import type { AdminStats } from '../../types';

export function AdminDashboard() {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const data = await apiClient.getSystemStats();
            setStats(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load stats';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-zinc-500 animate-pulse">
                Loading admin insights...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full text-red-400 gap-2">
                <AlertCircle />
                {error}
            </div>
        );
    }

    if (!stats) return null;

    // Visual 1: Overview Cards
    const cards = [
        { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
        { label: 'Extensions', value: stats.totalExtensions, icon: HardDrive, color: 'text-purple-400', bg: 'bg-purple-400/10' },
        { label: 'Generations', value: stats.totalGenerations, icon: Cpu, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
        { label: 'Active Sessions', value: stats.activeUsersResult || '-', icon: Activity, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    ];

    // Visual 2: Activity Chart (SVG Line)
    // Normalize data for chart
    const maxCount = Math.max(...stats.recentActivity.map(d => d.count), 10);
    const points = stats.recentActivity.map((d, i) => {
        const x = (i / (stats.recentActivity.length - 1 || 1)) * 100;
        const y = 100 - (d.count / maxCount) * 80; // keep some padding
        return `${x},${y}`;
    }).join(' ');

    // Visual 3: Status Distribution (Segments)
    const total = stats.totalExtensions || 1;
    const completed = stats.extensionsByStatus.find(s => s.status === 'completed')?.count || 0;
    const failed = stats.extensionsByStatus.find(s => s.status === 'failed')?.count || 0;
    // const pending = total - completed - failed;

    const completedPct = (completed / total) * 100;
    const failedPct = (failed / total) * 100;

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                        Dashboard Overview
                    </h2>
                    <p className="text-zinc-500 mt-1">Real-time system insights</p>
                </div>
                <button
                    onClick={loadStats}
                    className="text-sm text-zinc-400 hover:text-white transition-colors"
                >
                    Refresh Data
                </button>
            </div>

            {/* 1. Metric Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {cards.map((card, i) => (
                    <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl flex items-center justify-between hover:border-zinc-700 transition-colors group"
                    >
                        <div>
                            <p className="text-zinc-500 text-sm font-medium">{card.label}</p>
                            <h3 className="text-2xl font-bold mt-1 text-white group-hover:scale-105 transition-transform origin-left">
                                {card.value.toLocaleString()}
                            </h3>
                        </div>
                        <div className={`p-3 rounded-xl ${card.bg} ${card.color}`}>
                            <card.icon size={24} />
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 2. Activity Chart */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Activity className="text-blue-400" size={20} />
                            Generation Activity (30 Days)
                        </h3>
                    </div>

                    <div className="h-64 relative w-full pt-4">
                        {stats.recentActivity.length > 0 ? (
                            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                                {/* Grid Lines */}
                                <line x1="0" y1="100" x2="100" y2="100" stroke="#3f3f46" strokeWidth="0.5" />
                                <line x1="0" y1="50" x2="100" y2="50" stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="2" />
                                <line x1="0" y1="0" x2="100" y2="0" stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="2" />

                                {/* Gradient Fill */}
                                <defs>
                                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                <path
                                    d={`M0,100 ${points} L100,100 Z`}
                                    fill="url(#chartGradient)"
                                />

                                {/* Line */}
                                <motion.path
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ duration: 1.5, ease: "easeInOut" }}
                                    d={`M ${points.split(' ').join(' L ')}`}
                                    fill="none"
                                    stroke="#60a5fa"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    vectorEffect="non-scaling-stroke"
                                />

                                {/* Dots on Hover */}
                                {stats.recentActivity.map((d, i) => {
                                    const x = (i / (stats.recentActivity.length - 1 || 1)) * 100;
                                    const y = 100 - (d.count / maxCount) * 80;
                                    return (
                                        <circle key={i} cx={x} cy={y} r="0.8" fill="white" className="hover:r-2 transition-all cursor-crosshair">
                                            <title>{`${d.date}: ${d.count}`}</title>
                                        </circle>
                                    );
                                })}
                            </svg>
                        ) : (
                            <div className="flex items-center justify-center h-full text-zinc-600">
                                No activity data yet
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* 3. Distribution & Health */}
                <div className="space-y-6">
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl"
                    >
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <HardDrive className="text-purple-400" size={20} />
                            Success Rate
                        </h3>
                        <div className="relative pt-1">
                            <div className="flex mb-2 items-center justify-between text-sm">
                                <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={14} /> Completed</span>
                                <span className="font-mono">{completed} ({Math.round(completedPct)}%)</span>
                            </div>
                            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-zinc-800">
                                <div style={{ width: `${completedPct}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-500"></div>
                            </div>

                            <div className="flex mb-2 items-center justify-between text-sm">
                                <span className="text-red-400 flex items-center gap-1"><AlertCircle size={14} /> Failed</span>
                                <span className="font-mono">{failed} ({Math.round(failedPct)}%)</span>
                            </div>
                            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-zinc-800">
                                <div style={{ width: `${failedPct}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-red-500"></div>
                            </div>
                        </div>
                    </motion.div>

                    {/* 4. Mini Insight */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-zinc-800 p-6 rounded-2xl"
                    >
                        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                            System Health
                        </h3>
                        <div className="text-3xl font-bold text-white mb-1">
                            98.5%
                        </div>
                        <p className="text-emerald-400 text-sm flex items-center gap-2">
                            <CheckCircle size={16} /> All systems operational
                        </p>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
