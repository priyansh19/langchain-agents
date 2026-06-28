import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { Archive, MessageSquare, Bookmark, ArrowDown, RotateCcw, Undo2, Square, DollarSign, ChevronDown } from 'lucide-react';
import type { ChatMessage } from '../types';
import { MessageBubble } from './MessageBubble';
import { ArtifactPanel } from './ArtifactPanel';

const PROMPT_FILES = [
  'claude-fable-5.md',
  'claude-opus-4.8-v2.md',
  'claude-opus-4.8.md',
  'cursor.md',
  'devin-cli.md',
  'opencode.md',
  'zed.md',
];

interface Props {
  messages:          ChatMessage[];
  onSend:            (text: string, systemPrompt?: string) => void;
  onStop:            () => void;
  onRetry:           () => void;
  onUndo:            () => void;
  onEditMessage:     (msgId: string, newText: string) => void;
  onBookmarkMessage: (msgId: string) => void;
  disabled:          boolean;
  isGenerating:      boolean;
  isArchived?:       boolean;
  showRetry?:        boolean;
  showUndo?:         boolean;
  draft:             string;
  onDraftChange:     (text: string) => void;
}

const MAX_CHARS = 2000;

export function ChatArea({
  messages, onSend, onStop, onRetry, onUndo, onEditMessage, onBookmarkMessage,
  disabled, isGenerating, isArchived, showRetry, showUndo, draft, onDraftChange,
}: Props) {
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const containerRef    = useRef<HTMLDivElement>(null);
  const textareaRef     = useRef<HTMLTextAreaElement>(null);

  function scrollToMessage(id: string) {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  const [showJump,         setShowJump]         = useState(false);
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [showCost,          setShowCost]          = useState(false);
  const [artifact,          setArtifact]          = useState<{content: string; lang: string} | null>(null);
  const [selectedPrompt,    setSelectedPrompt]    = useState('');
  const [promptContent,     setPromptContent]     = useState('');
  const [promptLocked,      setPromptLocked]      = useState(false);

  useEffect(() => {
    if (!showJump) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showJump]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  }

  function jumpToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowJump(false);
  }

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  async function handlePromptSelect(filename: string) {
    setSelectedPrompt(filename);
    if (!filename) { setPromptContent(''); return; }
    try {
      const res = await fetch(`/prompts/${filename}`);
      const text = await res.text();
      setPromptContent(text);
    } catch { setPromptContent(''); }
  }

  function submit() {
    const text = draft.trim();
    if (!text || disabled || isGenerating || text.length > MAX_CHARS) return;
    onDraftChange('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    const isFirst = messages.length === 0 && !promptLocked;
    if (isFirst) setPromptLocked(true);
    onSend(text, isFirst && promptContent ? promptContent : undefined);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
    if (e.key === 'ArrowUp' && !draft) {
      const lastUser = [...messages].reverse().find(m => m.role === 'user');
      if (lastUser) {
        e.preventDefault();
        onDraftChange(lastUser.text);
        setTimeout(() => {
          const ta = textareaRef.current;
          if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`; }
        }, 0);
      }
    }
  }

  const charsLeft = MAX_CHARS - draft.length;
  const nearLimit = charsLeft < 200;
  const bookmarkCount  = messages.filter(m => m.bookmarked).length;
  const displayMessages = showBookmarksOnly ? messages.filter(m => m.bookmarked) : messages;
  const routingDots    = messages.filter(m => m.role === 'assistant' && m.handled_by && !m.loading);
  const lastMsg        = messages[messages.length - 1];
  const showChips      = !disabled && !isGenerating && lastMsg?.role === 'assistant' && !lastMsg?.loading;
  const CHIPS = ['Tell me more', 'Give an example', 'Explain differently'];

  return (
    <div className={`chat-wrap ${artifact ? 'chat-wrap--with-panel' : ''}`}>
      <div className="chat-header">
        <span>{isArchived ? <><Archive size={12}/> Archived — view only</> : <><MessageSquare size={12}/> Chat</>}</span>
        <div className="chat-header-actions">
          {bookmarkCount > 0 && (
            <button
              className={`btn-bookmarks-toggle ${showBookmarksOnly ? 'btn-bookmarks-toggle--active' : ''}`}
              onClick={() => setShowBookmarksOnly(v => !v)}
              title={showBookmarksOnly ? 'Show all messages' : 'Show bookmarked only'}
            >
              <Bookmark size={11}/> {bookmarkCount}
            </button>
          )}
          <button
            className={`btn-cost-toggle ${showCost ? 'btn-cost-toggle--active' : ''}`}
            onClick={() => setShowCost(v => !v)}
            title={showCost ? 'Hide costs' : 'Show cost per message'}
          >
            <DollarSign size={11}/> {showCost ? 'on' : 'off'}
          </button>
        </div>
      </div>

      <div className="messages" ref={containerRef} onScroll={handleScroll}>
        {!showBookmarksOnly && displayMessages.length === 0 && (
          <div className="empty-chat-state">
            <span className="empty-chat-icon">⌨</span>
            <p className="empty-chat-text">New conversation — type your first message</p>
          </div>
        )}
        {showBookmarksOnly && bookmarkCount === 0 && (
          <div className="empty-state">No bookmarked messages yet</div>
        )}
        {displayMessages.map(msg => (
          <div key={msg.id} id={`msg-${msg.id}`}>
            <MessageBubble
              message={msg}
              showCost={showCost}
              onEdit={msg.role === 'user' ? newText => onEditMessage(msg.id, newText) : undefined}
              onBookmark={() => onBookmarkMessage(msg.id)}
              onOpenArtifact={(content, lang) => setArtifact({ content, lang })}
            />
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {routingDots.length > 0 && (
        <GitBranchTimeline dots={routingDots} onJumpTo={scrollToMessage}/>
      )}

      {showJump && (
        <button className="btn-jump-bottom" onClick={jumpToBottom} title="Jump to bottom"><ArrowDown size={14}/></button>
      )}

      {showChips && (
        <div className="quick-chips">
          {CHIPS.map(chip => (
            <button key={chip} className="quick-chip" onClick={() => onSend(chip)}>{chip}</button>
          ))}
        </div>
      )}

      {(showRetry || showUndo) && (
        <div className="action-bar">
          {showRetry && !showUndo && (
            <button className="btn-retry" onClick={onRetry}><RotateCcw size={12}/> Retry last message</button>
          )}
          {showUndo && (
            <button className="btn-undo" onClick={onUndo}><Undo2 size={12}/> Undo send</button>
          )}
        </div>
      )}

      {messages.length === 0 && !promptLocked && !isArchived && (
        <div className="prompt-selector-bar">
          <span className="prompt-selector-label">System prompt</span>
          <div className="prompt-selector-wrap">
            <select
              className="prompt-selector-select"
              value={selectedPrompt}
              onChange={e => handlePromptSelect(e.target.value)}
            >
              <option value="">None (default)</option>
              {PROMPT_FILES.map(f => (
                <option key={f} value={f}>{f.replace('.md', '')}</option>
              ))}
            </select>
            <ChevronDown size={12} className="prompt-selector-chevron"/>
          </div>
          {selectedPrompt && (
            <span className="prompt-selector-active">
              ✓ {selectedPrompt.replace('.md', '')}
            </span>
          )}
        </div>
      )}

      <div className="input-bar">
        <div className="input-wrap">
          <span className="input-prefix">{'>'}</span>
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={draft}
            rows={1}
            disabled={disabled || isGenerating}
            placeholder={isArchived ? 'Archived — start a new session' : 'enter prompt...'}
            onChange={e => { onDraftChange(e.target.value); autoResize(); }}
            onKeyDown={onKeyDown}
            maxLength={MAX_CHARS}
          />
          {draft.length > 0 && (
            <span className={`char-counter ${nearLimit ? 'char-counter--warn' : ''}`}>
              {charsLeft}
            </span>
          )}
        </div>
        {isGenerating ? (
          <button className="btn-stop" onClick={onStop}><Square size={11}/> Stop</button>
        ) : (
          <button
            className="btn-send"
            onClick={submit}
            disabled={disabled || !draft.trim()}
          >
            RUN
          </button>
        )}
      </div>
      {artifact && (
        <ArtifactPanel
          content={artifact.content}
          lang={artifact.lang}
          onClose={() => setArtifact(null)}
        />
      )}
    </div>
  );
}

function GitBranchTimeline({ dots, onJumpTo }: { dots: ChatMessage[]; onJumpTo: (id: string) => void }) {
  const STEP     = 30;   // more vertical space so bezier curves have room
  const MAIN_X   = 12;
  const BRANCH_X = 36;
  const W        = 50;
  const PAD      = 14;

  if (dots.length === 0) return null;

  const H = PAD * 2 + (dots.length - 1) * STEP;

  return (
    <div className="routing-overlay">
      <span className="routing-overlay-label">routing</span>
      <div className="routing-overlay-scroll">
        <svg width={W} height={H}>
          {/* ── Continuous green main track, always full height ── */}
          <line
            x1={MAIN_X} y1={PAD} x2={MAIN_X} y2={H - PAD}
            stroke="rgba(63,185,80,0.55)" strokeWidth="1.5"
            strokeLinecap="round"
          />

          {dots.map((msg, i) => {
            const isCloud     = msg.handled_by === 'claude';
            const prevIsCloud = i > 0 && dots[i - 1].handled_by === 'claude';
            const cy   = PAD + i * STEP;
            const prevY = PAD + Math.max(0, i - 1) * STEP;
            const cx   = isCloud ? BRANCH_X : MAIN_X;

            return (
              <g key={msg.id}>
                {/* New branch: S-curve from the parent local dot down-and-right */}
                {isCloud && !prevIsCloud && i > 0 && (
                  <path
                    d={`M ${MAIN_X} ${prevY} C ${MAIN_X} ${cy} ${BRANCH_X} ${prevY} ${BRANCH_X} ${cy}`}
                    stroke="rgba(167,139,250,0.65)"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                )}
                {/* First dot is cloud: short horizontal to branch */}
                {isCloud && i === 0 && (
                  <line
                    x1={MAIN_X} y1={cy} x2={BRANCH_X} y2={cy}
                    stroke="rgba(167,139,250,0.65)" strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                )}
                {/* Consecutive cloud calls: straight vertical on branch */}
                {isCloud && prevIsCloud && (
                  <line
                    x1={BRANCH_X} y1={prevY} x2={BRANCH_X} y2={cy}
                    stroke="rgba(167,139,250,0.65)" strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                )}

                {/* Node */}
                <circle
                  cx={cx} cy={cy} r={4.5}
                  fill={isCloud ? '#a78bfa' : '#3fb950'}
                  className={`routing-node routing-node--${isCloud ? 'cloud' : 'local'}`}
                  onClick={() => onJumpTo(msg.id)}
                >
                  <title>
                    {isCloud ? 'Claude' : 'Local LLM'}
                    {msg.confidence !== undefined ? ` · ${msg.confidence}/10` : ''}
                    {' — click to jump'}
                  </title>
                </circle>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
