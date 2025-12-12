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

    async generateSuggestions(count: number = 3): Promise<Suggestion[]> {
        const cleanKey = this.apiKey?.trim() ?? '';
        let cleanUrl = this.apiUrl?.trim() ?? 'https://api.cerebras.ai/v1';
        if (cleanUrl.endsWith('/')) {
            cleanUrl = cleanUrl.slice(0, -1);
        }

        try {
            console.log(`Generating ${count} suggestions using qwen-3-32b...`);

            const response = await fetch(`${cleanUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${cleanKey}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'AI-Extension-Builder/1.0'
                },
                body: JSON.stringify({
                    model: 'qwen-3-32b',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a creative assistant for a Chrome Extension builder. 
Generate ${count} diverse and interesting Chrome extension ideas.
For each idea, provide a short 'label' (max 20 chars) and a longer 'prompt' (1-2 sentences).
Focus on utilities, productivity, and fun small tools.`
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
                    tool_choice: "required",
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data: any = await response.json();
            const toolCall = data.choices[0]?.message?.tool_calls?.[0];

            if (!toolCall || toolCall.function.name !== 'submit_suggestions') {
                console.warn("No valid tool call found in response");
                return [];
            }

            const args = JSON.parse(toolCall.function.arguments);
            const suggestions = args.suggestions || [];

            console.log(`Generated ${suggestions.length} suggestions.`);
            return suggestions;

        } catch (error) {
            console.error("Error generating suggestions:", error);
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
            systemPrompt += `\n\nCONTEXT: Updating existing extension.`;
            systemPrompt += `\n\nIMPORTANT: IGNORE the "Required Files" list in the main prompt. Since this is an UPDATE, ONLY return the files that you have explicitly modified or created. Do NOT return unchanged files.`;

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
        } else {
            systemPrompt += `\n\nVERSIONING INSTRUCTION:\nBecause this is a NEW extension, you MUST set the "version" field in manifest.json to "0.1.0". Do NOT use "1.0", "0.0.1", or any other value. Start with "0.1.0".`;
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
                        model: 'gpt-oss-120b', // Assuming generic tool support, or switch to llama-3.1-70b if qwen lacks it
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

                // FALLBACK: Inject default CSS if missing but HTML exists
                if (files['popup.html'] && !files['styles.css']) {
                    files['styles.css'] = `body{font-family:system-ui,-apple-system,sans-serif;width:300px;padding:16px;background:#f9fafb;color:#1f2937}button{background:#2563eb;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:500;transition:all 0.2s}button:hover{background:#1d4ed8}input{width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-bottom:8px}`;
                    console.warn("Injected default styles.css because it was missing.");
                }

                // FRAMEWORK ENFORCEMENT
                if (ExtensionRules.framework_config) {
                    files['background.js'] = ExtensionRules.framework_config.background_router;
                }

                // Validate Framework Contract if features.js was generated
                if (filesObj['features.js']) {
                    if (!filesObj['features.js'].includes('export function handleMessage')) {
                        throw new AIGenerationError("Validation Failed: features.js must export 'handleMessage' function.");
                    }
                    if (!filesObj['features.js'].includes('return') && !filesObj['features.js'].includes('throw')) {
                        console.warn("Validation Warning: features.js might not be returning values correctly.");
                    }
                }

                // UI Logic Validation
                if (filesObj['popup.js']) {
                    // Check for null/undefined safety
                    if (!filesObj['popup.js'].includes('if (!state)') && !filesObj['popup.js'].includes('if (!data)')) {
                        // We inject a warning comment if it's missing, or we could throw. 
                        // For now, let's enforce a basic check pattern.
                        if (filesObj['popup.js'].includes('updateUI')) {
                            console.warn("Validation Warning: popup.js 'updateUI' might be missing null checks.");
                        }
                    }
                }
                // ---------------------------------

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
