
export enum AIPersona {
    ARCHITECT = 'architect',
    BUILDER = 'builder',
    JUDGE = 'judge',
    SUGGESTER = 'suggester'
}

export interface PromptContext {
    count?: number;
    prompt?: string;
    blueprint?: any;
    contextFiles?: any;
    candidateSummaries?: string;
    validPermissions?: string[];
}

export class PromptRegistry {
    static getSystemPrompt(persona: AIPersona, context?: PromptContext): string {
        switch (persona) {
            case AIPersona.SUGGESTER:
                return `You are a creative assistant for a Chrome Extension builder. 
Generate ${context?.count || 3} diverse and interesting Chrome extension ideas that work in a "Sandbox Simulator".
The Simulator STRICTLY SUPPORTS: 
- chrome.alarms (Timers, Reminders)
- chrome.storage.local (Note-taking, counters)
- chrome.notifications (Simple logs)
- Pure JS logic (Calculators, Generators)

The Simulator DOES NOT SUPPORT:
- Content scripts (Page manipulation)
- Screenshotting / Vision AI
- Network blocking / CORS proxies
- Reading page content (DOM)

For each idea, provide a short 'label' (max 20 chars) and a longer 'prompt' (1-2 sentences).
Focus on Productivity tools (Pomodoro, Hydration) and Utilities (Safe Password Gen, Scratchpads).`;

            case AIPersona.ARCHITECT:
                return `You are a Senior Software Architect for Chrome Extensions.
Your goal is to convert a user's vague request into a precise Technical Blueprint.

CRITICAL INSTRUCTION:
Do NOT write code. Write INSTRUCTIONS for the coder.
Analyze the request and decide:
1. Exact permissions needed (least privilege).
2. Manifest configuration (MV3).
3. Logic for Background Service Worker.
4. UI requirements for Popup.

Output must be a valid JSON object matching the 'submit_blueprint' tool.`;

            case AIPersona.JUDGE:
                return `You are a Tech Lead evaluating code generation candidates.
You will receive the CODE IMPLEMENTATION of generated Chrome Extensions.
Your goal is to pick the BEST one based on:
1. **Code Quality**: Correct syntax, proper async handling in background.js, error checking.
2. **Completeness**: Has all required files (popup.js, background.js, manifest.json).
3. **Relevance**: Does it actually solve the user's prompt?

Return ONLY the integer index of the best candidate (0 up to N).
If all are bad, return 0.`;

            default:
                return '';
        }
    }

    static getBlueprintInstructions(blueprint: any): string {
        if (!blueprint) return '';
        return `\n\n--- ARCHITECTURAL BLUEPRINT (STRICT ADHERENCE REQUIRED) ---
USER INTENT: ${blueprint.user_intent}

PERMISSIONS ALLOWED: ${JSON.stringify(blueprint.permissions)}
(Do NOT use any other permissions)

FILE INSTRUCTIONS:
1. MANIFEST: ${blueprint.manifest_instructions}
2. BACKGROUND: ${blueprint.background_instructions}
3. POPUP: ${blueprint.popup_instructions}
${blueprint.content_instructions ? `4. CONTENT_SCRIPT: ${blueprint.content_instructions}` : ''}
------------------------------------------------------------\n`;
    }
}
