import { X, Terminal, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { apiClient } from '../../api';

interface PreviewModalProps {
    jobId: string;
    userEmail: string;
    userId: string;
    apiUrl: string;
    onClose: () => void;
    onConnected?: () => void;
}

export function PreviewModal({ jobId, onClose, onConnected }: PreviewModalProps) {
    const [code, setCode] = useState('');
    const [isLinking, setIsLinking] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code || code.length !== 4) {
            setError('Please enter a valid 4-character code.');
            return;
        }

        setIsLinking(true);
        setError(null);

        try {
            await apiClient.linkPreview(code, jobId);
            setIsSuccess(true);
            if (onConnected) onConnected();
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Failed to link preview. Code might be expired.');
            setIsLinking(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                <Terminal className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Test Extension Locally
                            </h3>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {!isSuccess ? (
                        <>
                            <div className="space-y-4">
                                <div className="p-4 bg-slate-50 dark:bg-zinc-950/50 rounded-xl border border-slate-100 dark:border-zinc-800 text-sm">
                                    <p className="text-slate-600 dark:text-slate-400 mb-2">
                                        1. Run the Satellite Tool to <span className="text-indigo-600 dark:text-indigo-400 font-medium">automatically launch Chrome</span> with your extension:
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-slate-900 text-slate-200 px-3 py-2 rounded-lg font-mono text-xs select-all">
                                            npx ai-extension-preview@latest
                                        </div>
                                        <button
                                            onClick={() => navigator.clipboard.writeText('npx ai-extension-preview@latest')}
                                            className="p-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 rounded-lg text-slate-600 dark:text-slate-400 transition-colors"
                                            title="Copy Command"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                                        </button>
                                    </div>
                                    <p className="text-slate-600 dark:text-slate-400 mt-4 mb-2">
                                        2. Enter the <span className="font-semibold text-indigo-600 dark:text-indigo-400">4-character code</span> displayed:
                                    </p>
                                    <form onSubmit={handleConnect} className="relative">
                                        <input
                                            type="text"
                                            value={code}
                                            onChange={(e) => {
                                                setCode(e.target.value.toUpperCase().slice(0, 4));
                                                setError(null);
                                            }}
                                            placeholder="XXXX"
                                            className="w-full text-center text-2xl font-mono tracking-widest p-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none uppercase placeholder:opacity-50"
                                            autoFocus
                                        />
                                    </form>
                                    {error && (
                                        <p className="text-red-500 text-xs mt-2 text-center animate-in fade-in">{error}</p>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={handleConnect}
                                disabled={isLinking || code.length !== 4}
                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                                {isLinking ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Linking...
                                    </>
                                ) : (
                                    <>
                                        Launch Local Preview <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <div className="py-8 flex flex-col items-center text-center animate-in fade-in">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-4">
                                <Check className="w-8 h-8" />
                            </div>
                            <h4 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Connected!</h4>
                            <p className="text-slate-500 dark:text-slate-400">Chrome is launching with your extension...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
