import React, { useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface InputAreaProps {
    prompt: string;
    setPrompt: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    isGenerating: boolean;
    isLoading?: boolean;
    components?: string[];
    setComponents?: (components: string[]) => void;
}

export function InputArea({ prompt, setPrompt, onSubmit, isGenerating, isLoading, components, setComponents }: InputAreaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
        }
    }, [prompt]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (prompt.trim() && !isGenerating) {
                onSubmit(e);
            }
        }
    };

    const [globalCooldown, setGlobalCooldown] = React.useState<number | null>(null);

    // Global Cooldown Logic
    useEffect(() => {
        const checkGlobalCooldown = () => {
            const stored = localStorage.getItem('global_cooldown');
            if (stored) {
                const expiry = parseInt(stored, 10);
                const remaining = Math.ceil((expiry - Date.now()) / 1000);
                if (remaining > 0) {
                    setGlobalCooldown(remaining);
                } else {
                    setGlobalCooldown(null);
                    localStorage.removeItem('global_cooldown');
                }
            } else {
                setGlobalCooldown(null);
            }
        };

        checkGlobalCooldown();

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'global_cooldown') checkGlobalCooldown();
        };
        const handleCustomUpdate = () => checkGlobalCooldown();

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('global-cooldown-update', handleCustomUpdate);

        const interval = setInterval(() => {
            setGlobalCooldown(prev => {
                if (prev === null) return null;
                if (prev <= 1) {
                    localStorage.removeItem('global_cooldown'); // Cleanup
                    return null;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('global-cooldown-update', handleCustomUpdate);
            clearInterval(interval);
        };
    }, []);

    return (
        <div className="w-full px-4 pb-4 md:px-8 md:pb-8 relative z-20">
            {/* Fade Gradient Overlay */}
            <div className="absolute -top-12 left-0 right-0 h-12 bg-gradient-to-t from-slate-50 dark:from-zinc-950 to-transparent pointer-events-none" />

            <div className="max-w-2xl mx-auto relative">
                <div className="transition-all duration-300 ease-in-out">
                    <form onSubmit={onSubmit} className="relative">
                        <div className={cn(
                            "relative flex items-end gap-2 bg-white dark:bg-zinc-900/90 backdrop-blur-sm border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm transition-all duration-300 ease-out p-3",
                            !globalCooldown && "hover:shadow-md focus-within:shadow-xl focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10",
                            globalCooldown && "opacity-80 bg-slate-50 dark:bg-zinc-900/50"
                        )}>
                            <div className="flex-1 relative min-h-[68px]">
                                {isLoading && (
                                    <div className="absolute inset-0 z-10 space-y-2 pt-3.5 pb-3.5">
                                        <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-3/4 animate-pulse" />
                                        <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-1/2 animate-pulse" />
                                    </div>
                                )}
                                <textarea
                                    ref={textareaRef}
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={globalCooldown
                                        ? `Rate limit active. Please wait ${Math.floor(globalCooldown / 60)}:${(globalCooldown % 60).toString().padStart(2, '0')}...`
                                        : "Enter extension requirements and commands..."
                                    }
                                    className={cn(
                                        "w-full bg-transparent border-0 outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none py-2.5 max-h-[200px] overflow-y-auto scrollbar-hide min-h-[68px]",
                                        isLoading && "opacity-0",
                                        globalCooldown && "cursor-not-allowed placeholder:text-red-400/70"
                                    )}
                                    rows={1}
                                    disabled={isGenerating || isLoading || !!globalCooldown}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isGenerating || !prompt.trim() || !!globalCooldown}
                                className={cn(
                                    "p-2 rounded-lg transition-all flex-shrink-0 mb-0.5",
                                    isGenerating || !prompt.trim() || !!globalCooldown
                                        ? "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600"
                                        : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg",
                                    !!globalCooldown && "w-16 flex justify-center bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400"
                                )}
                            >
                                {isGenerating ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : globalCooldown ? (
                                    <span className="text-xs font-mono font-medium">
                                        {Math.floor(globalCooldown / 60)}:{globalCooldown % 60 < 10 ? '0' : ''}{globalCooldown % 60}
                                    </span>
                                ) : (
                                    <Send className="w-5 h-5" />
                                )}
                            </button>
                        </div>

                        <div className="flex items-center justify-between mt-2 px-1">
                            <div className="flex items-center gap-2">
                                {/* Component Selector */}
                                {setComponents && (
                                    <div className="relative group">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (components?.includes('auth-supabase')) {
                                                    setComponents(components.filter(c => c !== 'auth-supabase'));
                                                } else {
                                                    setComponents([...(components || []), 'auth-supabase']);
                                                }
                                            }}
                                            className={cn(
                                                "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors border",
                                                components?.includes('auth-supabase')
                                                    ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
                                                    : "bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 border-transparent hover:bg-slate-100 dark:hover:bg-zinc-800"
                                            )}
                                        >
                                            <span className={cn("w-2 h-2 rounded-full", components?.includes('auth-supabase') ? "bg-indigo-500" : "bg-slate-300 dark:bg-zinc-600")} />
                                            Auth (Supabase)
                                        </button>
                                        <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                            Injects ready-to-use Supabase Auth hooks and login UI.
                                        </div>
                                    </div>
                                )}
                            </div>

                            <p className="text-center text-xs text-slate-400 dark:text-zinc-600">
                                AI can make mistakes. Please review.
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
