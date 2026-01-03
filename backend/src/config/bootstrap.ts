
import { PluginLoader } from '../services/plugin-loader';
import path from 'path';

let initialized = false;

export async function bootstrap() {
    if (initialized) return;

    try {
        console.log('[Bootstrap] Starting application initialization...');

        // Determine plugin directory (default to ./plugins relative to CWD)
        // In a worker, this might not resolve correctly or fs might fail, 
        // so we wrap strictly.
        const pluginDir = path.resolve(process.cwd(), 'plugins');

        console.log(`[Bootstrap] Attempting to load plugins from: ${pluginDir}`);
        await PluginLoader.loadPlugins(pluginDir);

        console.log('[Bootstrap] Initialization complete.');
        initialized = true;
    } catch (error) {
        console.error('[Bootstrap] Initialization failed (Non-fatal):', error);
        // We don't re-throw because core functionality should still work without plugins
        initialized = true; // Prevent retry loops on every request
    }
}
