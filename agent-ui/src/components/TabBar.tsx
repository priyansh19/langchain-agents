import type { ConnectionStatus } from '../types';

interface Props {
  status: ConnectionStatus;
}

export function TabBar({ status }: Props) {
  return (
    <header className="app-bar">
      <div className="app-bar-logo">
        <img src="/logo.png" alt="M1" className="app-bar-logo-img"/>
        <span className="app-bar-logo-text">
          MACH<span style={{ color: 'var(--blue)' }}>1</span>
        </span>
      </div>

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
