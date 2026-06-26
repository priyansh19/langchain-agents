from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import agent

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/capabilities")
def capabilities():
    return {
        "agent_name": "Confidence Scoring Agent",
        "version": "4.0",
        "model": "gemma4:latest",
        "features": {
            "memory": True,
            "persona": False,
            "tools": True,
            "rag": False,
            "confidence_scoring": True,
            "triage_routing": True
        }
    }

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
def chat(req: ChatRequest):
    result = agent.chat(req.message)
    return {
        "response": result["response"],
        "tool_steps": result["tool_steps"],
        "confidence": result["confidence"],
        "handled_by": result["handled_by"],
        "memory_used": result["memory_used"]
    }

class PersonaRequest(BaseModel):
    persona: str

@app.post("/clear")
def clear():
    agent.clear_history()
    return {"status": "cleared"}

class ConfigRequest(BaseModel):
    threshold: int

@app.get("/config")
def get_config():
    return {"threshold": agent.CONFIDENCE_THRESHOLD}

@app.patch("/config")
def update_config(req: ConfigRequest):
    agent.CONFIDENCE_THRESHOLD = max(1, min(10, req.threshold))
    return {"threshold": agent.CONFIDENCE_THRESHOLD}

@app.post("/persona")
def set_persona(req: PersonaRequest):
    agent.set_persona(req.persona)
    return {"status": "persona updated"}