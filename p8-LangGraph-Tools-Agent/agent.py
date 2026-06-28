from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_community.tools import DuckDuckGoSearchRun, WikipediaQueryRun
from langchain_community.utilities import WikipediaAPIWrapper
from langchain_community.tools.shell import ShellTool
from langchain_community.tools.file_management import ListDirectoryTool, FileSearchTool
from langchain_experimental.utilities import PythonREPL
from langgraph.prebuilt import ToolNode
from langchain_core.tools import tool as tool_decorator
from langchain_ollama import ChatOllama
from langchain_core.tools import tool
import requests
import chromadb, uuid, subprocess, os, warnings
from chromadb.utils import embedding_functions
from bs4 import BeautifulSoup

class AgentState(TypedDict):
    messages:     Annotated[list, add_messages]
    confidence:   int
    handled_by:   str
    tool_steps:   list
    memory_used:  bool
    facts_learned: int
    turn_count:   int

warnings.filterwarnings("ignore")
WORKSPACE = "workspace"
os.makedirs(WORKSPACE, exist_ok=True)

chroma_client = chromadb.PersistentClient(path="memory")
ollama_ef = embedding_functions.OllamaEmbeddingFunction(
    url="http://localhost:11434/api/embeddings",
    model_name="nomic-embed-text"
)

episodic = chroma_client.get_or_create_collection("episodic_memory", embedding_function=ollama_ef)
semantic  = chroma_client.get_or_create_collection("semantic_memory",  embedding_function=ollama_ef)

def save_episodic(role: str, content: str):
    episodic.add(documents=[f"{role}: {content}"], ids=[str(uuid.uuid4())])

def retrieve_episodic(query: str, n=3) -> str:
    if episodic.count() == 0: return ""
    docs = episodic.query(query_texts=[query], n_results=n)["documents"][0]
    return "\n".join(docs)

def retrieve_semantic(query: str, n=3) -> str:
    if semantic.count() == 0: return ""
    docs = semantic.query(query_texts=[query], n_results=n)["documents"][0]
    return "\n".join(docs)

llm = ChatOllama(model="gemma4:latest")

def score_confidence(message: str) -> int:
    prompt = f"Rate how confidently you can answer this on a scale of 1-10. Reply with ONLY a number. Request: {message}"
    try:
        return int(llm.invoke([HumanMessage(content=prompt)]).content.strip())
    except:
        return 5

@tool
def create_file(filename: str, content: str) -> str:
    """Create a file with the given filename and content."""
    with open(os.path.join(WORKSPACE, filename), "w") as f:
        f.write(content)
    return f"File '{filename}' created."

@tool
def read_file(filename: str) -> str:
    """Read and return the contents of a file."""
    path = os.path.join(WORKSPACE, filename)
    if not os.path.exists(path): return f"Error: '{filename}' does not exist."
    with open(path) as f: return f.read()

@tool
def edit_file(filename: str, content: str) -> str:
    """Completely replace a file's content."""
    path = os.path.join(WORKSPACE, filename)
    if not os.path.exists(path): return f"Error: '{filename}' does not exist."
    with open(path, "w") as f: f.write(content)
    return f"File '{filename}' updated."

@tool
def append_to_file(filename: str, content: str) -> str:
    """Append content to the end of an existing file."""
    path = os.path.join(WORKSPACE, filename)
    if not os.path.exists(path): return f"Error: '{filename}' does not exist."
    with open(path, "a") as f: f.write("\n" + content)
    return f"Appended to '{filename}'."

@tool
def delete_file(filename: str) -> str:
    """Delete a file from the workspace."""
    path = os.path.join(WORKSPACE, filename)
    if not os.path.exists(path): return f"Error: '{filename}' does not exist."
    os.remove(path)
    return f"File '{filename}' deleted."

@tool
def edit_section(filename: str, old_text: str, new_text: str) -> str:
    """Replace a specific section of text in a file without rewriting the whole file."""
    path = os.path.join(WORKSPACE, filename)
    if not os.path.exists(path): return f"Error: '{filename}' does not exist."
    with open(path, "r") as f: content = f.read()
    if old_text not in content: return f"Error: section not found in '{filename}'."
    with open(path, "w") as f: f.write(content.replace(old_text, new_text, 1))
    return f"Section updated in '{filename}'."

@tool
def browse_url(url: str) -> str:
    """Fetch and return the readable text content of any webpage URL."""
    try:
        response = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(response.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer"]): tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
        return text[:3000]
    except Exception as e:
        return f"Error browsing URL: {e}"
    
@tool_decorator
def search_stackoverflow(query: str) -> str:
    """Search Stack Overflow for coding questions and answers."""
    import requests
    url = "https://api.stackexchange.com/2.3/search/advanced"
    params = {"order": "desc", "sort": "relevance", "q": query, "site": "stackoverflow", "pagesize": 3}
    r = requests.get(url, params=params, timeout=10).json()
    results = []
    for item in r.get("items", []):
        results.append(f"Q: {item['title']}\nLink: {item['link']}\nAnswered: {item['is_answered']}")
    return "\n\n".join(results) if results else "No results found."

_repl = PythonREPL()

@tool_decorator
def python_repl(code: str) -> str:
    """Execute Python code and return the output. Use for calculations, data processing, and scripting."""
    return _repl.run(code)


shell     = ShellTool()
list_dir  = ListDirectoryTool()
file_search = FileSearchTool()
web_search = DuckDuckGoSearchRun()
wikipedia  = WikipediaQueryRun(api_wrapper=WikipediaAPIWrapper())

tools = [
    create_file, read_file, edit_file, edit_section,
    append_to_file, delete_file,
    shell, list_dir, file_search, python_repl,
    web_search, wikipedia, browse_url, search_stackoverflow
]

system_prompt = ""
config = {"threshold": 7}
sessions: dict = {}
session_turns: dict = {}

def create_session() -> str:
    sid = str(uuid.uuid4())
    sessions[sid] = []
    session_turns[sid] = 0
    return sid

def delete_session(sid: str):
    sessions.pop(sid, None)
    session_turns.pop(sid, None)


def triage_node(state: AgentState) -> AgentState:
    message = state["messages"][-1].content
    score = score_confidence(message)
    return {**state, "confidence": score}

def route_after_triage(state: AgentState) -> str:
    if state["confidence"] >= config["threshold"]:
        return "local"
    return "claude"

llm_with_tools = llm.bind_tools(tools)
tool_node = ToolNode(tools)

def local_node(state: AgentState) -> AgentState:
    past  = retrieve_episodic(state["messages"][-1].content)
    facts = retrieve_semantic(state["messages"][-1].content)
    context_parts = []
    if past:  context_parts.append(f"Past conversations:\n{past}")
    if facts: context_parts.append(f"Known facts:\n{facts}")
    context = "\n\n".join(context_parts)
    sys_parts = []
    if system_prompt: sys_parts.append(system_prompt)
    if context:       sys_parts.append(context)
    combined_system = "\n\n".join(sys_parts)
    messages = ([SystemMessage(content=combined_system)] if combined_system else []) + list(state["messages"])
    tool_steps = []
    while True:
        response = llm_with_tools.invoke(messages)
        messages.append(response)
        if not response.tool_calls:
            break
        tool_results = tool_node.invoke({"messages": messages})
        messages = tool_results["messages"]
        for tc in response.tool_calls:
            tool_steps.append({"tool": tc["name"], "input": str(tc["args"])})
    return {**state, "messages": [AIMessage(content=response.content)], "handled_by": "local llm", "tool_steps": tool_steps, "memory_used": bool(past)}

def claude_node(state: AgentState) -> AgentState:
    history = ""
    for msg in state["messages"][:-1]:
        if isinstance(msg, HumanMessage): history += f"User: {msg.content}\n"
        elif isinstance(msg, AIMessage): history += f"Assistant: {msg.content}\n"
    last = state["messages"][-1].content
    full_prompt = f"{history}User: {last}\nAssistant:"
    result = subprocess.run(["claude", "-p", full_prompt, "--dangerously-skip-permissions"], capture_output=True, text=True)
    response = result.stdout.strip()
    return {**state, "messages": [AIMessage(content=response)], "handled_by": "claude", "tool_steps": [], "memory_used": False}

def memory_save_node(state: AgentState) -> AgentState:
    messages = state["messages"]
    user_msg = next((m for m in reversed(messages) if isinstance(m, HumanMessage)), None)
    ai_msg   = next((m for m in reversed(messages) if isinstance(m, AIMessage)), None)
    if user_msg: save_episodic("user", user_msg.content)
    if ai_msg:   save_episodic("assistant", ai_msg.content)
    return {**state, "turn_count": state["turn_count"] + 1}

SUMMARIZE_EVERY = 10

def summarizer_node(state: AgentState) -> AgentState:
    if episodic.count() == 0: return state
    raw = episodic.query(query_texts=["conversation summary"], n_results=10)["documents"][0]
    combined = "\n".join(raw)
    prompt = f"""Extract 3-5 concise facts about the user or their work from these conversations. Reply with one fact per line. If nothing useful, reply NONE.{combined}"""
    response = llm.invoke([HumanMessage(content=prompt)])
    lines = [l.strip() for l in response.content.strip().split("\n") if l.strip() and l.strip() != "NONE"]
    for fact in lines:
        semantic.add(documents=[fact], ids=[str(uuid.uuid4())])
    return {**state, "facts_learned": len(lines)}

def route_after_memory(state: AgentState) -> str:
    if state["turn_count"] % SUMMARIZE_EVERY == 0:
        return "summarize"
    return "end"

graph_builder = StateGraph(AgentState)

graph_builder.add_node("triage",    triage_node)
graph_builder.add_node("local",     local_node)
graph_builder.add_node("claude",    claude_node)
graph_builder.add_node("save",      memory_save_node)
graph_builder.add_node("summarize", summarizer_node)

graph_builder.set_entry_point("triage")

graph_builder.add_conditional_edges("triage", route_after_triage, {"local": "local", "claude": "claude"})
graph_builder.add_edge("local",  "save")
graph_builder.add_edge("claude", "save")
graph_builder.add_conditional_edges("save", route_after_memory, {"summarize": "summarize", "end": END})
graph_builder.add_edge("summarize", END)

graph = graph_builder.compile()

def chat(message: str, session_id: str = None, force_model: str = None, system_prompt_override: str = None) -> dict:
    global system_prompt
    if session_id not in sessions:
        sessions[session_id] = []
        session_turns[session_id] = 0

    history = sessions[session_id]

    if force_model == "local":    override_score = 10
    elif force_model == "claude": override_score = 0
    else:                         override_score = None

    history.append(HumanMessage(content=message))
    if system_prompt_override:
        system_prompt = system_prompt_override

    initial_state: AgentState = {
        "messages":     history,
        "confidence":   override_score if override_score is not None else 5,
        "handled_by":   "",
        "tool_steps":   [],
        "memory_used":  False,
        "facts_learned": 0,
        "turn_count":   session_turns.get(session_id, 0),
    }

    result = graph.invoke(initial_state)
    response = result["messages"][-1].content
    history.append(AIMessage(content=response))
    session_turns[session_id] = result["turn_count"]

    return {
        "response":     response,
        "tool_steps":   result["tool_steps"],
        "confidence":   result["confidence"],
        "handled_by":   result["handled_by"],
        "memory_used":  result["memory_used"],
        "facts_learned": result["facts_learned"],
    }

def clear_history(session_id: str = None):
    if session_id is None:
        sessions.clear()
        session_turns.clear()
    elif session_id in sessions:
        sessions[session_id] = []
        session_turns[session_id] = 0


