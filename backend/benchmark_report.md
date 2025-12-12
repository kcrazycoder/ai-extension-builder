# Cerebras Ultra-Low Latency Benchmark Report

**Date:** 2025-12-12
**Model:** gpt-oss-120b
**Prompt:** "Create a Pomodoro Timer extension."

## Execution Log

```text
> ai-extension-builder@1.0.0 benchmark
> ts-node -O '{"module":"commonjs"}' scripts/benchmark_cerebras.ts

[dotenv@17.2.3] injecting env (11) from .env
--- Cerebras Ultra-Low Latency Benchmark ---
Endpoint: https://api.cerebras.ai/v1/chat/completions
Model: gpt-oss-120b
Prompt: "Create a Pomodoro Timer extension."
--------------------------------------------
Request sent. Waiting for first token...

[TTFT] First token received in 470.35ms!

Stream output: {
  "manifest.json": "...",
  "features.js": "...",
  "popup.html": "...",
  "popup.js": "..."
}

--------------------------------------------
Benchmark Results (Real Extension Generation):
Total Time:       1615.10 ms
Time to First Token (TTFT): 470.35 ms
Total Tokens:     61
Tokens Per Second (TPS):    53.29 tokens/s
--------------------------------------------

Summary of Findings:
⚡ HIGH SPEED DETECTED (53 TPS)
⏱️  LOW LATENCY (470 ms TTFT)
--------------------------------------------
```

## Conclusions
- **Throughput**: The model achieved **53.29 TPS**. This is lower than the previous `qwen-3-32b` model (~200 TPS), which is expected due to the significantly larger parameter size (120B vs 32B), but still highly responsive.
- **Latency**: The Time-To-First-Token (TTFT) remains excellent at **470.35 ms**, ensuring an instant "feeling" response for users.
