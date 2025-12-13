import React, { useEffect, useState } from 'react';
import { apiClient } from '../api';
import type { UserStats } from '../types';
import { LayoutDashboard, CheckCircle, XCircle, Clock, Zap, Crown, Puzzle } from 'lucide-react';

export function Dashboard() {
    const [stats, setStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await apiClient.getUserStats();
                setStats(data);
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-zinc-950 p-6 md:p-12 animate-pulse">
                <div className="max-w-5xl mx-auto space-y-8">
                    {/* Header Skeleton */}
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-8 bg-slate-200 dark:bg-zinc-800 rounded-lg"></div>
                        <div className="h-8 w-48 bg-slate-200 dark:bg-zinc-800 rounded-lg"></div>
                    </div>

                    {/* Stats Grid Skeleton */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-zinc-800"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-3 w-24 bg-slate-200 dark:bg-zinc-800 rounded"></div>
                                    <div className="h-6 w-16 bg-slate-200 dark:bg-zinc-800 rounded"></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
                        {/* Activity Skeleton */}
                        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-zinc-800">
                            <div className="h-6 w-32 bg-slate-200 dark:bg-zinc-800 rounded mb-4"></div>
                            <div className="h-64 bg-slate-200 dark:bg-zinc-800 rounded-xl"></div>
                        </div>

                        {/* Plan Skeleton */}
                        <div className="bg-slate-200 dark:bg-zinc-800 rounded-2xl p-6 h-80"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-zinc-950 p-6 md:p-12">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <LayoutDashboard className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        label="Total Extensions"
                        value={stats?.total || 0}
                        icon={<Zap className="w-5 h-5 text-indigo-600" />}
                        color="bg-indigo-50 dark:bg-indigo-900/20"
                    />
                    <StatCard
                        label="Completed"
                        value={stats?.completed || 0}
                        icon={<CheckCircle className="w-5 h-5 text-emerald-600" />}
                        color="bg-emerald-50 dark:bg-emerald-900/20"
                    />
                    <StatCard
                        label="Failed"
                        value={stats?.failed || 0}
                        icon={<XCircle className="w-5 h-5 text-red-600" />}
                        color="bg-red-50 dark:bg-red-900/20"
                    />
                    <StatCard
                        label="Estimated Cost"
                        value={stats?.totalTokens ? `$${((stats.totalTokens / 1_000_000) * 0.60).toFixed(4)}` : '$0.0000'}
                        icon={<Zap className="w-5 h-5 text-purple-600" />}
                        color="bg-purple-50 dark:bg-purple-900/20"
                    />
                    <StatCard
                        label="Total Tokens"
                        value={stats?.totalTokens?.toLocaleString() || 0}
                        icon={<Puzzle className="w-5 h-5 text-blue-600" />}
                        color="bg-blue-50 dark:bg-blue-900/20"
                    />
                    <StatCard
                        label="Processing"
                        value={stats?.pending || 0}
                        icon={<Clock className="w-5 h-5 text-amber-600" />}
                        color="bg-amber-50 dark:bg-amber-900/20"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
                    {/* Activity Chart */}
                    <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-zinc-800">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Activity (Last 30 Days)</h2>

                        {(!stats?.activity || stats.activity.length === 0) ? (
                            <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
                                <span className="text-slate-400 text-sm">No activity recorded yet</span>
                            </div>
                        ) : (
                            <div className="h-64 flex items-end gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {(() => {
                                    // Fill in missing days
                                    const filledData: { date: string; count: number }[] = [];
                                    const today = new Date();
                                    const dataMap = new Map(stats.activity?.map(a => [a.date, a.count]) || []);

                                    for (let i = 29; i >= 0; i--) {
                                        const d = new Date(today);
                                        d.setDate(d.getDate() - i);
                                        const dateStr = d.toISOString().split('T')[0];
                                        filledData.push({
                                            date: dateStr,
                                            count: dataMap.get(dateStr) || 0
                                        });
                                    }

                                    const maxCount = Math.max(...filledData.map(d => d.count), 5); // Minimum scale of 5

                                    return filledData.map((day) => {
                                        const heightPercent = Math.max((day.count / maxCount) * 100, 4); // Min 4% height for visibility
                                        const isToday = day.date === new Date().toISOString().split('T')[0];

                                        return (
                                            <div key={day.date} className="group relative flex-1 min-w-[12px] h-full flex flex-col justify-end items-center gap-2">
                                                {/* Tooltip */}
                                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                                    {new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: {day.count}
                                                </div>

                                                <div
                                                    className={`w-full rounded-t-sm transition-all duration-500 ease-out ${isToday ? 'bg-indigo-500 dark:bg-indigo-500' : 'bg-indigo-200 dark:bg-indigo-900/50 group-hover:bg-indigo-300 dark:group-hover:bg-indigo-800'}`}
                                                    style={{ height: `${heightPercent}%` }}
                                                />
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        )}
                    </div>

                    {/* Pro Plan Card */}
                    <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-6 shadow-lg text-white">
                        <div className="flex items-center justify-between mb-6">
                            <div className="p-3 bg-white/20 rounded-xl">
                                <Crown className="w-6 h-6 text-white" />
                            </div>
                            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">Free Plan</span>
                        </div>

                        <h3 className="text-xl font-bold mb-2">Upgrade to Pro</h3>
                        <p className="text-indigo-100 text-sm mb-6">Unlock advanced generation limits, priority processing, and private exports.</p>

                        <div className="space-y-3 mb-8">
                            <PlanFeature label="Unlimited Extensions" />
                            <PlanFeature label="Priority Queue" />
                            <PlanFeature label="Private GitHub Export" />
                        </div>

                        <button
                            onClick={() => alert('Upgrade flow coming soon!')}
                            className="w-full py-3 bg-white text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors shadow-sm"
                        >
                            Upgrade Plan
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon, color }: { label: string, value: number | string, icon: React.ReactNode, color: string }) {
    return (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${color}`}>
                {icon}
            </div>
            <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            </div>
        </div>
    );
}

function PlanFeature({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-2 text-sm text-indigo-100">
            <CheckCircle className="w-4 h-4 text-white" />
            <span>{label}</span>
        </div>
    );
}
