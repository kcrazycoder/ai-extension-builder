import { useRef, useEffect } from 'react';

import { User } from 'lucide-react';
import type { Extension } from '../../types';
import { ResultCard } from '../ui/ResultCard';


// Unused utility - removing locally if not needed or keeping if logic might need it later?
// Actually in this file we don't use 'cn', so we can remove it.

interface ChatAreaProps {
    currentExtension: Extension | null;
    onDownload: (ext: Extension) => void;
    isGenerating: boolean;
    userEmail?: string;
}

export function ChatArea({ currentExtension, onDownload, isGenerating, userEmail }: ChatAreaProps) {
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
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-8" ref={scrollRef}>
            <div className="max-w-3xl mx-auto space-y-8">

                {/* User Message */}
                {currentExtension && (
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                            {userEmail ? (
                                <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                    {userEmail[0].toUpperCase()}
                                </div>
                            ) : <User className="w-5 h-5 text-slate-500" />}
                        </div>
                        <div className="flex-1 space-y-1 mt-1">
                            <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                                You
                            </div>
                            <div className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {currentExtension.prompt}
                            </div>
                        </div>
                    </div>
                )}

                {/* AI Response (Result Card) */}
                {(currentExtension || isGenerating) && (
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary-600 flex-shrink-0 flex items-center justify-center text-white">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div className="flex-1 space-y-2 mt-1">
                            <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                                Tophat
                            </div>
                            {currentExtension ? (
                                <ResultCard extension={currentExtension} onDownload={onDownload} />
                            ) : (
                                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                    <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                                    Thinking...
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
