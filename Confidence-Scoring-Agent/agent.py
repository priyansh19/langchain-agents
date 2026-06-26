from langchain_core.tools import tool
from langchain_ollama import ChatOllama
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage, SystemMessage
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

llm = ChatOllama(model="gemma4:26b")

def score_confidence(message: str) -> int:
    prompt = f"""Rate how confidently you can answer this request on a scale of 1 to 10, REPLY with ONLY a single number, nothing else. Request: {message}"""

    response = llm.invoke([HumanMessage(content=prompt)])
    try:
        return int(response.content.strip())
    except (ValueError):
        return 5

tools = [create_file, read_file, append_to_file, edit_file]
system_prompt = SystemMessage(content="You are a friendly and helpful assistant. You have file tools available but only use them when the user explicitly asks to create, read, edit, or manage files. For all other conversation, respond naturally.")
agent = create_react_agent(llm, tools, prompt=system_prompt)

conversation_history = []

def chat(message: str) -> dict:
    score = score_confidence(message)
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
        "tool_steps": tool_steps,
        "confidence": score
    }

def clear_history() -> None:
    conversation_history.clear()

if __name__ == "__main__":
    print(chat("Create a file called test.txt with a fun fact about the moon")) # test for scoring prompt
    print(chat("Create a file called notes.txt with a haiku about coding")) # test for file operations agent
    print(chat("What will the stock market do tomorrow?")) # test for scoring prompt