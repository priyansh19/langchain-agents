import { useState, useRef, KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bookmark, BookmarkCheck, Pencil, Copy, Check, Lock, Wrench, BookOpen, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import type { ChatMessage, ToolStep, Source } from '../types';

interface Props {
  message:          ChatMessage;
  showCost?:        boolean;
  onEdit?:          (newText: string) => void;
  onBookmark?:      () => void;
  onOpenArtifact?:  (content: string, lang: string) => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ message, showCost, onEdit, onBookmark, onOpenArtifact }: Props) {
  const { role, text, tool_steps, sources, confidence, handled_by, memory_used, facts_learned, timestamp, loading, bookmarked } = message;
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
        <span className="msg-label">{isUser ? 'YOU' : 'MACH1'}</span>
        {timestamp && <span className="msg-time">{formatTime(timestamp)}</span>}
        {bookmarked && <span className="bookmark-indicator" title="Bookmarked"><BookmarkCheck size={11}/></span>}
        {!isUser && handled_by === 'local llm' && !loading && (
          <span className="privacy-badge" title="This response never left your machine"><Lock size={9}/> Private</span>
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
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const inline = !className;
                  if (inline) return <code className={className} {...props}>{children}</code>;
                  const lang = /language-(\w+)/.exec(className || '')?.[1] || '';
                  const content = String(children).replace(/\n$/, '');
                  return (
                    <div className="code-block-wrap">
                      <div className="code-block-header">
                        <span className="code-lang">{lang || 'code'}</span>
                        {onOpenArtifact && (
                          <button className="btn-open-artifact" onClick={() => onOpenArtifact(content, lang)}>
                            ⊞ Open in panel
                          </button>
                        )}
                      </div>
                      <pre><code className={className} {...props}>{children}</code></pre>
                    </div>
                  );
                }
              }}
            >{text}</ReactMarkdown>
          </div>
        )}
        {!loading && !isUser && confidence !== undefined && confidence >= 5 && confidence <= 6 && (
          <div className="confidence-warning">
            ⚠️ Borderline confidence ({confidence}/10) — answer may need verification
          </div>
        )}

        {!loading && !isUser && (confidence !== undefined || handled_by || memory_used || showCost) && (
          <div className="msg-meta-row">
            {confidence !== undefined && <ConfidenceBadge score={confidence} />}
            {handled_by && <HandledByBadge by={handled_by} confidence={confidence} />}
            {memory_used && <span className="memory-badge"><BookOpen size={10}/> from memory</span>}
            {facts_learned !== undefined && facts_learned > 0 && (
              <span className="facts-badge"><Sparkles size={10}/> {facts_learned} fact{facts_learned > 1 ? 's' : ''} learned</span>
            )}
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
                <Bookmark size={11}/>
              </button>
            )}
            {isUser && onEdit && !editing && (
              <button className="btn-msg-action" onClick={startEdit} title="Edit message"><Pencil size={11}/></button>
            )}
            {!isUser && (
              <button
                className={`btn-msg-action ${copied ? 'btn-msg-action--copied' : ''}`}
                onClick={copyText}
                title="Copy response"
              >
                {copied ? <Check size={11}/> : <Copy size={11}/>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HandledByBadge({ by, confidence }: { by: string; confidence?: number }) {
  const isClaude = by.toLowerCase() === 'claude';
  const [open, setOpen] = useState(false);
  return (
    <span className="handled-badge-wrap">
      <span
        className={`handled-badge handled-badge--clickable ${isClaude ? 'handled--claude' : 'handled--local'}`}
        onClick={() => setOpen(o => !o)}
        title="Click to see routing reason"
      >
        {isClaude ? 'via Claude' : 'via Local'}
      </span>
      {open && (
        <div className="routing-popover">
          {confidence !== undefined && (
            <p className="routing-popover-score">Score: <strong>{confidence}/10</strong></p>
          )}
          <p className="routing-popover-reason">
            {isClaude
              ? 'Score was below threshold — escalated to Claude CLI'
              : 'Score met threshold — answered locally on your machine'}
          </p>
          {!isClaude && <p className="routing-popover-private">🔒 Never left your device</p>}
        </div>
      )}
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
        <Wrench size={11}/><span>Used {steps.length} tool{steps.length > 1 ? 's' : ''}</span>
        <span className="tool-toggle">{open ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}</span>
      </button>
      {open && steps.map((s, i) => (
        <div key={i} className="tool-step">
          <p className="tool-step-name"><Wrench size={10}/> {s.tool}</p>
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
      <div className="sources-header"><BookOpen size={11}/> {sources.length} source{sources.length > 1 ? 's' : ''}</div>
      {sources.map((s, i) => (
        <div key={i} className="source-item">
          <p className="source-title">{s.title}{s.page ? ` — p.${s.page}` : ''}</p>
          {s.snippet && <p className="source-snippet">"{s.snippet}"</p>}
        </div>
      ))}
    </div>
  );
}
