
import { Cpu, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { Link } from 'react-router-dom';
// Wait, LandingPage defined cn locally. I should check if there is a shared utility.
// I saw 'clsx' and 'tailwind-merge' in LandingPage.
// Let's assume I should move that utility or just redefine it if it's not shared.
// Actually, I'll check for a utils file first in my next step, but for now I will define it or import closely.
// Looking at file list, there isn't a top level utils.ts. 
// I'll inline the cn function or create a utils file. Creating a utils file is better practice.

export function Header() {
    const { resolvedTheme, setTheme } = useTheme();

    return (
        <header className="absolute top-0 left-0 z-50 w-full pt-6">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
                <Link to="/" className="flex items-center gap-3 group cursor-pointer">
                    <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 transition-transform duration-300 group-hover:scale-105">
                        <Cpu className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold tracking-widest uppercase text-zinc-900 dark:text-white">
                        Extn
                    </span>
                </Link>

                <div className="flex items-center gap-6">
                    <Link to="/plans" className="text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                        Plans
                    </Link>

                    <button
                        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                        className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                        aria-label="Toggle theme"
                    >
                        {resolvedTheme === 'dark' ? (
                            <Sun size={18} />
                        ) : (
                            <Moon size={18} />
                        )}
                    </button>

                    {/* Optional: Add a small Login button if this is used on pages where user isn't logged in, 
                         but for now keeping it clean as per original design + enhancements */}
                </div>
            </div>
        </header>
    );
}
