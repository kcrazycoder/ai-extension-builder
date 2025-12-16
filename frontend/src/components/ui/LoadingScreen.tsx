import { Zap } from 'lucide-react';

export function LoadingScreen() {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-zinc-950">
            <div className="flex flex-col items-center gap-4 animate-pulse">
                <div className="p-3 bg-indigo-500/10 rounded-xl relative">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full" />
                    <Zap className="w-8 h-8 text-indigo-600 dark:text-indigo-400 relative z-10" fill="currentColor" />
                </div>
                {/* Optional: Add text if desired, but icon-only is cleaner for 'minimal' vibe */}
            </div>
        </div>
    );
}
