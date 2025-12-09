import { X, Terminal, Copy, Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';

interface PreviewModalProps {
    jobId: string;
    userEmail: string;
    userId: string;
    apiUrl: string;
    onClose: () => void;
}

export function PreviewModal({ jobId, userId, apiUrl, onClose }: PreviewModalProps) {
    const [copied, setCopied] = useState(false);

    // Command to run the preview tool
    // We assume the user is in the project root or has the tool available
    // For now, let's provide the path relative to repo root assuming developer context
    const command = `npx tsx preview-tool/src/index.ts --job ${jobId} --user ${userId} --host ${apiUrl}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(command);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                <Terminal className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Live Browser Preview
                            </h3>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            To preview this extension in a real browser and enable <b>auto-reloading</b>, run the following command in your terminal:
                        </p>

                        <div className="relative group">
                            <div className="absolute inset-0 bg-slate-950 rounded-xl" />
                            <div className="relative bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-xs break-all border border-slate-800 shadow-inner">
                                {command}
                            </div>
                            <button
                                onClick={handleCopy}
                                className="absolute top-2 right-2 p-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-700 shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100"
                                title="Copy to clipboard"
                            >
                                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl p-4 flex gap-3">
                            <ExternalLink className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-700 dark:text-blue-300">
                                <p className="font-medium mb-1">How it works</p>
                                <p className="opacity-90">
                                    This command launches a Chrome window with your extension loaded. When you generate changes here, the browser will automatically reload with the new version.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-zinc-950/50 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
