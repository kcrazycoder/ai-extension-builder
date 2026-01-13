import React, { useMemo, useState } from 'react';
import {
    File,
    FileJson,
    FileCode,
    FileImage,
    Folder,
    FolderOpen,
    ChevronRight,
    ChevronDown
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface FileTreeProps {
    files: string[];
    selectedFile: string | null;
    onSelect: (filename: string) => void;
    className?: string;
}

// Helper to check file type for icon
const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'json': return <FileJson size={16} className="text-yellow-400" />;
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx': return <FileCode size={16} className="text-blue-400" />;
        case 'html': return <FileCode size={16} className="text-orange-400" />;
        case 'css': return <FileCode size={16} className="text-pink-400" />;
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'svg': return <FileImage size={16} className="text-purple-400" />;
        default: return <File size={16} className="text-gray-400" />;
    }
};

interface TreeNode {
    name: string;
    path: string; // Full path
    type: 'file' | 'directory';
    children?: Record<string, TreeNode>;
}

export const FileTree: React.FC<FileTreeProps> = ({ files, selectedFile, onSelect, className }) => {

    // Build Tree Structure
    const tree = useMemo(() => {
        const root: Record<string, TreeNode> = {};

        files.sort().forEach(filepath => {
            const parts = filepath.split('/');
            let currentLevel = root;

            parts.forEach((part, index) => {
                const isFile = index === parts.length - 1;
                const currentPath = parts.slice(0, index + 1).join('/');

                if (!currentLevel[part]) {
                    currentLevel[part] = {
                        name: part,
                        path: currentPath,
                        type: isFile ? 'file' : 'directory',
                        children: isFile ? undefined : {}
                    };
                }

                if (!isFile) {
                    currentLevel = currentLevel[part].children!;
                }
            });
        });

        return root;
    }, [files]);

    return (
        <div className={twMerge("w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800 overflow-y-auto", className)}>
            <div className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Files
            </div>
            <div className="px-2">
                <TreeLevel
                    nodes={tree}
                    selectedFile={selectedFile}
                    onSelect={onSelect}
                />
            </div>
        </div>
    );
};

const TreeLevel: React.FC<{
    nodes: Record<string, TreeNode>,
    selectedFile: string | null,
    onSelect: (path: string) => void,
    level?: number
}> = ({ nodes, selectedFile, onSelect, level = 0 }) => {
    // Sort: Directories first, then files
    const sortedNodes = Object.values(nodes).sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
    });

    return (
        <>
            {sortedNodes.map((node) => (
                <TreeNodeItem
                    key={node.path}
                    node={node}
                    selectedFile={selectedFile}
                    onSelect={onSelect}
                    level={level}
                />
            ))}
        </>
    );
};

const TreeNodeItem: React.FC<{
    node: TreeNode,
    selectedFile: string | null,
    onSelect: (path: string) => void,
    level: number
}> = ({ node, selectedFile, onSelect, level }) => {
    const [isOpen, setIsOpen] = useState(true); // Default open for better visibility

    const isSelected = selectedFile === node.path;

    const handleClick = () => {
        if (node.type === 'directory') {
            setIsOpen(!isOpen);
        } else {
            onSelect(node.path);
        }
    };

    return (
        <div>
            <div
                className={clsx(
                    "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer text-sm select-none transition-colors",
                    isSelected ? "bg-blue-600/20 text-blue-200" : "text-gray-300 hover:bg-gray-800",
                )}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={handleClick}
            >
                {/* Toggle / Spacer */}
                {node.type === 'directory' ? (
                    isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                ) : (
                    <span className="w-[14px]" />
                )}

                {/* Icon */}
                {node.type === 'directory' ? (
                    isOpen ? <FolderOpen size={16} className="text-yellow-500" /> : <Folder size={16} className="text-yellow-500" />
                ) : (
                    getFileIcon(node.name)
                )}

                {/* Name */}
                <span className="truncate">{node.name}</span>
            </div>

            {node.type === 'directory' && isOpen && node.children && (
                <TreeLevel
                    nodes={node.children}
                    selectedFile={selectedFile}
                    onSelect={onSelect}
                    level={level + 1}
                />
            )}
        </div>
    );
};
