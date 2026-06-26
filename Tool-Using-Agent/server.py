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
        "agent_name": "File Operations Agent",
        "version": "3.0",
        "model": "llama3.2",
        "features": {
            "memory": True,
            "persona": True,
            "tools": True,
            "rag": False
        }
    }

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
def chat(req: ChatRequest):
    result = agent.chat(req.message)
    return {"response": result["response"], "tool_steps": result["tool_steps"]}

class PersonaRequest(BaseModel):
    persona: str

@app.post("/clear")
def clear():
    agent.clear_history()
    return {"status": "cleared"}

@app.post("/persona")
def set_persona(req: PersonaRequest):
    agent.set_persona(req.persona)
    return {"status": "persona updated"}