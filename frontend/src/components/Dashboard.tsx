
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api';
import type { UserStats, Extension } from '../types';
import { CheckCircle, Clock, Zap, Crown, AlertTriangle, Cuboid, FileCode, ArrowUpRight, Calendar, Eye } from 'lucide-react';
import { DashboardSkeleton } from './DashboardSkeleton';

export function Dashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [recentExtensions, setRecentExtensions] = useState<Extension[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Check for payment verification
                const urlParams = new URLSearchParams(window.location.search);
                const sessionId = urlParams.get('session_id');

                if (sessionId) {
                    try {
                        // Optimistically show verification UI or toast if needed
                        // For now we just verify in background then refresh stats
                        await apiClient.verifyPaymentSession(sessionId);

                        // Clear URL param to prevent re-verify on refresh
                        window.history.replaceState({}, '', window.location.pathname);

                        // Show success message (could use a toast lib if available, or just rely on updated stats)
                        // For this task, we'll let the stats refresh reflect the change, keeping it simple.
                    } catch (err) {
                        console.error('Payment verification failed:', err);
                    }
                }

                const [statsData, historyData] = await Promise.all([
                    apiClient.getUserStats(),
                    apiClient.getHistory() // Fetching full history, we'll slice for recent
                ]);
                setStats(statsData);
                setRecentExtensions(historyData.slice(0, 5)); // Top 5 recent
            } catch (error) {
                console.error('Failed to fetch dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-zinc-950 p-6 relative h-full">
            {/* Mesh Gradient Background removed to fix z-index issues */}


            <div className="max-w-7xl mx-auto space-y-6 relative z-10">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Overview of your activity</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Payment Verification Status */}
                        {new URLSearchParams(window.location.search).get('session_id') && (
                            <button
                                onClick={() => window.location.reload()}
                                className="text-xs bg-indigo-500 text-white px-3 py-1 rounded-full animate-pulse cursor-pointer hover:bg-indigo-600"
                            >
                                Verifying Payment... (Click to Retry)
                            </button>
                        )}
                        <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-md">
                            v1.2.1
                        </span>
                    </div>
                </div>

                {/* 1. Summary Stats Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <CompactStatCard
                        label="Total Extensions"
                        value={stats?.total || 0}
                        icon={<Cuboid className="w-5 h-5 text-indigo-500" />}
                    />
                    <CompactStatCard
                        label="Success Rate"
                        value={`${stats?.total ? Math.round(((stats.completed || 0) / stats.total) * 100) : 0}%`}
                        icon={<CheckCircle className="w-5 h-5 text-emerald-500" />}
                        subtext={`${stats?.completed || 0} completed`}
                    />
                    <CompactStatCard
                        label="Usage (Today)"
                        value={`${stats?.dailyUsage || 0} / ${stats?.limit === -1 ? '∞' : stats?.limit || 5}`}
                        icon={<Zap className="w-5 h-5 text-amber-500" />}
                        subtext={stats?.tier === 'free' ? 'Refresh at midnight' : 'Unlimited'}
                    />
                    <CompactStatCard
                        label="Est. Cost"
                        value={`$${((stats?.totalTokens || 0) / 1_000_000 * 0.60).toFixed(2)}`}
                        icon={<Crown className={`w-5 h-5 ${stats?.tier === 'pro' ? 'text-violet-500' : 'text-slate-400'}`} />}
                        subtext={`${(stats?.totalTokens || 0).toLocaleString()} tokens`}
                    />
                </div>

                {/* 2. Middle Section: Activity & Subscription */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Activity Chart */}
                    <div className="lg:col-span-2">
                        <div className="bg-white/60 dark:bg-zinc-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-white/5 rounded-2xl p-5 h-full">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    Activity
                                </h3>
                                {/* Simple interaction hint */}
                                <span className="text-xs text-slate-400">Past 30 Days</span>
                            </div>

                            <div className="h-48 w-full">
                                {(!stats?.activity || stats.activity.length === 0) ? (
                                    <div className="h-full flex items-center justify-center border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                                        <span className="text-slate-400 text-sm">No activity recorded</span>
                                    </div>
                                ) : (
                                    <ActivityBars activity={stats.activity} />
                                )}
                            </div>
                        </div>
                    </div >

                    {/* Compact Subscription Panel */}
                    < div className="lg:col-span-1" >
                        <CompactSubscriptionPanel stats={stats} />
                    </div >
                </div >

                {/* 3. Recent Extensions List */}
                < div className="bg-white/60 dark:bg-zinc-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-white/5 rounded-2xl overflow-hidden" >
                    <div className="p-5 border-b border-slate-200/60 dark:border-white/5 flex justify-between items-center">
                        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <FileCode className="w-4 h-4 text-slate-400" />
                            Recent Extensions
                        </h3>
                        <button
                            onClick={() => navigate('/', { state: { newChat: true } })}
                            className="text-xs font-medium text-indigo-500 hover:text-indigo-400 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                            Create New <ArrowUpRight className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50/50 dark:bg-white/5 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200/60 dark:border-white/5">
                                <tr>
                                    <th className="px-5 py-3 rounded-tl-lg">Name / Prompt</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3">Date</th>
                                    <th className="px-5 py-3 rounded-tr-lg"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                                {recentExtensions.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                                            No extensions created yet.
                                        </td>
                                    </tr>
                                ) : (
                                    recentExtensions.map((ext) => (
                                        <tr key={ext.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                                            <td className="px-5 py-3 max-w-xs">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                                                        <Cuboid className="w-4 h-4" />
                                                    </div>
                                                    <div className="truncate">
                                                        <p className="font-medium text-slate-900 dark:text-white truncate">
                                                            {ext.name || 'Untitled Extension'}
                                                        </p>
                                                        <p className="text-xs text-slate-500 truncate" title={ext.prompt}>
                                                            {ext.prompt}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <StatusBadge status={ext.status} />
                                            </td>
                                            <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                                                {new Date(ext.createdAt || 0).toLocaleDateString()}
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <button
                                                    onClick={() => navigate(`/?extId=${ext.id}`)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-white/10 rounded-md transition-colors cursor-pointer"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div >

            </div >
        </div >
    );
}

// === Components ===

function CompactStatCard({ label, value, icon, subtext }: { label: string, value: string | number, icon: React.ReactNode, subtext?: string }) {
    return (
        <div className="bg-white/60 dark:bg-zinc-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:border-indigo-500/30 transition-colors">
            <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
                <div className="p-1.5 bg-slate-100 dark:bg-white/5 rounded-lg">
                    {icon}
                </div>
            </div>
            <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</p>
                {subtext && <p className="text-xs text-slate-400 mt-0.5">{subtext}</p>}
            </div>
        </div>
    );
}

function CompactSubscriptionPanel({ stats }: { stats: UserStats | null }) {
    const isPro = stats?.tier === 'pro';

    return (
        <div className="h-full bg-slate-900 text-white rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between group">
            {/* Gradient & Glow */}
            <div className={`absolute inset-0 bg-gradient-to-br opacity-20 pointer-events-none transition-all duration-500 ${isPro ? 'from-emerald-500 to-teal-500' : 'from-indigo-500 to-purple-500'}`} />
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-[50px] rounded-full pointer-events-none" />

            <div>
                <div className="flex justify-between items-start mb-4">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${isPro ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/20'}`}>
                        {isPro ? (stats?.subscriptionStatus === 'canceled' ? 'Canceling' : 'Active') : 'Free Plan'}
                    </span>
                    {isPro ? <Crown className="w-5 h-5 text-emerald-400" /> : <Zap className="w-5 h-5 text-indigo-400" />}
                </div>

                <h3 className="text-lg font-bold mb-1">
                    {isPro ? 'Pro Subscription' : 'Upgrade to Pro'}
                </h3>
                <p className="text-sm text-slate-300/80 mb-4 leading-relaxed">
                    {isPro
                        ? 'You have access to unlimited generations and priority queue.'
                        : 'Remove daily limits and generate faster extensions.'}
                </p>
            </div>

            <div>
                <div
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-center text-sm opacity-80"
                >
                    Coming Soon
                </div>
                {isPro && stats?.nextBillingDate && (
                    <p className="text-[10px] text-center text-slate-400 mt-2">
                        {stats.subscriptionStatus === 'canceled' ? 'Expires' : 'Renews'} on {new Date(stats.nextBillingDate).toLocaleDateString()}
                    </p>
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: Extension['status'] }) {
    const styles = {
        pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
        processing: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
        completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
        failed: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'
    };

    const icons = {
        pending: <Clock className="w-3 h-3" />,
        processing: <Clock className="w-3 h-3 animate-spin" />,
        completed: <CheckCircle className="w-3 h-3" />,
        failed: <AlertTriangle className="w-3 h-3" />
    };

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
            {icons[status]}
            <span className="capitalize">{status}</span>
        </span>
    );
}

function ActivityBars({ activity }: { activity: { date: string, count: number }[] }) {
    // Fill in missing days (30 days)
    const filledData: { date: string; count: number }[] = [];
    const today = new Date();
    const dataMap = new Map(activity.map(a => [a.date, a.count]) || []);

    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        filledData.push({
            date: dateStr,
            count: dataMap.get(dateStr) || 0
        });
    }

    const maxCount = Math.max(...filledData.map(d => d.count), 5); // Minimum scale
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    return (
        <div className="flex items-end gap-1 h-full w-full pt-4 relative">
            {/* Note: relative on container to ensure tooltips stack correctly if needed */}
            {filledData.map((day, index) => {
                const heightPercent = Math.max((day.count / maxCount) * 100, 5);
                const isToday = day.date === new Date().toISOString().split('T')[0];
                const hasActivity = day.count > 0;
                const isHovered = hoveredIndex === index;

                return (
                    <div
                        key={day.date}
                        className={`relative flex-1 h-full flex items-end transition-all ${isHovered ? 'z-50' : 'z-0'}`}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                    >
                        {/* Interactive Tooltip area - enlarged invisible hit target covering full column height */}
                        <div className="absolute inset-x-0 bottom-0 top-0 cursor-pointer z-10" />

                        {/* Tooltip - Rendered conditionally for robust visibility */}
                        {isHovered && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max bg-slate-900 text-white text-xs font-medium px-2 py-1.5 rounded-lg shadow-xl border border-white/10 z-50 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex flex-col items-center">
                                    <span className="font-bold">{day.count} Gens</span>
                                    <span className="text-[10px] text-slate-400">{new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                </div>
                                {/* Arrow tip */}
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 border-r border-b border-white/10" />
                            </div>
                        )}

                        {/* Bar */}
                        <div
                            className={`w-full rounded-t-sm transition-all duration-300 ${hasActivity ? 'bg-indigo-500 dark:bg-indigo-500' : 'bg-slate-100 dark:bg-white/5'} ${isHovered && hasActivity ? 'bg-indigo-400 dark:bg-indigo-400' : ''} ${isHovered && !hasActivity ? 'bg-slate-200 dark:bg-white/10' : ''} ${isToday ? 'ring-1 ring-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.3)]' : ''}`}
                            style={{ height: `${heightPercent}%` }}
                        />
                    </div>
                );
            })}
        </div>
    );
}

