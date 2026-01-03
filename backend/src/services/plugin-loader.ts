
import fs from 'fs';
import path from 'path';

export interface PluginManifest {
    id: string;
    version: string;
    type: 'template' | 'rules' | 'persona';
    content: any;
}

export class PluginLoader {
    private static plugins: Map<string, PluginManifest> = new Map();

    /**
     * Loads plugins from a specified directory.
     * WARNING: This uses dynamic imports and should be used cautiously.
     */
    static async loadPlugins(directory: string): Promise<void> {
        if (!fs.existsSync(directory)) {
            console.warn(`[PluginLoader] Directory not found: ${directory}`);
            return;
        }

        const files = fs.readdirSync(directory);
        for (const file of files) {
            if (file.endsWith('.js') || file.endsWith('.json')) {
                try {
                    const fullPath = path.join(directory, file);
                    let content;

                    if (file.endsWith('.json')) {
                        content = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
                    } else {
                        // Dynamic import for JS modules
                        content = await import(fullPath);
                    }

                    if (content.default) content = content.default;

                    if (this.validatePlugin(content)) {
                        this.plugins.set(content.id, content);
                        console.log(`[PluginLoader] Loaded plugin: ${content.id} (${content.type})`);
                    } else {
                        console.warn(`[PluginLoader] Skipped invalid plugin: ${file}`);
                    }
                } catch (e) {
                    console.error(`[PluginLoader] Failed to load ${file}:`, e);
                }
            }
        }
    }

    private static validatePlugin(plugin: any): plugin is PluginManifest {
        return plugin && typeof plugin.id === 'string' && typeof plugin.type === 'string' && plugin.content;
    }

    static getPlugin(id: string): PluginManifest | undefined {
        return this.plugins.get(id);
    }

    static getAllPlugins(): PluginManifest[] {
        return Array.from(this.plugins.values());
    }

    static getPluginsByType(type: string): PluginManifest[] {
        return this.getAllPlugins().filter(p => p.type === type);
    }
}
