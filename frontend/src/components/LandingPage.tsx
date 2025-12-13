
import { useState } from 'react';
import { Moon, Sun, Sparkles, Cpu } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getLoginUrl } from '../api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Link } from 'react-router-dom';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function LandingPage() {
    const { resolvedTheme, setTheme } = useTheme();
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = () => {
        setIsLoading(true);
        window.location.href = getLoginUrl();
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950 transition-colors duration-300">
            {/* Header */}
            <header className="px-6 py-4 flex justify-between items-center border-b border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                        <Cpu className="w-5 h-5" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                        EXTN
                    </span>
                </div>

                <button
                    onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                    className="cursor-pointer p-2 rounded-full inline-flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-all duration-300 hover:scale-125 hover:rotate-12"
                    aria-label="Toggle theme"
                >
                    {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </header>

            {/* Hero Section */}
            <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 text-center bg-gradient-to-b from-transparent to-slate-100 dark:to-zinc-900/50">
                <style>{`
                    @keyframes gentleScale {
                        0%, 100% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(0.97); opacity: 0.7; }
                    }
                    .animate-gentle-scale {
                        animation: gentleScale 1.2s infinite ease-in-out;
                    }
                `}</style>
                <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium">
                        <Sparkles size={16} />
                        <span>AI-Powered Development</span>
                    </div>

                    <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                        Build Browser Extensions <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                            in Seconds
                        </span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-xl text-slate-600 dark:text-slate-400">
                        Turn your ideas into working Chrome extensions instantly.
                        No complex setup, just describe what you want and let AI handle the code.
                    </p>

                    {/* How It Works Steps */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 py-8">
                        {[
                            { step: '1', text: 'Describe your idea' },
                            { step: '2', text: 'AI generates code' },
                            { step: '3', text: 'Download & Install' },
                        ].map((item, i) => (
                            <div key={i} className="flex flex-col items-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 shadow-sm">
                                    {item.step}
                                </div>
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    {item.text}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="pt-2">
                        <button
                            onClick={handleLogin}
                            disabled={isLoading}
                            className={cn(
                                "cursor-pointer group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-full transition-colors border-2 border-transparent min-w-[220px]",
                                isLoading
                                    ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 ring-4 ring-indigo-500/20 animate-gentle-scale"
                                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/30"
                            )}
                        >
                            {isLoading ? "Redirecting" : (
                                <>
                                    Start Building
                                    <svg
                                        className="w-5 h-5 ml-2 -mr-1 transition-transform group-hover:translate-x-1"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </>
                            )}
                        </button>

                    </div>
                </div>
            </main>

            <footer className="py-8 border-t border-slate-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                    <p>&copy; {new Date().getFullYear()} EXTN. Open Source Project.</p>
                    <div className="flex flex-wrap justify-center gap-6">
                        <Link to="/terms" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Terms of Service</Link>
                        <Link to="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Privacy Policy</Link>
                        <Link to="/license" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">License</Link>
                        <a href="https://github.com/kcrazycoder/ai-extension-builder" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">GitHub</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
