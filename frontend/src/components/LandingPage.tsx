
import { useState } from 'react';
import { Moon, Sun, Sparkles, Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getLoginUrl } from '../api';

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
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                        E
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

                    <div className="pt-4">
                        <button
                            onClick={handleLogin}
                            disabled={isLoading}
                            className="cursor-pointer group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white transition-all duration-300 ease-out bg-blue-600 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 dark:focus:ring-offset-zinc-900 shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 hover:scale-110 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Sending Code...
                                </>
                            ) : (
                                <>
                                    Send Login Code
                                    <svg
                                        className="w-5 h-5 ml-2 -mr-1 transition-all duration-300 group-hover:translate-x-2"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </>
                            )}
                        </button>
                        <p className="mt-4 text-sm text-slate-500 dark:text-slate-500">
                            No credit card required · Open Source
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
