import { useState } from 'react';
import { Circle, RefreshCw, Pause, CheckCircle2, XCircle, Check, X, Users } from 'lucide-react';

type TaskStatus = 'pending' | 'running' | 'awaiting' | 'done' | 'failed';

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  steps: { label: string; done: boolean }[];
  output?: string;
  createdAt: string;
}

function StatusIcon({ status }: { status: TaskStatus }) {
  switch (status) {
    case 'pending':  return <Circle size={12}/>;
    case 'running':  return <RefreshCw size={12}/>;
    case 'awaiting': return <Pause size={12}/>;
    case 'done':     return <CheckCircle2 size={12}/>;
    case 'failed':   return <XCircle size={12}/>;
  }
}
const STATUS_CLASS: Record<TaskStatus, string> = {
  pending:  'task-status--pending',
  running:  'task-status--running',
  awaiting: 'task-status--awaiting',
  done:     'task-status--done',
  failed:   'task-status--failed',
};

const DEMO_TASKS: Task[] = [
  {
    id: 't1',
    title: 'Draft project README',
    status: 'done',
    steps: [
      { label: 'Read existing files', done: true },
      { label: 'Generate outline', done: true },
      { label: 'Write README.md', done: true },
    ],
    output: 'README.md written to workspace (342 words).',
    createdAt: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: 't2',
    title: 'Summarise last 5 conversations',
    status: 'awaiting',
    steps: [
      { label: 'Load session history', done: true },
      { label: 'Extract key topics', done: true },
      { label: 'Write summary — awaiting approval', done: false },
    ],
    createdAt: new Date(Date.now() - 30000).toISOString(),
  },
];

export function CoworkArea() {
  const [tasks, setTasks]         = useState<Task[]>(DEMO_TASKS);
  const [input, setInput]         = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [autonomy, setAutonomy]   = useState(1);

  const AUTONOMY_LABELS = ['Observe & Suggest', 'Plan & Propose', 'Act with Confirmation', 'Act Autonomously'];

  function submitTask() {
    const title = input.trim();
    if (!title) return;
    const newTask: Task = {
      id: `t${Date.now()}`,
      title,
      status: 'pending',
      steps: [],
      createdAt: new Date().toISOString(),
    };
    setTasks(prev => [newTask, ...prev]);
    setInput('');
  }

  return (
    <div className="cowork-wrap">

      {/* Left column — task queue */}
      <div className="cowork-left">
        <div className="cowork-header">
          <span className="cowork-title">Cowork</span>
          <div className="autonomy-wrap">
            <span className="autonomy-label">Autonomy:</span>
            <div className="autonomy-dial">
              {AUTONOMY_LABELS.map((l, i) => (
                <button
                  key={i}
                  className={`autonomy-btn ${autonomy === i ? 'autonomy-btn--active' : ''}`}
                  onClick={() => setAutonomy(i)}
                  title={l}
                >{i + 1}</button>
              ))}
            </div>
            <span className="autonomy-mode">{AUTONOMY_LABELS[autonomy]}</span>
          </div>
        </div>

        <div className="task-input-wrap">
          <textarea
            className="task-input"
            placeholder="Describe a task in plain language…"
            value={input}
            rows={2}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitTask(); } }}
          />
          <button className="btn-task-submit" onClick={submitTask} disabled={!input.trim()}>
            Queue Task
          </button>
        </div>

        <div className="task-list">
          {tasks.length === 0 && <p className="cowork-empty">No tasks yet — describe one above</p>}
          {tasks.map(task => (
            <div
              key={task.id}
              className={`task-card ${selectedTask?.id === task.id ? 'task-card--active' : ''}`}
              onClick={() => setSelectedTask(task)}
            >
              <div className="task-card-top">
                <span className={`task-status-icon ${STATUS_CLASS[task.status]}`}>
                  <StatusIcon status={task.status}/>
                </span>
                <span className="task-card-title">{task.title}</span>
              </div>
              <div className="task-card-steps">
                {task.steps.map((s, i) => (
                  <span key={i} className={`task-step-dot ${s.done ? 'task-step-dot--done' : ''}`} title={s.label} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right column — output panel */}
      <div className="cowork-right">
        {selectedTask ? (
          <>
            <div className="cowork-output-header">
              <span className="cowork-output-title">{selectedTask.title}</span>
              <span className={`task-status-badge ${STATUS_CLASS[selectedTask.status]}`}>
                {selectedTask.status}
              </span>
            </div>

            <div className="cowork-steps">
              {selectedTask.steps.map((s, i) => (
                <div key={i} className={`cowork-step ${s.done ? 'cowork-step--done' : 'cowork-step--pending'}`}>
                  <span className="cowork-step-icon">{s.done ? <Check size={11}/> : <Circle size={11}/>}</span>
                  <span className="cowork-step-label">{s.label}</span>
                </div>
              ))}
            </div>

            {selectedTask.output && (
              <div className="cowork-output-box">
                <p className="cowork-output-label">Output</p>
                <p className="cowork-output-text">{selectedTask.output}</p>
              </div>
            )}

            {selectedTask.status === 'awaiting' && (
              <div className="cowork-approval">
                <p className="cowork-approval-msg"><Pause size={11}/> Agent is waiting for your approval to continue.</p>
                <div className="cowork-approval-btns">
                  <button className="btn-approve" onClick={() => setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, status: 'running' as TaskStatus } : t))}>
                    <Check size={12}/> Approve &amp; Continue
                  </button>
                  <button className="btn-reject" onClick={() => setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, status: 'failed' as TaskStatus } : t))}>
                    <X size={12}/> Cancel Task
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="cowork-output-empty">
            <span className="cowork-output-empty-icon"><Users size={28}/></span>
            <p>Select a task to see its steps and output</p>
            <p className="cowork-output-empty-sub">Tasks run locally using your agent — cloud only when confidence is low</p>
          </div>
        )}
      </div>
    </div>
  );
}
