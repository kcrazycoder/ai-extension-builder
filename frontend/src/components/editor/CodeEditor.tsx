import React from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';

interface CodeEditorProps {
    code: string;
    language: string;
    onChange?: (value: string | undefined) => void;
    readOnly?: boolean;
    theme?: 'vs-dark' | 'light';
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
    code,
    language,
    onChange,
    readOnly = false,
    theme = 'vs-dark' // Default to dark as our app seems to be dark mode oriented or we want professional look
}) => {
    const handleEditorDidMount: OnMount = (_editor, monaco) => {
        // You can customize the editor here if needed
        // e.g. editor.focus();

        // Optional: Configure compiler options for better intellisense if we had types
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
            noSyntaxValidation: false,
        });
    };

    return (
        <div className="h-full w-full overflow-hidden rounded-lg border border-gray-700 bg-[#1e1e1e]">
            <Editor
                height="100%"
                width="100%"
                language={language}
                value={code}
                theme={theme}
                onChange={onChange}
                onMount={handleEditorDidMount}
                options={{
                    readOnly,
                    minimap: { enabled: true },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                    wordWrap: 'on',
                    automaticLayout: true,
                    padding: { top: 16, bottom: 16 },
                }}
            />
        </div>
    );
};
