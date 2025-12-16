import { Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface GlobalStatusIndicatorProps {
    isGenerating: boolean;
    progressMessage: string;
    queuePosition?: number;
    estimatedWaitSeconds?: number;
    onClick?: () => void;
}

export function GlobalStatusIndicator({ isGenerating, progressMessage, queuePosition, estimatedWaitSeconds, onClick }: GlobalStatusIndicatorProps) {
    if (!isGenerating) return null;

    return (
        <button
            onClick={onClick}
            className={cn(
                "fixed bottom-6 right-6 z-50",
                "flex items-center gap-3 px-4 py-3",
                "bg-white dark:bg-zinc-900",
                "border border-slate-200 dark:border-zinc-800",
                "shadow-lg shadow-indigo-500/10 dark:shadow-black/20",
                "rounded-full transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]",
                "animate-in slide-in-from-bottom-4 fade-in duration-500",
                "group cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700"
            )}
        >
            <div className="relative flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                <div className="absolute inset-0 bg-indigo-500/20 blur-[6px] rounded-full animate-pulse" />
            </div>

            <div className="flex flex-col items-start gap-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {queuePosition ? `Queue Position: #${queuePosition}` : 'Building Extension'}
                </span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200 max-w-[150px] truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {progressMessage}
                </span>
                {estimatedWaitSeconds && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        Est. wait: {Math.ceil(estimatedWaitSeconds / 60)} min
                    </span>
                )}
            </div>
        </button>
    );
}
