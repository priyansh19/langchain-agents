import { useState } from 'react';
import { Circle, RefreshCw, Pause, CheckCircle2, XCircle, Check, X, Users, Wrench } from 'lucide-react';
import { planTask, executeTask } from '../api';
import type { PlanStep } from '../api';

type TaskStatus = 'pending' | 'planning' | 'awaiting' | 'running' | 'done' | 'failed';

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  steps: PlanStep[];
  output?: string;
  toolSteps?: unknown[];
  error?: string;
  createdAt: string;
  autonomy: number;
}

function StatusIcon({ status }: { status: TaskStatus }) {
  switch (status) {
    case 'pending':  return <Circle size={12}/>;
    case 'planning': return <RefreshCw size={12} className="spin"/>;
    case 'awaiting': return <Pause size={12}/>;
    case 'running':  return <RefreshCw size={12} className="spin"/>;
    case 'done':     return <CheckCircle2 size={12}/>;
    case 'failed':   return <XCircle size={12}/>;
  }
}

const STATUS_CLASS: Record<TaskStatus, string> = {
  pending:  'task-status--pending',
  planning: 'task-status--running',
  awaiting: 'task-status--awaiting',
  running:  'task-status--running',
  done:     'task-status--done',
  failed:   'task-status--failed',
};

const AUTONOMY_LABELS = ['Observe & Suggest', 'Plan & Propose', 'Act with Confirmation', 'Act Autonomously'];

export function CoworkArea() {
  const [tasks, setTasks]             = useState<Task[]>([]);
  const [input, setInput]             = useState('');
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [autonomy, setAutonomy]       = useState(2);

  const selectedTask = tasks.find(t => t.id === selectedId) ?? null;

  function updateTask(id: string, patch: Partial<Task>) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }

  async function submitTask() {
    const title = input.trim();
    if (!title) return;
    const id = `t${Date.now()}`;
    const task: Task = { id, title, status: 'planning', steps: [], createdAt: new Date().toISOString(), autonomy };
    setTasks(prev => [task, ...prev]);
    setSelectedId(id);
    setInput('');

    try {
      const steps = await planTask(title, autonomy);
      if (autonomy >= 3) {
        // Act Autonomously — skip approval gate
        updateTask(id, { steps, status: 'running' });
        const result = await executeTask(title, steps, autonomy);
        updateTask(id, { status: 'done', output: result.output, toolSteps: result.tool_steps });
      } else {
        // Plan & Propose / Act with Confirmation — pause for approval
        updateTask(id, { steps, status: 'awaiting' });
      }
    } catch (e) {
      updateTask(id, { status: 'failed', error: String(e) });
    }
  }

  async function approve(task: Task) {
    updateTask(task.id, { status: 'running' });
    try {
      const result = await executeTask(task.title, task.steps, task.autonomy);
      updateTask(task.id, { status: 'done', output: result.output, toolSteps: result.tool_steps });
    } catch (e) {
      updateTask(task.id, { status: 'failed', error: String(e) });
    }
  }

  function reject(id: string) {
    updateTask(id, { status: 'failed', error: 'Cancelled by user' });
  }

  return (
    <div className="cowork-wrap">

      {/* Left — task queue */}
      <div className="cowork-left">
        <div className="cowork-header">
          <span className="cowork-title">Cowork</span>
          <div className="autonomy-wrap">
            <span className="autonomy-label">Autonomy</span>
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
              className={`task-card ${selectedId === task.id ? 'task-card--active' : ''}`}
              onClick={() => setSelectedId(task.id)}
            >
              <div className="task-card-top">
                <span className={`task-status-icon ${STATUS_CLASS[task.status]}`}>
                  <StatusIcon status={task.status}/>
                </span>
                <span className="task-card-title">{task.title}</span>
              </div>
              {task.steps.length > 0 && (
                <div className="task-card-steps">
                  {task.steps.map((_, i) => (
                    <span
                      key={i}
                      className={`task-step-dot ${task.status === 'done' ? 'task-step-dot--done' : ''}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right — detail panel */}
      <div className="cowork-right">
        {selectedTask ? (
          <>
            <div className="cowork-output-header">
              <span className="cowork-output-title">{selectedTask.title}</span>
              <span className={`task-status-badge ${STATUS_CLASS[selectedTask.status]}`}>
                {selectedTask.status}
              </span>
            </div>

            {selectedTask.steps.length > 0 && (
              <div className="cowork-steps">
                <p className="cowork-section-label">Plan</p>
                {selectedTask.steps.map((s, i) => (
                  <div key={i} className={`cowork-step ${selectedTask.status === 'done' ? 'cowork-step--done' : 'cowork-step--pending'}`}>
                    <span className="cowork-step-icon">
                      {selectedTask.status === 'done' ? <Check size={11}/> : <Circle size={11}/>}
                    </span>
                    <span className="cowork-step-label">{s.label}</span>
                    {s.tool && <span className="cowork-step-tool"><Wrench size={9}/> {s.tool}</span>}
                  </div>
                ))}
              </div>
            )}

            {selectedTask.status === 'planning' && (
              <div className="cowork-status-msg">
                <RefreshCw size={12} className="spin"/> Planning task…
              </div>
            )}

            {selectedTask.status === 'running' && (
              <div className="cowork-status-msg">
                <RefreshCw size={12} className="spin"/> Executing…
              </div>
            )}

            {selectedTask.status === 'awaiting' && (
              <div className="cowork-approval">
                <p className="cowork-approval-msg"><Pause size={11}/> Review the plan above — approve to execute.</p>
                <div className="cowork-approval-btns">
                  <button className="btn-approve" onClick={() => approve(selectedTask)}>
                    <Check size={12}/> Approve &amp; Execute
                  </button>
                  <button className="btn-reject" onClick={() => reject(selectedTask.id)}>
                    <X size={12}/> Cancel
                  </button>
                </div>
              </div>
            )}

            {selectedTask.output && (
              <div className="cowork-output-box">
                <p className="cowork-output-label">Output</p>
                <pre className="cowork-output-text">{selectedTask.output}</pre>
              </div>
            )}

            {selectedTask.error && (
              <div className="cowork-error-box">
                <p className="cowork-output-label">Error</p>
                <p className="cowork-error-text">{selectedTask.error}</p>
              </div>
            )}
          </>
        ) : (
          <div className="cowork-output-empty">
            <span className="cowork-output-empty-icon"><Users size={28}/></span>
            <p>Select a task to see its plan and output</p>
            <p className="cowork-output-empty-sub">Tasks run locally · cloud only when confidence is low</p>
          </div>
        )}
      </div>
    </div>
  );
}
