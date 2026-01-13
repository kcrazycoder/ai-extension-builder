import React, { useState, useEffect } from 'react';
import { FileTree } from './FileTree';
import { CodeEditor } from './CodeEditor';
import { type VirtualFiles, getLanguageFromFilename } from '../../utils/fileSystem';
import { Save, TerminalSquare } from 'lucide-react';
import { ConsolePanel, type LogEntry } from './ConsolePanel';

interface EditorLayoutProps {
    files: VirtualFiles;
    onChange?: (filename: string, content: string) => void;
    onApplyEdits?: () => void;
    readOnly?: boolean;
    logs?: LogEntry[];
    onClearLogs?: () => void;
}

export const EditorLayout: React.FC<EditorLayoutProps> = ({
    files,
    onChange,
    onApplyEdits,
    readOnly = false,
    logs = [],
    onClearLogs = () => { }
}) => {
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [showConsole, setShowConsole] = useState(true);

    // Select first relevant file on load (manifest or background)
    useEffect(() => {
        if (!selectedFile && Object.keys(files).length > 0) {
            const priority = ['manifest.json', 'README.md', 'background.js', 'popup.html'];
            const hit = priority.find(f => files[f]);
            if (hit) setSelectedFile(hit);
            else setSelectedFile(Object.keys(files)[0]);
        }
    }, [files, selectedFile]);

    const handleContentChange = (newContent: string | undefined) => {
        if (selectedFile && newContent !== undefined && onChange) {
            onChange(selectedFile, newContent);
        }
    };

    const fileKeys = Object.keys(files);

    // Determine current content and language
    const currentContent = selectedFile ? files[selectedFile] || '' : '';
    const currentLanguage = selectedFile ? getLanguageFromFilename(selectedFile) : 'plaintext';

    // Check if binary (simple heuristic)
    const isBinary = selectedFile?.match(/\.(png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot)$/i);

    return (
        <div className="flex flex-1 h-full overflow-hidden bg-[#1e1e1e] text-white">
            {/* File Tree Sidebar */}
            <FileTree
                files={fileKeys}
                selectedFile={selectedFile}
                onSelect={setSelectedFile}
                className="w-64 border-r border-[#333]"
            />

            {/* Main Editor Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Tab/Header */}
                <div className="h-9 flex items-center justify-between bg-[#1e1e1e] border-b border-[#333] px-4">
                    <span className="text-sm text-gray-400 font-medium">
                        {selectedFile || 'No file selected'}
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowConsole(!showConsole)}
                            className={`p-1 rounded hover:bg-white/10 transition-colors ${showConsole ? 'text-white' : 'text-gray-500'}`}
                            title="Toggle Console"
                        >
                            <TerminalSquare size={16} />
                        </button>

                        {onApplyEdits && (
                            <button
                                onClick={onApplyEdits}
                                className="flex items-center gap-2 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium transition-colors"
                                title="Apply manual edits using AI"
                            >
                                <Save size={14} />
                                <span>Apply Changes</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Split View: Editor (Top) / Console (Bottom) */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Editor Segment */}
                    <div className={`flex-1 relative min-h-0`}>
                        {selectedFile ? (
                            isBinary ? (
                                <div className="flex items-center justify-center h-full flex-col gap-4 text-gray-500">
                                    <p>Binary file cannot be edited.</p>
                                    {selectedFile.match(/\.(png|jpg|jpeg|gif|ico)$/i) && (
                                        <div className="p-4 border border-dashed border-gray-700 rounded">
                                            [Image Preview Not Implemented Yet]
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <CodeEditor
                                    key={selectedFile} // Force re-mount on file change to reset history/state
                                    code={currentContent}
                                    language={currentLanguage}
                                    onChange={handleContentChange}
                                    readOnly={readOnly}
                                    theme="vs-dark"
                                />
                            )
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-600">
                                Select a file to view
                            </div>
                        )}
                    </div>

                    {/* Console Segment */}
                    {showConsole && (
                        <ConsolePanel
                            logs={logs}
                            onClear={onClearLogs}
                            height={200}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
