import { useState } from 'react';
import type { Blueprint } from '../../../types';
import { Shield, Layout, CheckCircle, Play, X } from 'lucide-react';

interface BlueprintEditorProps {
    blueprint: Blueprint;
    onConfirm: (blueprint: Blueprint) => void;
    onCancel: () => void;
}

export function BlueprintEditor({ blueprint, onConfirm, onCancel }: BlueprintEditorProps) {
    const [editedBlueprint, setEditedBlueprint] = useState<Blueprint>(blueprint);
    const [activeTab, setActiveTab] = useState<'general' | 'permissions' | 'logic' | 'ui'>('general');

    const handleSave = () => {
        onConfirm(editedBlueprint);
    };

    const handleChange = (field: keyof Blueprint, value: any) => {
        setEditedBlueprint((prev: Blueprint) => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* ... Header ... */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
                        <Layout className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Extension Blueprint</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Review the architectural plan before building.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onCancel}
                        className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-zinc-800">
                {['general', 'permissions', 'logic', 'ui'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-zinc-950/50">
                {activeTab === 'general' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">User Intent (Summary)</label>
                            <textarea
                                value={editedBlueprint.user_intent}
                                onChange={(e) => handleChange('user_intent', e.target.value)}
                                className="w-full h-24 p-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Implementation Strategy</label>
                            <textarea
                                value={editedBlueprint.implementation_strategy || ''}
                                onChange={(e) => handleChange('implementation_strategy', e.target.value)}
                                className="w-full h-32 p-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                placeholder="High-level technical approach..."
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'permissions' && (
                    <div className="space-y-4">
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg flex gap-3">
                            <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Security Review</h3>
                                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">Review requested permissions carefully. Minimize permissions for better security and user trust.</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Requested Permissions</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {editedBlueprint.permissions.map((perm: string, idx: number) => (
                                    <span key={idx} className="px-2 py-1 bg-slate-200 dark:bg-zinc-700 text-slate-900 dark:text-slate-100 rounded text-xs font-mono flex items-center gap-1 group">
                                        {perm}
                                        <button
                                            onClick={() => {
                                                const newPerms = editedBlueprint.permissions.filter((_: string, i: number) => i !== idx);
                                                handleChange('permissions', newPerms);
                                            }}
                                            className="hover:text-red-500"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                                <button
                                    onClick={() => {
                                        const p = prompt("Add permission (e.g. 'storage'):");
                                        if (p) handleChange('permissions', [...editedBlueprint.permissions, p]);
                                    }}
                                    className="px-2 py-1 border border-dashed border-slate-300 dark:border-zinc-600 rounded text-xs text-slate-500 hover:text-indigo-500 hover:border-indigo-500 transition-colors"
                                >
                                    + Add
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Reasoning</label>
                            <textarea
                                value={editedBlueprint.permissions_reasoning}
                                onChange={(e) => handleChange('permissions_reasoning', e.target.value)}
                                className="w-full h-32 p-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'logic' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Background Script Instructions</label>
                            <textarea
                                value={editedBlueprint.background_instructions}
                                onChange={(e) => handleChange('background_instructions', e.target.value)}
                                className="w-full h-32 p-3 font-mono text-xs rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Content Script Instructions</label>
                            <textarea
                                value={editedBlueprint.content_instructions || ''}
                                onChange={(e) => handleChange('content_instructions', e.target.value)}
                                className="w-full h-32 p-3 font-mono text-xs rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                placeholder="No content script instructions..."
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'ui' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Popup / UI Instructions</label>
                            <textarea
                                value={editedBlueprint.popup_instructions}
                                onChange={(e) => handleChange('popup_instructions', e.target.value)}
                                className="w-full h-32 p-3 font-mono text-xs rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Use Manifest V3 logic?</label>
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span>Checked: Interactivity & State Management</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-end gap-3">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors font-medium"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-all font-medium flex items-center gap-2"
                >
                    <Play className="w-4 h-4 fill-current" />
                    Build Extension
                </button>
            </div>
        </div>
    );
}
