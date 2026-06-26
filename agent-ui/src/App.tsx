import { useState, useEffect, useCallback, useRef } from 'react';
import type { Capabilities, ChatMessage, ConnectionStatus } from './types';
import { fetchCapabilities, sendChat, clearConversation, setPersona } from './api';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';

let msgCounter = 0;
const uid = () => `msg-${++msgCounter}`;

function App() {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [status,       setStatus]       = useState<ConnectionStatus>('connecting');
  const [messages,     setMessages]     = useState<ChatMessage[]>([]);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(async () => {
    try {
      const caps = await fetchCapabilities();
      setCapabilities(caps);
      setStatus('online');
      setMessages([{
        id:   uid(),
        role: 'assistant',
        text: "Hi! I'm ready. Ask me anything.",
      }]);
    } catch {
      setStatus('offline');
      retryRef.current = setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => { if (retryRef.current) clearTimeout(retryRef.current); };
  }, [connect]);

  const handleSend = useCallback(async (text: string) => {
    const loadId = uid();

    setMessages(prev => [
      ...prev,
      { id: uid(), role: 'user', text },
      { id: loadId, role: 'assistant', text: '', loading: true },
    ]);

    try {
      const data = await sendChat(text);
      setMessages(prev => prev.map(m =>
        m.id === loadId
          ? {
              id:         loadId,
              role:       'assistant',
              text:       data.response,
              tool_steps: data.tool_steps,
              sources:    data.sources,
              confidence: data.confidence,
            }
          : m
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === loadId
          ? {
              id:   loadId,
              role: 'assistant',
              text: '⚠️ Could not reach the server. Is it running on port 8000?',
            }
          : m
      ));
    }
  }, []);

  const handleClear = useCallback(async () => {
    await clearConversation();
    setMessages([{
      id:   uid(),
      role: 'assistant',
      text: 'Conversation cleared. Ask me anything!',
    }]);
  }, []);

  const handleSetPersona = useCallback(async (persona: string) => {
    await setPersona(persona);
    await clearConversation();
    setMessages([{
      id:   uid(),
      role: 'assistant',
      text: `Persona updated! I'm now: "${persona}". Start chatting!`,
    }]);
  }, []);

  return (
    <div className="app">
      <Sidebar
        capabilities={capabilities}
        status={status}
        onClear={handleClear}
        onSetPersona={handleSetPersona}
      />
      <ChatArea
        messages={messages}
        onSend={handleSend}
        disabled={status !== 'online'}
      />
    </div>
  );
}

export default App;
