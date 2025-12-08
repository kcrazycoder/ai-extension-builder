import React from 'react';
import { Menu } from 'lucide-react';

interface ChatLayoutProps {
    sidebar: React.ReactNode;
    children: React.ReactNode;
}

export function ChatLayout({ sidebar, children }: ChatLayoutProps) {
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
                <div className="md:hidden flex items-center p-4 border-b border-slate-200 dark:border-zinc-800">
                    <button
                        onClick={() => setIsMobileSidebarOpen(true)}
                        className="p-2 -ml-2 text-slate-600 dark:text-slate-400"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <span className="font-semibold text-slate-900 dark:text-white ml-2">Extension Builder</span>
                </div>

                {children}
            </main>
        </div>
    );
}
