# Hybrid Inference Architecture: "The Refined Best-of-N Pipeline"

To win the **Best Ultra-Low Latency App** category while maximizing code quality, we are implementing a **"Refine - Fan-out - Converge"** architecture. This strategy leverages the extreme speed of **Cerebras Inference** to brute-force quality through parallel exploration, while using **Raindrop SmartInference** to ensure those parallel attempts are grounded in a perfect prompt.

---

## The Architecture

```text
User Request
    |
    v
[1. Raindrop SmartInference] (Prompt Engineering Agent)
    |
    +-> [Refined "Blueprint" Prompt]
          |
          +-> (Fan-out: 3 Parallel Streams)
          |       |       |
      [2. Cerebras] [2. Cerebras] [2. Cerebras]
      (Variant A)   (Variant B)   (Variant C)
          |       |       |
          v       v       v
      [Candidate A] [Candidate B] [Candidate C]
          |       |       |
          +-------+-------+
                  |
                  v
       [3. The Judge (Raindrop/Cerebras)]
          (Selects Best & Validates)
                  |
                  v
           [Final Extension]
```

---

## Phase 1: Smart Refinement (The BRAIN)
**Goal:** Garbage In, Garbage Out prevention.
**Engine:** Raindrop SmartInference (e.g., Qwen-72b or Llama-3-70b via Raindrop)

Before generating a single line of code, we transform the user's raw input into a **Technical Blueprint**.
1.  **Context Injection:** We verify permissions and manifest requirements.
2.  **Prompt Expansion:** "Make a clock" becomes "Create a popup clock with start/stop buttons, local storage persistence, and a dark mode UI."
3.  **Sanitization:** Ensure no malicious instructions are passed dowstream.

*Output: A structured, unambiguous prompt optimized for the coding model.*

---

## Phase 2: Parallel "Best-of-N" (The BRAWN)
**Goal:** Ultra-Low Latency Quality.
**Engine:** Cerebras Inference (Llama-3.1-70b / qwen-2.5-coder)

This is where we win the category. Instead of generating one extension and hoping it works, we exploit Cerebras's speed to generate **three versions in parallel**.

*   **Variant A (Conservative):** Stricts adherence to the prompt.
*   **Variant B (Creative):** Allowed to add "delight" features (animations, better CSS).
*   **Variant C (Robust):** Focuses heavily on error handling and edge cases.

Because Cerebras is so fast, generating 3 parallel versions takes roughly the same *Wall Clock Time* as generating 1 version on a standard provider. This is the definition of **"Speed enabling new capabilities."**

---

## Phase 3: The Judge (The QA)
**Goal:** Automated Quality Assurance.
**Engine:** Raindrop SmartInference or Cerebras Llama-70b

We feed the 3 candidates (Manifest + Code) into a comparison model.
1.  **Completeness Check:** Does it have `manifest.json`, `background.js`, `popup.html`?
2.  **Linting:** Does the code look syntactically valid?
3.  **Selection:** Which variant best matched the user's original intent?

*The winner is packaged and delivered to the user.*

---

## Why This Wins
1.  **Compliance:** All "user-facing" code generation runs on **Cerebras**, satisfying the Ultra-Low Latency requirement.
2.  **Quality:** We don't rely on a single "lucky roll" of the LLM. We generate multiple options and pick the best one.
3.  **Innovation:** We are using speed not just to be "fast", but to be **"better"**. We are buying reliability with compute, which is only possible when inference is this fast.

---

## Implementation Details
*   **Backend:** `backend/src/services/ai.ts` already implements the `generateRefinedExtension` method with parallel `Promise.all` calls.
*   **Frontend:** The UI simply calls the endpoint; the magic happens on the server.
*   **Logging:** We must log the "Winner Selection" process to show the judges (e.g., "Candidate B selected for better CSS").
