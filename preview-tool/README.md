# AI Extension Preview

A local companion tool for the **AI Extension Builder**.
This tool allows you to instantly preview and test your AI-generated Chrome Extensions locally, bridging the gap between the **AI Extension Builder** and your local browser.

## Features

-   **Instant Preview:** Launches a Chrome instance with your extension loaded.
-   **Live Updates:** Automatically detects new builds from the AI Builder and reloads your extension (Hot Reload).
-   **Secure Connection:** Uses a short-code "Device Flow" authentication to securely link to your account.
-   **Cross-Platform:** Works on Windows, macOS, and Linux (including WSL/Git Bash via Detached Mode).

## Usage

You do NOT need to install this package globally. Just run it with `npx`:

```bash
npx ai-extension-preview
```

### Setup Flow

1.  Run the command above.
2.  The tool will display a **Link Code** (e.g., `ABCD`).
3.  Go to your **AI Extension Builder Dashboard**.
4.  Click **"Connect Preview"** and enter the code.
5.  Enjoy! The tool will automatically download and launch your active extension.

## Requirements

-   Node.js v18+
-   Google Chrome or Chromium installed.
