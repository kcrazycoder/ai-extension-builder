
import { Link } from 'react-router-dom';


export function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="mt-auto py-8">
            <div className="mx-auto max-w-7xl px-6 flex flex-col items-center justify-center gap-4">
                <div className="flex items-center gap-6 text-xs font-medium text-zinc-400 dark:text-zinc-600 tracking-wide uppercase">
                    <Link to="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">Terms</Link>
                    <Link to="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">Privacy</Link>
                    <Link to="/license" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">License</Link>
                    <span className="text-zinc-300 dark:text-zinc-800">/</span>
                    <a href="https://github.com/kcrazycoder/ai-extension-builder" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">
                        GitHub
                    </a>
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-700">
                    &copy; {currentYear} EXTN.
                </p>
            </div>
        </footer>
    );
}
