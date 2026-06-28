from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import agent

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/capabilities")
def capabilities():
    return {
        "agent_name": "Mach 1",
        "version": "4.0",
        "model": "gemma4:latest",
        "features": {
            "memory": True,
            "persona": True,
            "tools": True,
            "rag": True,
            "confidence_scoring": True,
            "triage_routing": True
        }
    }

class ChatRequest(BaseModel):
    message: str
    force_model: str = None
    system_prompt: str = None

@app.post("/chat")
def chat(req: ChatRequest):
    result = agent.chat(req.message, force_model=req.force_model, system_prompt_override=req.system_prompt)
    return {
        "response": result["response"],
        "tool_steps": result.get("tool_steps", []),
        "confidence": result.get("confidence"),
        "handled_by": result.get("handled_by"),
        "memory_used": result.get("memory_used", False),
        "facts_learned": result.get("facts_learned", 0)
    }

@app.post("/clear")
def clear():
    agent.clear_history()
    return {"status": "cleared"}

class ConfigRequest(BaseModel):
    threshold: int

@app.get("/config")
def get_config():
    return {"threshold": agent.config["threshold"]}

@app.patch("/config")
def update_config(req: ConfigRequest):
    agent.config["threshold"] = max(1, min(10, req.threshold))
    return {"threshold": agent.config["threshold"]}

