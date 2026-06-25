from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, AIMessage

history = []

llm = ChatOllama(model="llama3.2")
while True:
    user_input = input("You: ")
    history.append(HumanMessage(content=user_input))
    response = llm.invoke(history)
    history.append(AIMessage(content=response.content))
    print("Assistant:", response.content)
