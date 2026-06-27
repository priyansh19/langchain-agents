import { useState, useEffect } from 'react';
import { X, Cpu, Cloud, SlidersHorizontal, Shield, Zap, FolderCode, Wrench, ListTodo, Bot, ToggleLeft, ToggleRight } from 'lucide-react';
import type { Capabilities, ConnectionStatus, Session } from '../types';
import { fetchThreshold, setThreshold } from '../api';

type SettingsMode = 'chat' | 'cowork' | 'code';

interface Props {
  capabilities:  Capabilities | null;
  status:        ConnectionStatus;
  sessions:      Session[];
  onSetPersona:  (persona: string) => void;
  onClose:       () => void;
}

const DEFAULT_PERSONA = 'You are a helpful assistant who replies in a concise and friendly manner.';
const AUTONOMY_LABELS = ['Observe & Suggest', 'Plan & Propose', 'Act with Confirmation', 'Act Autonomously'];

export function SettingsPanel({ capabilities, status, sessions, onSetPersona, onClose }: Props) {
  const [tab,       setTab]       = useState<SettingsMode>('chat');
  const [threshold, setThresholdVal] = useState(7);
  const [persona,   setPersona]   = useState(DEFAULT_PERSONA);
  const [applied,   setApplied]   = useState(false);
  const [autonomy,  setAutonomy]  = useState(1);
  const [permission, setPermission] = useState<'ask' | 'auto' | 'plan'>('ask');
  const [approvalFlags, setApprovalFlags] = useState([true, true, false]);

  useEffect(() => { fetchThreshold().then(setThresholdVal); }, []);

  const localCount = sessions.reduce((n, s) => n + s.messages.filter(m => m.handled_by === 'local llm').length, 0);
  const cloudCount = sessions.reduce((n, s) => n + s.messages.filter(m => m.handled_by === 'claude').length, 0);
  const totalHandled = localCount + cloudCount;
  const localRate = totalHandled > 0 ? Math.round((localCount / totalHandled) * 100) : null;

  function handleApply() {
    onSetPersona(persona);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  }

  function handleThresholdChange(v: number) {
    setThresholdVal(v);
    setThreshold(v);
  }

  return (
    <div className="settings-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings-panel">

        {/* Header */}
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="settings-close" onClick={onClose}><X size={16}/></button>
        </div>

        {/* Mode tabs */}
        <div className="settings-tabs">
          {(['chat', 'cowork', 'code'] as SettingsMode[]).map(t => (
            <button
              key={t}
              className={`settings-tab ${tab === t ? `settings-tab--active settings-tab--${t}` : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'chat' ? 'Chat' : t === 'cowork' ? 'Cowork' : 'Code'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="settings-body">

          {/* ── CHAT SETTINGS ── */}
          {tab === 'chat' && (
            <>
              {/* Agent card */}
              <div className="settings-card">
                <div className="settings-card-header"><Bot size={13}/> Active Agent</div>
                <div className="settings-grid">
                  <div className="settings-row">
                    <span className="settings-label">Name</span>
                    <span className="settings-value">{capabilities?.agent_name ?? '—'}</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-label">Version</span>
                    <span className="tag tag--blue">v{capabilities?.version ?? '—'}</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-label">Model</span>
                    <span className="tag tag--purple">{capabilities?.model ?? '—'}</span>
                  </div>
                </div>
              </div>

              {/* Stats card */}
              {totalHandled > 0 && (
                <div className="settings-card">
                  <div className="settings-card-header"><Cpu size={13}/> Routing Stats</div>
                  <div className="settings-grid">
                    <div className="settings-row">
                      <span className="settings-label"><Cpu size={10}/> Local</span>
                      <span className="settings-value" style={{ color: 'var(--green)' }}>{localCount} calls</span>
                    </div>
                    <div className="settings-row">
                      <span className="settings-label"><Cloud size={10}/> Cloud</span>
                      <span className="settings-value" style={{ color: 'var(--purple)' }}>{cloudCount} calls</span>
                    </div>
                    {localRate !== null && (
                      <div className="settings-row" style={{ flexDirection: 'column', gap: 6 }}>
                        <div className="local-rate-bar">
                          <div className="local-rate-fill" style={{ width: `${localRate}%` }}/>
                        </div>
                        <span className="local-rate-label">{localRate}% answered locally</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Threshold card */}
              {capabilities?.features?.triage_routing && (
                <div className="settings-card">
                  <div className="settings-card-header"><SlidersHorizontal size={13}/> Routing Threshold</div>
                  <div className="threshold-row">
                    <span className="threshold-zone threshold-zone--local">Local ≥{threshold}</span>
                    <span className="threshold-zone threshold-zone--cloud">Cloud &lt;{threshold}</span>
                  </div>
                  <input
                    type="range" className="threshold-slider"
                    min={1} max={10} value={threshold}
                    onChange={e => handleThresholdChange(Number(e.target.value))}
                  />
                  <p className="threshold-label">Escalate to Claude if confidence &lt; {threshold}/10</p>
                </div>
              )}

              {/* Features card */}
              {capabilities?.features && (
                <div className="settings-card">
                  <div className="settings-card-header"><ToggleLeft size={13}/> Features</div>
                  <div className="settings-grid">
                    {Object.entries(capabilities.features).map(([key, enabled]) => (
                      <div key={key} className="settings-row">
                        <span className="settings-label">{formatKey(key)}</span>
                        <span className={`badge ${enabled ? 'badge--on' : 'badge--off'}`}>{enabled ? 'ON' : 'OFF'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Persona card */}
              {capabilities?.features?.persona && (
                <div className="settings-card">
                  <div className="settings-card-header"><Bot size={13}/> Persona</div>
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
                </div>
              )}
            </>
          )}

          {/* ── COWORK SETTINGS ── */}
          {tab === 'cowork' && (
            <>
              <div className="settings-card">
                <div className="settings-card-header"><Zap size={13}/> Autonomy Level</div>
                <div className="autonomy-dial" style={{ marginBottom: 8 }}>
                  {AUTONOMY_LABELS.map((l, i) => (
                    <button key={i}
                      className={`autonomy-btn ${autonomy === i ? 'autonomy-btn--active' : ''}`}
                      onClick={() => setAutonomy(i)} title={l}
                    >{i + 1}</button>
                  ))}
                </div>
                <p className="autonomy-mode">{AUTONOMY_LABELS[autonomy]}</p>
                <p className="threshold-label" style={{ marginTop: 6 }}>
                  {autonomy === 0 ? 'Agent only suggests — you act on everything'
                   : autonomy === 1 ? 'Agent plans tasks and proposes them for review'
                   : autonomy === 2 ? 'Agent acts but asks before irreversible steps'
                   : 'Agent acts fully on its own — use with care'}
                </p>
              </div>

              <div className="settings-card">
                <div className="settings-card-header"><Shield size={13}/> Approval Gate</div>
                <div className="settings-grid">
                  {['Require approval before file writes', 'Require approval before API calls', 'Auto-approve read-only tasks'].map((opt, i) => (
                    <div key={i} className="settings-row">
                      <span className="settings-label">{opt}</span>
                      <button
                        className="toggle-btn"
                        onClick={() => setApprovalFlags(f => f.map((v, j) => j === i ? !v : v))}
                      >
                        {approvalFlags[i]
                          ? <ToggleRight size={20} style={{ color: 'var(--blue)' }}/>
                          : <ToggleLeft  size={20} style={{ color: 'var(--text-muted)' }}/>}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card-header"><ListTodo size={13}/> Task Settings</div>
                <div className="settings-grid">
                  <div className="settings-row">
                    <span className="settings-label">Max parallel tasks</span>
                    <span className="tag tag--blue">1</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-label">Auto-retry on failure</span>
                    <span className="badge badge--off">OFF</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-label">Memory context in tasks</span>
                    <span className="badge badge--on">ON</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── CODE SETTINGS ── */}
          {tab === 'code' && (
            <>
              <div className="settings-card">
                <div className="settings-card-header"><Shield size={13}/> Permission Mode</div>
                <div className="permission-btns" style={{ marginBottom: 8 }}>
                  {(['ask', 'auto', 'plan'] as const).map(m => (
                    <button key={m}
                      className={`permission-btn ${permission === m ? 'permission-btn--active' : ''}`}
                      onClick={() => setPermission(m)}
                    >{m}</button>
                  ))}
                </div>
                <p className="threshold-label">
                  {permission === 'ask' ? 'Confirm every action before executing'
                   : permission === 'auto' ? 'Execute actions automatically without confirmation'
                   : 'Generate a plan first, then execute with one confirmation'}
                </p>
              </div>

              <div className="settings-card">
                <div className="settings-card-header"><FolderCode size={13}/> Workspace</div>
                <div className="settings-grid">
                  <div className="settings-row">
                    <span className="settings-label">Path</span>
                    <span className="tag tag--blue" style={{ fontFamily: 'monospace' }}>./workspace</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-label">Files tracked</span>
                    <span className="settings-value">3</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-label">Auto-save</span>
                    <span className="badge badge--on">ON</span>
                  </div>
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card-header"><Wrench size={13}/> Active Tools</div>
                <div className="settings-grid">
                  {[
                    { name: 'create_file',    on: true },
                    { name: 'read_file',      on: true },
                    { name: 'edit_file',      on: true },
                    { name: 'append_to_file', on: true },
                    { name: 'run_terminal',   on: false },
                    { name: 'web_search',     on: false },
                  ].map(tool => (
                    <div key={tool.name} className="settings-row">
                      <span className="settings-label" style={{ fontFamily: 'monospace', fontSize: 11 }}>{tool.name}</span>
                      <span className={`badge ${tool.on ? 'badge--on' : 'badge--off'}`}>{tool.on ? 'ON' : 'OFF'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

function formatKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
