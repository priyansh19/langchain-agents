# Triage Routing Agent — Phase 5

Builds on Phase 4 by adding intelligent routing — the agent scores its own confidence and decides whether to answer locally or hand off to Claude. Low-confidence requests get a better answer from a stronger model instead of a poor one from the local LLM.

## What was built

- **ask_claude()** — Calls Claude CLI via subprocess, passing full conversation history as context
- **CONFIDENCE_THRESHOLD = 7** — Requests scoring 7+ stay local; below 7 route to Claude
- **chat() updated** — Now branches on confidence score and returns `handled_by` field
- **server.py** — Updated to expose `handled_by` in the `/chat` response
- **UI badges** — "via Claude" (purple) or "via Local" (grey) badge on every assistant message

## How routing works

```
User message
     ↓
score_confidence() → score 1-10
     ↓
score >= 7 → gemma4:26b answers locally
score <  7 → Claude CLI handles it
     ↓
Response + confidence + handled_by returned to UI
```

## What it does

- Routes each request to the right model based on self-assessed confidence
- Claude is invoked via the CLI (no API key needed in code — uses existing CLI auth)
- Full conversation history is passed to Claude for context
- UI shows which model handled each response

## Models

- **Local**: `gemma4:26b` via Ollama
- **Fallback**: Claude via `claude -p` CLI subprocess

## Endpoints

| Method | Path | What it does |
|--------|------|-------------|
| GET | `/capabilities` | Returns agent name, version, model, and feature flags |
| POST | `/chat` | Returns reply + tool steps + confidence score + handled_by |
| POST | `/clear` | Clears conversation history |

## Prerequisites

- Python 3.14+
- [Ollama](https://ollama.com) running locally with `gemma4:26b` pulled
- Claude CLI installed and signed in (`claude` command works in terminal)
- Agent Lab UI running (`npm run dev` inside `agent-ui/`)

## Setup

```bash
pip install langchain langchain-ollama langgraph fastapi uvicorn
ollama pull gemma4:26b
```

## Run

```bash
python -m uvicorn server:app --reload --port 8000
```

Then open **http://localhost:5173** in your browser.

## Project structure

```
Triage-Routing-Agent/
├── agent.py        # Tools + scorer + router + chat()
├── server.py       # FastAPI server (3 endpoints)
├── workspace/      # Files the agent creates live here
├── requirements.txt
└── Readme.md
```
