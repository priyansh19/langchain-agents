import { useRef, useState, useEffect } from 'react';
import {
  Archive, CheckSquare, Upload, Pin, PinOff, Pencil,
  Download, Trash2, Undo2, Search, Settings,
  FolderPlus, ChevronRight, ChevronDown, Folder, X,
} from 'lucide-react';
import type { Session, Project } from '../types';

interface Props {
  sessions:               Session[];
  projects:               Project[];
  activeId:               string;
  onSwitchSession:        (id: string) => void;
  onNewSession:           () => void;
  onDeleteSession:        (id: string) => void;
  onRenameSession:        (id: string, name: string) => void;
  onExportSession:        (id: string) => void;
  onPinSession:           (id: string) => void;
  onImportSession:        (file: File) => void;
  onRestoreSession:       (id: string) => void;
  onPermanentDelete:      (id: string) => void;
  onCreateProject:        (name: string, color: string) => void;
  onDeleteProject:        (id: string) => void;
  onRenameProject:        (id: string, name: string) => void;
  onToggleProjectCollapse:(id: string) => void;
  onMoveToProject:        (sessionId: string, projectId: string | undefined) => void;
  onOpenSettings:         () => void;
}

interface CtxMenu {
  sessionId: string;
  x: number;
  y: number;
  archived:  boolean;
  pinned:    boolean;
  projectId?: string;
}

const PROJECT_COLORS = [
  '#6aaee0', // blue
  '#3fb950', // green
  '#a78bfa', // purple
  '#f97316', // orange
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#f85149', // red
];

const DATE_ORDER = ['Today', 'Yesterday', 'Last 7 days', 'Last 30 days', 'Older'];

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

function dateGroup(iso: string): string {
  const d    = new Date(iso);
  const now  = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff <= 7)  return 'Last 7 days';
  if (diff <= 30) return 'Last 30 days';
  return 'Older';
}

export function Sidebar({
  sessions, projects, activeId,
  onSwitchSession, onNewSession, onDeleteSession, onRenameSession,
  onExportSession, onPinSession, onImportSession,
  onRestoreSession, onPermanentDelete,
  onCreateProject, onDeleteProject, onRenameProject,
  onToggleProjectCollapse, onMoveToProject,
  onOpenSettings,
}: Props) {
  const [selectMode,       setSelectMode]       = useState(false);
  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(new Set());
  const [showArchived,     setShowArchived]     = useState(false);
  const [search,           setSearch]           = useState('');
  const [searchInMessages, setSearchInMessages] = useState(false);
  const [editingId,        setEditingId]        = useState<string | null>(null);
  const [editName,         setEditName]         = useState('');
  const [ctxMenu,          setCtxMenu]          = useState<CtxMenu | null>(null);
  const [showNewProject,   setShowNewProject]   = useState(false);
  const [newProjName,      setNewProjName]      = useState('');
  const [newProjColor,     setNewProjColor]     = useState(PROJECT_COLORS[0]);
  const [editingProjId,    setEditingProjId]    = useState<string | null>(null);
  const [editProjName,     setEditProjName]     = useState('');
  const [moveMenuId,       setMoveMenuId]       = useState<string | null>(null);

  const fileRef  = useRef<HTMLInputElement>(null);
  const menuRef  = useRef<HTMLDivElement>(null);
  const moveRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxMenu && !moveMenuId) return;
    function close(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) setCtxMenu(null);
      if (moveRef.current && !moveRef.current.contains(target)) setMoveMenuId(null);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [ctxMenu, moveMenuId]);

  const liveSessions     = sessions.filter(s => !s.archived);
  const archivedSessions = sessions.filter(s => s.archived);

  function startRename(session: Session) {
    setCtxMenu(null);
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

  function openCtxMenu(e: React.MouseEvent, session: Session) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({
      sessionId: session.id,
      x: e.clientX,
      y: e.clientY,
      archived:  !!session.archived,
      pinned:    !!session.pinned,
      projectId: session.projectId,
    });
    setMoveMenuId(null);
  }

  function handleCreateProject() {
    if (!newProjName.trim()) return;
    onCreateProject(newProjName.trim(), newProjColor);
    setNewProjName('');
    setNewProjColor(PROJECT_COLORS[0]);
    setShowNewProject(false);
  }

  const sourceList = showArchived ? archivedSessions : liveSessions;
  const sorted = [...sourceList].sort((a, b) => {
    if (!showArchived) {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return  1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const q = search.toLowerCase();
  const filtered = sorted.filter(s => {
    if (!search) return true;
    if (getPreview(s).toLowerCase().includes(q)) return true;
    if (searchInMessages) return s.messages.some(m => m.text.toLowerCase().includes(q));
    return false;
  });

  const ungrouped = filtered.filter(s => !s.projectId);

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function bulkDelete() { selectedIds.forEach(id => onDeleteSession(id)); setSelectedIds(new Set()); setSelectMode(false); }
  function bulkExport() { selectedIds.forEach(id => onExportSession(id)); setSelectedIds(new Set()); setSelectMode(false); }

  function ctxAction(fn: () => void) { fn(); setCtxMenu(null); }

  function renderSessionItem(session: Session) {
    return (
      <div
        key={session.id}
        className={[
          'session-item',
          session.id === activeId ? 'session-item--active' : '',
          session.pinned          ? 'session-item--pinned' : '',
          selectMode && selectedIds.has(session.id) ? 'session-item--selected' : '',
        ].join(' ')}
        onContextMenu={e => openCtxMenu(e, session)}
      >
        {selectMode && (
          <input
            type="checkbox"
            className="session-checkbox"
            checked={selectedIds.has(session.id)}
            onChange={() => toggleSelect(session.id)}
          />
        )}
        {editingId === session.id ? (
          <input
            className="session-rename-input"
            value={editName}
            autoFocus
            onChange={e => setEditName(e.target.value)}
            onBlur={() => commitRename(session.id)}
            onKeyDown={e => {
              if (e.key === 'Enter')  commitRename(session.id);
              if (e.key === 'Escape') setEditingId(null);
            }}
          />
        ) : (
          <button
            className="session-body"
            onClick={() => selectMode ? toggleSelect(session.id) : onSwitchSession(session.id)}
          >
            <span className="session-preview">
              {session.pinned && <span className="pin-icon"><Pin size={10}/></span>}
              {getPreview(session)}
            </span>
            <span className="session-time">{formatTime(session.createdAt)}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <aside className="sidebar">
      <section className="sidebar-section session-section">

        {/* Header row */}
        <div className="session-header-row">
          <p className="section-title" style={{ marginBottom: 0 }}>
            {showArchived ? `Archived (${archivedSessions.length})` : 'History'}
          </p>
          <div className="session-header-btns">
            {!showArchived && (
              <button
                className={`btn-icon-small ${showNewProject ? 'btn-icon-small--active' : ''}`}
                title="New project"
                onClick={() => setShowNewProject(v => !v)}
              ><FolderPlus size={12}/></button>
            )}
            <button
              className={`btn-icon-small ${showArchived ? 'btn-icon-small--active' : ''}`}
              title="Archived sessions"
              onClick={() => { setShowArchived(v => !v); setSelectMode(false); setSelectedIds(new Set()); }}
            ><Archive size={12}/></button>
            <button
              className={`btn-icon-small ${selectMode ? 'btn-icon-small--active' : ''}`}
              title="Multi-select"
              onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()); }}
            ><CheckSquare size={12}/></button>
            <button className="btn-icon-small" title="Import session" onClick={() => fileRef.current?.click()}>
              <Upload size={12}/>
            </button>
            {!showArchived && (
              <button className="btn-new-session" onClick={onNewSession}>+ New</button>
            )}
          </div>
        </div>

        <input ref={fileRef} type="file" accept=".md,.txt" style={{ display: 'none' }} onChange={handleImportFile}/>

        {/* New project form */}
        {showNewProject && (
          <div className="new-project-form">
            <input
              className="proj-name-input"
              placeholder="Project name…"
              value={newProjName}
              autoFocus
              onChange={e => setNewProjName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter')  handleCreateProject();
                if (e.key === 'Escape') setShowNewProject(false);
              }}
            />
            <div className="proj-color-row">
              {PROJECT_COLORS.map(c => (
                <button
                  key={c}
                  className={`proj-color-swatch ${newProjColor === c ? 'proj-color-swatch--active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setNewProjColor(c)}
                />
              ))}
            </div>
            <div className="proj-form-btns">
              <button className="btn-proj-cancel" onClick={() => setShowNewProject(false)}>Cancel</button>
              <button className="btn-proj-create" onClick={handleCreateProject} disabled={!newProjName.trim()}>Create</button>
            </div>
          </div>
        )}

        {/* Search */}
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
            title={searchInMessages ? 'Searching content' : 'Titles only'}
          ><Search size={11}/></button>
        </div>

        {/* Session list */}
        <div className="session-list">
          {filtered.length === 0 && <span className="muted">No sessions found</span>}

          {/* Projects */}
          {!showArchived && projects.map(project => {
            const projSessions = filtered.filter(s => s.projectId === project.id);
            return (
              <div key={project.id} className="project-group">
                <div className="project-header">
                  <button
                    className="project-toggle"
                    onClick={() => onToggleProjectCollapse(project.id)}
                  >
                    <span className="project-dot" style={{ background: project.color }}/>
                    {project.collapsed
                      ? <ChevronRight size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }}/>
                      : <ChevronDown  size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }}/>}
                    {editingProjId === project.id ? (
                      <input
                        className="proj-inline-rename"
                        value={editProjName}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                        onChange={e => setEditProjName(e.target.value)}
                        onBlur={() => {
                          if (editProjName.trim()) onRenameProject(project.id, editProjName.trim());
                          setEditingProjId(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            if (editProjName.trim()) onRenameProject(project.id, editProjName.trim());
                            setEditingProjId(null);
                          }
                          if (e.key === 'Escape') setEditingProjId(null);
                        }}
                      />
                    ) : (
                      <span className="project-name">{project.name}</span>
                    )}
                    <span className="project-count">{projSessions.length}</span>
                  </button>
                  <div className="project-actions">
                    <button
                      className="proj-action-btn"
                      title="Rename project"
                      onClick={e => { e.stopPropagation(); setEditingProjId(project.id); setEditProjName(project.name); }}
                    ><Pencil size={10}/></button>
                    <button
                      className="proj-action-btn proj-action-btn--danger"
                      title="Delete project"
                      onClick={e => { e.stopPropagation(); onDeleteProject(project.id); }}
                    ><X size={10}/></button>
                  </div>
                </div>

                {!project.collapsed && (
                  <div className="project-sessions" style={{ borderLeftColor: project.color }}>
                    {projSessions.length === 0 && (
                      <span className="muted" style={{ fontSize: 10, padding: '4px 8px', display: 'block' }}>
                        Right-click a chat to add here
                      </span>
                    )}
                    {projSessions.map(s => renderSessionItem(s))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Ungrouped sessions */}
          {!showArchived && ungrouped.length > 0 && (
            <>
              {projects.length > 0 && (
                <p className="date-group-label" style={{ marginTop: 10 }}>No Project</p>
              )}
              {DATE_ORDER.map(group => {
                const groupSessions  = ungrouped.filter(s => !s.pinned && dateGroup(s.createdAt) === group);
                const pinnedSessions = group === 'Today' ? ungrouped.filter(s => s.pinned) : [];
                const all = [...pinnedSessions, ...groupSessions];
                if (all.length === 0) return null;
                return (
                  <div key={group}>
                    <p className="date-group-label">{group}</p>
                    {all.map(s => renderSessionItem(s))}
                  </div>
                );
              })}
            </>
          )}

          {/* Archived list */}
          {showArchived && archivedSessions.map(s => renderSessionItem(s))}

          {selectMode && selectedIds.size > 0 && (
            <div className="bulk-action-bar">
              <span className="bulk-count">{selectedIds.size} selected</span>
              <button className="bulk-btn" onClick={bulkExport}><Download size={11}/> Export</button>
              <button className="bulk-btn bulk-btn--danger" onClick={bulkDelete}>Archive</button>
            </div>
          )}
        </div>
      </section>

      {/* Settings button */}
      <button className="btn-sidebar-settings" onClick={onOpenSettings}>
        <Settings size={13}/> Settings
      </button>

      {/* Right-click context menu */}
      {ctxMenu && (
        <div
          ref={menuRef}
          className="session-ctx-menu"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
        >
          {ctxMenu.archived ? (
            <>
              <button className="ctx-item" onClick={() => ctxAction(() => onRestoreSession(ctxMenu.sessionId))}>
                <Undo2 size={13}/> Restore
              </button>
              <div className="ctx-divider"/>
              <button className="ctx-item ctx-item--danger" onClick={() => ctxAction(() => onPermanentDelete(ctxMenu.sessionId))}>
                <Trash2 size={13}/> Delete forever
              </button>
            </>
          ) : (
            <>
              <button className="ctx-item" onClick={() => ctxAction(() => onPinSession(ctxMenu.sessionId))}>
                {ctxMenu.pinned ? <PinOff size={13}/> : <Pin size={13}/>}
                {ctxMenu.pinned ? 'Unpin' : 'Pin'}
              </button>
              <button className="ctx-item" onClick={() => {
                const session = sessions.find(s => s.id === ctxMenu.sessionId);
                if (session) startRename(session);
              }}>
                <Pencil size={13}/> Rename
              </button>
              <button className="ctx-item" onClick={() => ctxAction(() => onExportSession(ctxMenu.sessionId))}>
                <Download size={13}/> Export
              </button>

              {projects.length > 0 && (
                <>
                  <div className="ctx-divider"/>
                  <button
                    className="ctx-item ctx-item--sub"
                    onClick={e => { e.stopPropagation(); setMoveMenuId(moveMenuId === ctxMenu.sessionId ? null : ctxMenu.sessionId); }}
                  >
                    <Folder size={13}/> Move to project
                    <ChevronRight size={11} style={{ marginLeft: 'auto' }}/>
                  </button>
                </>
              )}

              <div className="ctx-divider"/>
              <button className="ctx-item ctx-item--danger" onClick={() => ctxAction(() => onDeleteSession(ctxMenu.sessionId))}>
                <Archive size={13}/> Archive
              </button>
            </>
          )}
        </div>
      )}

      {/* Move-to-project submenu */}
      {moveMenuId && ctxMenu && (
        <div
          ref={moveRef}
          className="session-ctx-menu"
          style={{ top: ctxMenu.y, left: ctxMenu.x + 172 }}
        >
          {ctxMenu.projectId && (
            <>
              <button className="ctx-item" onClick={() => { onMoveToProject(moveMenuId, undefined); setMoveMenuId(null); setCtxMenu(null); }}>
                <X size={13}/> Remove from project
              </button>
              <div className="ctx-divider"/>
            </>
          )}
          {projects.map(p => (
            <button
              key={p.id}
              className={`ctx-item ${ctxMenu.projectId === p.id ? 'ctx-item--active' : ''}`}
              onClick={() => { onMoveToProject(moveMenuId, p.id); setMoveMenuId(null); setCtxMenu(null); }}
            >
              <span className="project-dot" style={{ background: p.color, flexShrink: 0 }}/>
              {p.name}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
