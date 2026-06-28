import type { Capabilities, ChatResponse } from './types';

export async function fetchCapabilities(): Promise<Capabilities> {
  const res = await fetch('/capabilities');
  if (!res.ok) throw new Error('Server unreachable');
  return res.json() as Promise<Capabilities>;
}

export async function createSession(): Promise<string> {
  const res = await fetch('/session', { method: 'POST' });
  if (!res.ok) throw new Error('Could not create session');
  const data = await res.json();
  return data.session_id as string;
}

export async function sendChat(
  message: string,
  sessionId: string,
  signal?: AbortSignal,
  systemPrompt?: string,
): Promise<ChatResponse> {
  const res = await fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId, system_prompt: systemPrompt }),
    signal,
  });
  if (!res.ok) throw new Error('Chat request failed');
  return res.json() as Promise<ChatResponse>;
}

export async function clearConversation(sessionId?: string): Promise<void> {
  try {
    await fetch('/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId ?? null }),
    });
  } catch { /* ok */ }
}

export async function deleteSessionRemote(sessionId: string): Promise<void> {
  try { await fetch(`/session/${sessionId}`, { method: 'DELETE' }); } catch { /* ok */ }
}

export async function fetchThreshold(): Promise<number> {
  try {
    const res = await fetch('/config');
    if (!res.ok) return 7;
    const data = await res.json();
    return data.threshold ?? 7;
  } catch { return 7; }
}

export async function setThreshold(threshold: number): Promise<void> {
  try {
    await fetch('/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threshold }),
    });
  } catch { /* ok */ }
}

// ── Cowork ────────────────────────────────────────────────────────────────────

export interface PlanStep { step: number; label: string; tool?: string; }

export async function planTask(task: string, autonomy: number): Promise<PlanStep[]> {
  const res = await fetch('/cowork/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, autonomy }),
  });
  if (!res.ok) throw new Error('Plan failed');
  const data = await res.json();
  return data.steps as PlanStep[];
}

export async function executeTask(task: string, steps: PlanStep[], autonomy: number): Promise<{ output: string; tool_steps?: unknown[] }> {
  const res = await fetch('/cowork/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, steps, autonomy }),
  });
  if (!res.ok) throw new Error('Execute failed');
  return res.json();
}

// ── Code / Files ──────────────────────────────────────────────────────────────

export interface FileEntry { name: string; type: 'file' | 'dir'; size: number; path: string; }

export async function listFiles(path: string): Promise<{ path: string; entries: FileEntry[] }> {
  const res = await fetch(`/files?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error('Cannot list files');
  return res.json();
}

export async function readFile(path: string): Promise<string> {
  const res = await fetch(`/files/read?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error('Cannot read file');
  const data = await res.json();
  return data.content as string;
}

export async function fetchGitDiff(): Promise<string> {
  try {
    const res = await fetch('/git/diff');
    if (!res.ok) return '';
    const data = await res.json();
    return data.diff as string;
  } catch { return ''; }
}

export async function runCommand(command: string): Promise<{ stdout: string; stderr: string; returncode: number }> {
  const res = await fetch('/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  });
  if (!res.ok) throw new Error('Run failed');
  return res.json();
}
