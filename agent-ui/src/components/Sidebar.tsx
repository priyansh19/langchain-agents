import { useRef, useState } from 'react';
import type { Capabilities, ConnectionStatus, Session } from '../types';

interface Props {
  capabilities:    Capabilities | null;
  status:          ConnectionStatus;
  sessions:        Session[];
  activeId:        string;
  onSwitchSession: (id: string) => void;
  onNewSession:    () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, name: string) => void;
  onExportSession: (id: string) => void;
  onPinSession:    (id: string) => void;
  onImportSession: (file: File) => void;
  onSetPersona:    (persona: string) => void;
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Connecting…',
  online:     'Online',
  offline:    'Offline — retrying…',
};

const DEFAULT_PERSONA = 'You are a helpful assistant who replies in a concise and friendly manner.';

function formatTime(iso: string): string {
  const date = new Date(iso);
  const n    = new Date();
  if (date.toDateString() === n.toDateString())
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getPreview(session: Session): string {
  if (session.name) return session.name;
  const first = session.messages.find(m => m.role === 'user');
  if (!first) return 'New conversation';
  return first.text.length > 30 ? first.text.slice(0, 30) + '…' : first.text;
}

export function Sidebar({
  capabilities, status, sessions, activeId,
  onSwitchSession, onNewSession, onDeleteSession, onRenameSession,
  onExportSession, onPinSession, onImportSession, onSetPersona,
}: Props) {
  const [persona,          setPersona]          = useState(DEFAULT_PERSONA);
  const [applied,          setApplied]          = useState(false);
  const [search,           setSearch]           = useState('');
  const [searchInMessages, setSearchInMessages] = useState(false);
  const [editingId,        setEditingId]        = useState<string | null>(null);
  const [editName,         setEditName]         = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const localCount = sessions.reduce((n, s) => n + s.messages.filter(m => m.handled_by === 'local llm').length, 0);
  const cloudCount = sessions.reduce((n, s) => n + s.messages.filter(m => m.handled_by === 'claude').length, 0);

  function handleApply() {
    onSetPersona(persona);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  }

  function startRename(session: Session) {
    setEditingId(session.id);
    setEditName(session.name ?? getPreview(session));
  }

  function commitRename(id: string) {
    if (editName.trim()) onRenameSession(id, editName.trim());
    setEditingId(null);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onImportSession(file);
    e.target.value = '';
  }

  const sorted = [...sessions].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return  1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const q = search.toLowerCase();
  const filtered = sorted.filter(s => {
    if (!search) return true;
    if (getPreview(s).toLowerCase().includes(q)) return true;
    if (searchInMessages) return s.messages.some(m => m.text.toLowerCase().includes(q));
    return false;
  });

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="logo">Agent Lab</span>
      </div>

      <section className="sidebar-section">
        <p className="section-title">Active Agent</p>
        <p className="agent-name">{capabilities?.agent_name ?? 'Connecting…'}</p>
        <div className="tag-row">
          {capabilities?.version && <span className="tag tag--blue">v{capabilities.version}</span>}
          {capabilities?.model   && <span className="tag tag--purple">{capabilities.model}</span>}
        </div>
        {(localCount + cloudCount) > 0 && (
          <div className="savings-counter">
            <span className="savings-local">⬢ {localCount} local</span>
            <span className="savings-cloud">◈ {cloudCount} cloud</span>
          </div>
        )}
      </section>

      <section className="sidebar-section">
        <p className="section-title">Features</p>
        <div className="feature-list">
          {capabilities
            ? Object.entries(capabilities.features).map(([key, enabled]) => (
                <div key={key} className="feature-row">
                  <span className="feature-name">{formatKey(key)}</span>
                  <span className={`badge ${enabled ? 'badge--on' : 'badge--off'}`}>
                    {enabled ? 'ON' : 'OFF'}
                  </span>
                </div>
              ))
            : <span className="muted">Waiting for server…</span>
          }
        </div>
      </section>

      {capabilities?.features?.persona && (
        <section className="sidebar-section">
          <p className="section-title">Persona</p>
          <textarea
            className="persona-input"
            value={persona}
            onChange={e => setPersona(e.target.value)}
            rows={4}
            placeholder="Describe the assistant's personality…"
          />
          <button
            className={`btn-apply ${applied ? 'btn-apply--done' : ''}`}
            onClick={handleApply}
            disabled={status !== 'online'}
          >
            {applied ? '✓ Applied' : 'Apply Persona'}
          </button>
        </section>
      )}

      <section className="sidebar-section session-section">
        <div className="session-header-row">
          <p className="section-title" style={{ marginBottom: 0 }}>Sessions</p>
          <div className="session-header-btns">
            <button className="btn-icon-small" title="Import session (.md)" onClick={() => fileRef.current?.click()}>↑</button>
            <button className="btn-new-session" onClick={onNewSession} disabled={status !== 'online'}>+ New</button>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".md,.txt"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />

        <div className="search-row">
          <input
            className="session-search"
            placeholder="Search sessions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            className={`btn-search-toggle ${searchInMessages ? 'btn-search-toggle--active' : ''}`}
            onClick={() => setSearchInMessages(v => !v)}
            title={searchInMessages ? 'Searching message content' : 'Search titles only'}
          >
            ☰
          </button>
        </div>

        <div className="session-list">
          {filtered.length === 0 && <span className="muted">No sessions found</span>}
          {filtered.map(session => (
            <div
              key={session.id}
              className={`session-item ${session.id === activeId ? 'session-item--active' : ''} ${session.pinned ? 'session-item--pinned' : ''}`}
            >
              {editingId === session.id ? (
                <input
                  className="session-rename-input"
                  value={editName}
                  autoFocus
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => commitRename(session.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(session.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <button className="session-body" onClick={() => onSwitchSession(session.id)}>
                  <span className="session-preview">
                    {session.pinned && <span className="pin-icon">📌</span>}
                    {getPreview(session)}
                  </span>
                  <span className="session-time">{formatTime(session.createdAt)}</span>
                </button>
              )}
              <div className="session-actions">
                <button className="session-action-btn" title={session.pinned ? 'Unpin' : 'Pin'} onClick={() => onPinSession(session.id)}>
                  {session.pinned ? '★' : '☆'}
                </button>
                <button className="session-action-btn" title="Rename" onClick={() => startRename(session)}>✎</button>
                <button className="session-action-btn" title="Export" onClick={() => onExportSession(session.id)}>↓</button>
                <button className="session-action-btn session-action-btn--delete" title="Delete" onClick={() => onDeleteSession(session.id)}>×</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="sidebar-footer">
        <div className="status-row">
          <div className={`dot dot--${status}`} />
          <span className="muted">{STATUS_LABEL[status]}</span>
        </div>
        <div className="shortcut-hint">Ctrl+K command palette · Alt+N new session</div>
      </div>
    </aside>
  );
}

function formatKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
