import { Loader2, Download, AlertCircle, CheckCircle2, Box } from 'lucide-react';
import type { Extension } from '../../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ResultCardProps {
    extension: Extension;
    onDownload: (ext: Extension) => void;
}

export function ResultCard({ extension, onDownload }: ResultCardProps) {
    const isCompleted = extension.status === 'completed';
    const isFailed = extension.status === 'failed';

    // Unused isProcessing removed; we use explicit checks in logic or default to "Generating"

    return (
        <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors">
            <div className="p-6">
                <div className="flex items-start gap-4">
                    <div className={cn(
                        "p-2 rounded-lg",
                        isCompleted ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" :
                            isFailed ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" :
                                "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                    )}>
                        {isCompleted ? <CheckCircle2 className="w-6 h-6" /> :
                            isFailed ? <AlertCircle className="w-6 h-6" /> :
                                <Loader2 className="w-6 h-6 animate-spin" />}
                    </div>

                    <div className="flex-1 space-y-2">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-lg">
                            {isCompleted ? "Extension Generated!" :
                                isFailed ? "Generation Failed" :
                                    "Generating Extension..."}
                        </h3>

                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                            {isCompleted ? "Your Chrome extension is ready. Detailed instructions for installation are included in the README.md within the zip file." :
                                isFailed ? extension.error || "An unexpected error occurred while generating the extension." :
                                    "The AI is currently analyzing your request and generating the necessary files (manifest.json, content scripts, popup, sidebar). This usually takes about 10-20 seconds."}
                        </p>

                        {/* Metadata Badges */}
                        <div className="flex items-center gap-2 pt-2">
                            <span className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 rounded text-xs font-mono text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-zinc-700">
                                v1.0.0
                            </span>
                            <span className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 rounded text-xs font-mono text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-zinc-700">
                                manifest_version: 3
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {isCompleted && (
                <div className="bg-slate-50 dark:bg-zinc-800/50 px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <Box className="w-4 h-4" />
                        <span>extension_bundle.zip</span>
                    </div>
                    <button
                        onClick={() => onDownload(extension)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-white/90 transition-colors shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        Download
                    </button>
                </div>
            )}
        </div>
    );
}
