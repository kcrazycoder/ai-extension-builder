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
}

export function InputArea({ prompt, setPrompt, onSubmit, isGenerating, isLoading }: InputAreaProps) {
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

    return (
        <div className="max-w-3xl mx-auto w-full p-4 relative">
            <form onSubmit={onSubmit} className="relative">
                <div className="relative flex items-end gap-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all p-3">
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
                            placeholder="Enter extension requirements and commands..."
                            className={cn(
                                "w-full bg-transparent border-0 outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none py-2.5 max-h-[200px] overflow-y-auto scrollbar-hide min-h-[68px]",
                                isLoading && "opacity-0"
                            )}
                            rows={1}
                            disabled={isGenerating || isLoading}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isGenerating || !prompt.trim()}
                        className={cn(
                            "p-2 rounded-lg transition-all flex-shrink-0 mb-0.5",
                            isGenerating || !prompt.trim()
                                ? "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600"
                                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg"
                        )}
                    >
                        {isGenerating ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </div>
                <p className="text-center text-xs text-slate-400 dark:text-zinc-600 mt-2">
                    AI can make mistakes. Please review the generated code before publishing.
                </p>
            </form>
        </div>
    );
}
