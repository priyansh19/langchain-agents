import { useState } from 'react';
import type { Capabilities, ConnectionStatus, Session } from '../types';

interface Props {
  capabilities: Capabilities | null;
  status: ConnectionStatus;
  sessions: Session[];
  activeId: string;
  onSwitchSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onSetPersona: (persona: string) => void;
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Connecting…',
  online:     'Online',
  offline:    'Offline — retrying…',
};

const DEFAULT_PERSONA = 'You are a helpful assistant who replies in a concise and friendly manner.';

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now  = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function sessionPreview(session: Session): string {
  const first = session.messages.find(m => m.role === 'user');
  if (!first) return 'New conversation';
  return first.text.length > 32 ? first.text.slice(0, 32) + '…' : first.text;
}

export function Sidebar({ capabilities, status, sessions, activeId, onSwitchSession, onNewSession, onDeleteSession, onSetPersona }: Props) {
  const [persona, setPersona] = useState(DEFAULT_PERSONA);
  const [applied, setApplied] = useState(false);

  function handleApply() {
    onSetPersona(persona);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  }

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
          <button className="btn-new-session" onClick={onNewSession} disabled={status !== 'online'}>
            + New
          </button>
        </div>
        <div className="session-list">
          {sessions.length === 0 && <span className="muted">No sessions yet</span>}
          {[...sessions].reverse().map(session => (
            <div
              key={session.id}
              className={`session-item ${session.id === activeId ? 'session-item--active' : ''}`}
            >
              <button className="session-body" onClick={() => onSwitchSession(session.id)}>
                <span className="session-preview">{sessionPreview(session)}</span>
                <span className="session-time">{formatTime(session.createdAt)}</span>
              </button>
              <button
                className="session-delete"
                onClick={e => { e.stopPropagation(); onDeleteSession(session.id); }}
                title="Delete session"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="sidebar-footer">
        <div className="status-row">
          <div className={`dot dot--${status}`} />
          <span className="muted">{STATUS_LABEL[status]}</span>
        </div>
      </div>
    </aside>
  );
}

function formatKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
