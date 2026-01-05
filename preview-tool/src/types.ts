import { RuntimeContext } from 'skeleton-crew-runtime';

/**
 * Configuration schema for the Preview Tool
 */
export interface PreviewConfig {
    /** The API Host URL (e.g. https://api.extension-builder.com) */
    host: string;
    /** The Job ID to preview */
    jobId: string;
    /** The User ID (optional, for auth) */
    user?: string;
    /** The Auth Token (optional, for auth) */
    token?: string;
    /** Local working directory for extensions */
    workDir: string;
    /** Port for hot reload server */
    hotReloadPort?: number;
}

/**
 * Extension of the SCR RuntimeContext to include our typed config
 */
export type PreviewContext = RuntimeContext<PreviewConfig>;
