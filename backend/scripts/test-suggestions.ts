import { AIService } from '../src/services/ai';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from backend root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Mock Ai interface since we are testing the direct fetch path
const mockAi = {
    run: async () => {
        console.log("Mock AI run called - this should NOT happen with the fix");
        return { choices: [] };
    }
} as any;

async function test() {
    console.log("Initializing AIService...");
    if (!process.env.CEREBRAS_API_KEY) {
        console.error("Missing CEREBRAS_API_KEY");
        process.exit(1);
    }

    const aiService = new AIService(
        mockAi,
        process.env.CEREBRAS_API_KEY,
        process.env.CEREBRAS_API_URL || 'https://api.cerebras.ai/v1'
    );

    console.log("Calling generateSuggestions(3)...");
    try {
        const suggestions = await aiService.generateSuggestions(3);
        console.log("Suggestions Result:", JSON.stringify(suggestions, null, 2));

        if (suggestions && suggestions.length > 0 && suggestions[0]?.label && suggestions[0]?.prompt) {
            console.log("\n✅ SUCCESS: Got valid suggestions.");
        } else {
            console.error("\n❌ FAILURE: Suggestions array is empty or invalid.");
            process.exit(1);
        }
    } catch (e) {
        console.error("\n❌ FAILURE: Exception thrown:", e);
        process.exit(1);
    }
}

test().catch(e => {
    console.error("Unhandled error:", e);
    process.exit(1);
});
