# AI Extension Builder

**Build Chrome Extensions in seconds using AI.**

This project is a high-performance web application that leverages **Cerebras** for ultra-fast AI inference and the **Raindrop Framework** for a scalable, service-oriented backend. It generates full-featured, Manifest V3 compliant browser extensions from simple text prompts.

## 🚀 Key Features

*   **Instant Generation**: Powered by `gpt-oss-120b` via Cerebras, offering blazing fast code generation.
*   **Structured Output**: Robust JSON generation using Native JSON Mode to ensure valid, compilable code every time.
*   **Agentic Interface (MCP)**: Implements the **Model Context Protocol**, allowing AI agents (like Claude or IDE assistants) to interact with the builder programmatically (`generate_extension`, `check_status`).
*   **Streaming UI**: Real-time progress updates ("Generating...", "Compressing...", "Done") for a responsive user experience.
*   **Secure & Scalable**: Managed authentication via WorkOS and asynchronous job processing.

## 🏗️ Architecture

Built on **Raindrop**, a modern comprehensive framework for scalable apps.

### Core Services
The backend (`/backend`) is composed of three micro-services working in unison:

1.  **`service "api"`**:
    *   **Role**: The public gateway (Hono.js). Handles Authentication (WorkOS), validates requests, and serves the REST API.
    *   **Logic**: Enqueues generation jobs to the `GENERATION_QUEUE` and serves status/downloads.

2.  **`service "job-processor"`**:
    *   **Role**: The background worker.
    *   **Logic**: Consumes jobs from the queue, calls the AI Service, creates the ZIP archive, and uploads to Object Storage.
    *   **Scalability**: Decoupled from the API to handle high load.

3.  **`mcp_service "extension-builder"`**:
    *   **Role**: The Agent Interface.
    *   **Logic**: Exposes the application logic as Tools (Functions) that LLMs can call. This enables "Agentic" usage where an AI assistant drives the application.

### Data & Infrastructure
*   **Database**: `smart_sql_database "extension_db"` (Production-grade SQL).
*   **Storage**: `bucket "extension_storage"` (Object storage for generated ZIPs).
*   **Queue**: `queue "generation_queue"` (Async processing).
    *   *Note*: The architecture follows a "Ports & Adapters" pattern. While currently using the Raindrop Internal Queue, the system is designed to seamlessly plug in **Vultr Kafka** for massive scale.
*   **AI**: **Cerebras Inference API** (`gpt-oss-120b`).

## 🛠️ Technology Stack

*   **Frontend**: React, Vite, TypeScript, TailwindCSS.
*   **Backend**: TypeScript, Hono, Raindrop Framework.
*   **AI**: Cerebras (`gpt-oss-120b`).
*   **Auth**: WorkOS.

## 🧠 Generation Strategy

To ensure high reliability and Strict Manifest V3 compliance, this project uses a multi-layered approach:

1.  **Global JSON Schema**: Valid permissions are dynamically fetched from the [Chrome Manifest Schema](https://json.schemastore.org/chrome-manifest). This creates a strict whitelist, preventing the AI from hallucinating fake or legacy permissions.
2.  **Golden Reference Injection**: A perfect, "Golden" example of a Manifest V3 extension is injected into the system prompt. This uses One-Shot Prompting to visually anchor the model to the correct syntax.
3.  **Framework Contract**: The AI does NOT write the entire codebase. It fills in specific slots (feature logic, UI) within a pre-built, robust Service Worker router (`background_router`). This guarantees that async message handling—the hardest part of V3—is always correct.
4.  **Rule Enforcement**: Explicit deny-lists block deprecated patterns like `webRequestBlocking` and `browser_action`.

## 🏃‍♂️ Getting Started

### Prerequisites
*   Node.js 18+
*   Raindrop CLI (`npm i -g @liquidmetal-ai/raindrop@latest`)
*   Cerebras API Key
*   WorkOS Keys

### Installation

1.  **Clone & Install**:
    ```bash
    git clone <repo>
    cd ai-extension-builder
    npm install --prefix frontend
    npm install --prefix backend
    ```

2.  **Environment Setup**:
    Copy `.env.example` to `.env` in `backend` and fill in your keys.

3.  **Run Locally (Full Stack)**:
    Start the Raindrop backend services:
    ```bash
    cd backend
    npm run raindrop:build:start
    ```
    Start the Frontend:
    ```bash
    cd frontend
    npm run dev
    ```

4.  **Access**: Open `http://localhost:5173`.
