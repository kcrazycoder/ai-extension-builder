import React from 'react';
import { Menu, Play, Sun, Moon } from 'lucide-react';

import type { Extension } from '../../types';
import { VersionDropdown } from '../chat/VersionDropdown';
import { useTheme } from '../../context/ThemeContext';

interface ChatLayoutProps {
    sidebar: React.ReactNode;
    children: React.ReactNode;
    onOpenPreview?: () => void;
    versions?: Extension[];
    currentVersion?: Extension | null;
    onSelectVersion?: (ext: Extension) => void;
    onDownload?: (ext: Extension) => void;
}

export function ChatLayout({ sidebar, children, onOpenPreview, versions, currentVersion, onSelectVersion, onDownload }: ChatLayoutProps) {
    const { resolvedTheme, setTheme } = useTheme();
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);

    return (
        <div className="flex h-screen bg-white dark:bg-zinc-950 overflow-hidden">
            {/* Desktop Sidebar */}
            <aside className="hidden md:block flex-shrink-0">
                {sidebar}
            </aside>

            {/* Mobile Sidebar Overlay */}
            {isMobileSidebarOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setIsMobileSidebarOpen(false)} />
                    <div className="absolute inset-y-0 left-0 w-64 bg-white dark:bg-zinc-950 shadow-xl">
                        {sidebar}
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950 relative">

                {/* Mobile Header */}
                <div className="md:hidden flex items-center p-4 border-b border-slate-200 dark:border-zinc-800 justify-between">
                    <div className="flex items-center">
                        <button
                            onClick={() => setIsMobileSidebarOpen(true)}
                            className="p-2 -ml-2 text-slate-600 dark:text-slate-400"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <span className="font-semibold text-slate-900 dark:text-white ml-2">Extension Builder</span>
                    </div>
                    {onOpenPreview && (
                        <button
                            onClick={onOpenPreview}
                            className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg"
                            title="Live Preview"
                        >
                            <Play className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Desktop Header Actions */}
                <div className="hidden md:flex items-center justify-between px-6 py-3 border-b border-slate-100 dark:border-zinc-900">
                    <span className="font-medium text-slate-500 dark:text-slate-400 text-sm">Workspace</span>
                    <div className="flex items-center gap-2">
                        {versions && versions.length > 0 && onSelectVersion && onDownload && (
                            <VersionDropdown
                                versions={versions}
                                currentVersion={currentVersion || null}
                                onSelectVersion={onSelectVersion}
                                onDownload={onDownload}
                            />
                        )}

                        {onOpenPreview && (
                            <button
                                onClick={onOpenPreview}
                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg text-sm font-medium transition-colors border border-indigo-200 dark:border-indigo-800"
                            >
                                <Play className="w-4 h-4" />
                                <span>Live Preview</span>
                            </button>
                        )}

                        <div className="w-px h-6 bg-slate-200 dark:bg-zinc-800 mx-1" />

                        <button
                            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                            className="p-2 rounded-full inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all hover:scale-110 active:scale-95"
                            title="Toggle Theme"
                        >
                            {resolvedTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {children}
            </main>
        </div>
    );
}
