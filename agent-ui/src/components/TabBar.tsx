import type { ReactNode } from 'react';
import { MessageSquare, Users, Code2 } from 'lucide-react';
import type { ConnectionStatus } from '../types';

export type AppMode = 'chat' | 'cowork' | 'code';

interface Props {
  mode:   AppMode;
  status: ConnectionStatus;
  onChange: (mode: AppMode) => void;
}

const MODES: { id: AppMode; label: string; icon: ReactNode }[] = [
  { id: 'chat',   label: 'Chat',   icon: <MessageSquare size={13}/> },
  { id: 'cowork', label: 'Cowork', icon: <Users size={13}/> },
  { id: 'code',   label: 'Code',   icon: <Code2 size={13}/> },
];

export function TabBar({ mode, status, onChange }: Props) {
  return (
    <header className="app-bar">
      <div className="app-bar-logo">
        <img src="/logo.png" alt="M1" className="app-bar-logo-img"/>
        <span className="app-bar-logo-text">
          MACH<span style={{ color: 'var(--blue)' }}>1</span>
        </span>
      </div>

      <nav className="app-bar-center">
        {MODES.map(m => (
          <button
            key={m.id}
            className={`mode-btn mode-btn--${m.id} ${mode === m.id ? 'mode-btn--active' : ''}`}
            onClick={() => onChange(m.id)}
            title={`${m.label} · Ctrl+${MODES.indexOf(m) + 1}`}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </nav>

      <div className="app-bar-right">
        <div className={`app-bar-status app-bar-status--${status}`}>
          <span className={`dot dot--${status}`}/>
          <span className="app-bar-status-label">
            {status === 'online' ? 'Online' : status === 'connecting' ? 'Connecting' : 'Offline'}
          </span>
        </div>
      </div>
    </header>
  );
}
