
// import { PluginLoader } from '../services/plugin-loader';
// import path from 'path';

let initialized = false;

export async function bootstrap() {
    if (initialized) return;

    try {
        console.log('[Bootstrap] Starting application initialization...');

        // Plugin loading disabled for Edge compatibility
        // const pluginDir = path.resolve(process.cwd(), 'plugins');
        // await PluginLoader.loadPlugins(pluginDir);

        console.log('[Bootstrap] Initialization complete.');
        initialized = true;
    } catch (error) {
        console.error('[Bootstrap] Initialization failed (Non-fatal):', error);
        initialized = true;
    }
}
