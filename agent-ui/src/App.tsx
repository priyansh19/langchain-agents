import { useState, useEffect, useCallback, useRef } from 'react';
import type { Capabilities, ChatMessage, ConnectionStatus, Session } from './types';
import { fetchCapabilities, sendChat, clearConversation, setPersona } from './api';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';

let msgCounter = 0;
const uid = () => `msg-${++msgCounter}`;
const newSessionId = () => `session-${Date.now()}`;
const STORAGE_KEY = 'agent-lab-sessions';

function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSessions(sessions: Session[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); } catch {}
}

function App() {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [status,       setStatus]       = useState<ConnectionStatus>('connecting');
  const [sessions,     setSessions]     = useState<Session[]>(() => loadSessions());
  const [activeId,     setActiveId]     = useState<string>(() => {
    const saved = loadSessions();
    return saved.length > 0 ? saved[saved.length - 1].id : '';
  });
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeMessages = sessions.find(s => s.id === activeId)?.messages ?? [];
  const latestId = sessions[sessions.length - 1]?.id;
  const canSend = status === 'online' && activeId === latestId;

  useEffect(() => { saveSessions(sessions); }, [sessions]);

  const connect = useCallback(async () => {
    try {
      const caps = await fetchCapabilities();
      setCapabilities(caps);
      setStatus('online');
      setSessions(prev => {
        if (prev.length === 0) {
          const id = newSessionId();
          const session: Session = {
            id,
            createdAt: new Date().toISOString(),
            messages: [{ id: uid(), role: 'assistant', text: "Hi! I'm ready. Ask me anything." }],
            agentName: caps.agent_name,
          };
          setActiveId(id);
          return [session];
        }
        return prev;
      });
    } catch {
      setStatus('offline');
      retryRef.current = setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => { if (retryRef.current) clearTimeout(retryRef.current); };
  }, [connect]);

  const updateSession = useCallback((id: string, updater: (msgs: ChatMessage[]) => ChatMessage[]) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, messages: updater(s.messages) } : s));
  }, []);

  const handleSend = useCallback(async (text: string) => {
    const loadId = uid();
    const targetId = activeId;

    updateSession(targetId, msgs => [
      ...msgs,
      { id: uid(), role: 'user', text },
      { id: loadId, role: 'assistant', text: '', loading: true },
    ]);

    try {
      const data = await sendChat(text);
      updateSession(targetId, msgs => msgs.map(m =>
        m.id === loadId ? {
          id: loadId, role: 'assistant',
          text:       data.response,
          tool_steps: data.tool_steps,
          sources:    data.sources,
          confidence: data.confidence,
          handled_by: data.handled_by,
        } : m
      ));
    } catch {
      updateSession(targetId, msgs => msgs.map(m =>
        m.id === loadId ? {
          id: loadId, role: 'assistant',
          text: '⚠️ Could not reach the server. Is it running on port 8000?',
        } : m
      ));
    }
  }, [activeId, updateSession]);

  const handleNewSession = useCallback(async () => {
    await clearConversation();
    const id = newSessionId();
    const session: Session = {
      id,
      createdAt: new Date().toISOString(),
      messages: [{ id: uid(), role: 'assistant', text: 'New conversation started. Ask me anything!' }],
      agentName: capabilities?.agent_name,
    };
    setSessions(prev => [...prev, session]);
    setActiveId(id);
  }, [capabilities]);

  const handleDeleteSession = useCallback((id: string) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      if (id === activeId) {
        setActiveId(next.length > 0 ? next[next.length - 1].id : '');
      }
      return next;
    });
  }, [activeId]);

  const handleSetPersona = useCallback(async (persona: string) => {
    await setPersona(persona);
    await clearConversation();
    updateSession(activeId, msgs => [
      ...msgs,
      { id: uid(), role: 'assistant', text: `Persona updated! I'm now: "${persona}". Start chatting!` },
    ]);
  }, [activeId, updateSession]);

  return (
    <div className="app">
      <Sidebar
        capabilities={capabilities}
        status={status}
        sessions={sessions}
        activeId={activeId}
        onSwitchSession={setActiveId}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        onSetPersona={handleSetPersona}
      />
      <ChatArea
        messages={activeMessages}
        onSend={handleSend}
        disabled={!canSend}
        isArchived={!canSend && status === 'online'}
      />
    </div>
  );
}

export default App;
