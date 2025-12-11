import React from 'react';
import { Plus, MessageSquare, LogOut, ChevronLeft, ChevronRight, Trash2, Puzzle } from 'lucide-react';
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
    onDeleteConversation: (extId: string) => void;
    onNewChat: () => void;
    onLogout: () => void;
    userEmail?: string;
}

export function Sidebar({
    history,
    currentExtensionId,
    onSelectExtension,
    onDeleteConversation,
    onNewChat,
    onLogout,
    userEmail
}: SidebarProps) {
    const [isCollapsed, setIsCollapsed] = React.useState(false);

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

            {/* Header / New Chat */}
            <div className="p-4">
                <button
                    onClick={onNewChat}
                    className={cn(
                        "w-full flex items-center justify-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-sm",
                        isCollapsed ? "p-2" : "px-3 py-2 gap-2"
                    )}
                    title="New Extension"
                >
                    <Plus className="w-4 h-4" />
                    {!isCollapsed && <span>New Extension</span>}
                </button>
            </div>

            {/* Split Sidebar Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

                {/* Top: History */}
                {/* Top: History */}
                <div className="flex-1 flex flex-col min-h-0 relative">
                    {!isCollapsed && (
                        <div className="relative z-20 px-2 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-zinc-950 shrink-0">
                            History
                            <div className="absolute -bottom-5 left-0 right-0 h-5 bg-gradient-to-b from-slate-50 dark:from-zinc-950 to-transparent pointer-events-none" />
                        </div>
                    )}
                    {isCollapsed && (
                        <div className="absolute top-0 left-0 right-0 h-5 bg-gradient-to-b from-slate-50 dark:from-zinc-950 to-transparent pointer-events-none z-20" />
                    )}
                    <div className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-hide min-h-0 pb-6 pt-1">
                        {history.length === 0 ? (
                            !isCollapsed && (
                                <div className="px-4 py-8 text-center text-sm text-slate-400 dark:text-zinc-500 animate-in fade-in">
                                    No history yet
                                </div>
                            )
                        ) : (
                            history.map((ext) => (
                                <div
                                    key={ext.id}
                                    className="relative group"
                                >
                                    <button
                                        onClick={() => onSelectExtension(ext)}
                                        className={cn(
                                            "w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 transition-colors",
                                            currentExtensionId === ext.id
                                                ? "bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-white"
                                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-900 hover:text-slate-900 dark:hover:text-white",
                                            isCollapsed && "justify-center px-2"
                                        )}
                                        title={isCollapsed ? ext.prompt : undefined}
                                    >
                                        <MessageSquare className="w-4 h-4 flex-shrink-0" />
                                        {!isCollapsed && (
                                            <div className="flex-1 truncate animate-in fade-in pr-6">
                                                {ext.prompt}
                                            </div>
                                        )}
                                    </button>
                                    {!isCollapsed && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm('Are you sure you want to delete this conversation? This cannot be undone.')) {
                                                    onDeleteConversation(ext.id);
                                                }
                                            }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all bg-transparent hover:bg-slate-200 dark:hover:bg-zinc-700 rounded"
                                            title="Delete Conversation"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    {/* Fade Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-50 dark:from-zinc-950 to-transparent pointer-events-none z-10" />
                </div>

                {/* Bottom: My Extensions */}
                <div className="flex-1 flex flex-col min-h-0 border-t border-slate-200 dark:border-zinc-800 relative">
                    {!isCollapsed && (
                        <div className="relative z-20 px-4 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-zinc-950 shrink-0">
                            My Extensions
                            <div className="absolute -bottom-5 left-0 right-0 h-5 bg-gradient-to-b from-slate-50 dark:from-zinc-950 to-transparent pointer-events-none" />
                        </div>
                    )}
                    {isCollapsed && (
                        <div className="absolute top-0 left-0 right-0 h-5 bg-gradient-to-b from-slate-50 dark:from-zinc-950 to-transparent pointer-events-none z-20" />
                    )}
                    <div className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-hide pb-6 pt-1">
                        {history.map((ext) => (
                            <button
                                key={'my-' + ext.id}
                                onClick={() => onSelectExtension(ext)}
                                className={cn(
                                    "w-full text-left p-2 rounded-lg flex items-start gap-2.5 transition-all group",
                                    currentExtensionId === ext.id
                                        ? "bg-white dark:bg-zinc-900 shadow-sm border border-indigo-200 dark:border-indigo-900/50 ring-1 ring-indigo-500/10"
                                        : "hover:bg-white dark:hover:bg-zinc-900 border border-transparent hover:shadow-sm hover:border-slate-200 dark:hover:border-zinc-800"
                                )}
                                title={isCollapsed ? ext.name || ext.prompt : undefined}
                            >
                                {/* Block 1: Icon */}
                                <div className={cn(
                                    "flex-shrink-0 flex items-center justify-center rounded-lg border",
                                    currentExtensionId === ext.id
                                        ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                                        : "bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-slate-400",
                                    isCollapsed ? "w-8 h-8" : "w-6 h-6"
                                )}>
                                    {isCollapsed ? (
                                        <span className="text-[10px] font-bold">{ext.name ? ext.name.substring(0, 2).toUpperCase() : 'EX'}</span>
                                    ) : (
                                        <Puzzle className="w-3 h-3" />
                                    )}
                                </div>

                                {/* Block 2: Content */}
                                {!isCollapsed && (
                                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                        {/* Row 1: Name + Version */}
                                        <div className="flex items-center justify-between gap-1 w-full">
                                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={ext.name || ext.prompt}>
                                                {ext.name || ext.prompt}
                                            </span>
                                            <span className="flex-shrink-0 text-[9px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-zinc-800 px-1 py-px rounded border border-slate-200 dark:border-zinc-700">
                                                v{ext.version || '0.1'}
                                            </span>
                                        </div>
                                        {/* Row 2: Description */}
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight opacity-90">
                                            {ext.description || ext.summary || "No description available."}
                                        </p>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                    {/* Fade Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-50 dark:from-zinc-950 to-transparent pointer-events-none z-10" />
                </div>

            </div>

            {/* Footer / User / Theme */}
            <div className={cn(
                "border-t border-slate-200 dark:border-zinc-800 space-y-2",
                isCollapsed ? "p-2" : "p-4"
            )}>

                {/* User Profile */}
                <div className={cn(
                    "flex items-center pt-2",
                    isCollapsed ? "justify-center flex-col gap-2" : "justify-between"
                )}>
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {userEmail?.[0].toUpperCase()}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0 animate-in fade-in">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                    {userEmail}
                                </p>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onLogout}
                        className={cn(
                            "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors",
                            isCollapsed ? "p-1" : "p-1.5"
                        )}
                        title="Sign out"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
