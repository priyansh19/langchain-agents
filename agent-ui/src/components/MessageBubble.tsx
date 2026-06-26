import { useState, useRef, KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage, ToolStep, Source } from '../types';

interface Props {
  message:   ChatMessage;
  showCost?: boolean;
  onEdit?:   (newText: string) => void;
  onBookmark?: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ message, showCost, onEdit, onBookmark }: Props) {
  const { role, text, tool_steps, sources, confidence, handled_by, memory_used, timestamp, loading, bookmarked } = message;
  const isUser = role === 'user';
  const routingClass = !isUser && handled_by
    ? (handled_by === 'local llm' ? 'msg-group--local' : 'msg-group--cloud')
    : '';
  const [copied,  setCopied]  = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(text);
  const editRef = useRef<HTMLTextAreaElement>(null);

  function copyText() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function startEdit() {
    setEditVal(text);
    setEditing(true);
    setTimeout(() => editRef.current?.focus(), 50);
  }

  function submitEdit() {
    const v = editVal.trim();
    if (v && v !== text && onEdit) onEdit(v);
    setEditing(false);
  }

  function onEditKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(); }
    if (e.key === 'Escape') setEditing(false);
  }

  return (
    <div className={`msg-group msg-group--${role} ${routingClass}`}>
      <div className="msg-label-row">
        <span className="msg-label">{isUser ? 'You' : 'Assistant'}</span>
        {timestamp && <span className="msg-time">{formatTime(timestamp)}</span>}
        {bookmarked && <span className="bookmark-indicator" title="Bookmarked">🔖</span>}
        {!isUser && handled_by === 'local llm' && !loading && (
          <span className="privacy-badge" title="This response never left your machine">🔒 Private</span>
        )}
      </div>

      <div className={`msg-bubble msg-bubble--${role}`}>
        {tool_steps && tool_steps.length > 0 && <ToolStepsCard steps={tool_steps} />}
        {sources    && sources.length    > 0 && <SourcesCard sources={sources} />}

        {loading ? (
          <TypingDots />
        ) : editing ? (
          <div className="msg-edit-wrap">
            <textarea
              ref={editRef}
              className="msg-edit-input"
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onKeyDown={onEditKeyDown}
              rows={3}
            />
            <div className="msg-edit-actions">
              <button className="btn-edit-submit" onClick={submitEdit}>Send</button>
              <button className="btn-edit-cancel" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : isUser ? (
          <span className="msg-text">{text}</span>
        ) : (
          <div className="msg-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        )}

        {!loading && !isUser && (confidence !== undefined || handled_by || memory_used || showCost) && (
          <div className="msg-meta-row">
            {confidence !== undefined && <ConfidenceBadge score={confidence} />}
            {handled_by && <HandledByBadge by={handled_by} />}
            {memory_used && <span className="memory-badge">🧠 from memory</span>}
            {showCost && handled_by && (
              <span className="cost-badge">{handled_by === 'local llm' ? '$0.00' : '~$0.003'}</span>
            )}
          </div>
        )}

        {!loading && (
          <div className="msg-action-bar">
            {onBookmark && (
              <button
                className={`btn-msg-action ${bookmarked ? 'btn-msg-action--active' : ''}`}
                onClick={onBookmark}
                title={bookmarked ? 'Remove bookmark' : 'Bookmark'}
              >
                🔖
              </button>
            )}
            {isUser && onEdit && !editing && (
              <button className="btn-msg-action" onClick={startEdit} title="Edit message">✎</button>
            )}
            {!isUser && (
              <button
                className={`btn-msg-action ${copied ? 'btn-msg-action--copied' : ''}`}
                onClick={copyText}
                title="Copy response"
              >
                {copied ? '✓' : '⎘'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HandledByBadge({ by }: { by: string }) {
  const isClaude = by.toLowerCase() === 'claude';
  return (
    <span className={`handled-badge ${isClaude ? 'handled--claude' : 'handled--local'}`}>
      {isClaude ? 'via Claude' : 'via Local'}
    </span>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 8 ? 'confidence--high' : score >= 5 ? 'confidence--mid' : 'confidence--low';
  return <div className={`confidence-badge ${color}`}>Confidence {score}/10</div>;
}

function TypingDots() {
  return (
    <div className="typing-dots" aria-label="Thinking…">
      <span /><span /><span />
    </div>
  );
}

function ToolStepsCard({ steps }: { steps: ToolStep[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="tool-card">
      <button className="tool-card-header" onClick={() => setOpen(o => !o)}>
        <span>🔧 Used {steps.length} tool{steps.length > 1 ? 's' : ''}</span>
        <span className="tool-toggle">{open ? '▾ collapse' : '▸ expand'}</span>
      </button>
      {open && steps.map((s, i) => (
        <div key={i} className="tool-step">
          <p className="tool-step-name">🔧 {s.tool}</p>
          <div className="tool-step-row"><span className="ts-key">Input</span><span className="ts-val">{s.input}</span></div>
          <div className="tool-step-row"><span className="ts-key">Output</span><span className="ts-val">{s.output}</span></div>
        </div>
      ))}
    </div>
  );
}

function SourcesCard({ sources }: { sources: Source[] }) {
  return (
    <div className="sources-card">
      <div className="sources-header">📚 {sources.length} source{sources.length > 1 ? 's' : ''}</div>
      {sources.map((s, i) => (
        <div key={i} className="source-item">
          <p className="source-title">{s.title}{s.page ? ` — p.${s.page}` : ''}</p>
          {s.snippet && <p className="source-snippet">"{s.snippet}"</p>}
        </div>
      ))}
    </div>
  );
}
