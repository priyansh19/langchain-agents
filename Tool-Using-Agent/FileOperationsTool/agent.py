from langchain_core.tools import tool
from langchain_ollama import ChatOllama
from langchain.agents import create_agent
from langchain_core.messages import HumanMessage
import os

WORKSPACE = "workspace"
os.makedirs(WORKSPACE, exist_ok=True)

@tool
def create_file(filename: str, content: str) -> str:
    """Create a file with the given filename and content."""
    filepath = os.path.join(WORKSPACE, filename)
    with open(filepath, "w") as f:
        f.write(content)
    return f"File '{filename}' created successfully."

@tool
def read_file(filename: str) -> str:
    """Read and return the contents of a file from the workspace."""
    filepath = os.path.join(WORKSPACE, filename)
    if not os.path.exists(filepath):
        return f"Error: '{filename}' does not exist."
    with open(filepath, "r") as f:
        return f.read()

@tool
def edit_file(filename: str, content: str) -> str:
    """COMPLETELY REPLACES all existing content in the file. Use only when you want to overwrite everything."""

    filepath = os.path.join(WORKSPACE, filename)
    if not os.path.exists(filepath):
        return f"Error: '{filename}' does not exist. Use create_file to make it first."
    with open(filepath, "w") as f:
        f.write(content)
    return f"File '{filename}' updated successfully."

@tool
def append_to_file(filename: str, content: str) -> str:
    """Adds new content to the END of an existing file, keeping all existing content intact. Use this to add lines without losing what is already there."""

    filepath = os.path.join(WORKSPACE, filename)
    if not os.path.exists(filepath):
        return f"Error: '{filename}' does not exist. Use create_file to make it first."
    with open(filepath, "a") as f:
        f.write("\n" + content)
    return f"Content appended to '{filename}' successfully."

llm = ChatOllama(model="llama3.2")
tools = [create_file, read_file, append_to_file, edit_file]
agent = create_agent(llm, tools)

conversation_history = []

def chat(message: str) -> str:
    conversation_history.append(HumanMessage(content=message))
    result = agent.invoke({"messages": conversation_history})

    tool_steps = []
    for msg in result["messages"]:
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            for tc in msg.tool_calls:
                tool_steps.append({"tool": tc["name"], "input": str(tc["args"])})

    conversation_history.clear()
    conversation_history.extend(result["messages"])

    return {
        "response": result["messages"][-1].content,
        "tool_steps": tool_steps
    }

def clear_history() -> None:
    conversation_history.clear()

if __name__ == "__main__":
    print(chat("Create a file called notes.txt with a haiku about coding"))