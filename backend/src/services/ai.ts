// AI Service - Interface with LiquidMetal AI for code generation
import axios, { AxiosError } from 'axios';
import { Ai } from '@liquidmetal-ai/raindrop-framework';
import { AIGenerationError, Suggestion, TokenUsage, Blueprint } from './types';
import { defaultIcons } from '../config/defaultIcons';
import { SchemaService } from './schema';
import { getTemplate } from '../templates';
import { getRelevantPatterns } from '../config/patterns';
import { ExtensionRules } from '../config/rules';
import { PromptRegistry, AIPersona } from './prompts';
import { LinterService, LintError } from './linter';

export interface GenerateExtensionRequest {
  prompt: string;
  userId: string;
  contextFiles?: ExtensionFiles;
  templateId?: string;
  blueprint?: Blueprint;
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
  summary?: string;
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
          Authorization: `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Extension-Builder/1.0',
        },
        body: JSON.stringify({
          model: 'qwen-3-32b',
          messages: [
            {
              role: 'system',
              content: PromptRegistry.getSystemPrompt(AIPersona.SUGGESTER, { count }),
            },
            { role: 'user', content: 'Generate new extension ideas.' },
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'submit_suggestions',
                description: 'Submit the list of generated extension suggestions.',
                parameters: {
                  type: 'object',
                  properties: {
                    suggestions: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          label: {
                            type: 'string',
                            description: "Short title (e.g. 'Pomodoro Timer')",
                          },
                          prompt: {
                            type: 'string',
                            description: "Full prompt (e.g. 'Create a timer that...')",
                          },
                        },
                        required: ['label', 'prompt'],
                      },
                    },
                  },
                  required: ['suggestions'],
                },
              },
            },
          ],
          tool_choice: 'required',
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data: any = await response.json();
      const toolCall = data.choices[0]?.message?.tool_calls?.[0];

      if (!toolCall || toolCall.function.name !== 'submit_suggestions') {
        console.warn('No valid tool call found in response');
        return [];
      }

      const args = JSON.parse(toolCall.function.arguments);
      const suggestions = args.suggestions || [];

      console.log(`Generated ${suggestions.length} suggestions.`);
      return suggestions;
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return [];
    }
  }

  async generateBlueprint(prompt: string): Promise<Blueprint> {
    const cleanKey = this.apiKey?.trim() ?? '';
    let cleanUrl = this.apiUrl?.trim() ?? 'https://api.cerebras.ai/v1';
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }

    try {
      console.log(`[Phase 1] Generating Technical Blueprint for: "${prompt}"`);

      // Using qwen-3-32b (or similar smart model) for planning
      const response = await fetch(`${cleanUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Extension-Builder/1.0',
        },
        body: JSON.stringify({
          model: 'qwen-3-32b', // Using SmartInference equivalent via proxy
          messages: [
            {
              role: 'system',
              content: PromptRegistry.getSystemPrompt(AIPersona.ARCHITECT),
            },
            { role: 'user', content: prompt },
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'submit_blueprint',
                description: 'Submit the technical blueprint.',
                parameters: {
                  type: 'object',
                  properties: {
                    user_intent: { type: 'string', description: 'Refined summary of what to build.' },
                    permissions_reasoning: { type: 'string', description: 'Why each permission is needed.' },
                    permissions: { type: 'array', items: { type: 'string' }, description: 'List of chrome permissions (e.g. ["storage", "alarms"]).' },
                    manifest_instructions: { type: 'string', description: 'Specific rules for manifest.json (e.g. "Use host_permissions for google.com").' },
                    background_instructions: { type: 'string', description: 'Logic logic for background.js.' },
                    content_instructions: { type: 'string', description: 'Logic for content.js (if needed).' },
                    popup_instructions: { type: 'string', description: 'UI/UX instructions for popup.html/js.' },
                  },
                  required: [
                    'user_intent',
                    'permissions_reasoning',
                    'permissions',
                    'manifest_instructions',
                    'background_instructions',
                    'popup_instructions',
                  ],
                },
              },
            },
          ],
          tool_choice: 'required',
          temperature: 0.1, // High precision
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data: any = await response.json();
      const toolCall = data.choices[0]?.message?.tool_calls?.[0];

      if (!toolCall || toolCall.function.name !== 'submit_blueprint') {
        throw new AIGenerationError('Model failed to generate a blueprint.');
      }

      const blueprint = JSON.parse(toolCall.function.arguments);
      console.log('[Phase 1] Blueprint generated:', blueprint.user_intent);
      return blueprint as Blueprint;

    } catch (error) {
      console.error('Error generating blueprint:', error);
      throw new AIGenerationError('Failed to generate execution blueprint.', error as Error);
    }
  }

  async generateExtension(
    request: GenerateExtensionRequest
  ): Promise<{ files: ExtensionFiles; usage?: TokenUsage }> {
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

    // [PHASE 2 INJECTION] Apply Blueprint Instructions if available
    if (request.blueprint) {
      systemPrompt += PromptRegistry.getBlueprintInstructions(request.blueprint);
    }

    if (request.contextFiles) {
      systemPrompt += `\n\nCONTEXT: Updating existing extension.`;
      systemPrompt += `\n\nIMPORTANT: IGNORE the "Required Files" list in the main prompt. Since this is an UPDATE, ONLY return the files that you have explicitly modified or created. Do NOT return unchanged files.`;

      let fileContext = '\n\nEXISTING FILES:\n';
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
            } catch (e) {
              /* ignore */
            }
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
            Authorization: `Bearer ${cleanKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'AI-Extension-Builder/1.0',
          },
          body: JSON.stringify({
            model: 'gpt-oss-120b', // Assuming generic tool support, or switch to llama-3.1-70b if qwen lacks it
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userContent },
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'submit_extension',
                  description: 'Submit the complete browser extension package.',
                  parameters: {
                    type: 'object',
                    properties: {
                      blueprint: {
                        type: 'object',
                        description: "Step 1: The Architect's Plan.",
                        properties: {
                          user_intent: {
                            type: 'string',
                            description: 'Summary of what the user wants to build.',
                          },
                          permissions_reasoning: {
                            type: 'string',
                            description: `Justification for every permission requested. MUST be from this whitelist: ${validPermissions.join(', ')}.`,
                          },
                          async_logic_check: {
                            type: 'string',
                            description:
                              "Confirmation that message listeners return 'true' for async operations.",
                          },
                          data_contract_check: {
                            type: 'string',
                            description: "Confirmation that UI code unwraps 'response.data'.",
                          },
                          ui_event_handling_check: {
                            type: 'string',
                            description:
                              'If background initiates messages (e.g. timers), confirm UI has chrome.runtime.onMessage listener.',
                          },
                          storage_async_check: {
                            type: 'string',
                            description:
                              "Confirm that all chrome.storage calls use 'await' and the function is 'async'.",
                          },
                          ux_interactivity_check: {
                            type: 'string',
                            description:
                              'If creating a timer or progress bar, confirm the UI updates in real-time (ticks).',
                          },
                          implementation_strategy: {
                            type: 'string',
                            description:
                              'CRITICAL: Explain mechanism for Interactivity and Persistence.',
                          },
                          summary: {
                            type: 'string',
                            description:
                              'A concise summary (1-2 sentences) of what was built or changed, suitable for a timeline view.',
                          },
                        },
                        required: [
                          'user_intent',
                          'permissions_reasoning',
                          'async_logic_check',
                          'data_contract_check',
                          'ui_event_handling_check',
                          'storage_async_check',
                          'ux_interactivity_check',
                          'implementation_strategy',
                          'summary',
                        ],
                      },
                      files: {
                        type: 'object',
                        description: "Step 2: The Builder's Code.",
                        properties: {
                          manifest_json: {
                            type: 'string',
                            description:
                              "Content of manifest.json. MUST include 'type': 'module' and a valid 'description'.",
                          },
                          features_js: { type: 'string', description: 'Content of features.js.' },
                          popup_js: { type: 'string', description: 'Content of popup.js.' },
                          popup_html: { type: 'string', description: 'Content of popup.html.' },
                          styles_css: { type: 'string', description: 'Content of styles.css.' },
                          readme_md: { type: 'string', description: 'Content of README.md.' },
                          content_js: {
                            type: 'string',
                            description: 'Optional: Content script logic.',
                          },
                        },
                        required: request.contextFiles
                          ? ['manifest_json']
                          : [
                            'manifest_json',
                            'features_js',
                            'popup_js',
                            'popup_html',
                            'styles_css',
                            'readme_md',
                          ],
                      },
                    },
                    required: ['blueprint', 'files'],
                  },
                },
              },
            ],
            tool_choice: 'required',
            temperature: 0.2,
            max_tokens: 8192,
          }),
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

        console.log('[Blueprint Analysis]', blueprint);

        // Map arguments to ExtensionFiles interface
        // If updating, start with existing files, then overwrite with new ones
        const files: ExtensionFiles = request.contextFiles
          ? ({ ...request.contextFiles } as ExtensionFiles)
          : ({} as ExtensionFiles);

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
        if (!files['icons/icon16.png'])
          files['icons/icon16.png'] = Buffer.from(defaultIcons.icon16, 'base64');
        if (!files['icons/icon48.png'])
          files['icons/icon48.png'] = Buffer.from(defaultIcons.icon48, 'base64');
        if (!files['icons/icon128.png'])
          files['icons/icon128.png'] = Buffer.from(defaultIcons.icon128, 'base64');

        // FALLBACK: Inject default CSS if missing but HTML exists
        if (files['popup.html'] && !files['styles.css']) {
          files['styles.css'] =
            `body{font-family:system-ui,-apple-system,sans-serif;width:300px;padding:16px;background:#f9fafb;color:#1f2937}button{background:#2563eb;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:500;transition:all 0.2s}button:hover{background:#1d4ed8}input{width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-bottom:8px}`;
          console.warn('Injected default styles.css because it was missing.');
        }

        // FRAMEWORK ENFORCEMENT
        if (ExtensionRules.framework_config) {
          files['background.js'] = ExtensionRules.framework_config.background_router;
        }

        // Validate Framework Contract if features.js was generated
        if (filesObj['features.js']) {
          if (!filesObj['features.js'].includes('export function handleMessage')) {
            throw new AIGenerationError(
              "Validation Failed: features.js must export 'handleMessage' function."
            );
          }
          if (
            !filesObj['features.js'].includes('return') &&
            !filesObj['features.js'].includes('throw')
          ) {
            console.warn(
              'Validation Warning: features.js might not be returning values correctly.'
            );
          }
        }

        // UI Logic Validation
        if (filesObj['popup.js']) {
          // Check for null/undefined safety
          if (
            !filesObj['popup.js'].includes('if (!state)') &&
            !filesObj['popup.js'].includes('if (!data)')
          ) {
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

        // Extract usage
        const usage = data.usage as TokenUsage | undefined;

        return { files, usage };
      } catch (error) {
        lastError = error as Error;
        if (error instanceof AIGenerationError) throw error;

        if (attempt < this.maxRetries) {
          console.warn(`Attempt ${attempt} failed: ${lastError.message}. Retrying...`);
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay * attempt));
          continue;
        }
      }
    }

    throw new AIGenerationError(
      `Generation failed after ${this.maxRetries} attempts: ${lastError?.message}`,
      lastError
    );
  }

  async generateRefinedExtension(
    request: GenerateExtensionRequest,
    candidateCount: number = 3
  ): Promise<{ files: ExtensionFiles; usage?: TokenUsage }> {
    console.log(`[Multi-Inference] Starting Pipeline...`);

    // 0. GENERATE BLUEPRINT (One brain to rule them all)
    // We only generate a blueprint if one isn't already provided
    let blueprint = request.blueprint;
    if (!blueprint) {
      try {
        blueprint = await this.generateBlueprint(request.prompt);
      } catch (err) {
        console.warn('[Multi-Inference] Blueprint generation failed, falling back to raw prompt.', err);
      }
    }

    console.log(`[Multi-Inference] generating ${candidateCount} candidates in parallel...`);

    // 1. Generate N candidates in parallel (fan-out)
    const promises = Array.from({ length: candidateCount }).map((_, i) =>
      this.generateExtension({
        ...request,
        blueprint, // Pass the shared brain
        prompt: `${request.prompt} (Variant ${i + 1})`
      })
        .then(async (res) => {
          // [NEW] Validate and Repair
          const { files: fixedFiles, repaired } = await this.validateAndRepair(request.prompt, res.files);
          if (repaired) {
            console.log(`[Self-Repair] Candidate ${i} was repaired.`);
          }
          return { result: { ...res, files: fixedFiles }, error: null };
        })
        .catch(err => ({ result: null, error: err }))
    );

    const results = await Promise.all(promises);
    const successCandidates = results
      .filter(r => r.result !== null)
      .map(r => r.result!);

    if (successCandidates.length === 0) {
      throw new AIGenerationError('All candidates failed generation.');
    }

    if (successCandidates.length === 1) {
      console.log('[Multi-Inference] Only 1 candidate succeeded, returning it.');
      return successCandidates[0]!;
    }

    // 2. Evaluate candidates to pick the best one
    const winnerIndex = await this.evaluateCandidates(successCandidates, request.prompt);
    const winner = successCandidates[winnerIndex] ?? successCandidates[0];

    if (!winner) {
      throw new AIGenerationError('Unexpected error: No winner selected.');
    }

    // Aggregate usage
    const totalUsage: TokenUsage = {
      prompt_tokens: successCandidates.reduce((acc, c) => acc + (c.usage?.prompt_tokens || 0), 0),
      completion_tokens: successCandidates.reduce((acc, c) => acc + (c.usage?.completion_tokens || 0), 0),
      total_tokens: successCandidates.reduce((acc, c) => acc + (c.usage?.total_tokens || 0), 0),
    };

    return { files: winner.files, usage: totalUsage };
  }

  // [NEW] Validate and Repair Loop
  async validateAndRepair(originalPrompt: string, files: ExtensionFiles): Promise<{ files: ExtensionFiles; repaired: boolean }> {
    const MAX_REPAIRS = 2;
    let currentFiles = { ...files };
    let attempt = 0;

    while (attempt < MAX_REPAIRS) {
      const errors = LinterService.lint(currentFiles);
      if (errors.length === 0) {
        return { files: currentFiles, repaired: attempt > 0 };
      }

      console.log(`[Self-Repair] Found ${errors.length} errors. Attempting fix ${attempt + 1}/${MAX_REPAIRS}...`);

      try {
        currentFiles = await this.repairExtension(originalPrompt, currentFiles, errors);
        attempt++;
      } catch (e) {
        console.warn('[Self-Repair] Repair failed:', e);
        break; // Stop if repair crashes
      }
    }

    return { files: currentFiles, repaired: attempt > 0 };
  }

  async repairExtension(prompt: string, files: ExtensionFiles, errors: LintError[]): Promise<ExtensionFiles> {
    const cleanKey = this.apiKey?.trim() ?? '';
    let cleanUrl = this.apiUrl?.trim() ?? 'https://api.cerebras.ai/v1';
    if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);

    const errorContext = errors.map(e => `[${e.severity.toUpperCase()}] ${e.file}: ${e.message}`).join('\n');
    const fileContext = Object.entries(files)
      .filter(([name]) => name.endsWith('.js') || name.endsWith('.json') || name.endsWith('.html'))
      .map(([name, content]) => `--- ${name} ---\n${content}`).join('\n');

    const response = await fetch(`${cleanUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Extension-Builder/1.0',
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b',
        messages: [
          { role: 'system', content: PromptRegistry.getSystemPrompt(AIPersona.REPAIR) },
          {
            role: 'user',
            content: `User Request: ${prompt}\n\nERRORS:\n${errorContext}\n\nFILES:\n${fileContext}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'submit_repairs',
              description: 'Submit fixed files.',
              parameters: {
                type: 'object',
                properties: {
                  files: {
                    type: 'object',
                    description: 'Map of filename to NEW content. Only include files you fixed.',
                    additionalProperties: { type: 'string' }
                  }
                },
                required: ['files']
              }
            }
          }
        ],
        tool_choice: 'required',
        temperature: 0.1
      })
    });

    if (!response.ok) throw new Error('Repair API failed');

    const data: any = await response.json();
    const toolCall = data.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) return files;

    const args = JSON.parse(toolCall.function.arguments);
    const fixedFiles = args.files || {};

    return { ...files, ...fixedFiles };
  }

  private async evaluateCandidates(
    candidates: { files: ExtensionFiles }[],
    originalPrompt: string
  ): Promise<number> {
    const cleanKey = this.apiKey?.trim() ?? '';
    let cleanUrl = this.apiUrl?.trim() ?? 'https://api.cerebras.ai/v1';
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }

    // Filter candidates using Pre-flight Check
    const validCandidates = candidates.map((c, index) => ({
      originalIndex: index,
      files: c.files,
      isValid: this.preflightCheck(c.files),
    }));

    const passingCandidates = validCandidates.filter(c => c.isValid);

    // If only one (or zero) valid candidates, return the first valid or fallback to first original
    if (passingCandidates.length === 0) {
      console.warn('[Validation] All candidates failed pre-flight check. Falling back to index 0.');
      return 0;
    }
    if (passingCandidates.length === 1) {
      console.log(`[Validation] Only one candidate (Index ${passingCandidates[0]?.originalIndex}) passed pre-flight. Winning automatically.`);
      return passingCandidates[0]?.originalIndex ?? 0;
    }

    // Prepare content for the Judge
    // We only judge the passing candidates
    const candidateContext = passingCandidates.map((c, i) => {
      return `Candidate ${i} (Original Index ${c.originalIndex}):\n${this.formatCandidateForJudge(c.files)}\n-------------------\n`;
    }).join('\n');

    try {
      console.log(`[Multi-Inference] Judging ${passingCandidates.length} valid candidates (out of ${candidates.length} total)...`);
      const response = await fetch(`${cleanUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Extension-Builder/1.0',
        },
        body: JSON.stringify({
          model: 'llama-3.1-70b',
          messages: [
            {
              role: 'system',
              content: PromptRegistry.getSystemPrompt(AIPersona.JUDGE),
            },
            {
              role: 'user',
              content: `User Request: "${originalPrompt}"\n\nCANDIDATES:\n${candidateContext}`,
            },
          ],
          temperature: 0.1,
          max_tokens: 10,
        }),
      });

      if (!response.ok) return passingCandidates[0]?.originalIndex ?? 0;

      const data: any = await response.json();
      const content = data.choices[0]?.message?.content?.trim();
      const relativeIndex = parseInt(content, 10);

      if (isNaN(relativeIndex) || relativeIndex < 0 || relativeIndex >= passingCandidates.length) {
        return passingCandidates[0]?.originalIndex ?? 0;
      }

      const winnerOriginalIndex = passingCandidates[relativeIndex]?.originalIndex ?? 0;
      console.log(`[Multi-Inference] Judge selected Candidate (Relative ${relativeIndex} -> Original ${winnerOriginalIndex})`);
      return winnerOriginalIndex;

    } catch (error) {
      console.warn('Evaluation failed, defaulting to first valid candidate', error);
      return passingCandidates[0]?.originalIndex ?? 0;
    }
  }

  private preflightCheck(files: ExtensionFiles): boolean {
    // [OPTIMIZATION] Use Linter for robust preflight
    const errors = LinterService.lint(files);
    // Only fail on CRITICAL errors for now
    const criticalErrors = errors.filter(e => e.severity === 'critical');

    if (criticalErrors.length > 0) {
      console.warn('[Preflight] Failed with errors:', criticalErrors);
      return false;
    }
    return true;
  }

  private formatCandidateForJudge(files: ExtensionFiles): string {
    let output = '';

    // Manifest
    if (files['manifest.json']) {
      output += `[manifest.json]\n${files['manifest.json']}\n`;
    }

    // Background (Critical logic)
    if (files['background.js']) {
      const bg = files['background.js'] as string;
      // Truncate if huge, but usually background logic is key
      output += `[background.js]\n${bg.slice(0, 5000)}\n`;
    }

    // Popup script
    if (files['popup.js']) {
      const popup = files['popup.js'] as string;
      output += `[popup.js]\n${popup.slice(0, 3000)}\n`;
    }

    return output;
  }
}
