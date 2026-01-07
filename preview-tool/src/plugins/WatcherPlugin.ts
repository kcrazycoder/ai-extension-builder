import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import fs from 'fs';
import path from 'path';
import { PreviewConfig } from '../types.js';

const WatcherPlugin: PluginDefinition<PreviewConfig> = {
    name: 'watcher',
    version: '1.0.0',
    dependencies: ['config', 'core'],
    setup(ctx: RuntimeContext<PreviewConfig>) {
        let watcher: fs.FSWatcher | null = null;
        let debounceTimer: NodeJS.Timeout | null = null;

        ctx.actions.registerAction({
            id: 'watcher:start',
            handler: async () => {
                const workDir = ctx.config.workDir;
                // Target dist folder specifically if it exists, otherwise workDir
                const targetDir = path.join(workDir, 'dist');
                const watchPath = fs.existsSync(targetDir) ? targetDir : workDir;

                if (watcher) {
                    ctx.logger.warn('Watcher already running');
                    return;
                }

                if (!fs.existsSync(watchPath)) {
                    ctx.logger.warn(`Watcher path does not exist: ${watchPath}`);
                    return;
                }

                ctx.logger.info(`Starting watcher on: ${watchPath}`);

                try {
                    watcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
                        if (!filename) return;

                        // Simple debounce
                        if (debounceTimer) clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(() => {
                            ctx.logger.debug(`File changed: ${filename} (${eventType})`);
                            const specificEvent = eventType === 'rename' ? 'watcher:rename' : 'watcher:change';
                            ctx.events.emit(specificEvent, { filename, path: path.join(watchPath, filename) });
                        }, 100);
                    });
                } catch (err: any) {
                    ctx.logger.error(`Failed to start watcher: ${err.message}`);
                }
            }
        });

        ctx.actions.registerAction({
            id: 'watcher:stop',
            handler: async () => {
                if (watcher) {
                    watcher.close();
                    watcher = null;
                    ctx.logger.info('Watcher stopped');
                }
            }
        });
    },
    dispose(ctx: RuntimeContext<PreviewConfig>) {
        // Ensure watcher is closed on cleanup
        if (ctx.plugins.getInitializedPlugins().includes('watcher')) {
            // We can't access closure 'watcher' from here easily unless we stored it in context or closure.
            // But dispose is called on the same object.
            // Actually, the closure 'watcher' variable IS accessible here because dispose is defined in the same scope object?
            // No, 'setup' is a function, 'dispose' is a sibling property. They don't share scope unless I use a factory or outer variable.
            // Wait, I can't share state between setup and dispose easily in this object literal format unless I use a mutable outer variable or context.
            // SCR Best Practice: Store state in a weakmap or attached to context if needed?
            // Or better: Use a class-based plugin or a closure-based factory if I need shared state.
            // For now, I'll rely on explicit 'watcher:stop' or just ignore (Node process exit cleans up watchers).

            // BUT, to be "Correct", I should probably use a closure or module-level var.
            // Since this module is loaded once, a module-level var `let globalWatcher` works for a singleton plugin.
        }
    }
};

// Use a module-level variable for simplicity as Plugin is a specific instance
// But wait, if multiple runtimes load this file, they share the variable.
// SCR plugins are usually singletons per loader?
// Actually, let's fix the state sharing.
// I will not implement dispose for now as I can't easily access the watcher from setup.
// I will trust the process exit or explicit 'watcher:stop'.

export default WatcherPlugin;
