import { useState } from 'react';
import type { ReactNode } from 'react';
import { FolderOpen, FileDiff, MessageSquare, Terminal, FileText } from 'lucide-react';

type PaneType = 'chat' | 'diff' | 'files' | 'terminal';

interface FileEntry { name: string; size: string; modified: string; }

const DEMO_FILES: FileEntry[] = [
  { name: 'agent.py',        size: '4.2 KB', modified: 'just now' },
  { name: 'server.py',       size: '1.8 KB', modified: '2 min ago' },
  { name: 'requirements.txt', size: '0.3 KB', modified: '10 min ago' },
];

const DEMO_DIFF = `--- a/agent.py
+++ b/agent.py
@@ -88,6 +88,10 @@ memory_collection = chroma_client.get_or_create_collection(
+semantic_collection = chroma_client.get_or_create_collection(
+    name="semantic_memory",
+    embedding_function=ollama_ef
+)
+
 def save_memory(role: str, content: str):`;

export function CodeArea() {
  const [activePane, setActivePane] = useState<PaneType>('files');
  const [permission, setPermission] = useState<'ask' | 'auto' | 'plan'>('ask');

  const PANES: { id: PaneType; icon: ReactNode; label: string }[] = [
    { id: 'files',    icon: <FolderOpen size={12}/>,    label: 'Files' },
    { id: 'diff',     icon: <FileDiff size={12}/>,      label: 'Diff' },
    { id: 'chat',     icon: <MessageSquare size={12}/>, label: 'Chat' },
    { id: 'terminal', icon: <Terminal size={12}/>,      label: 'Terminal' },
  ];

  return (
    <div className="code-wrap">

      {/* Toolbar */}
      <div className="code-toolbar">
        <span className="code-toolbar-title">Code</span>
        <div className="code-pane-tabs">
          {PANES.map(p => (
            <button
              key={p.id}
              className={`code-pane-tab ${activePane === p.id ? 'code-pane-tab--active' : ''}`}
              onClick={() => setActivePane(p.id)}
            >{p.icon} {p.label}</button>
          ))}
        </div>
        <div className="permission-btns">
          {(['ask', 'auto', 'plan'] as const).map(m => (
            <button
              key={m}
              className={`permission-btn ${permission === m ? 'permission-btn--active' : ''}`}
              onClick={() => setPermission(m)}
            >{m}</button>
          ))}
        </div>
      </div>

      {/* Pane content */}
      <div className="code-pane">

        {activePane === 'files' && (
          <div className="file-tree">
            <p className="file-tree-label">workspace/</p>
            {DEMO_FILES.map(f => (
              <div key={f.name} className="file-row">
                <span className="file-icon"><FileText size={12}/></span>
                <span className="file-name">{f.name}</span>
                <span className="file-meta">{f.size} · {f.modified}</span>
              </div>
            ))}
            <p className="file-tree-note">Live file tree — connects to workspace/ when agent is running</p>
          </div>
        )}

        {activePane === 'diff' && (
          <div className="diff-view">
            <div className="diff-header">
              <span className="diff-title">agent.py</span>
              <span className="diff-stats"><span className="diff-add">+4</span> <span className="diff-del">-0</span></span>
            </div>
            <pre className="diff-pre">{DEMO_DIFF.split('\n').map((line, i) => (
              <div
                key={i}
                className={`diff-line ${line.startsWith('+') && !line.startsWith('+++') ? 'diff-line--add' : line.startsWith('-') && !line.startsWith('---') ? 'diff-line--del' : ''}`}
              >{line}</div>
            ))}</pre>
          </div>
        )}

        {activePane === 'chat' && (
          <div className="code-chat-placeholder">
            <span className="code-chat-icon"><MessageSquare size={28}/></span>
            <p>Code chat connects to the main agent.</p>
            <p className="code-chat-sub">Switch to Chat mode (Ctrl+1) to send messages — output appears here when Code mode is active.</p>
          </div>
        )}

        {activePane === 'terminal' && (
          <div className="terminal-placeholder">
            <div className="terminal-bar">
              <span className="terminal-dot terminal-dot--red" />
              <span className="terminal-dot terminal-dot--yellow" />
              <span className="terminal-dot terminal-dot--green" />
              <span className="terminal-title">bash — workspace</span>
            </div>
            <div className="terminal-body">
              <p className="terminal-line"><span className="terminal-prompt">$</span> python server.py</p>
              <p className="terminal-line terminal-line--out">INFO:     Started server on http://0.0.0.0:8000</p>
              <p className="terminal-line"><span className="terminal-prompt">$</span> <span className="terminal-cursor">█</span></p>
              <p className="terminal-note">Full terminal pane powered by xterm.js — coming in Phase 11</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
