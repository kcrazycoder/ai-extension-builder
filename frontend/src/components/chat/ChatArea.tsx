import { useRef, useEffect, useState } from 'react';
import { Sparkles, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { Extension } from '../../types';
import { ResultCard } from '../ui/ResultCard';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// In-file suggestions data
const SUGGESTIONS = [
    { label: "Pomodoro Timer", prompt: "Create a Pomodoro timer extension with a 25-minute countdown, work/break modes, desktop notifications, and a minimalist popup UI." },
    { label: "Dark Mode Toggle", prompt: "Build a global dark mode toggle that automatically injects high-contrast dark CSS into any active webpage, with a whitelist feature." },
    { label: "JSON Formatter", prompt: "Develop a JSON formatter that automatically detects JSON content, syntax highlights it, and provides collapsible tree view navigation." },
    { label: "QR Code Gen", prompt: "Create a QR code generator that instantly creates a QR code for the current tab's URL, with options to download as PNG or SVG." },
    { label: "Reading Mode", prompt: "Implement a Reader View extension that strips clutter, ads, and sidebars from article pages, presenting text in clean, readable typography." },
    { label: "Color Picker", prompt: "Build a color picker tool that allows selecting any pixel on the screen to copy its HEX/RGB code, and stores a history of picked colors." },
    { label: "Tab Manager", prompt: "Create a tab manager that lists all open tabs vertically, allows searching/filtering them, and supports bulk closing of duplicate tabs." },
    { label: "Lorem Ipsum", prompt: "Develop a fast 'Lorem Ipsum' generator popup that allows users to copy random paragraphs, sentences, or words to the clipboard with one click." },
    { label: "Focus Blocker", prompt: "Build a site blocker to improve focus. Allow users to add a list of distracting domains and set a schedule during which they are blocked." },
    { label: "Note Taker", prompt: "Create a simple sticky note extension that persists text per-domain. Notes should be auto-saved and visible whenever the user visits that specific site." },
    { label: "Image Downloader", prompt: "Build a tool that extracts all images from the current page, displays them in a grid in the popup, and allows bulk downloading." },
    { label: "Cookie Clearer", prompt: "Create a utility to quickly clear cookies and local storage for the current site with one click, useful for web development debugging." },
    { label: "User Agent Switcher", prompt: "Implement a User Agent switcher that modifies the request headers to simulate different devices (Mobile, Tablet, Desktop) for testing." },
    { label: "Markdown Viewer", prompt: "Build a Markdown previewer that automatically renders .md files in the browser using a clean, GitHub-like style." },
    { label: "Password Gen", prompt: "Create a secure password generator with customizable length and character sets (symbols, numbers), and a button to copy to clipboard." },
    { label: "Tweet Hider", prompt: "Build a content filter for Twitter/X that hides posts containing specific keywords or hashtags defined by the user." },
    { label: "CSS Inspector", prompt: "Create a lightweight CSS inspector that displays the computed font family, color, and dimensions of any element hovered over." },
    { label: "Broken Link Checker", prompt: "Develop a tool that scans the current page for broken links (404s) and highlights them in red." },
    { label: "Price Tracker", prompt: "Build a simple price tracker that allows users to save the current product page and periodically checks for price drops." },
    { label: "ToDo List", prompt: "Create a minimalist To-Do list extension that replaces the 'New Tab' page with a daily task list and an inspiring quote." },
];

interface ChatAreaProps {
    currentExtension: Extension | null;
    onDownload: (ext: Extension) => void;
    isGenerating: boolean;
    progressMessage?: string;
    versions?: Extension[];
    onSelectSuggestion?: (prompt: string) => Promise<void>;
}



export function ChatArea({ currentExtension, onDownload, isGenerating, progressMessage, versions, onSelectSuggestion }: ChatAreaProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [loadingSuggestion, setLoadingSuggestion] = useState<string | null>(null);
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

    // Randomize suggestions on mount
    const randomSuggestions = useRef<typeof SUGGESTIONS>([]);
    useEffect(() => {
        if (randomSuggestions.current.length === 0) {
            randomSuggestions.current = [...SUGGESTIONS].sort(() => 0.5 - Math.random()).slice(0, 5);
        }

        // Simulate loading delay for shimmer effect
        const timer = setTimeout(() => {
            setAreSuggestionsReady(true);
        }, 800);

        return () => clearTimeout(timer);
    }, []);

    const handleSuggestionClick = async (item: typeof SUGGESTIONS[0]) => {
        if (!onSelectSuggestion) return;
        setLoadingSuggestion(item.label);

        // App handles the delay and specific prompt setting logic
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
                    .bg-grid-pattern {
                        background-image: radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0);
                        background-size: 24px 24px;
                    }
                    @keyframes slideUpFade {
                        from { opacity: 0; transform: translateY(4px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes gentleScale {
                        0%, 100% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(0.97); opacity: 0.7; }
                    }
                    .animate-slide-up-fade {
                        animation: slideUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards;
                    }
                    .animate-gentle-scale {
                        animation: gentleScale 1.2s infinite ease-in-out;
                    }
                `}</style>
                <div className="absolute inset-0 bg-grid-pattern text-slate-200 dark:text-zinc-900 [mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none" />

                <div className="relative max-w-2xl w-full text-center space-y-8 animate-in fade-in zoom-in-95 duration-700">

                    {/* Hero Section */}
                    <div className="space-y-6">

                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                            Let's build your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">extension</span>.
                        </h1>
                        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
                            Describe the Chrome extension you want to create, and the AI will generate the manifest, scripts, and UI for you.
                        </p>
                    </div>

                    {/* Suggestions Pills */}
                    <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg mx-auto">
                        <span className="text-sm text-slate-400 dark:text-slate-500 font-medium mr-2">Try:</span>
                        {areSuggestionsReady ? (
                            randomSuggestions.current.map((item, i) => (
                                <button
                                    key={i}
                                    disabled={!!loadingSuggestion}
                                    style={{ animationDelay: `${i * 40}ms` }}
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
                                            "relative block",
                                            loadingSuggestion === item.label && "animate-gentle-scale text-indigo-600 dark:text-indigo-400 font-semibold"
                                        )}
                                    >
                                        {item.label}
                                    </span>
                                </button>
                            ))
                        ) : (
                            // Loading Shimmer Pills
                            Array.from({ length: 5 }).map((_, i) => (
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

    // Use versions if available (sorted ASC from App.tsx), otherwise fallback to currentExtension (only if versions empty?)
    const displayVersions = versions && versions.length > 0 ? versions : (currentExtension ? [currentExtension] : []);

    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-8" ref={scrollRef}>
            <div className="max-w-3xl mx-auto py-8">
                <div className="relative border-l-2 border-slate-100 dark:border-zinc-800 ml-4 md:ml-6 space-y-12 pb-12">

                    {/* Loading State Line Item */}
                    {isGenerating && !currentExtension && (
                        <div className="relative pl-8 md:pl-12 animate-in fade-in">
                            <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-white dark:bg-zinc-950 border-4 border-slate-200 dark:border-zinc-700 z-10 animate-pulse" />
                            <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 border-dashed rounded-2xl p-6">
                                <div className="flex items-center gap-3">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                                    </span>
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400 animate-pulse">
                                        {progressMessage || 'Analyzing requirements...'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {[...displayVersions].reverse().map((version, index) => {
                        const isLatest = index === 0;
                        const isExpanded = isLatest || expandedVersionIds.has(version.id);

                        return (
                            <div key={version.id} className="relative pl-8 md:pl-12 animate-in fade-in slide-in-from-top-4 duration-500 group">
                                {/* Timeline Node */}
                                <div className={cn(
                                    "absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-4 shadow-sm z-10 transition-colors",
                                    isExpanded ? "bg-white dark:bg-zinc-950 border-indigo-600" : "bg-slate-200 dark:bg-zinc-800 border-slate-300 dark:border-zinc-700"
                                )} />

                                {/* Date Header */}
                                <div className="flex items-center gap-2 mb-3 select-none">
                                    <span className="text-xs font-mono font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Clock className="w-3 h-3" />
                                        {version.created_at ? new Date(version.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Just now'}
                                    </span>
                                </div>

                                {/* Content Card */}
                                <div
                                    onClick={() => !isLatest && toggleVersion(version.id)}
                                    className={cn(
                                        "bg-white dark:bg-zinc-900 border rounded-2xl shadow-sm ring-1 ring-slate-900/5 transition-all overflow-hidden",
                                        isExpanded
                                            ? "border-slate-200 dark:border-zinc-800 p-5 md:p-6"
                                            : "border-slate-100 dark:border-zinc-800/60 p-4 cursor-pointer hover:border-slate-300 dark:hover:border-zinc-700 hover:shadow-md"
                                    )}
                                >

                                    {/* User Request */}
                                    <div className={cn(
                                        "flex items-start justify-between gap-4",
                                        isExpanded && "mb-6 pb-6 border-b border-slate-100 dark:border-zinc-800/50"
                                    )}>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 select-none">
                                                <div className="w-5 flex justify-center">
                                                    <span className={cn("w-1.5 h-1.5 rounded-full", isExpanded ? "bg-slate-400 dark:bg-slate-600" : "bg-slate-300 dark:bg-zinc-700")} />
                                                </div>
                                                Request
                                            </h4>
                                            <div className={cn(
                                                "font-medium whitespace-pre-wrap text-slate-800 dark:text-slate-200 pl-7",
                                                isExpanded ? "text-base leading-relaxed" : "text-sm truncate text-slate-600 dark:text-slate-400"
                                            )}>
                                                {version.prompt}
                                            </div>
                                        </div>
                                        {!isExpanded && (
                                            <ChevronDown className="w-4 h-4 text-slate-400" />
                                        )}
                                        {isExpanded && !isLatest && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleVersion(version.id); }}
                                                className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400 transition-colors"
                                            >
                                                <ChevronUp className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    {/* AI Result - Only show if expanded */}
                                    {isExpanded && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <h4 className="flex items-center gap-2 text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-3 select-none">
                                                <div className="w-5 flex justify-center">
                                                    <Sparkles className="w-3.5 h-3.5" />
                                                </div>
                                                Result
                                                {version.version && (
                                                    <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-full border border-indigo-100 dark:border-indigo-800/30 text-indigo-600 dark:text-indigo-400 font-mono">
                                                        v{version.version}
                                                    </span>
                                                )}
                                            </h4>

                                            {version.status === 'failed' ? (
                                                <div className="pl-7">
                                                    <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
                                                        {version.error || 'Generation failed.'}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-4 pl-7">
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                                        {version.summary || "The AI has generated the extension manifest and files based on your request."}
                                                    </p>
                                                    <ResultCard extension={version} onDownload={onDownload} />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
