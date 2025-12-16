


export function DashboardSkeleton() {
    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-zinc-950 p-6 relative">
            <div className="max-w-7xl mx-auto space-y-6 relative z-10 animate-pulse">
                <div className="h-8 w-48 bg-slate-200 dark:bg-white/5 rounded-lg" />

                {/* 1. Summary Stats Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-24 bg-slate-200 dark:bg-white/5 rounded-2xl" />
                    ))}
                </div>

                {/* 2. Middle Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 h-64 bg-slate-100 dark:bg-white/5 rounded-2xl" />
                    <div className="lg:col-span-1 h-64 bg-slate-100 dark:bg-white/5 rounded-2xl" />
                </div>

                {/* 3. Bottom Table */}
                <div className="h-64 bg-slate-100 dark:bg-white/5 rounded-2xl" />
            </div>
        </div>
    );
}
