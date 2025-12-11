// AI Service - Interface with LiquidMetal AI for code generation
import axios, { AxiosError } from 'axios';
import { Ai } from '@liquidmetal-ai/raindrop-framework';
import { AIGenerationError, Suggestion } from './types';
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
    'summary'?: string;
    [key: string]: string | Uint8Array | Buffer | undefined | number[];
}

export class AIService {
    private ai: Ai;
    private apiKey?: string;
    private apiUrl?: string;
    private maxRetries: number = 3;
    private retryDelay: number = 1000; // 1 second

    constructor(ai: Ai, apiKey?: string, apiUrl?: string) {
        this.ai = ai;
        this.apiKey = apiKey;
        this.apiUrl = apiUrl;
    }

    async generateSuggestions(count: number = 5): Promise<Suggestion[]> {
        try {
            const response = await this.ai.run('llama-3.3-70b', {
                model: 'llama-3.3-70b',
                messages: [
                    {
                        role: 'system',
                        content: `You are a creative creative assistant for a Chrome Extension builder. 
Generate ${count} diverse and interesting Chrome extension ideas that a user might want to build.
For each idea, provide a short 'label' (max 20 chars) and a longer 'prompt' (1-2 sentences) describing the extension.
Focus on utilities, productivity, and fun small tools.
Ensure the ideas are feasible to build as a browser extension.
Use the 'submit_suggestions' tool to return the data.`
                    },
                    { role: 'user', content: 'Generate new extension ideas.' }
                ],
                tools: [{
                    type: "function",
                    function: {
                        name: "submit_suggestions",
                        description: "Submit the list of generated extension suggestions.",
                        parameters: {
                            type: "object",
                            properties: {
                                suggestions: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            label: { type: "string", description: "Short title (e.g. 'Pomodoro Timer')" },
                                            prompt: { type: "string", description: "Full prompt (e.g. 'Create a timer that...')" }
                                        },
                                        required: ["label", "prompt"]
                                    }
                                }
                            },
                            required: ["suggestions"]
                        }
                    }
                }],
                tool_choice: "required"
            });

            console.log("Raw AI response:", JSON.stringify(response, null, 2));

            // Handle tool call
            const message = response.choices[0]?.message as any;
            if (message?.tool_calls) {
                const toolCall = message.tool_calls[0];
                console.log("Tool call detected:", toolCall.function.name);
                if (toolCall.function.name === 'submit_suggestions') {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log("Parsed suggestions:", args.suggestions?.length);
                    return args.suggestions;
                }
            }

            // Fallback if no tool call (shouldn't happen with tool_choice required)
            console.warn("No tool calls found in response");
            throw new Error("No suggestions generated");

        } catch (error) {
            console.error("Error generating suggestions:", error);
            // Fallback to empty or throw, client will handle or show skeletons/error
            return [];
        }
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
            systemPrompt += `\n\nCONTEXT: Updating existing extension. Return ONLY the files that you have modified or created. Do NOT return unchanged files.`;
            let fileContext = "\n\nEXISTING FILES:\n";
            for (const [name, content] of Object.entries(request.contextFiles)) {
                if (typeof content === 'string') {
                    // FILTER: Skip lockfiles and map files to save context
                    if (name === 'package-lock.json' || name === 'yarn.lock' || name.endsWith('.map')) {
                        console.log(`Skipping ${name} from context (optimization)`);
                        continue;
                    }

                    // CHECK: Capture current version for prompt instruction
                    if (name === 'manifest.json') {
                        try {
                            const m = JSON.parse(content);
                            if (m.version) {
                                systemPrompt += `\n\nCURRENT VERSION: ${m.version}.
                                SEMANTIC VERSIONING RULES:
                                1. PATCH (x.y.Z): Backward-compatible bug fixes or small tweaks.
                                2. MINOR (x.Y.0): New features (backward-compatible).
                                3. MAJOR (X.0.0): Breaking changes or complete rewrites.
                                
                                INSTRUCTION: Analyze the user's request and your changes. Determine the appropriate version increment (Major, Minor, or Patch) and UPDATE 'version' in manifest.json accordingly.`;
                            }
                        } catch (e) { /* ignore */ }
                    }

                    // SIZE SAFETY: Truncate very large files
                    const MAX_SIZE = 30000; // ~30KB or ~7.5k tokens
                    if (content.length > MAX_SIZE) {
                        fileContext += `\n--- ${name} ---\n(File truncated: Content too large for context)\n${content.slice(0, MAX_SIZE)}...\n`;
                    } else {
                        fileContext += `\n--- ${name} ---\n${content}\n`;
                    }
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
                                                "implementation_strategy": { type: "string", description: "CRITICAL: Explain mechanism for Interactivity and Persistence." },
                                                "summary": { type: "string", description: "A concise summary (1-2 sentences) of what was built or changed, suitable for a timeline view." }
                                            },
                                            required: ["user_intent", "permissions_reasoning", "async_logic_check", "data_contract_check", "ui_event_handling_check", "storage_async_check", "ux_interactivity_check", "implementation_strategy", "summary"]
                                        },
                                        "files": {
                                            type: "object",
                                            description: "Step 2: The Builder's Code.",
                                            properties: {
                                                "manifest_json": { type: "string", description: "Content of manifest.json. MUST include 'type': 'module' and a valid 'description'." },
                                                "features_js": { type: "string", description: "Content of features.js." },
                                                "popup_js": { type: "string", description: "Content of popup.js." },
                                                "popup_html": { type: "string", description: "Content of popup.html." },
                                                "styles_css": { type: "string", description: "Content of styles.css." },
                                                "readme_md": { type: "string", description: "Content of README.md." },
                                                "content_js": { type: "string", description: "Optional: Content script logic." }
                                            },
                                            required: request.contextFiles ? ["manifest_json"] : ["manifest_json", "features_js", "popup_js", "popup_html", "styles_css", "readme_md"]
                                        }
                                    },
                                    required: ["blueprint", "files"]
                                }
                            }
                        }],
                        tool_choice: "required",
                        temperature: 0.2,
                        max_tokens: 8192
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
                // If updating, start with existing files, then overwrite with new ones
                const files: ExtensionFiles = request.contextFiles ? { ...request.contextFiles } as ExtensionFiles : {} as ExtensionFiles;

                // Extract summary from blueprint
                if (blueprint && blueprint.summary) {
                    files['summary'] = blueprint.summary;
                }

                if (filesObj.manifest_json) files['manifest.json'] = filesObj.manifest_json;
                if (filesObj.features_js) files['features.js'] = filesObj.features_js;
                if (filesObj.popup_js) files['popup.js'] = filesObj.popup_js;
                if (filesObj.popup_html) files['popup.html'] = filesObj.popup_html;
                if (filesObj.styles_css) files['styles.css'] = filesObj.styles_css;
                if (filesObj.readme_md) files['README.md'] = filesObj.readme_md;
                if (filesObj.content_js) files['content.js'] = filesObj.content_js;

                // Inject default icons if they don't exist
                if (!files['icons/icon16.png']) files['icons/icon16.png'] = Buffer.from(defaultIcons.icon16, 'base64');
                if (!files['icons/icon48.png']) files['icons/icon48.png'] = Buffer.from(defaultIcons.icon48, 'base64');
                if (!files['icons/icon128.png']) files['icons/icon128.png'] = Buffer.from(defaultIcons.icon128, 'base64');

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
