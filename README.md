# AI Browser-Extension Builder

A production-ready application that generates browser extensions from natural language prompts using AI. Built on the **Raindrop MCP** platform.

## Features

- **AI Code Generation**: Uses **Cerebras Inference** for ultra-low latency extension generation.
- **Smart Architecture**: Leverages **Raindrop Smart Primitives** (SmartSQL, SmartBucket, SmartMemory).
- **Async Processing**: Uses **Vultr Managed Kafka** (or Raindrop Queue) for reliable job processing.
- **Enterprise Auth**: Integrated with **WorkOS** for secure authentication.
- **Instant Download**: Automatically packages generated code into ZIP files.

## Tech Stack

- **Backend**: Node.js, Hono.js, TypeScript
- **Frontend**: React, Vite, Tailwind CSS
- **Platform**: Raindrop MCP
- **AI**: Cerebras (Llama 3.1)
- **Database**: Raindrop SmartSQL (SQL Database)
- **Storage**: Raindrop SmartBucket

## Setup & Deployment

### Prerequisites

- Node.js 18+
- Raindrop CLI (`npm install -g @liquidmetal-ai/raindrop`)
- Raindrop Account (`raindrop auth login`)

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configuration

Copy `.env.example` to `.env` (or set secrets in Raindrop Dashboard) and fill in your API keys:

- **WorkOS**: Get credentials from WorkOS dashboard.
- **Cerebras**: Get API key from Cerebras.
- **Vultr**: (Optional) Get Kafka credentials if using external queue.

### 3. Deploy to Raindrop

```bash
# From root directory
cd backend
raindrop build deploy --start
```

### 4. Run Frontend Locally

```bash
cd frontend
npm run dev
```

## Architecture

1.  **User** submits prompt via Frontend.
2.  **API Service** creates a job record in **SmartSQL** and enqueues it.
3.  **Job Processor** (Observer) picks up the job.
4.  **AI Service** calls **Cerebras** to generate extension code.
5.  **Archiver** zips the files.
6.  **SmartBucket** stores the ZIP file.
7.  **Frontend** polls for status and provides download link.

## License

MIT
