# Mach1 — Local-First AI Agent

> *"Sometimes you gotta run before you can walk."* — Tony Stark

Mach1 is a personal AI agent built for speed, privacy, and intelligence. It runs locally using open-source LLMs, routes hard questions to Claude only when needed, and remembers everything across sessions — like a co-worker who never forgets.

---

## Architecture

![Mach1 Architecture](./mach1-architecture.png)

---

## How It Works

**Every message goes through this pipeline:**

1. **User Prompt** + chat history + system prompt → loaded into **Working Memory**
2. Working Memory is enriched with relevant context via **RAG Top-k search** from Episodic and Semantic memory stores, plus **Skill.md** from Procedural memory
3. A **Triaging Agent** (local LLM scoring agent) scores how confidently the local model can handle the request
   - **Score > 7** → answered by the **Local LLM Agent** directly
   - **Score < 7** → routed to **Claude** via MCP connector → Claude submits response back through the Local LLM Agent
4. The response is returned to the user
5. The exchange is **saved to memory** — and if N chats have accumulated, the **Summarizer Agent** distills them into facts that flow back into Semantic Memory

---

## Memory System

| Layer | Type | What's Stored | How Retrieved |
|---|---|---|---|
| **Working Memory** | In-process RAM | Current conversation + injected context | Direct (always present) |
| **Episodic Memory** | ChromaDB vector store | Dated events, past chat history | RAG Top-k similarity search |
| **Semantic Memory** | ChromaDB vector store | Durable facts, user profile | RAG Top-k similarity search |
| **Procedural Memory** | Files on disk | Skill.md, how to act with user | Loaded at startup via Skill.md |

The **Summarizer Agent** runs only when total saved chats reaches N — it distills raw episodic memory into clean semantic facts, keeping the vector store sharp over time.

---

## Triage Routing

Every message is scored 1–10 by a local LLM before answering:

| Score | Action | Cost |
|---|---|---|
| ≥ threshold (default 7) | Answered locally by Ollama | Free, private, instant |
| < threshold | Routed to Claude via MCP | Tokens, but powerful |

The threshold is adjustable live from the UI — no restart needed. The goal: **90%+ of messages answered locally**.

---

## Three Modes

| Mode | Purpose |
|---|---|
| **Chat** | Conversational AI with memory, routing badges, artifact panel, quick-reply chips |
| **Cowork** | Agentic task queue — describe a task, agent plans + executes with approval gates |
| **Code** | File browser, diff viewer, terminal pane, code-focused agent sessions |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Agent framework | LangChain + LangGraph (`create_react_agent`) |
| Local LLM | Ollama — `gemma3:4b` / `gemma4:27b` |
| Cloud fallback | Claude (Anthropic) via MCP connector |
| Embeddings | `nomic-embed-text` via Ollama |
| Vector DB | ChromaDB (embedded, no server needed) |
| API server | FastAPI + Uvicorn |
| UI | React + TypeScript + Vite |
| Styling | Vanilla CSS (GitHub-dark design system) |

---

## Build Phases

```
mach-1/
├── p1-Simple-Langchain-AI-Agent/    ✅  Phase 1: Basic LangChain chatbot
├── p2-Giving-ai-agent-persona/      ✅  Phase 2: Persona + FastAPI server
├── p3-Tool-Using-Agent/             ✅  Phase 3: File tools + LangGraph
├── p4-Confidence-Scoring-Agent/     ✅  Phase 4: Confidence scoring (1–10)
├── p5-Triage-Routing-Agent/         ✅  Phase 5: Local vs Claude routing
├── p6-Episodic-Memory-Agent/        ✅  Phase 6: ChromaDB episodic memory
├── p7-Semantic-Memory-Agent/        ✅  Phase 7: Fact extraction + semantic store
├── p8-LangGraph-Tools-Agent/        🔧  Phase 8: Custom LangGraph graph + web search + MCP tools + summarizer
├── p9-Three-Mode-Shell/             ⬜  Phase 9: Chat / Cowork / Code shell
├── p10-Cowork-Mode/                 ⬜  Phase 10: Task cards + approval gates
├── p11-Code-Mode/                   ⬜  Phase 11: Diff, terminal, file editor
└── agent-ui/                        ✅  React + TypeScript UI (all phases)
```

**Milestone:** Combine all phases → **Mach1 v1.0**

---

## Running Locally

```bash
# 1. Start Ollama with your model
ollama pull gemma3:4b
ollama pull nomic-embed-text
ollama serve

# 2. Start the agent server (from the latest phase folder)
cd p7-Semantic-Memory-Agent
pip install -r requirements.txt
python server.py
# → http://localhost:8000

# 3. Start the UI
cd ../agent-ui
npm install
npm run dev
# → http://localhost:5173
```

---

## What Makes This Different

1. **Local-first triage** — runs 90%+ locally, escalates only when genuinely uncertain. Visible, tunable confidence threshold
2. **Cost transparency** — every message shows `$0.00` (local) or `~$0.003` (cloud). Running cost counter + lifetime local rate
3. **Privacy by default** — local responses show a lock icon: *"This response never left your machine"*
4. **Memory that lasts** — remembers past conversations, extracts long-term facts, distills them over time
5. **Zero API key required** — Claude is called via CLI/MCP using your existing auth

---

*Built by Priyansh · [priyansh.9071@gmail.com](mailto:priyansh.9071@gmail.com)*
