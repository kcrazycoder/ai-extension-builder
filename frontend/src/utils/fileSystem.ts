import JSZip from 'jszip';

export type VirtualFiles = Record<string, string>;

/**
 * Unzips a Blob (Extension ZIP) into a map of filenames to content strings.
 * Used for populating the Code Editor.
 */
export async function unzipToMemory(blob: Blob): Promise<VirtualFiles> {
    try {
        const zip = await JSZip.loadAsync(blob);
        const files: VirtualFiles = {};

        const promises: Promise<void>[] = [];

        zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir) {
                promises.push(
                    zipEntry.async('string').then((content) => {
                        files[relativePath] = content;
                    })
                );
            }
        });

        await Promise.all(promises);
        return files;
    } catch (error) {
        console.error('Failed to unzip blob:', error);
        throw new Error('Failed to load extension files.');
    }
}

/**
 * Helper to determine basic language from filename extension.
 * Useful for Monaco Editor language selection.
 */
export function getLanguageFromFilename(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
            return 'javascript'; // Monaco usually handles JS/TS well with 'javascript' or 'typescript'
        case 'html':
            return 'html';
        case 'css':
            return 'css';
        case 'json':
            return 'json';
        case 'md':
            return 'markdown';
        default:
            return 'plaintext';
    }
}
