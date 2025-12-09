// AI Service - Interface with Cerebras for ultra-low latency code generation
import axios, { AxiosError } from 'axios';
import { AIGenerationError } from './types';
import { defaultIcons } from '../config/defaultIcons';
import { getTemplate } from '../templates';

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
    'icons/icon16.png'?: string | Uint8Array;
    'icons/icon48.png'?: string | Uint8Array;
    'icons/icon128.png'?: string | Uint8Array;
    [key: string]: string | Uint8Array | undefined;
}

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
        // Sanitize API key
        let cleanKey = this.apiKey ? this.apiKey.trim() : '';
        if (cleanKey.toLowerCase().startsWith('bearer ')) {
            cleanKey = cleanKey.substring(7).trim();
        }

        // Sanitize API URL
        let cleanUrl = this.apiUrl ? this.apiUrl.trim() : 'https://api.cerebras.ai/v1';
        if (cleanUrl.endsWith('/')) {
            cleanUrl = cleanUrl.slice(0, -1);
        }

        // Use Template System
        const template = getTemplate(request.templateId);
        let systemPrompt = template.systemPrompt;

        let userContent = request.prompt;

        // If context is provided, inject it into the prompt
        if (request.contextFiles) {
            systemPrompt += `\n\nCONTEXT: You are updating an existing extension. Base your changes on the provided files. Return the FULL extension code (all files), including unmodified ones, to ensure a complete working package.`;

            let fileContext = "\n\nEXISTING FILES:\n";
            for (const [name, content] of Object.entries(request.contextFiles)) {
                if (typeof content === 'string' && name !== 'manifest.json' && !name.startsWith('icons/')) {
                    // Skip manifest and icons in context? No, manifest is crucial.
                    // Actually, include everything string based.
                    // But we filter out binary implicitely by typeof string checks in loop
                }
                if (typeof content === 'string') {
                    fileContext += `\n--- ${name} ---\n${content}\n`;
                }
            }
            userContent = `UPDATE REQUEST: ${request.prompt}\n\n${fileContext}`;
        }

        let lastError: Error | undefined;

        // Retry logic for transient failures
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                if (!cleanKey) {
                    throw new Error('Cerebras API key is missing or empty');
                }

                console.log(`Calling Cerebras API: ${cleanUrl}/chat/completions`);
                console.log(`Model: llama-3.3-70b`);

                const response = await fetch(`${cleanUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${cleanKey}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'AI-Extension-Builder/1.0'
                    },
                    body: JSON.stringify({
                        model: 'llama-3.3-70b',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userContent }
                        ],
                        temperature: 0.2, // Lower temperature for more deterministic code
                        max_tokens: 4000,
                        response_format: { type: 'json_object' }
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('AI API error details:', {
                        url: `${cleanUrl}/chat/completions`,
                        status: response.status,
                        statusText: response.statusText,
                        data: errorText
                    });

                    // Don't retry on 4xx errors
                    if (response.status >= 400 && response.status < 500) {
                        throw new AIGenerationError(
                            `AI API client error: ${response.status} - ${errorText} (URL: ${cleanUrl})`
                        );
                    }
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const data: any = await response.json();
                const content = data.choices[0].message.content;

                // Parse the JSON response
                let files: ExtensionFiles;
                try {
                    // Try direct parse first (JSON mode should be clean)
                    files = JSON.parse(content);
                } catch (e) {
                    console.warn('Direct JSON parse failed, trying regex extraction', e);
                    // Fallback to regex if model added markdown wrappers despite strict instructions
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) {
                        throw new AIGenerationError('Failed to extract JSON from AI response');
                    }
                    files = JSON.parse(jsonMatch[0]);
                }

                // Sanitize files: ensure all content is string, not object
                for (const [key, value] of Object.entries(files)) {
                    if (typeof value === 'object' && value !== null) {
                        files[key] = JSON.stringify(value, null, 2);
                    }
                }

                // Inject default icons
                files['icons/icon16.png'] = Buffer.from(defaultIcons.icon16, 'base64');
                files['icons/icon48.png'] = Buffer.from(defaultIcons.icon48, 'base64');
                files['icons/icon128.png'] = Buffer.from(defaultIcons.icon128, 'base64');

                // Validate manifest.json exists
                if (!files['manifest.json']) {
                    throw new AIGenerationError('Generated extension missing manifest.json');
                }

                return files;

            } catch (error) {
                lastError = error as Error;
                if (error instanceof AIGenerationError) throw error;

                // For other errors (network, parsing, etc.), retry if possible
                if (attempt < this.maxRetries) {
                    console.warn(`AI generation attempt ${attempt} failed, retrying in ${this.retryDelay}ms...`, error);
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
                    continue;
                }
                throw new AIGenerationError(`AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        // All retries exhausted
        throw new AIGenerationError(
            `Failed to generate extension after ${this.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
            lastError
        );
    }
}
