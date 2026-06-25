# Simple LangChain AI Agent — Phase 1

A basic conversational chatbot built with LangChain and Ollama. This is Phase 1 of a progressive AI agents learning journey.

## What was built

This phase was built incrementally, one block at a time:

- **Block 1** — Connected LangChain to a locally running Ollama model (`llama3.2`) and got a response
- **Block 2** — Made the input dynamic so the user can type any message
- **Block 3** — Added a `while` loop so the conversation keeps going
- **Block 4** — Added conversation memory using `HumanMessage` and `AIMessage` so the model remembers what was said earlier in the session

## What it does

- Runs as a terminal chatbot
- Accepts user input and replies using the local `llama3.2` model via Ollama
- Remembers the full conversation history within a session

## Prerequisites

- Python 3.14+
- [Ollama](https://ollama.com) installed and running locally with the `llama3.2` model pulled

To pull the model if you haven't already:
```bash
ollama pull llama3.2
```

## Setup

Install dependencies:
```bash
pip install langchain langchain-ollama
```

## Run

```bash
python agent.py
```

Type your message and press Enter. The assistant will reply. Type another message to continue the conversation. Press `Ctrl+C` to exit.

## Project structure

```
Simple-Langchain-AI-Agent/
├── agent.py          # The chatbot logic
├── requirements.txt  # Python dependencies
└── Readme.md
```
