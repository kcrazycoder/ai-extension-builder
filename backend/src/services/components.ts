import { AuthFiles } from './modules/auth';

export interface ComponentDefinition {
    id: string;
    name: string;
    description: string;
    files: Record<string, string>;
    dependencies?: string[]; // npm dependencies to add
}

const REGISTRY: Record<string, ComponentDefinition> = {
    'auth-supabase': {
        id: 'auth-supabase',
        name: 'Authentication (Supabase)',
        description: 'Complete Auth implementation using Supabase (Hooks + UI)',
        files: AuthFiles,
        dependencies: ['@supabase/supabase-js']
    }
};

export class ComponentService {
    static getComponent(id: string): ComponentDefinition | undefined {
        return REGISTRY[id];
    }

    static getAllComponents(): ComponentDefinition[] {
        return Object.values(REGISTRY);
    }

    static getFilesForComponents(ids: string[]): Record<string, string> {
        const files: Record<string, string> = {};
        ids.forEach(id => {
            const component = this.getComponent(id);
            if (component) {
                Object.assign(files, component.files);
            }
        });
        return files;
    }
}
