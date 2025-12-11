# Cerebras Ultra-Low Latency Benchmark Report

**Date:** 2025-12-11
**Model:** qwen-3-32b
**Prompt:** "Create a Pomodoro Timer extension."

## Execution Log

```text
> ai-extension-builder@1.0.0 benchmark
> ts-node -O '{"module":"commonjs"}' scripts/benchmark_cerebras.ts

[dotenv@17.2.3] injecting env (11) from .env
--- Cerebras Ultra-Low Latency Benchmark ---
Endpoint: https://api.cerebras.ai/v1/chat/completions
Model: qwen-3-32b
Prompt: "Create a Pomodoro Timer extension."
--------------------------------------------
Request sent. Waiting for first token...

[TTFT] First token received in 507.44ms!

Stream output: 
Okay, I need to create a Pomodoro Timer extension for Manifest V3. Let me start by recalling the requirements. The user wants a 25-minute countdown with start and reset buttons. The extension should have a popup UI.

First, the manifest.json. Since it's V3, I need to use service workers instead of background pages. The background script will be a service worker. I'll need to register the background script and any necessary permissions. The popup will need its own HTML and JS files. Also, I should include the features.js which exports the handleMessage function.

For the features.js, it should handle messages from the popup. The handleMessage function will manage starting and resetting the timer. Since the timer needs to persist even when the popup is closed, I'll need to use the background service worker to keep track of the time. But wait, service workers can be terminated, so maybe I should use chrome.alarms to handle the countdown? Or use setInterval? Hmm, but with V3, background scripts have limitations. Using chrome.alarms might be more reliable for scheduling the countdown steps.

Wait, maybe I can use a combination of storing the remaining time and using alarms to trigger updates. Let me think. When the user starts the timer, the background script sets an alarm for the next tick (e.g., every second). Each time the alarm triggers, it decrements the time and sends an update to the popup. If the timer is reset, it cancels the alarm and resets the time.

So in features.js, the handleMessage function will handle 'start' and 'reset' commands. It will manage the state of the timer, set alarms, and communicate with the popup.

Now, the popup.html needs to display the timer and have buttons. The popup.js will send messages to the background script when the buttons are clicked and update the display based on messages from the background.

For the countdown logic: the initial time is 25 minutes (1500 seconds). When started, each second, the background script reduces the time by 1, updates storage, and notifies the popup. When it reaches zero, maybe show a notification or alert, but the user didn't specify that, so maybe just stop.

In the manifest, I need to include permissions for alarms and storage. Also, the background script is in background.js, which imports features.js. The popup has the necessary scripts.

Let me outline the files:

manifest.json:
- name, version, manifest_version 3
- background: service_worker: "background.js"
- permissions: ["alarms", "storage", "scripting"]
- action: default_popup: "popup.html", default_icon...

features.js:
- exports handleMessage. Handles 'start' and 'reset' requests.
- On start, sets the initial time if not set, then schedules an alarm for 1 second.
- When the alarm triggers, it checks the current time, decrements, schedules next alarm if needed.
- Sends the updated time to the popup.
- On reset, cancels the alarm and resets the time.

popup.html:
- A simple UI with a display for the timer and two buttons: Start and Reset.

popup.js:
- Listens for messages from the background to update the display.
- Sends 'start' and 'reset' messages when buttons are clicked.

Now, coding each part.

In features.js, the handleMessage function will have a switch on request.action. For 'start', check if the timer is already running. If not, set the time to 1500 (25*60) and schedule the first alarm. For 'reset', set time to 1500 and cancel any existing alarm.

The alarm handler in background.js (which uses features.js) will need to be set up. Wait, how do I register the alarm handler? In the background script, I need to listen for alarms. So in background.js, after importing features.js, I can add chrome.alarms.onAlarm.addListener(...).

Wait, but the background script is separate. Let me structure background.js as:

import { handleMessage } from './features.js';

chrome.runtime.onMessage.addListener(handleMessage);

chrome.alarms.onAlarm.addListener(() => {
  // handle decrementing time and scheduling next alarm
});

But how to store the current time? Maybe use chrome.storage.sync or chrome.storage.local. Let's use chrome.storage.local to keep track of the remaining time and whether the timer is running.

So in handleMessage, when starting, set the remaining time to 1500 and set a flag that the timer is running. Then create an alarm for 1 second.

When the alarm triggers, check if the timer is running. If yes, subtract 1 from remaining time. If remaining time is >0, set another alarm for 1 second. If 0, stop.

Each time the time changes, send a message to the popup to update the display.

In popup.js, when it loads, it can request the current time from the background script. Also, listen for updates.

But how to get the current time when the popup opens? The popup can send a message like {action: 'getTime'}, and the background responds with the current time.

Wait, the handleMessage function in features.js is for handling messages from the popup. So in features.js, maybe add a case for 'getTime' to return the current time.

So, in features.js, handleMessage can handle different actions: 'start', 'reset', 'getTime'.

In the popup.js, on load, send a 'getTime' message and update the display. Then, listen for messages from the background to update as the timer runs.

--------------------------------------------
Benchmark Results (Real Extension Generation):
Total Time:       1659.74 ms
Time to First Token (TTFT): 507.44 ms
Total Tokens:     232
Tokens Per Second (TPS):    201.34 tokens/s
--------------------------------------------

Summary of Findings:
🚀 ULTRA-FAST SPEEDS DETECTED! (201 TPS)
   - This model is generating Code significantly faster than real-time reading speed.
⏱️  LOW LATENCY (507 ms TTFT)
--------------------------------------------
```

## Conclusions
- **Throughput**: The model achieved **201.34 TPS** while performing complex reasoning and code planning tasks. This confirms the "ultra-low latency" and high throughput capabilities of the Cerebras inference engine.
- **Latency**: The Time-To-First-Token (TTFT) was **507.44 ms**, providing near-instantaneous feedback.
