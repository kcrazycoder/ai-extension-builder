import { Plus, MessageSquare, LogOut, ChevronLeft, ChevronRight, Trash2, Puzzle, LayoutDashboard, Check, X, Shield, Zap, Filter } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Extension } from '../../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface SidebarProps {
    history: Extension[];
    currentExtensionId: string | null;
    onSelectExtension: (ext: Extension) => void;
    onDeleteExtension: (extId: string) => Promise<void>;
    onNewChat: () => void;
    onLogout: () => void;
    userEmail?: string;
    isAdmin?: boolean;
    userPlan?: string;
    nextBillingDate?: string | null;
}

export function Sidebar({
    history,
    currentExtensionId,
    onSelectExtension,
    onDeleteExtension,
    onNewChat,
    onLogout,
    userEmail,
    isAdmin,
    userPlan = 'Free',
    nextBillingDate
}: SidebarProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showFailedOnly, setShowFailedOnly] = useState(false);


    const filteredHistory = showFailedOnly
        ? history.filter(ext => ext.status === 'failed')
        : history;

    return (
        <div className={cn(
            "bg-slate-50 dark:bg-zinc-950 border-r border-slate-200 dark:border-zinc-800 flex flex-col h-screen transition-all duration-300 ease-in-out relative",
            isCollapsed ? "w-[70px]" : "w-64"
        )}>
            {/* Toggle Button */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-6 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-full p-1 shadow-md hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors z-10"
            >
                {isCollapsed ? <ChevronRight className="w-3 h-3 text-slate-500" /> : <ChevronLeft className="w-3 h-3 text-slate-500" />}
            </button>

            {/* Top: New Extension */}
            <div className="p-4">
                <button
                    onClick={onNewChat}
                    className={cn(
                        "w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-all duration-200",
                        isCollapsed ? "p-3 rounded-xl" : "px-4 py-2.5 gap-2"
                    )}
                    title="New Extension"
                >
                    <Plus className="w-5 h-5" />
                    {!isCollapsed && <span className="font-semibold">New Project</span>}
                </button>
            </div>

            {/* Middle: History & My Extensions (Scrollable) */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

                {/* History Section */}

                {/* Top: History */}
                {/* Top: History */}
                <div className="flex-1 flex flex-col min-h-0 relative border-b border-slate-200 dark:border-zinc-800">
                    {!isCollapsed && (
                        <div className="px-4 py-3 bg-slate-50 dark:bg-zinc-950 shrink-0 sticky top-0 z-10 shadow-sm flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Recent Chats
                            </span>
                            <button
                                onClick={() => setShowFailedOnly(!showFailedOnly)}
                                title={showFailedOnly ? "Show All" : "Show Failed Only"}
                                className={cn(
                                    "p-1 rounded-md transition-colors",
                                    showFailedOnly
                                        ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                        : "hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400"
                                )}
                            >
                                <Filter className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                    <div className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-hide min-h-0 pb-2 pt-1">
                        {filteredHistory.length === 0 ? (
                            !isCollapsed && (
                                <div className="px-4 py-8 text-center text-sm text-slate-400 dark:text-zinc-500 animate-in fade-in">
                                    {showFailedOnly ? 'No failed items found' : 'No history yet'}
                                </div>
                            )
                        ) : (
                            filteredHistory.map((ext) => (
                                <SidebarItem
                                    key={ext.id}
                                    ext={ext}
                                    currentExtensionId={currentExtensionId}
                                    isCollapsed={isCollapsed}
                                    onSelect={() => onSelectExtension(ext)}
                                    onDelete={onDeleteExtension}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* Bottom: My Extensions */}
                <div className="flex-1 flex flex-col min-h-0 relative bg-slate-50/50 dark:bg-zinc-900/30">
                    {!isCollapsed && (
                        <div className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-zinc-950 shrink-0 sticky top-0 z-10 border-b border-slate-100 dark:border-zinc-800 shadow-sm">
                            My Extensions
                        </div>
                    )}
                    <div className="flex-1 overflow-y-auto px-2 space-y-1.5 scrollbar-hide pt-2 pb-2">
                        {history.map((ext) => (
                            <button
                                key={'my-' + ext.id}
                                onClick={() => onSelectExtension(ext)}
                                className={cn(
                                    "w-full text-left p-3 rounded-xl flex items-start gap-3 transition-all group cursor-pointer relative overflow-hidden",
                                    currentExtensionId === ext.id
                                        ? "bg-white dark:bg-zinc-900 shadow-sm border border-indigo-200 dark:border-indigo-900/50 ring-1 ring-indigo-500/10"
                                        : "hover:bg-white dark:hover:bg-zinc-900 border border-transparent hover:shadow-sm hover:border-slate-200 dark:hover:border-zinc-800 text-slate-500 dark:text-slate-400"
                                )}
                                title={isCollapsed ? ext.name || ext.prompt : undefined}
                            >
                                {/* Icon */}
                                <div className={cn(
                                    "flex-shrink-0 flex items-center justify-center rounded-lg border transition-colors shadow-sm",
                                    currentExtensionId === ext.id
                                        ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                                        : "bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 group-hover:border-indigo-200",
                                    isCollapsed ? "w-8 h-8" : "w-10 h-10"
                                )}>
                                    {isCollapsed ? (
                                        <span className="text-[10px] font-bold">{ext.name ? ext.name.substring(0, 2).toUpperCase() : 'EX'}</span>
                                    ) : (
                                        <Puzzle className="w-5 h-5" />
                                    )}
                                </div>

                                {/* Content */}
                                {!isCollapsed && (
                                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                {ext.name || ext.prompt}
                                            </span>
                                            {ext.version && (
                                                <span className="text-[9px] font-mono text-slate-400 border border-slate-200 dark:border-zinc-700 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800">
                                                    v{ext.version}
                                                </span>
                                            )}
                                        </div>

                                        {/* Description */}
                                        {ext.description ? (
                                            <p className="text-[10px] text-slate-500 dark:text-slate-500 line-clamp-2 leading-relaxed">
                                                {ext.description}
                                            </p>
                                        ) : (
                                            <p className="text-[10px] text-slate-400 dark:text-slate-600 italic">
                                                No description provided
                                            </p>
                                        )}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

            </div>

            {/* Bottom: User Section (Unified) */}
            <div className="border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
                <div className={cn(
                    "rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex flex-col gap-1 shadow-sm",
                    isCollapsed ? "p-1 items-center" : "p-3"
                )}>
                    {/* User Header */}
                    <div className={cn("flex items-center gap-3", isCollapsed ? "flex-col justify-center" : "mb-2")}>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm border-2 border-white dark:border-zinc-800 ring-1 ring-slate-100 dark:ring-zinc-800">
                            {userEmail?.[0]?.toUpperCase()}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0 overflow-hidden">
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate" title={userEmail}>{userEmail}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{userPlan} Plan</span>
                                    {userPlan === 'Pro' && nextBillingDate && (
                                        <p className="text-[9px] text-slate-400 pl-3">Renews {new Date(nextBillingDate).toLocaleDateString()}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Upgrade Button (visible in expanded) */}
                        {!isCollapsed && userPlan !== 'Pro' && (
                            <Link
                                to="/plans"
                                className="p-1.5 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors"
                                title="Upgrade"
                            >
                                <Zap className="w-3.5 h-3.5 fill-current" />
                            </Link>
                        )}
                    </div>

                    {/* Divider */}
                    {!isCollapsed && <div className="h-px bg-slate-200 dark:bg-zinc-800 my-1 w-full" />}

                    {/* Navigation Items */}
                    <div className={cn("flex", isCollapsed ? "flex-col gap-2 mt-2" : "flex-col gap-0.5")}>
                        {/* Collapsed Plan/Upgrade Icon */}
                        {isCollapsed && (
                            <Link
                                to="/plans"
                                className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors flex justify-center"
                                title={`Plan: ${userPlan}. Upgrade.`}
                            >
                                <Zap className="w-4 h-4 fill-current" />
                            </Link>
                        )}

                        <Link
                            to="/dashboard"
                            className={cn(
                                "flex items-center gap-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400 transition-all group",
                                isCollapsed ? "justify-center p-2" : "px-2 py-1.5"
                            )}
                            title="Dashboard"
                        >
                            <LayoutDashboard className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                            {!isCollapsed && <span className="text-xs font-medium">Dashboard</span>}
                        </Link>

                        {isAdmin && (
                            <Link
                                to="/admin"
                                className={cn(
                                    "flex items-center gap-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/20 dark:hover:text-purple-400 transition-all group",
                                    isCollapsed ? "justify-center p-2" : "px-2 py-1.5"
                                )}
                                title="Admin"
                            >
                                <Shield className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                {!isCollapsed && <span className="text-xs font-medium">Admin</span>}
                            </Link>
                        )}

                        <button
                            onClick={onLogout}
                            className={cn(
                                "flex items-center gap-2.5 rounded-lg text-slate-500 dark:text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all group",
                                isCollapsed ? "justify-center p-2" : "px-2 py-1.5"
                            )}
                            title="Logout"
                        >
                            <LogOut className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                            {!isCollapsed && <span className="text-xs font-medium">Logout</span>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Extracted Sidebar Item to handle individual state and animations
function SidebarItem({
    ext,
    currentExtensionId,
    isCollapsed,
    onSelect,
    onDelete
}: {
    ext: Extension,
    currentExtensionId: string | null,
    isCollapsed: boolean,
    onSelect: () => void,
    onDelete: (id: string) => Promise<void>
}) {
    const [status, setStatus] = useState<'idle' | 'confirm' | 'deleting' | 'exiting'>('idle');

    const handleConfirm = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setStatus('deleting');

        // 1. Show Red Shimmer
        await new Promise(resolve => setTimeout(resolve, 800));

        // 2. Perform API Delete
        await onDelete(ext.id);

        // 3. Trigger Exit Animation
        setStatus('exiting');

        // 4. Component will unmount when parent list updates,
        // but exiting state gives it a moment if list update is delayed.
    };

    return (
        <div
            className={cn(
                "relative group transition-all duration-300 overflow-hidden",
                status === 'exiting' ? "opacity-0 -translate-x-full h-0 margin-0 padding-0" : "h-10 mb-1"
            )}
        >
            {status === 'confirm' ? (
                <div className="absolute inset-0 w-full px-2 py-2 rounded-lg text-sm flex items-center justify-between bg-red-50 dark:bg-zinc-900 border border-red-200 dark:border-red-900 animate-in fade-in slide-in-from-left-2 z-20 shadow-sm">
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">Delete?</span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setStatus('idle');
                            }}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 cursor-pointer transition-colors"
                        >
                            <Check className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            ) : null}

            <button
                onClick={onSelect}
                className={cn(
                    "absolute inset-0 w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 transition-colors cursor-pointer overflow-hidden",
                    currentExtensionId === ext.id
                        ? "bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-white"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-900 hover:text-slate-900 dark:hover:text-white",
                    isCollapsed && "justify-center px-2",
                    status === 'deleting' && "bg-red-50 dark:bg-red-900/20 cursor-wait !text-red-800 dark:!text-red-200"
                )}
                title={isCollapsed ? ext.prompt : undefined}
                disabled={status === 'deleting'}
            >
                {status === 'deleting' && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                )}

                {status !== 'deleting' && <MessageSquare className="w-4 h-4 flex-shrink-0" />}

                {!isCollapsed && (
                    <div className="flex-1 truncate pr-6 transition-all">
                        {status === 'deleting' ? "Deleting..." : ext.prompt}
                    </div>
                )}
            </button>

            {!isCollapsed && status === 'idle' && currentExtensionId === ext.id && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setStatus('confirm');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-red-500 transition-all bg-transparent hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-md cursor-pointer z-10"
                    title="Delete Extension"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}
