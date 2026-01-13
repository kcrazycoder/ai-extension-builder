import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api';
import type { Extension } from '../types';
import { ArrowLeft, GitBranch, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { LoadingScreen } from './ui/LoadingScreen';

export function ProjectPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [lineage, setLineage] = useState<Extension[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        const loadData = async () => {
            try {
                const data = await apiClient.getLineage(id);
                setLineage(data);
            } catch (err: any) {
                console.error("Failed to load project:", err);
                setError(err.message || "Failed to load project history");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [id]);

    if (loading) return <LoadingScreen />;

    if (error || lineage.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <AlertTriangle className="w-12 h-12 mb-4 text-amber-500" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Project Not Found</h2>
                <p className="mb-6">{error || "This project does not exist or you don't have access."}</p>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    // The "Current" project is the one we requested, but we really want to show the HEAD of the lineage?
    // Or just show the lineage list.
    // Let's sort lineage by date descending (newest first)
    const sortedLineage = [...lineage].sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    const latest = sortedLineage[0];

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-950 overflow-y-auto">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-slate-500"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate max-w-xl">
                            {latest.name || latest.prompt || "Untitled Project"}
                        </h1>
                        <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                            <span className="font-mono bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs">
                                {sortedLineage.length} Versions
                            </span>
                            <span>•</span>
                            <span>Created {new Date(sortedLineage[sortedLineage.length - 1].createdAt || 0).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(`/?extId=${latest.id}`)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-sm transition-all flex items-center gap-2"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Open in Editor
                    </button>
                </div>
            </div>

            {/* Content - Timeline */}
            <div className="p-6 max-w-4xl mx-auto w-full">
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
                    <GitBranch className="w-5 h-5 text-indigo-500" />
                    Version History
                </h2>

                <div className="relative border-l-2 border-slate-200 dark:border-zinc-800 ml-3 space-y-8 pb-10">
                    {sortedLineage.map((ext) => (
                        <div key={ext.id} className="relative pl-8 group">
                            {/* Dot */}
                            <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-zinc-950 shadow-sm transition-colors ${ext.id === id ? 'bg-indigo-500 ring-4 ring-indigo-500/20' : 'bg-slate-300 dark:bg-zinc-700 group-hover:bg-indigo-400'
                                }`} />

                            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all">
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                                v{ext.version || '0.1.0'}
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                {new Date(ext.createdAt || 0).toLocaleString()}
                                            </span>
                                            {ext.status === 'completed' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                                            {ext.status === 'failed' && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                                        </div>

                                        <p className="text-slate-800 dark:text-slate-200 font-medium text-sm mb-2 line-clamp-2">
                                            {ext.prompt}
                                        </p>

                                        {ext.summary && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-zinc-950 p-2 rounded-lg border border-slate-100 dark:border-zinc-800">
                                                {ext.summary}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => navigate(`/?extId=${ext.id}`)}
                                            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                                        >
                                            View Code
                                        </button>

                                        {/* Future: Rollback button */}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
