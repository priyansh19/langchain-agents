import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import type { ReactNode } from 'react';
import { FolderOpen, FileDiff, Terminal, FileText, Folder, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';
import { listFiles, readFile, fetchGitDiff, runCommand } from '../api';
import type { FileEntry } from '../api';

type PaneType = 'files' | 'diff' | 'terminal';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function CodeArea() {
  const [activePane, setActivePane] = useState<PaneType>('files');
  const [permission, setPermission] = useState<'ask' | 'auto' | 'plan'>('ask');

  const PANES: { id: PaneType; icon: ReactNode; label: string }[] = [
    { id: 'files',    icon: <FolderOpen size={12}/>,    label: 'Files' },
    { id: 'diff',     icon: <FileDiff size={12}/>,      label: 'Diff' },
    { id: 'terminal', icon: <Terminal size={12}/>,       label: 'Terminal' },
  ];

  return (
    <div className="code-wrap">
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

      <div className="code-pane">
        {activePane === 'files'    && <FilesPane />}
        {activePane === 'diff'     && <DiffPane />}
        {activePane === 'terminal' && <TerminalPane />}
      </div>
    </div>
  );
}

/* ── Files pane ──────────────────────────────────────────────────────────── */

function FilesPane() {
  const [cwd, setCwd]           = useState('.');
  const [entries, setEntries]   = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function load(path: string) {
    setLoading(true); setError(null);
    try {
      const data = await listFiles(path);
      setCwd(data.path);
      setEntries(data.entries);
      setSelected(null); setContent(null);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { load('.'); }, []);

  async function openEntry(entry: FileEntry) {
    if (entry.type === 'dir') { load(entry.path); return; }
    setSelected(entry.path); setContent(null);
    try {
      const text = await readFile(entry.path);
      setContent(text);
    } catch { setContent('(cannot read file)'); }
  }

  function goUp() {
    const parent = cwd.split(/[\\/]/).slice(0, -1).join('/') || '.';
    load(parent);
  }

  return (
    <div className="files-pane">
      <div className="files-toolbar">
        <button className="files-up-btn" onClick={goUp} title="Up">↑</button>
        <span className="files-cwd" title={cwd}>{cwd}</span>
        <button className="files-refresh-btn" onClick={() => load(cwd)} title="Refresh">
          <RefreshCw size={11} className={loading ? 'spin' : ''}/>
        </button>
      </div>

      {error && <div className="files-error"><AlertCircle size={12}/> {error}</div>}

      <div className="files-body">
        <div className="file-tree">
          {entries.map(e => (
            <div
              key={e.path}
              className={`file-row ${selected === e.path ? 'file-row--active' : ''}`}
              onClick={() => openEntry(e)}
            >
              <span className="file-icon">
                {e.type === 'dir' ? <Folder size={12}/> : <FileText size={12}/>}
              </span>
              <span className="file-name">{e.name}</span>
              {e.type === 'file' && <span className="file-meta">{formatSize(e.size)}</span>}
              {e.type === 'dir'  && <ChevronRight size={10} className="file-dir-arrow"/>}
            </div>
          ))}
        </div>

        {content !== null && (
          <div className="file-viewer">
            <div className="file-viewer-header">
              <span className="file-viewer-name">{selected?.split(/[\\/]/).pop()}</span>
            </div>
            <pre className="file-viewer-pre">{content}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Diff pane ───────────────────────────────────────────────────────────── */

function DiffPane() {
  const [diff, setDiff]       = useState<string>('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const d = await fetchGitDiff();
    setDiff(d);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="diff-loading"><RefreshCw size={14} className="spin"/> Loading diff…</div>;
  if (!diff)   return <div className="diff-empty">No uncommitted changes in this repo.</div>;

  const lines = diff.split('\n');
  const files: { name: string; lines: string[] }[] = [];
  let cur: { name: string; lines: string[] } | null = null;
  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      if (cur) files.push(cur);
      const name = line.split(' b/')[1] ?? line;
      cur = { name, lines: [] };
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  if (cur) files.push(cur);

  return (
    <div className="diff-view">
      <div className="diff-refresh-row">
        <span className="diff-file-count">{files.length} file{files.length !== 1 ? 's' : ''} changed</span>
        <button className="files-refresh-btn" onClick={load}><RefreshCw size={11}/></button>
      </div>
      {files.map((f, fi) => {
        const adds = f.lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
        const dels = f.lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;
        return (
          <div key={fi} className="diff-file-block">
            <div className="diff-header">
              <span className="diff-title">{f.name}</span>
              <span className="diff-stats">
                <span className="diff-add">+{adds}</span>{' '}
                <span className="diff-del">-{dels}</span>
              </span>
            </div>
            <pre className="diff-pre">
              {f.lines.map((line, i) => (
                <div
                  key={i}
                  className={`diff-line ${
                    line.startsWith('+') && !line.startsWith('+++') ? 'diff-line--add' :
                    line.startsWith('-') && !line.startsWith('---') ? 'diff-line--del' :
                    line.startsWith('@@') ? 'diff-line--hunk' : ''
                  }`}
                >{line}</div>
              ))}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

/* ── Terminal pane ───────────────────────────────────────────────────────── */

interface TermLine { type: 'cmd' | 'out' | 'err'; text: string; }

function TerminalPane() {
  const [lines, setLines]   = useState<TermLine[]>([{ type: 'out', text: 'Mach1 terminal — type a command and press Enter' }]);
  const [input, setInput]   = useState('');
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines]);

  async function run() {
    const cmd = input.trim();
    if (!cmd) return;
    setLines(prev => [...prev, { type: 'cmd', text: cmd }]);
    setHistory(prev => [cmd, ...prev]);
    setHistIdx(-1);
    setInput('');
    setRunning(true);
    try {
      const result = await runCommand(cmd);
      if (result.stdout) result.stdout.split('\n').filter(Boolean).forEach(l =>
        setLines(prev => [...prev, { type: 'out', text: l }])
      );
      if (result.stderr) result.stderr.split('\n').filter(Boolean).forEach(l =>
        setLines(prev => [...prev, { type: 'err', text: l }])
      );
    } catch (e) {
      setLines(prev => [...prev, { type: 'err', text: String(e) }]);
    }
    setRunning(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { run(); return; }
    if (e.key === 'ArrowUp') {
      const idx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(idx);
      setInput(history[idx] ?? '');
    }
    if (e.key === 'ArrowDown') {
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? '' : history[idx] ?? '');
    }
  }

  return (
    <div className="terminal-pane">
      <div className="terminal-bar">
        <span className="terminal-dot terminal-dot--red"/>
        <span className="terminal-dot terminal-dot--yellow"/>
        <span className="terminal-dot terminal-dot--green"/>
        <span className="terminal-title">terminal</span>
      </div>
      <div className="terminal-body">
        {lines.map((l, i) => (
          <div key={i} className={`terminal-line terminal-line--${l.type}`}>
            {l.type === 'cmd' && <span className="terminal-prompt">$</span>}
            {l.text}
          </div>
        ))}
        {running && <div className="terminal-line terminal-line--out"><RefreshCw size={10} className="spin"/> running…</div>}
        <div ref={bottomRef}/>
      </div>
      <div className="terminal-input-row">
        <span className="terminal-prompt">$</span>
        <input
          className="terminal-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="enter command…"
          disabled={running}
          autoFocus
        />
      </div>
    </div>
  );
}
