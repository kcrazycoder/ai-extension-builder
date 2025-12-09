import { useRef, useEffect } from 'react';

import type { Extension } from '../../types';
import { ResultCard } from '../ui/ResultCard';


// Unused utility - removing locally if not needed or keeping if logic might need it later?
// Actually in this file we don't use 'cn', so we can remove it.

interface ChatAreaProps {
    currentExtension: Extension | null;
    onDownload: (ext: Extension) => void;
    isGenerating: boolean;
    progressMessage?: string;
    versions?: Extension[];
}



export function ChatArea({ currentExtension, onDownload, isGenerating, progressMessage, versions }: ChatAreaProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [currentExtension, isGenerating]);

    if (!currentExtension && !isGenerating) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 dark:text-zinc-500">
                <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-900 rounded-2xl flex items-center justify-center mb-6">
                    {/* Placeholder Icon */}
                    <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    What can I help you build today?
                </h2>
                <p className="max-w-md mx-auto">
                    Describe the Chrome extension you want to create, and I'll generate the manifest, scripts, and UI for you.
                </p>
                <div className="mt-8 p-4 bg-slate-50 dark:bg-zinc-900 rounded-xl max-w-sm text-sm text-left">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">How it works</h3>
                    <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
                        <li>AI generates full source code (Manifest V3)</li>
                        <li>Download the .zip bundle</li>
                        <li>Load unpacked extension in Chrome</li>
                        <li>Check README.md for details</li>
                    </ul>
                </div>
            </div>
        );
    }

    // Use versions if available (sorted ASC from App.tsx), otherwise fallback to currentExtension (only if versions empty?)
    const displayVersions = versions && versions.length > 0 ? versions : (currentExtension ? [currentExtension] : []);

    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-8" ref={scrollRef}>
            <div className="max-w-3xl mx-auto space-y-8">

                {/* Iterate through conversation history */}
                {displayVersions.map((version) => (
                    <div key={version.id} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* User Message */}
                        <div className="flex flex-row-reverse gap-4">
                            <div className="flex-1 space-y-1 mt-1 flex flex-col items-end">
                                <div className="bg-primary-600 text-white rounded-2xl rounded-tr-sm px-5 py-3 shadow-sm max-w-[85%] text-left leading-relaxed whitespace-pre-wrap">
                                    {version.prompt}
                                </div>
                            </div>
                        </div>

                        {/* AI Response */}
                        <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/40">
                            <div className="w-8 h-8 rounded-full bg-primary-600 flex-shrink-0 flex items-center justify-center text-white shadow-sm">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <div className="flex-1 space-y-2 mt-1">
                                <div className="flex items-center gap-2">
                                    <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                                        Extn
                                    </div>
                                    {version.version && (
                                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-zinc-700">
                                            v{version.version}
                                        </span>
                                    )}
                                </div>

                                {version.status === 'failed' ? (
                                    <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
                                        Generation Failed: {version.error || 'Unknown error'}
                                    </div>
                                ) : (
                                    <>
                                        <div className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-3">
                                            {version.summary || "I've generated the extension based on your requirements. The package includes a manifest, background script, and popup UI."}
                                        </div>
                                        <ResultCard extension={version} onDownload={onDownload} />

                                        {/* Show Version History Summary only on the LATEST item? 
                                            User said: "The same block should be used to display the version history... generated block can be minimized".
                                            But if we show the whole chat, we don't strictly need the history list repeated.
                                            However, keeping it collapsible is nice.
                                            Let's show it only on the last item for easy "go back".
                                         */}
                                        {/* VersionHistory removed per user request */}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Loading State (Pending/Processing) */}
                {isGenerating && !currentExtension && (
                    <div className="flex gap-4 animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-primary-600 flex-shrink-0 flex items-center justify-center text-white">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div className="flex-1 mt-2">
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                                {progressMessage || 'Thinking...'}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
