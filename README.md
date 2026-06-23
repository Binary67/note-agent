# RAG Engine

A personal knowledge base RAG (Retrieval-Augmented Generation) engine built with Next.js and Azure OpenAI. Upload documents, ask questions, and get answers grounded in your own content.

## Features

- **Document ingestion** — Upload `.txt`, `.pdf`, and audio files (`.mp3`, `.wav`, `.m4a`, etc.). Documents are chunked, embedded, and indexed automatically.
- **Hybrid search** — Combines semantic search (embeddings) with BM25 keyword search, fused via Reciprocal Rank Fusion for accurate retrieval.
- **Chat with your knowledge base** — Ask natural language questions and get AI-generated answers with source references.
- **Folder organization** — Group documents into folders for better context management.
- **Analytics** — Track questions answered, references reviewed, time saved, streaks, and daily activity.
- **Export/Import** — Bundle your entire knowledge base (documents, folders, indexes, metadata) as a `.zip` for backup or transfer.

## Setup

### Prerequisites

- Node.js 18+
- An Azure OpenAI resource with:
  - A chat model deployment (e.g., GPT-4o)
  - An embedding model deployment (e.g., `text-embedding-3-large`)
  - (Optional) A Whisper model deployment for audio transcription

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-large
```

For audio transcription support, add:

```env
AZURE_OPENAI_TRANSCRIPTION_API_KEY=your-api-key
AZURE_OPENAI_TRANSCRIPTION_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT=whisper
AZURE_OPENAI_TRANSCRIPTION_API_VERSION=2024-10-01-preview
```

Optional tuning:

```env
CHUNK_SIZE=800
CHUNK_OVERLAP=120
INGESTION_CONCURRENCY=1
AZURE_OPENAI_TRANSCRIPTION_MAX_BYTES=25165824
```

## Running

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Other commands

```bash
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## How It Works

1. **Upload** documents via drag-and-drop or file picker. PDFs are converted to Markdown via Azure OpenAI vision. Audio files are transcribed via Whisper.
2. **Ingest** — Click "Ingest All" to chunk, embed, and index all ready documents. Progress is shown in real time.
3. **Chat** — Select documents or folders as context, then ask questions. The engine retrieves the most relevant chunks and generates an answer with citations.
4. **Analytics** — View usage stats on the Analytics tab.

Data is stored locally as JSON files under `./data/` (gitignored). No external database required.

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| AI/LLM | Azure OpenAI (chat, embeddings, Whisper) |
| PDF | pdf-lib, Azure OpenAI vision extraction |
| Audio | ffmpeg-static, Azure OpenAI Whisper |
| Search | Hybrid: cosine similarity + BM25 + RRF |
