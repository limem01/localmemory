# 🧠 LocalMemory

> **Your private second brain that remembers everything forever — 100% local, proactive, and yours.**

LocalMemory is a full-stack AI knowledge management system that runs entirely on your machine. Upload documents, chat with your knowledge base, and let your AI assistant proactively surface insights — all without a single byte leaving your computer.

<img width="1526" height="917" alt="image" src="https://github.com/user-attachments/assets/dbc146b7-11b5-4611-8ffc-3ae9df1f990e" />


---

## ✨ Features

- **📄 Document Ingestion** — Upload PDFs, Word docs, text files, and Markdown. Automatic chunking and embedding.
- **🔍 Semantic Search** — ChromaDB vector storage with `nomic-embed-text` embeddings for intelligent retrieval.
- **💬 RAG Chat** — Ask questions and get streamed responses grounded in your actual documents with source citations.
- **🧠 Memory System** — Capture facts, preferences, and insights. Pin important memories. Auto-generate daily digests.
- **📁 Folder Watching** — Drop files into a watched folder and they're automatically ingested.
- **⏰ Proactive Digests** — APScheduler generates a daily summary of your knowledge base every morning.
- **🌙 Beautiful Dark UI** — Next.js 15 with Tailwind CSS and shadcn/ui components.
- **🔒 100% Local** — Ollama runs your LLM and embeddings. No API keys, no cloud, no telemetry.

---

## 🚀 Quick Start (Docker)

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/localmemory.git
cd localmemory

# 2. Start everything with one command
docker compose up -d

# 3. Pull required models (first time only)
docker exec localmemory-ollama ollama pull llama3.2
docker exec localmemory-ollama ollama pull nomic-embed-text

# 4. Open your browser
open http://localhost:3000
```

That's it! LocalMemory will be running at **http://localhost:3000**.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | FastAPI, Python 3.12, SQLAlchemy, Pydantic |
| **AI/LLM** | Ollama (llama3.2 or any local model) |
| **Embeddings** | nomic-embed-text via Ollama |
| **Vector DB** | ChromaDB (persistent, local) |
| **Metadata DB** | SQLite (WAL mode, zero config) |
| **Scheduling** | APScheduler (daily digests) |
| **File Watch** | Watchdog (auto-ingest from folder) |
| **Deployment** | Docker Compose |

---

## ⚙️ Configuration

Copy `.env.example` to `.env` in the `backend/` directory:

```bash
cp backend/.env.example backend/.env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_LLM_MODEL` | `llama3.2` | LLM for chat (any Ollama model) |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Embedding model |
| `DATABASE_URL` | SQLite | Metadata database path |
| `CHROMA_PATH` | `/app/data/chroma` | ChromaDB storage directory |
| `UPLOAD_DIR` | `/app/data/uploads` | Uploaded file storage |
| `WATCHED_DIR` | `/app/data/watched` | Auto-watched folder |
| `CHUNK_SIZE` | `1000` | Characters per text chunk |
| `CHUNK_OVERLAP` | `200` | Overlap between chunks |
| `RETRIEVAL_TOP_K` | `5` | Max context chunks per query |
| `DIGEST_HOUR` | `8` | Daily digest generation hour (UTC) |

### Changing the LLM Model

Any model available via `ollama pull` works. Popular choices:

```bash
ollama pull llama3.2          # Default, fast, 2B params
ollama pull llama3.1:8b       # More capable, 8B params
ollama pull mistral           # Great balance of speed/quality
ollama pull deepseek-r1:8b    # Reasoning model
```

Then update `OLLAMA_LLM_MODEL` in your config.

---

## 🏗 Development Setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your local paths

uvicorn app.main:app --reload --port 8000
```

API docs available at: **http://localhost:8000/api/docs**

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend available at: **http://localhost:3000**

---

## 📁 Auto-Watch Folder

Files placed in `backend/data/watched/` (or configured `WATCHED_DIR`) are automatically ingested every 2 minutes. Supported formats: `.pdf`, `.txt`, `.docx`, `.md`

---

## 🔒 Privacy & Security

- **No telemetry** — ChromaDB telemetry is disabled
- **No API calls** — Everything runs on Ollama locally
- **No data leaves your machine** — Ever
- **SQLite + ChromaDB** — Both store data in `backend/data/` which you own
- **Secret key** — Change `SECRET_KEY` in production even for local use

---

## 📝 License

MIT — do whatever you want with it.
