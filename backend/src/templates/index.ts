import { basicExtensionTemplate } from './basic-extension';

export interface ExtensionTemplate {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
}

export const templates: Record<string, ExtensionTemplate> = {
    [basicExtensionTemplate.id]: basicExtensionTemplate,
    // Future templates (react, typescript, etc.) go here
};

export const defaultTemplateId = basicExtensionTemplate.id;

export function getTemplate(id?: string): ExtensionTemplate {
    if (!id || !templates[id]) {
        const defaultTemplate = templates[defaultTemplateId];
        if (!defaultTemplate) throw new Error(`Default template ${defaultTemplateId} not found`);
        return defaultTemplate;
    }
    return templates[id];
}
