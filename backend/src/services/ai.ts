// AI Service - Interface with Cerebras for ultra-low latency code generation
import axios, { AxiosError } from 'axios';
import { AIGenerationError } from './types';
import { defaultIcons } from '../config/defaultIcons';
import { SchemaService } from './schema';
import { getTemplate } from '../templates';
import { getRelevantPatterns } from '../config/patterns';
import { ExtensionRules } from '../config/rules';

export interface GenerateExtensionRequest {
    prompt: string;
    userId: string;
    contextFiles?: ExtensionFiles;
    templateId?: string;
}

export interface ExtensionFiles {
    'manifest.json': string;
    'background.js'?: string;
    'content.js'?: string;
    'popup.html'?: string;
    'popup.js'?: string;
    'styles.css'?: string;
    'icons/icon16.png'?: string | Uint8Array | Buffer;
    'icons/icon48.png'?: string | Uint8Array | Buffer;
    'icons/icon128.png'?: string | Uint8Array | Buffer;
    [key: string]: string | Uint8Array | Buffer | undefined | number[];
}

// REMOVED static submitExtensionTool definition. It is now dynamic.

export class AIService {
    private apiKey: string;
    private apiUrl: string;
    private maxRetries: number = 3;
    private retryDelay: number = 1000; // 1 second

    constructor(apiKey: string, apiUrl: string) {
        this.apiKey = apiKey;
        this.apiUrl = apiUrl;
    }

    async generateExtension(request: GenerateExtensionRequest): Promise<ExtensionFiles> {
        // [DYNAMIC LOAD] Fetch latest permissions
        const validPermissions = await SchemaService.getValidPermissions();

        let cleanKey = this.apiKey ? this.apiKey.trim() : '';
        if (cleanKey.toLowerCase().startsWith('bearer ')) {
            cleanKey = cleanKey.substring(7).trim();
        }

        let cleanUrl = this.apiUrl ? this.apiUrl.trim() : 'https://api.cerebras.ai/v1';
        if (cleanUrl.endsWith('/')) {
            cleanUrl = cleanUrl.slice(0, -1);
        }

        const template = getTemplate(request.templateId);
        let systemPrompt = template.systemPrompt;
        let userContent = request.prompt;

        const relevantPatterns = getRelevantPatterns(request.prompt);
        if (relevantPatterns) {
            systemPrompt += relevantPatterns;
        }

        if (request.contextFiles) {
            systemPrompt += `\n\nCONTEXT: Updating existing extension. Return FULL package via tool call.`;
            let fileContext = "\n\nEXISTING FILES:\n";
            for (const [name, content] of Object.entries(request.contextFiles)) {
                if (typeof content === 'string') {
                    fileContext += `\n--- ${name} ---\n${content}\n`;
                }
            }
            userContent = `UPDATE REQUEST: ${request.prompt}\n\n${fileContext}`;
        }

        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                if (!cleanKey) throw new Error('Cerebras API key is missing');

                console.log(`Calling Cerebras API (Tool Mode): ${cleanUrl}/chat/completions`);

                // Using explicit fetch for Tool Calling support
                const response = await fetch(`${cleanUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${cleanKey}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'AI-Extension-Builder/1.0'
                    },
                    body: JSON.stringify({
                        model: 'qwen-3-32b', // Assuming generic tool support, or switch to llama-3.1-70b if qwen lacks it
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userContent }
                        ],
                        tools: [{
                            type: "function",
                            function: {
                                name: "submit_extension",
                                description: "Submit the complete browser extension package.",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        "blueprint": {
                                            type: "object",
                                            description: "Step 1: The Architect's Plan.",
                                            properties: {
                                                "user_intent": { type: "string", description: "Summary of what the user wants to build." },
                                                "permissions_reasoning": { type: "string", description: `Justification for every permission requested. MUST be from this whitelist: ${validPermissions.join(', ')}.` },
                                                "async_logic_check": { type: "string", description: "Confirmation that message listeners return 'true' for async operations." },
                                                "data_contract_check": { type: "string", description: "Confirmation that UI code unwraps 'response.data'." },
                                                "ui_event_handling_check": { type: "string", description: "If background initiates messages (e.g. timers), confirm UI has chrome.runtime.onMessage listener." },
                                                "storage_async_check": { type: "string", description: "Confirm that all chrome.storage calls use 'await' and the function is 'async'." },
                                                "ux_interactivity_check": { type: "string", description: "If creating a timer or progress bar, confirm the UI updates in real-time (ticks)." },
                                                "implementation_strategy": { type: "string", description: "CRITICAL: Explain mechanism for Interactivity and Persistence." }
                                            },
                                            required: ["user_intent", "permissions_reasoning", "async_logic_check", "data_contract_check", "ui_event_handling_check", "storage_async_check", "ux_interactivity_check", "implementation_strategy"]
                                        },
                                        "files": {
                                            type: "object",
                                            description: "Step 2: The Builder's Code.",
                                            properties: {
                                                "manifest_json": { type: "string", description: "Content of manifest.json. MUST include 'type': 'module'." },
                                                "features_js": { type: "string", description: "Content of features.js." },
                                                "popup_js": { type: "string", description: "Content of popup.js." },
                                                "popup_html": { type: "string", description: "Content of popup.html." },
                                                "styles_css": { type: "string", description: "Content of styles.css." },
                                                "readme_md": { type: "string", description: "Content of README.md." },
                                                "content_js": { type: "string", description: "Optional: Content script logic." }
                                            },
                                            required: ["manifest_json", "features_js", "popup_js", "popup_html", "styles_css", "readme_md"]
                                        }
                                    },
                                    required: ["blueprint", "files"]
                                }
                            }
                        }],
                        tool_choice: "required",
                        temperature: 0.2,
                        max_tokens: 4000
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const data: any = await response.json();
                const toolCall = data.choices[0].message.tool_calls?.[0];

                if (!toolCall || toolCall.function.name !== 'submit_extension') {
                    throw new AIGenerationError('Model failed to call the submission tool.');
                }

                const args = JSON.parse(toolCall.function.arguments);
                const filesObj = args.files;
                const blueprint = args.blueprint;

                console.log("[Blueprint Analysis]", blueprint);

                // Map arguments to ExtensionFiles interface
                const files: ExtensionFiles = {
                    'manifest.json': filesObj.manifest_json,
                    'features.js': filesObj.features_js,
                    'popup.js': filesObj.popup_js,
                    'popup.html': filesObj.popup_html,
                    'styles.css': filesObj.styles_css,
                    'README.md': filesObj.readme_md
                };

                if (filesObj.content_js) {
                    files['content.js'] = filesObj.content_js;
                }

                // Inject default icons
                files['icons/icon16.png'] = Buffer.from(defaultIcons.icon16, 'base64');
                files['icons/icon48.png'] = Buffer.from(defaultIcons.icon48, 'base64');
                files['icons/icon128.png'] = Buffer.from(defaultIcons.icon128, 'base64');

                // FRAMEWORK ENFORCEMENT
                if (ExtensionRules.framework_config) {
                    files['background.js'] = ExtensionRules.framework_config.background_router;
                }

                if (!files['manifest.json']) {
                    throw new AIGenerationError('Tool validation failed: manifest.json missing.');
                }

                return files;

            } catch (error) {
                lastError = error as Error;
                if (error instanceof AIGenerationError) throw error;

                if (attempt < this.maxRetries) {
                    console.warn(`Attempt ${attempt} failed: ${lastError.message}. Retrying...`);
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
                    continue;
                }
            }
        }

        throw new AIGenerationError(`Generation failed after ${this.maxRetries} attempts: ${lastError?.message}`, lastError);
    }
}
