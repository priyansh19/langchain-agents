import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import type { ChatMessage } from '../types';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages:          ChatMessage[];
  onSend:            (text: string) => void;
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
  const [showJump,         setShowJump]         = useState(false);
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [showCost,          setShowCost]          = useState(false);

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

  function submit() {
    const text = draft.trim();
    if (!text || disabled || isGenerating || text.length > MAX_CHARS) return;
    onDraftChange('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    onSend(text);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  }

  const charsLeft = MAX_CHARS - draft.length;
  const nearLimit = charsLeft < 200;
  const bookmarkCount  = messages.filter(m => m.bookmarked).length;
  const displayMessages = showBookmarksOnly ? messages.filter(m => m.bookmarked) : messages;
  const routingDots    = messages.filter(m => m.role === 'assistant' && m.handled_by && !m.loading);

  return (
    <div className="chat-wrap">
      <div className="chat-header">
        <span>{isArchived ? '📁 Archived session — view only' : '💬 Chat'}</span>
        <div className="chat-header-actions">
          {bookmarkCount > 0 && (
            <button
              className={`btn-bookmarks-toggle ${showBookmarksOnly ? 'btn-bookmarks-toggle--active' : ''}`}
              onClick={() => setShowBookmarksOnly(v => !v)}
              title={showBookmarksOnly ? 'Show all messages' : 'Show bookmarked only'}
            >
              🔖 {bookmarkCount}
            </button>
          )}
          <button
            className={`btn-cost-toggle ${showCost ? 'btn-cost-toggle--active' : ''}`}
            onClick={() => setShowCost(v => !v)}
            title={showCost ? 'Hide costs' : 'Show cost per message'}
          >
            $ {showCost ? 'on' : 'off'}
          </button>
        </div>
      </div>

      <div className="messages" ref={containerRef} onScroll={handleScroll}>
        {showBookmarksOnly && bookmarkCount === 0 && (
          <div className="empty-state">No bookmarked messages yet</div>
        )}
        {displayMessages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            showCost={showCost}
            onEdit={msg.role === 'user' ? newText => onEditMessage(msg.id, newText) : undefined}
            onBookmark={() => onBookmarkMessage(msg.id)}
          />
        ))}
        {routingDots.length > 0 && (
          <div className="routing-timeline">
            {routingDots.map(m => (
              <span
                key={m.id}
                className={`routing-dot routing-dot--${m.handled_by === 'local llm' ? 'local' : 'cloud'}`}
                title={`${m.handled_by === 'local llm' ? 'Local' : 'Claude'}${m.confidence !== undefined ? ` · Score ${m.confidence}/10` : ''}`}
              />
            ))}
            <span className="routing-timeline-label">routing history</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {showJump && (
        <button className="btn-jump-bottom" onClick={jumpToBottom} title="Jump to bottom">↓</button>
      )}

      {(showRetry || showUndo) && (
        <div className="action-bar">
          {showRetry && !showUndo && (
            <button className="btn-retry" onClick={onRetry}>↺ Retry last message</button>
          )}
          {showUndo && (
            <button className="btn-undo" onClick={onUndo}>↩ Undo send</button>
          )}
        </div>
      )}

      <div className="input-bar">
        <div className="input-wrap">
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={draft}
            rows={1}
            disabled={disabled || isGenerating}
            placeholder={isArchived ? 'Archived — start a new session to chat' : 'Type a message… (Enter to send · Shift+Enter for newline)'}
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
          <button className="btn-stop" onClick={onStop}>■ Stop</button>
        ) : (
          <button
            className="btn-send"
            onClick={submit}
            disabled={disabled || !draft.trim()}
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
