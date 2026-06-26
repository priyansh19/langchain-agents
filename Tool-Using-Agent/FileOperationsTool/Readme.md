# Tool-Using Agent — Phase 3

Builds on Phase 2 by giving the agent real tools it can use to interact with the filesystem. The agent decides on its own which tool to call based on what you ask — no hardcoded logic.

## What was built

- **Block 1–3** — Defined three file tools: `create_file`, `read_file`, `edit_file`
- **Block 4** — Added `append_to_file` to safely add content without overwriting
- **Block 5** — Wired the tools to `llama3.2` using LangGraph's `create_agent`
- **Block 6** — Refactored into a `chat()` function that returns `tool_steps` for the UI
- **server.py** — FastAPI server that exposes the agent; `/chat` now returns which tools were called
- **UI integration** — Agent Lab UI shows a collapsible Tool Steps card per response

## What it does

- Creates, reads, edits, and appends to files inside a `workspace/` folder
- The model decides which tool to use based on the request — no explicit routing
- Remembers the full conversation history within a session
- Returns tool call details so the UI can show exactly what the agent did

## How tools work

The `@tool` decorator turns a Python function into something the LLM understands. The docstring is what the model reads to decide whether to use the tool. LangGraph's `create_agent` handles the think → call → observe → respond loop.

## Endpoints

| Method | Path | What it does |
|--------|------|-------------|
| GET | `/capabilities` | Returns agent name, version, model, and feature flags |
| POST | `/chat` | Sends a message, returns reply + list of tool steps |
| POST | `/clear` | Clears conversation history |

## Prerequisites

- Python 3.14+
- [Ollama](https://ollama.com) running locally with `llama3.2` pulled
- Agent Lab UI running (`npm run dev` inside `agent-ui/`)

## Setup

```bash
pip install langchain langchain-ollama langgraph fastapi uvicorn
```

## Run

```bash
python -m uvicorn server:app --reload --port 8000
```

Then open **http://localhost:5173** in your browser.

## Project structure

```
FileOperationsTool/
├── agent.py        # Tool definitions + LangGraph agent + chat() function
├── server.py       # FastAPI server (3 endpoints)
├── workspace/      # All files the agent creates live here
├── requirements.txt
└── Readme.md
```
