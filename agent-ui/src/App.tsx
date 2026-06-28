import { useState, useEffect, useCallback, useRef } from 'react';
import type { Capabilities, ChatMessage, ConnectionStatus, Session, Project } from './types';
import { fetchCapabilities, sendChat, createSession, deleteSessionRemote } from './api';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { CommandPalette, type Command } from './components/CommandPalette';
import { TabBar } from './components/TabBar';
import { ShortcutCheatsheet } from './components/ShortcutCheatsheet';
import { SettingsPanel } from './components/SettingsPanel';

let msgCounter = 0;
const uid          = () => `msg-${++msgCounter}`;
const newSessionId = () => crypto.randomUUID();
const now          = () => new Date().toISOString();
const STORAGE_KEY  = 'agent-lab-sessions';
const DRAFT_KEY    = 'agent-lab-drafts';
const PROJECT_KEY  = 'agent-lab-projects';

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
function loadProjects(): Project[] {
  try { const raw = localStorage.getItem(PROJECT_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveProjects(projects: Project[]) {
  try { localStorage.setItem(PROJECT_KEY, JSON.stringify(projects)); } catch {}
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
  const [capabilities,   setCapabilities]   = useState<Capabilities | null>(null);
  const [status,         setStatus]         = useState<ConnectionStatus>('connecting');
  const [sessions,       setSessions]       = useState<Session[]>(() => loadSessions());
  const [projects,       setProjects]       = useState<Project[]>(() => loadProjects());
  const [activeId,       setActiveId]       = useState<string>(() => {
    const saved = loadSessions();
    return saved.length > 0 ? saved[saved.length - 1].id : '';
  });
  const [drafts,         setDrafts]         = useState<Record<string, string>>(() => loadDrafts());
  const [isGenerating,   setIsGenerating]   = useState(false);
  const [showUndo,       setShowUndo]       = useState(false);
  const [showPalette,    setShowPalette]    = useState(false);
  const [showSettings,   setShowSettings]   = useState(false);
  const [showCheatsheet, setShowCheatsheet] = useState(false);

  const retryRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef   = useRef<AbortController | null>(null);
  const undoTimRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSession  = sessions.find(s => s.id === activeId);
  const activeMessages = activeSession?.messages ?? [];

  // A session is sendable if online, exists, and not explicitly archived
  const canSend = status === 'online' && !!activeSession && !activeSession.archived;
  const currentDraft = drafts[activeId] ?? '';

  useEffect(() => { saveSessions(sessions); }, [sessions]);
  useEffect(() => { saveDrafts(drafts); }, [drafts]);
  useEffect(() => { saveProjects(projects); }, [projects]);

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
            messages: [{ id: uid(), role: 'assistant', text: "Hi! I'm Mach1. Ask me anything.", timestamp: now() }],
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowPalette(p => !p); }
      if (e.altKey && e.key === 'n') { e.preventDefault(); if (status === 'online') handleNewSession(); }
      if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); setShowCheatsheet(p => !p); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [status]);

  const updateSession = useCallback((id: string, updater: (msgs: ChatMessage[]) => ChatMessage[]) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, messages: updater(s.messages) } : s));
  }, []);

  const handleSend = useCallback(async (text: string, systemPrompt?: string) => {
    const loadId   = uid();
    const targetId = activeId;
    const ctrl     = new AbortController();
    abortRef.current = ctrl;

    setIsGenerating(true);

    updateSession(targetId, msgs => [
      ...msgs,
      { id: uid(), role: 'user',      text, timestamp: now() },
      { id: loadId, role: 'assistant', text: '', loading: true, timestamp: now() },
    ]);

    setSessions(prev => prev.map(s => {
      if (s.id !== targetId || s.name) return s;
      const hasUserMsg = s.messages.some(m => m.role === 'user');
      if (!hasUserMsg) return { ...s, name: autoTitle(text) };
      return s;
    }));

    setShowUndo(true);
    undoTimRef.current = setTimeout(() => setShowUndo(false), 3000);

    try {
      // Lazy backend session creation — only created on first message
      let backendId = sessions.find(s => s.id === targetId)?.backendId;
      if (!backendId) {
        backendId = await createSession();
        setSessions(prev => prev.map(s => s.id === targetId ? { ...s, backendId } : s));
      }

      const data = await sendChat(text, backendId, ctrl.signal, systemPrompt);
      clearTimeout(undoTimRef.current ?? undefined);
      setShowUndo(false);
      updateSession(targetId, msgs => msgs.map(m =>
        m.id === loadId ? {
          id: loadId, role: 'assistant' as const,
          text:         data.response,
          tool_steps:   data.tool_steps,
          sources:      data.sources,
          confidence:   data.confidence,
          handled_by:   data.handled_by,
          memory_used:  data.memory_used,
          facts_learned: data.facts_learned,
          timestamp:    now(),
        } : m
      ));
    } catch (err) {
      clearTimeout(undoTimRef.current ?? undefined);
      setShowUndo(false);
      if (err instanceof Error && err.name === 'AbortError') {
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
  }, [activeId, sessions, updateSession]);

  const handleStop = useCallback(() => { abortRef.current?.abort(); }, []);

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
    const msgIdx = activeMessages.findIndex(m => m.id === msgId);
    if (msgIdx === -1) return;
    updateSession(activeId, ms => ms.slice(0, msgIdx));
    await handleSend(newText);
  }, [activeMessages, activeId, updateSession, handleSend]);

  const handleBookmarkMessage = useCallback((msgId: string) => {
    updateSession(activeId, msgs => msgs.map(m =>
      m.id === msgId ? { ...m, bookmarked: !m.bookmarked } : m
    ));
  }, [activeId, updateSession]);

  const handleNewSession = useCallback(() => {
    // Pure local action — no backend call, no history wipe
    const id = newSessionId();
    const session: Session = {
      id,
      createdAt: now(),
      agentName: capabilities?.agent_name,
      messages: [],
    };
    setActiveId(id);
    setSessions(prev => [...prev, session]);
  }, [capabilities]);

  const handleDeleteSession = useCallback((id: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, archived: true } : s));
    if (id === activeId) {
      setSessions(prev => {
        const live = prev.filter(s => !s.archived && s.id !== id);
        setActiveId(live.length > 0 ? live[live.length - 1].id : '');
        return prev;
      });
    }
  }, [activeId]);

  const handleRestoreSession = useCallback((id: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, archived: false } : s));
  }, []);

  const handlePermanentDelete = useCallback((id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session?.backendId) deleteSessionRemote(session.backendId);
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      if (id === activeId) setActiveId(next.filter(s => !s.archived).slice(-1)[0]?.id ?? '');
      return next;
    });
    setDrafts(prev => { const n = { ...prev }; delete n[id]; return n; });
  }, [activeId, sessions]);

  const handleRenameSession  = useCallback((id: string, name: string) => {
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

  const handleCreateProject = useCallback((name: string, color: string) => {
    const id = `proj-${Date.now()}`;
    setProjects(prev => [...prev, { id, name, color, createdAt: now() }]);
  }, []);

  const handleDeleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setSessions(prev => prev.map(s => s.projectId === id ? { ...s, projectId: undefined } : s));
  }, []);

  const handleRenameProject = useCallback((id: string, name: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  }, []);

  const handleToggleProjectCollapse = useCallback((id: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, collapsed: !p.collapsed } : p));
  }, []);

  const handleMoveToProject = useCallback((sessionId: string, projectId: string | undefined) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, projectId } : s));
  }, []);

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
      <TabBar status={status} />
      <div className="app-body">
        <Sidebar
          sessions={sessions}
          projects={projects}
          activeId={activeId}
          onSwitchSession={setActiveId}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          onExportSession={handleExportSession}
          onPinSession={handlePinSession}
          onImportSession={handleImportSession}
          onRestoreSession={handleRestoreSession}
          onPermanentDelete={handlePermanentDelete}
          onCreateProject={handleCreateProject}
          onDeleteProject={handleDeleteProject}
          onRenameProject={handleRenameProject}
          onToggleProjectCollapse={handleToggleProjectCollapse}
          onMoveToProject={handleMoveToProject}
          onOpenSettings={() => setShowSettings(true)}
        />
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
          isArchived={!!activeSession?.archived}
          showRetry={canSend && lastMsgFailed && !isGenerating}
          showUndo={showUndo}
          draft={currentDraft}
          onDraftChange={setDraft}
        />
      </div>
      {showPalette && (
        <CommandPalette
          commands={paletteCommands}
          onClose={() => setShowPalette(false)}
        />
      )}
      {showCheatsheet && <ShortcutCheatsheet onClose={() => setShowCheatsheet(false)} />}
      {showSettings && (
        <SettingsPanel
          capabilities={capabilities}
          status={status}
          sessions={sessions}
          onSetPersona={async () => {}}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
