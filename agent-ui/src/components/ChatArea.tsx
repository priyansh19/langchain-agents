import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import type { ChatMessage } from '../types';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  disabled: boolean;
  isArchived?: boolean;
}

export function ChatArea({ messages, onSend, disabled, isArchived }: Props) {
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  function submit() {
    const text = draft.trim();
    if (!text || disabled) return;
    setDraft('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    onSend(text);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="chat-wrap">
      <div className="chat-header">
        {isArchived
          ? '📁 Archived session — view only'
          : '💬 Chat with your agent'}
      </div>

      <div className="messages">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-bar">
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={draft}
          rows={1}
          disabled={disabled}
          placeholder="Type a message… (Enter to send · Shift+Enter for newline)"
          onChange={e => { setDraft(e.target.value); autoResize(); }}
          onKeyDown={onKeyDown}
        />
        <button
          className="btn-send"
          onClick={submit}
          disabled={disabled || !draft.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
