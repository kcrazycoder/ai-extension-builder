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
}

export function InputArea({ prompt, setPrompt, onSubmit, isGenerating }: InputAreaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'inherit';
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
                <div className="relative flex items-end gap-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all p-3">
                    <div className="flex-1 min-h-[44px]">
                        <textarea
                            ref={textareaRef}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Describe the Chrome extension you want to build..."
                            className="w-full bg-transparent border-0 outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none py-2.5 max-h-[200px] overflow-y-auto scrollbar-hide"
                            rows={1}
                            disabled={isGenerating}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isGenerating || !prompt.trim()}
                        className={cn(
                            "p-2 rounded-lg transition-all flex-shrink-0 mb-0.5",
                            isGenerating || !prompt.trim()
                                ? "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600"
                                : "bg-primary-600 hover:bg-primary-700 text-white shadow-md hover:shadow-lg"
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
