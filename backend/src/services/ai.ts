// AI Service - Interface with Cerebras for ultra-low latency code generation
import axios, { AxiosError } from 'axios';
import { AIGenerationError } from './types';

export interface GenerateExtensionRequest {
    prompt: string;
    userId: string;
}

export interface ExtensionFiles {
    'manifest.json': string;
    'background.js'?: string;
    'content.js'?: string;
    'popup.html'?: string;
    'popup.js'?: string;
    'styles.css'?: string;
    'icons/icon16.png'?: string;
    'icons/icon48.png'?: string;
    'icons/icon128.png'?: string;
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

        const systemPrompt = `You are an expert browser extension developer. Generate a complete, working browser extension based on the user's description. Return ONLY valid JSON with the following structure:
{
  "manifest.json": "...",
  "background.js": "...",
  "content.js": "...",
  "popup.html": "...",
  "popup.js": "...",
  "styles.css": "..."
}

Ensure the manifest.json follows Chrome Extension Manifest V3 format. Include all necessary permissions and files.`;

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
                            { role: 'user', content: request.prompt }
                        ],
                        temperature: 0.7,
                        max_tokens: 4000
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
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new AIGenerationError('Failed to extract JSON from AI response');
                }

                const files: ExtensionFiles = JSON.parse(jsonMatch[0]);

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
