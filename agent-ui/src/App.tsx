import { useState, useEffect, useCallback, useRef } from 'react';
import type { Capabilities, ChatMessage, ConnectionStatus, Session } from './types';
import { fetchCapabilities, sendChat, clearConversation, setPersona } from './api';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { CommandPalette, type Command } from './components/CommandPalette';
import { TabBar, type AppMode } from './components/TabBar';

let msgCounter = 0;
const uid          = () => `msg-${++msgCounter}`;
const newSessionId = () => `session-${Date.now()}`;
const now          = () => new Date().toISOString();
const STORAGE_KEY  = 'agent-lab-sessions';
const DRAFT_KEY    = 'agent-lab-drafts';

function loadSessions(): Session[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveSessions(sessions: Session[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); } catch {}
}
function loadDrafts(): Record<string, string> {
  try { const raw = localStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function saveDrafts(drafts: Record<string, string>) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts)); } catch {}
}

function sessionPreview(session: Session): string {
  if (session.name) return session.name;
  const first = session.messages.find(m => m.role === 'user');
  if (!first) return 'New conversation';
  return first.text.length > 32 ? first.text.slice(0, 32) + '…' : first.text;
}

function autoTitle(text: string): string {
  const words = text.trim().split(/\s+/).slice(0, 6).join(' ');
  return text.trim().split(/\s+/).length > 6 ? words + '…' : words;
}

function parseImportedSession(content: string, agentName?: string): Session {
  const lines = content.split('\n');
  let name = '';
  const messages: ChatMessage[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('# ')) { name = line.slice(2).trim(); continue; }
    const userMatch = line.match(/^\*\*You:\*\*\s*(?:\*\([^)]+\)\*\s*)?(.+)/);
    if (userMatch) {
      messages.push({ id: uid(), role: 'user', text: userMatch[1].trim(), timestamp: now() });
      continue;
    }
    const asstMatch = line.match(/^\*\*Assistant:\*\*\s*(?:\*\([^)]+\)\*\s*)?(.+)/);
    if (asstMatch) {
      messages.push({ id: uid(), role: 'assistant', text: asstMatch[1].trim(), timestamp: now() });
    }
  }

  return { id: newSessionId(), name: name || 'Imported session', createdAt: now(), messages, agentName };
}

function App() {
  const [capabilities,  setCapabilities]  = useState<Capabilities | null>(null);
  const [status,        setStatus]        = useState<ConnectionStatus>('connecting');
  const [sessions,      setSessions]      = useState<Session[]>(() => loadSessions());
  const [activeId,      setActiveId]      = useState<string>(() => {
    const saved = loadSessions();
    return saved.length > 0 ? saved[saved.length - 1].id : '';
  });
  const [drafts,        setDrafts]        = useState<Record<string, string>>(() => loadDrafts());
  const [isGenerating,  setIsGenerating]  = useState(false);
  const [showUndo,      setShowUndo]      = useState(false);
  const [showPalette,   setShowPalette]   = useState(false);
  const [mode,          setMode]          = useState<AppMode>('chat');

  const retryRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef   = useRef<AbortController | null>(null);
  const undoTimRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSession  = sessions.find(s => s.id === activeId);
  const activeMessages = activeSession?.messages ?? [];
  const latestId       = sessions[sessions.length - 1]?.id;
  const canSend        = status === 'online' && activeId === latestId;
  const currentDraft   = drafts[activeId] ?? '';

  useEffect(() => { saveSessions(sessions); }, [sessions]);
  useEffect(() => { saveDrafts(drafts); }, [drafts]);

  function setDraft(text: string) {
    setDrafts(prev => ({ ...prev, [activeId]: text }));
  }

  const connect = useCallback(async () => {
    try {
      const caps = await fetchCapabilities();
      setCapabilities(caps);
      setStatus('online');
      setSessions(prev => {
        if (prev.length === 0) {
          const id = newSessionId();
          const session: Session = {
            id, createdAt: now(), agentName: caps.agent_name,
            messages: [{ id: uid(), role: 'assistant', text: "Hi! I'm ready. Ask me anything.", timestamp: now() }],
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

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowPalette(p => !p); }
      if (e.altKey && e.key === 'n') { e.preventDefault(); if (status === 'online') handleNewSession(); }
      if ((e.ctrlKey || e.metaKey) && e.key === '1') { e.preventDefault(); setMode('chat'); }
      if ((e.ctrlKey || e.metaKey) && e.key === '2') { e.preventDefault(); setMode('cowork'); }
      if ((e.ctrlKey || e.metaKey) && e.key === '3') { e.preventDefault(); setMode('code'); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [status]);

  const updateSession = useCallback((id: string, updater: (msgs: ChatMessage[]) => ChatMessage[]) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, messages: updater(s.messages) } : s));
  }, []);

  const handleSend = useCallback(async (text: string) => {
    const loadId    = uid();
    const targetId  = activeId;
    const ctrl      = new AbortController();
    abortRef.current = ctrl;

    setIsGenerating(true);

    updateSession(targetId, msgs => [
      ...msgs,
      { id: uid(), role: 'user',      text, timestamp: now() },
      { id: loadId, role: 'assistant', text: '', loading: true, timestamp: now() },
    ]);

    // Auto-title: if this is the first user message and session has no name
    setSessions(prev => prev.map(s => {
      if (s.id !== targetId || s.name) return s;
      const hasUserMsg = s.messages.some(m => m.role === 'user');
      if (!hasUserMsg) return { ...s, name: autoTitle(text) };
      return s;
    }));

    // Undo toast for 3s
    setShowUndo(true);
    undoTimRef.current = setTimeout(() => setShowUndo(false), 3000);

    try {
      const data = await sendChat(text, ctrl.signal);
      clearTimeout(undoTimRef.current ?? undefined);
      setShowUndo(false);
      updateSession(targetId, msgs => msgs.map(m =>
        m.id === loadId ? {
          id: loadId, role: 'assistant' as const,
          text:        data.response,
          tool_steps:  data.tool_steps,
          sources:     data.sources,
          confidence:  data.confidence,
          handled_by:  data.handled_by,
          memory_used: data.memory_used,
          timestamp:   now(),
        } : m
      ));
    } catch (err) {
      clearTimeout(undoTimRef.current ?? undefined);
      setShowUndo(false);
      if (err instanceof Error && err.name === 'AbortError') {
        // Undo: remove both the user message and the loading bubble
        updateSession(targetId, msgs => msgs.filter(m => m.id !== loadId && !(m.role === 'user' && m.text === text)));
      } else {
        updateSession(targetId, msgs => msgs.map(m =>
          m.id === loadId ? {
            id: loadId, role: 'assistant' as const,
            text: '⚠️ Could not reach the server. Is it running on port 8000?',
            timestamp: now(),
          } : m
        ));
      }
    } finally {
      setIsGenerating(false);
    }
  }, [activeId, updateSession]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleUndo = useCallback(() => {
    clearTimeout(undoTimRef.current ?? undefined);
    setShowUndo(false);
    abortRef.current?.abort();
  }, []);

  const handleRetry = useCallback(async () => {
    const lastUser = [...activeMessages].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    updateSession(activeId, ms => {
      const idx = ms.map(m => m.role).lastIndexOf('assistant');
      return ms.filter((_, i) => i !== idx);
    });
    await handleSend(lastUser.text);
  }, [activeMessages, activeId, updateSession, handleSend]);

  const handleEditMessage = useCallback(async (msgId: string, newText: string) => {
    const msgs    = activeMessages;
    const msgIdx  = msgs.findIndex(m => m.id === msgId);
    if (msgIdx === -1) return;
    // Remove the edited message and everything after it
    updateSession(activeId, ms => ms.slice(0, msgIdx));
    await handleSend(newText);
  }, [activeMessages, activeId, updateSession, handleSend]);

  const handleBookmarkMessage = useCallback((msgId: string) => {
    updateSession(activeId, msgs => msgs.map(m =>
      m.id === msgId ? { ...m, bookmarked: !m.bookmarked } : m
    ));
  }, [activeId, updateSession]);

  const handleNewSession = useCallback(async () => {
    await clearConversation();
    const id = newSessionId();
    const session: Session = {
      id, createdAt: now(), agentName: capabilities?.agent_name,
      messages: [{ id: uid(), role: 'assistant', text: 'New conversation started. Ask me anything!', timestamp: now() }],
    };
    setSessions(prev => [...prev, session]);
    setActiveId(id);
  }, [capabilities]);

  const handleDeleteSession = useCallback((id: string) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      if (id === activeId) setActiveId(next.length > 0 ? next[next.length - 1].id : '');
      return next;
    });
    setDrafts(prev => { const n = { ...prev }; delete n[id]; return n; });
  }, [activeId]);

  const handleRenameSession = useCallback((id: string, name: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  }, []);

  const handlePinSession = useCallback((id: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, pinned: !s.pinned } : s));
  }, []);

  const handleExportSession = useCallback((id: string) => {
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    const lines: string[] = [
      `# ${sessionPreview(session)}`,
      `*Agent: ${session.agentName ?? 'Unknown'} — ${new Date(session.createdAt).toLocaleString()}*`,
      '',
    ];
    session.messages.forEach(msg => {
      const time = msg.timestamp
        ? `*(${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})* `
        : '';
      if (msg.role === 'user') {
        lines.push(`**You:** ${time}${msg.text}`, '');
      } else {
        lines.push(`**Assistant:** ${time}${msg.text}`);
        if (msg.confidence !== undefined) lines.push(`*Confidence: ${msg.confidence}/10*`);
        if (msg.handled_by)               lines.push(`*Handled by: ${msg.handled_by}*`);
        lines.push('');
      }
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `session-${id.slice(-6)}.md`; a.click();
    URL.revokeObjectURL(url);
  }, [sessions]);

  const handleImportSession = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const content = e.target?.result as string;
      if (!content) return;
      const session = parseImportedSession(content, capabilities?.agent_name);
      setSessions(prev => [...prev, session]);
      setActiveId(session.id);
    };
    reader.readAsText(file);
  }, [capabilities]);

  const handleSetPersona = useCallback(async (persona: string) => {
    await setPersona(persona);
    await clearConversation();
    updateSession(activeId, msgs => [
      ...msgs,
      { id: uid(), role: 'assistant', text: `Persona updated! I'm now: "${persona}". Start chatting!`, timestamp: now() },
    ]);
  }, [activeId, updateSession]);

  const lastMsgFailed = activeMessages.length > 0 &&
    activeMessages[activeMessages.length - 1].text?.startsWith('⚠️');

  const paletteCommands: Command[] = [
    { id: 'new',    label: 'New Session',              shortcut: 'Alt+N', action: handleNewSession },
    { id: 'export', label: 'Export Current Session',   shortcut: '',      action: () => handleExportSession(activeId) },
    { id: 'pin',    label: activeSession?.pinned ? 'Unpin Session' : 'Pin Session', shortcut: '', action: () => handlePinSession(activeId) },
    { id: 'import', label: 'Import Session from file', shortcut: '',      action: () => document.getElementById('palette-import-trigger')?.click() },
  ];

  return (
    <div className="app">
      <TabBar mode={mode} onChange={setMode} />
      <div className="app-body">
        <Sidebar
          capabilities={capabilities}
          status={status}
          sessions={sessions}
          activeId={activeId}
          onSwitchSession={setActiveId}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          onExportSession={handleExportSession}
          onPinSession={handlePinSession}
          onImportSession={handleImportSession}
          onSetPersona={handleSetPersona}
        />
        {mode === 'chat' ? (
          <ChatArea
            messages={activeMessages}
            onSend={handleSend}
            onStop={handleStop}
            onRetry={handleRetry}
            onUndo={handleUndo}
            onEditMessage={handleEditMessage}
            onBookmarkMessage={handleBookmarkMessage}
            disabled={!canSend}
            isGenerating={isGenerating}
            isArchived={!canSend && status === 'online'}
            showRetry={canSend && lastMsgFailed && !isGenerating}
            showUndo={showUndo}
            draft={currentDraft}
            onDraftChange={setDraft}
          />
        ) : (
          <ModePlaceholder mode={mode} />
        )}
      </div>
      {showPalette && (
        <CommandPalette
          commands={paletteCommands}
          onClose={() => setShowPalette(false)}
        />
      )}
    </div>
  );
}

function ModePlaceholder({ mode }: { mode: AppMode }) {
  const info = {
    chat:   { icon: '💬', title: 'Chat Mode',   desc: '' },
    cowork: { icon: '🤝', title: 'Cowork Mode', desc: 'Agentic task management with approval gates, dual-zone layout, and document production. Coming in Phase 10.' },
    code:   { icon: '💻', title: 'Code Mode',   desc: 'Software development workspace with diff pane, terminal, file editor, and live preview. Coming in Phase 11.' },
  }[mode];
  return (
    <div className="mode-placeholder">
      <div className="mode-placeholder-inner">
        <span className="mode-placeholder-icon">{info.icon}</span>
        <h2 className="mode-placeholder-title">{info.title}</h2>
        <p className="mode-placeholder-desc">{info.desc}</p>
        <p className="mode-placeholder-tag">Use Ctrl+1 to return to Chat</p>
      </div>
    </div>
  );
}

export default App;
