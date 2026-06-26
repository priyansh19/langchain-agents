import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage, ToolStep, Source } from '../types';

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const { role, text, tool_steps, sources, confidence, handled_by, loading } = message;
  const isUser = role === 'user';

  return (
    <div className={`msg-group msg-group--${role}`}>
      <span className="msg-label">{isUser ? 'You' : 'Assistant'}</span>
      <div className={`msg-bubble msg-bubble--${role}`}>
        {tool_steps && tool_steps.length > 0 && (
          <ToolStepsCard steps={tool_steps} />
        )}
        {sources && sources.length > 0 && (
          <SourcesCard sources={sources} />
        )}
        {loading ? (
          <TypingDots />
        ) : isUser ? (
          <span className="msg-text">{text}</span>
        ) : (
          <div className="msg-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        )}
        {!loading && !isUser && (confidence !== undefined || handled_by) && (
          <div className="msg-meta-row">
            {confidence !== undefined && <ConfidenceBadge score={confidence} />}
            {handled_by && <HandledByBadge by={handled_by} />}
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
  return (
    <div className={`confidence-badge ${color}`}>
      Confidence {score}/10
    </div>
  );
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
          <div className="tool-step-row">
            <span className="ts-key">Input</span>
            <span className="ts-val">{s.input}</span>
          </div>
          <div className="tool-step-row">
            <span className="ts-key">Output</span>
            <span className="ts-val">{s.output}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SourcesCard({ sources }: { sources: Source[] }) {
  return (
    <div className="sources-card">
      <div className="sources-header">
        📚 {sources.length} source{sources.length > 1 ? 's' : ''}
      </div>
      {sources.map((s, i) => (
        <div key={i} className="source-item">
          <p className="source-title">
            {s.title}{s.page ? ` — p.${s.page}` : ''}
          </p>
          {s.snippet && <p className="source-snippet">"{s.snippet}"</p>}
        </div>
      ))}
    </div>
  );
}
