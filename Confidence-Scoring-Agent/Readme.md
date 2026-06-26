# Confidence Scoring Agent — Phase 4

Builds on Phase 3 by giving the agent self-awareness — before responding, it rates how confidently it can handle the request on a scale of 1 to 10. This score is returned alongside every response and shown as a color-coded badge in the UI.

## What was built

- **score_confidence()** — A separate LLM call that asks the model to rate its own confidence (1–10) before answering
- **chat()** updated — Now returns `confidence` score alongside `response` and `tool_steps`
- **System prompt** — Added to prevent the model from calling file tools during general conversation
- **UI badge** — Confidence score appears on every assistant message: green (8–10), yellow (5–7), red (1–4)

## What it does

- Scores confidence before every response using a dedicated prompt
- Only uses file tools when the user explicitly asks to create, read, edit, or manage files
- Returns confidence score to the UI so the user can see how certain the model is
- Keeps full conversation history within a session

## Why this matters

This is the foundation for the Triage Routing Agent (Phase 5). Once we can score confidence, we can route low-confidence requests to a stronger model (Claude) instead of answering poorly with the local LLM.

## Model

Uses `gemma4:26b` via Ollama — a 26B parameter model that follows tool-calling instructions reliably.

## Endpoints

| Method | Path | What it does |
|--------|------|-------------|
| GET | `/capabilities` | Returns agent name, version, model, and feature flags |
| POST | `/chat` | Returns reply + tool steps + confidence score (1–10) |
| POST | `/clear` | Clears conversation history |

## Prerequisites

- Python 3.14+
- [Ollama](https://ollama.com) running locally with `gemma4:26b` pulled
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
Confidence-Scoring-Agent/
├── agent.py        # Tools + LangGraph agent + confidence scorer + chat()
├── server.py       # FastAPI server (3 endpoints)
├── workspace/      # Files the agent creates live here
├── requirements.txt
└── Readme.md
```
