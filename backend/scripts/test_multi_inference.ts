
import * as dotenv from 'dotenv';
import path from 'path';
import { AIService, GenerateExtensionRequest, ExtensionFiles } from '../src/services/ai';
import { Ai } from '@liquidmetal-ai/raindrop-framework';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_KEY = process.env.CEREBRAS_API_KEY;
const API_URL = process.env.CEREBRAS_API_URL;

if (!API_KEY) {
    console.error('Error: CEREBRAS_API_KEY is not defined in .env');
    process.exit(1);
}

// Mock AI binding since we are not in a full worker environment
// We don't actually use 'ai' binding for Cerebras calls in our implementation (we use fetch + apiKey)
// so a simple cast assertion or empty object is fine for the constructor if it's not strictly typed to fail at runtime.
const mockAi = {} as Ai;

async function runTest() {
    console.log('--- Multi-Inference (Best-of-N) Verification ---');
    console.log(`Endpoint: ${API_URL}`);

    const aiService = new AIService(mockAi, API_KEY, API_URL);

    const request: GenerateExtensionRequest = {
        prompt: "A Chrome extension that plays a sound every time you open a new tab.",
        userId: "test-user-local",
        templateId: "default"
    };

    console.log(`\nRequested Prompt: "${request.prompt}"`);
    console.log('Starting generateRefinedExtension(candidateCount=3)...');

    const startTime = performance.now();

    try {
        const result = await aiService.generateRefinedExtension(request, 3);

        const endTime = performance.now();
        console.log(`\n[SUCCESS] Multi-Inference Completed in ${(endTime - startTime).toFixed(2)}ms`);
        console.log('--- Result Analysis ---');
        console.log(`Manifest Name: ${JSON.parse(result.files['manifest.json'] as string).name}`);
        console.log(`Manifest Description: ${JSON.parse(result.files['manifest.json'] as string).description}`);
        console.log(`Total Files Generated: ${Object.keys(result.files).join(', ')}`);
        console.log(`Token Usage: ${JSON.stringify(result.usage)}`);

    } catch (error) {
        console.error('Test Failed:', error);
    }
}

runTest();
