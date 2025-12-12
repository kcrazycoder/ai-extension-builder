import { useRef, useEffect, useState } from 'react';
import { Clock, ChevronDown, ChevronUp, Copy, Check, Sparkles } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AnimatePresence, motion } from 'framer-motion';

import { apiClient } from '../../api';
import type { Extension, Suggestion } from '../../types';
import { ResultCard } from '../ui/ResultCard';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Fallback suggestions in case AI service is unavailable
const FALLBACK_SUGGESTIONS: Suggestion[] = [
    { label: "Pomodoro Timer", prompt: "Create a Pomodoro timer popup that uses chrome.alarms to track 25-minute intervals and fires a chrome.notification when time is up. Include Start/Reset buttons.", isAi: false },
    { label: "Bookmark Saver", prompt: "Build a Bookmark Manager that displays a tree of bookmarks using chrome.bookmarks.getTree and allows adding the current page as a bookmark.", isAi: false },
    { label: "Cookie Clearer", prompt: "Create a utility to view and wipe cookies for the current domain using chrome.cookies API. List cookies in a simple table.", isAi: false },
    { label: "Color Picker", prompt: "Build a color picker tool that uses the EyeDropper API to select pixels from the screen and copies the HEX code to clipboard history.", isAi: false },
    { label: "Quick Notes", prompt: "Create a sticky note extension that saves text to chrome.storage.local/sync so notes persist between sessions.", isAi: false },
];

interface ErrorBlockProps {
    error: string;
    onRetry?: (prompt: string, parentId?: string, retryFromId?: string) => void;
    isLatest: boolean;
    version: Extension;
}

function ErrorBlock({ error, onRetry, isLatest, version }: ErrorBlockProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [hasCopied, setHasCopied] = useState(false);
    const MAX_CHARS = 150;
    const shouldTruncate = error.length > MAX_CHARS;

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(error);
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000);
    };

    return (
        <div className="pl-7">
            <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl text-red-600 dark:text-red-400 text-sm flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4 w-full">
                    <div className="flex-1 min-w-0 break-words whitespace-pre-wrap font-mono text-xs">
                        {isExpanded || !shouldTruncate ? error : `${error.slice(0, MAX_CHARS)}...`}
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-red-100 dark:border-red-900/20">
                    {shouldTruncate ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(!isExpanded);
                            }}
                            className="text-xs font-semibold hover:underline bg-transparent border-none p-0 h-auto text-red-600 dark:text-red-400"
                        >
                            {isExpanded ? "Show less" : "Show more"}
                        </button>
                    ) : (
                        <span></span> /* Spacer */
                    )}

                    <div className="flex items-center gap-2">
                        {/* Copy Button with Feedback */}
                        <div className="relative">
                            <button
                                onClick={handleCopy}
                                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg text-red-500 transition-all active:scale-90"
                                title="Copy error"
                            >
                                {hasCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            {/* Mini Toast */}
                            {hasCopied && (
                                <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded shadow-md animate-in fade-in slide-in-from-bottom-2 whitespace-nowrap z-10">
                                    Copied!
                                </span>
                            )}
                        </div>

                        {isLatest && onRetry && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRetry(version.prompt, version.parentId, version.id);
                                }}
                                className="flex-shrink-0 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-sm whitespace-nowrap active:scale-95"
                            >
                                Retry
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

interface ChatAreaProps {
    currentExtension: Extension | null;
    onDownload: (ext: Extension) => void;
    isGenerating: boolean;
    progressMessage?: string;
    versions?: Extension[];
    onSelectSuggestion?: (prompt: string) => Promise<void>;
    onRetry?: (prompt: string, parentId?: string, retryFromId?: string) => void;
}

export function ChatArea({ currentExtension, onDownload, isGenerating, progressMessage, versions, onSelectSuggestion, onRetry }: ChatAreaProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [loadingSuggestion, setLoadingSuggestion] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [areSuggestionsReady, setAreSuggestionsReady] = useState(false);
    const [expandedVersionIds, setExpandedVersionIds] = useState<Set<string>>(new Set());

    const toggleVersion = (id: string) => {
        setExpandedVersionIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Auto-expand selected version exclusively
    useEffect(() => {
        if (currentExtension) {
            setExpandedVersionIds(new Set([currentExtension.id]));
        }
    }, [currentExtension]);

    // Fetch dynamic suggestions on mount
    useEffect(() => {
        const fetchSuggestions = async () => {
            try {
                setAreSuggestionsReady(false);
                const fetched = await apiClient.getSuggestions();
                if (fetched && fetched.length > 0) {
                    setSuggestions(fetched);
                } else {
                    // Fallback to random subset of hardcoded suggestions
                    setSuggestions([...FALLBACK_SUGGESTIONS].sort(() => 0.5 - Math.random()).slice(0, 3));
                }
            } catch (err) {
                console.error("Failed to fetch suggestions:", err);
                setSuggestions([...FALLBACK_SUGGESTIONS].sort(() => 0.5 - Math.random()).slice(0, 3));
            } finally {
                setAreSuggestionsReady(true);
            }
        };

        if (suggestions.length === 0) {
            fetchSuggestions();
        }
    }, []);

    const handleSuggestionClick = async (item: Suggestion) => {
        if (!onSelectSuggestion) return;
        setLoadingSuggestion(item.label);
        await onSelectSuggestion(item.prompt);
        setLoadingSuggestion(null);
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [currentExtension, isGenerating]);

    if (!currentExtension && !isGenerating) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-zinc-950/50">
                <style>{`
    .bg - grid - pattern {
    background - image: radial - gradient(circle at 1px 1px, currentColor 1px, transparent 0);
    background - size: 24px 24px;
}
@keyframes slideUpFade {
                        from { opacity: 0; transform: translateY(4px); }
                        to { opacity: 1; transform: translateY(0); }
}
@keyframes gentleScale {
    0 %, 100 % { transform: scale(1); opacity: 1; }
    50 % { transform: scale(0.97); opacity: 0.7; }
}
                    .animate - slide - up - fade {
    animation: slideUpFade 0.5s cubic - bezier(0.16, 1, 0.3, 1) backwards;
}
                    .animate - gentle - scale {
    animation: gentleScale 1.2s infinite ease -in -out;
}
`}</style>
                <div className="absolute inset-0 bg-grid-pattern text-slate-200 dark:text-zinc-900 [mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none" />

                <div className="relative max-w-2xl w-full text-center space-y-8 animate-in fade-in zoom-in-95 duration-700">
                    <div className="space-y-6">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                            Let's build your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">extension</span>.
                        </h1>
                        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
                            Describe the Chrome extension you want to create, and the AI will generate the manifest, scripts, and UI for you.
                        </p>
                    </div>

                    <div className="text-sm text-slate-400 dark:text-slate-500 font-medium mr-2 mb-4">Try:</div>
                    <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg mx-auto">
                        {areSuggestionsReady ? (
                            suggestions.map((item, i) => (
                                <button
                                    key={i}
                                    disabled={!!loadingSuggestion}
                                    style={{ animationDelay: `${i * 40} ms` }}
                                    className={cn(
                                        "relative px-3 py-1.5 rounded-full text-sm font-medium border transition-all cursor-pointer overflow-hidden animate-slide-up-fade",
                                        loadingSuggestion === item.label
                                            ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20"
                                            : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400"
                                    )}
                                    onClick={() => handleSuggestionClick(item)}
                                >
                                    <span
                                        className={cn(
                                            "relative flex items-center gap-1.5",
                                            loadingSuggestion === item.label && "animate-gentle-scale text-indigo-600 dark:text-indigo-400 font-semibold"
                                        )}
                                    >
                                        {item.isAi && <Sparkles className="w-3.5 h-3.5 opacity-60" />}
                                        {item.label}
                                    </span>
                                </button>
                            ))
                        ) : (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="h-8 bg-slate-100 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800 rounded-full animate-pulse"
                                    style={{ width: `${80 + (i * 15)}px` }}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div >
        );
    }

    const displayVersions = versions && versions.length > 0 ? versions : (currentExtension ? [currentExtension] : []);

    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide" ref={scrollRef}>
            <div className="max-w-2xl mx-auto w-full min-h-full flex flex-col justify-end p-4 md:p-8">
                {/* GitHub-style Timeline Container */}
                <div className="relative space-y-8">
                    {/* Continuous vertical line background REMOVED - using segmented lines now */}

                    {(() => {
                        const sortedVersions = [...displayVersions].sort((a, b) => {
                            const da = new Date(a.created_at || a.createdAt || 0).getTime();
                            const db = new Date(b.created_at || b.createdAt || 0).getTime();
                            return da - db;
                        });
                        const latestVersionId = sortedVersions.length > 0 ? sortedVersions[sortedVersions.length - 1].id : null;

                        return sortedVersions.map((version, index) => {
                            const isLatest = version.id === latestVersionId;
                            const isExpanded = expandedVersionIds.has(version.id);

                            // Show connection line to the NEXT item if it exists
                            // We do NOT show it for the last item (connecting to potentially nothing or loading state)
                            // as per user request "Show ... only after completion".
                            const showTail = index < sortedVersions.length - 1;

                            return (
                                <div key={version.id} className="relative pl-10 md:pl-0 animate-in fade-in slide-in-from-top-4 duration-500 group">

                                    {/* Vertical Line Segment (Tail) */}
                                    {showTail && (
                                        <motion.div
                                            initial={{ scaleY: 0 }}
                                            animate={{ scaleY: 1 }}
                                            transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
                                            style={{ originY: 0 }}
                                            className="absolute left-[15px] md:-left-6 top-4 -bottom-8 w-0.5 bg-slate-200 dark:bg-zinc-800"
                                        />
                                    )}

                                    {/* Timeline Node */}
                                    <div className={cn(
                                        "absolute left-[8px] md:-left-8 top-1.5 w-4 h-4 rounded-full border-[3px] z-10 transition-all shadow-sm",
                                        isExpanded
                                            ? "bg-white dark:bg-zinc-950 border-indigo-500 scale-110"
                                            : "bg-slate-100 dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 group-hover:border-indigo-400"
                                    )} />

                                    {/* Commit/Version Header */}
                                    <div
                                        onClick={() => toggleVersion(version.id)}
                                        className="flex items-center gap-3 mb-3 cursor-pointer select-none opacity-80 hover:opacity-100 transition-opacity"
                                    >
                                        <span className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
                                            v{version.version || '0.1.0'}
                                        </span>
                                        <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                            <Clock className="w-3 h-3" />
                                            {(version.created_at || version.createdAt) ? new Date(version.created_at || version.createdAt!).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                        </span>
                                    </div>

                                    {/* Content Card */}
                                    <div
                                        className={cn(
                                            "bg-white dark:bg-zinc-900 border rounded-xl shadow-sm transition-all overflow-hidden",
                                            isExpanded
                                                ? "border-slate-300 dark:border-zinc-700 ring-4 ring-slate-100 dark:ring-zinc-800/50"
                                                : "border-slate-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-900 hover:shadow-md cursor-pointer"
                                        )}
                                    >

                                        {/* User Request */}
                                        <div
                                            onClick={() => !isExpanded && toggleVersion(version.id)}
                                            className={cn(
                                                "p-5 md:p-6",
                                                isExpanded && "border-b border-slate-100 dark:border-zinc-800"
                                            )}>
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-slate-100 dark:border-zinc-800">
                                                            User Request
                                                        </span>
                                                    </div>
                                                    <div className={cn(
                                                        "text-slate-800 dark:text-slate-200 font-medium leading-relaxed",
                                                        !isExpanded && "line-clamp-2 text-sm text-slate-600 dark:text-slate-400"
                                                    )}>
                                                        {version.prompt}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {isExpanded ? (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleVersion(version.id); }}
                                                            className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                                        >
                                                            <ChevronUp className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        <div className="p-1.5 text-slate-300">
                                                            <ChevronDown className="w-4 h-4" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* AI Result - Only show if expanded */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    <div className="p-5 md:p-6 bg-slate-50/50 dark:bg-zinc-900/50">
                                                        {/* Result Header */}


                                                        {version.status === 'failed' ? (
                                                            <ErrorBlock
                                                                error={version.error || 'Generation failed.'}
                                                                onRetry={onRetry}
                                                                isLatest={isLatest}
                                                                version={version}
                                                            />
                                                        ) : (
                                                            <div className="space-y-4">
                                                                {/* Summary / Description */}
                                                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-l-2 border-indigo-200 dark:border-indigo-900 pl-4 py-1">
                                                                    {version.summary
                                                                        ? version.summary
                                                                        : "The AI has successfully analyzed your request and generated the extension package."}
                                                                </p>

                                                                <div className="mt-4">
                                                                    <ResultCard extension={version} onDownload={onDownload} />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            );
                        });
                    })()}

                    {/* Loading State */}
                    {isGenerating && (
                        <div className="relative pl-10 md:pl-0 animate-in fade-in pt-4">
                            <div className="absolute left-[8px] md:-left-8 top-1.5 w-4 h-4 rounded-full bg-white dark:bg-zinc-950 border-4 border-slate-100 dark:border-zinc-800 z-10 animate-pulse" />

                            <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 border-dashed rounded-xl p-6">
                                <div className="flex items-center gap-4">
                                    <div className="relative flex h-4 w-4">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500"></span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-sm font-medium text-slate-900 dark:text-slate-200">
                                            Building extension...
                                        </span>
                                        <div className="text-xs text-slate-500 dark:text-slate-500">
                                            {progressMessage || 'Analyzing requirements and generating code'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
