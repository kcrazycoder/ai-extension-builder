import axios from 'axios';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the backend directory's .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_KEY = process.env.CEREBRAS_API_KEY;
let baseUrl = process.env.CEREBRAS_API_URL || 'https://api.cerebras.ai/v1';
if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
const API_URL = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;

if (!API_KEY) {
    console.error('Error: CEREBRAS_API_KEY is not defined in .env');
    process.exit(1);
}

async function runBenchmark() {
    console.log('--- Cerebras Ultra-Low Latency Benchmark ---');
    console.log(`Endpoint: ${API_URL}`);
    console.log('Model: gpt-oss-120b');
    console.log('Prompt: "Create a Pomodoro Timer extension."');
    console.log('--------------------------------------------');

    const startTime = performance.now();
    let ttft: number | null = null;
    let tokenCount = 0;

    const systemPrompt = `You are an expert browser extension developer specializing in Manifest V3.
Generate a complete, working browser extension based on the user's description.

GOLDEN RULES (STRICT COMPLIANCE REQUIRED):
1. **Manifest V3**: Use V3 semantics.
2. **Framework Mode**: You are filling in a Pre-Built Framework.
   - **features.js**: WRITE THIS. It must export \`function handleMessage(request)\`.
   - **manifest.json**: WRITE THIS. Register \`background.js\` (it imports features.js).

Return ONLY a raw JSON object with this structure (ORDER MATTERS):
{
  "manifest.json": "string content",
  "features.js": "string content",
  "popup.html": "string content",
  "popup.js": "string content"
}`;

    try {
        const response = await axios.post(
            API_URL,
            {
                model: 'gpt-oss-120b',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: 'Create a Pomodoro Timer extension with dark mode and alarm sounds.' }
                ],
                stream: true,
                max_tokens: 2000,
                temperature: 0.1
            },
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'stream'
            }
        );

        console.log('Request sent. Waiting for first token...');

        const stream = response.data;

        stream.on('data', (chunk: Buffer) => {
            const now = performance.now();
            if (!ttft) {
                ttft = now - startTime;
                process.stdout.write(`\n[TTFT] First token received in ${ttft.toFixed(2)}ms!\n\nStream output: `);
            }

            const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    try {
                        const json = JSON.parse(data);
                        const content = json.choices[0]?.delta?.content;
                        if (content) {
                            process.stdout.write(content);
                            tokenCount++;
                        }
                    } catch (e) {
                        // ignore parse errors
                    }
                }
            }
        });

        stream.on('end', () => {
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            // Adjust time to account for TTFT in "Generation Time"
            const generationTime = totalTime - (ttft || 0);
            const tps = tokenCount / (generationTime / 1000);

            console.log('\n\n--------------------------------------------');
            console.log('Benchmark Results (Real Extension Generation):');
            console.log(`Total Time:       ${totalTime.toFixed(2)} ms`);
            console.log(`Time to First Token (TTFT): ${ttft?.toFixed(2)} ms`);
            console.log(`Total Tokens:     ${tokenCount}`);
            console.log('Tokens Per Second (TPS):    ' + tps.toFixed(2) + ' tokens/s');
            console.log('--------------------------------------------');

            console.log('\nSummary of Findings:');
            if (tps > 100) {
                console.log(`🚀 ULTRA-FAST SPEEDS DETECTED! (${tps.toFixed(0)} TPS)`);
                console.log('   - This model is generating Code significantly faster than real-time reading speed.');
            } else if (tps > 50) {
                console.log(`⚡ HIGH SPEED DETECTED (${tps.toFixed(0)} TPS)`);
            } else {
                console.log(`ℹ️ STANDARD SPEED DETECTED (${tps.toFixed(0)} TPS)`);
            }

            if (ttft && ttft < 600) {
                console.log(`⏱️  LOW LATENCY (${ttft.toFixed(0)} ms TTFT)`);
            }
            console.log('--------------------------------------------');
        });

    } catch (error: any) {
        console.error('Error running benchmark:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

runBenchmark();
