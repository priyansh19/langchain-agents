export type AppMode = 'chat' | 'cowork' | 'code';

interface Props {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
}

const TABS: { id: AppMode; label: string; key: string }[] = [
  { id: 'chat',   label: 'Chat',   key: '1' },
  { id: 'cowork', label: 'Cowork', key: '2' },
  { id: 'code',   label: 'Code',   key: '3' },
];

export function TabBar({ mode, onChange }: Props) {
  return (
    <div className="tab-bar">
      <span className="tab-bar-logo">Agent Lab</span>
      <div className="tab-list">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn tab-btn--${t.id} ${mode === t.id ? 'tab-btn--active' : ''}`}
            onClick={() => onChange(t.id)}
            title={`${t.label} · Ctrl+${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
