import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils';

export function StickyBackLink() {
    const [isVisible, setIsVisible] = useState(false);
    const [lastScrollY, setLastScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // Show if scrolling UP and we are down the page (passed the static link)
            // Hide if scrolling DOWN or if we are at the top
            if (currentScrollY < lastScrollY && currentScrollY > 200) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }

            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    return (
        <div className={cn(
            "fixed top-4 left-6 z-40 transition-all duration-300 transform",
            isVisible ? "translate-y-0 opacity-100" : "-translate-y-16 opacity-0 pointer-events-none"
        )}>
            <Link
                to="/"
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-slate-200 dark:border-zinc-800 shadow-sm text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 dark:hover:border-indigo-500/30 transition-all hover:scale-105"
            >
                <ArrowLeft size={16} />
                <span>Back</span>
            </Link>
        </div>
    );
}
