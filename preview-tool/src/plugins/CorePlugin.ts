import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import chalk from 'chalk';

export interface CoreConfig {
    host: string;
    token?: string;
    user?: string;
    jobId: string;
    workDir: string;
}

export const CorePlugin: PluginDefinition = {
    name: 'core',
    version: '1.0.0',
    setup(ctx: RuntimeContext) {
        console.log('CorePlugin: setup called');
        // We assume config is passed in hostContext
        const config = ctx.host.config as CoreConfig;

        ctx.actions.registerAction({
            id: 'core:config',
            handler: async () => config
        });

        console.log('CorePlugin: Registering core:log');
        ctx.actions.registerAction({
            id: 'core:log',
            handler: async (payload: { level: 'info' | 'error' | 'success' | 'warn', message: string }) => {
                // Access default logger from Runtime
                const rt = typeof ctx.getRuntime === 'function' ? ctx.getRuntime() : (ctx as any).runtime;
                // Logger is now public
                const logger = rt.logger || console;

                const { level, message } = payload;

                switch (level) {
                    case 'error':
                        logger.error(chalk.red(message));
                        break;
                    case 'warn':
                        logger.warn(chalk.yellow(message));
                        break;
                    case 'success':
                        // Default logger usually has info/warn/error/debug. Map success to info (green)
                        logger.info(chalk.green(message));
                        break;
                    default:
                        logger.info(message);
                        break;
                }

                // Emit event for UI
                ctx.events.emit('log', { level, message, timestamp: new Date().toISOString() });

                return true;
            }
        });
    }
};
