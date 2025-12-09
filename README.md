# AI Extension Builder

**Build Chrome Extensions in seconds using AI.**

This project is a high-performance web application that leverages **Cerebras** for ultra-fast AI inference and the **Raindrop Framework** for a scalable, service-oriented backend. It generates full-featured, Manifest V3 compliant browser extensions from simple text prompts.

## 🚀 Key Features

*   **Instant Generation**: Powered by `llama-3.3-70b` via Cerebras, offering blazing fast code generation.
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
*   **AI**: **Cerebras Inference API** (`llama-3.3-70b`).

## 🛠️ Technology Stack

*   **Frontend**: React, Vite, TypeScript, TailwindCSS.
*   **Backend**: TypeScript, Hono, Raindrop Framework.
*   **AI**: Cerebras (`llama-3.3-70b`).
*   **Auth**: WorkOS.

## 🏃‍♂️ Getting Started

### Prerequisites
*   Node.js 18+
*   Raindrop CLI (`npm install -g @liquidmetal-ai/raindrop-cli`)
*   Cerebras API Key
*   WorkOS Keys

### Installation

1.  **Clone & Install**:
    ```bash
    git clone <repo>
    cd ai-extension-builder
    npm install
    cd frontend && npm install
    cd ../backend && npm install
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
