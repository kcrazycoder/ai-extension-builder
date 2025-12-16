import { Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header } from './layout/Header';
import { Footer } from './layout/Footer';
import { StickyBackLink } from './ui/StickyBackLink';

export function PlansPage() {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-slate-200 font-sans selection:bg-indigo-500/30">
            <Header />
            <StickyBackLink />

            <main className="flex-1 max-w-5xl mx-auto w-full px-6 pt-32 pb-20">
                <div className="mb-12 text-center max-w-2xl mx-auto">
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-slate-900 dark:text-white">
                        Choose your Plan
                    </h1>
                    <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
                        Simple, transparent pricing. Start for free, upgrade for power.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {/* Hobby Plan */}
                    <div className="relative p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col">
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Hobby</h3>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-extrabold text-slate-900 dark:text-white">$0</span>
                                <span className="text-slate-500 dark:text-slate-500">/month</span>
                            </div>
                            <p className="mt-4 text-slate-600 dark:text-slate-400 text-sm">
                                Perfect for experimenting and building your first extensions.
                            </p>
                        </div>

                        <div className="flex-1 space-y-4 mb-8">
                            <PlanFeature>5 generations per day</PlanFeature>
                            <PlanFeature>Standard generation speed</PlanFeature>
                            <PlanFeature>Community usage</PlanFeature>
                        </div>

                        <Link
                            to="/"
                            className="block w-full py-3 px-6 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white font-semibold text-center hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                            Start Building Free
                        </Link>
                    </div>

                    {/* Pro Plan */}
                    <div className="relative p-8 rounded-3xl bg-white dark:bg-zinc-900 border-2 border-indigo-500/20 dark:border-indigo-500/30 shadow-xl shadow-indigo-500/10 flex flex-col">
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg">
                            Most Popular
                        </div>

                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Pro</h3>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-extrabold text-slate-900 dark:text-white">$19</span>
                                <span className="text-slate-500 dark:text-slate-500">/month</span>
                            </div>
                            <p className="mt-4 text-slate-600 dark:text-slate-400 text-sm">
                                For serious builders who need speed and advanced features.
                            </p>
                        </div>

                        <div className="flex-1 space-y-4 mb-8">
                            <PlanFeature check>Unlimited generations</PlanFeature>
                            <PlanFeature check>Priority generation queue</PlanFeature>
                            <PlanFeature check>Fastest generation speed</PlanFeature>
                        </div>

                        <div
                            className="block w-full py-3 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-center opacity-80"
                        >
                            Coming Soon
                        </div>
                    </div>
                </div>

                <div className="mt-16 text-center">
                    <p className="text-sm text-slate-500 dark:text-slate-500">
                        Have questions? <a href="mailto:support@extn.ai" className="text-indigo-600 dark:text-indigo-400 hover:underline">Contact us</a>
                    </p>
                </div>
            </main>

            <Footer />
        </div>
    );
}

function PlanFeature({ children, check = true }: { children: React.ReactNode, check?: boolean }) {
    return (
        <div className="flex items-start gap-3 text-sm">
            <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${check ? 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400' : 'bg-slate-100 text-slate-400 dark:bg-zinc-800'}`}>
                {check ? <Check size={12} strokeWidth={3} /> : <X size={12} />}
            </div>
            <span className="text-slate-700 dark:text-slate-300">{children}</span>
        </div>
    );
}
