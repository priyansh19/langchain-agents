import type { Capabilities, ChatResponse } from './types';

export async function fetchCapabilities(): Promise<Capabilities> {
  const res = await fetch('/capabilities');
  if (!res.ok) throw new Error('Server unreachable');
  return res.json() as Promise<Capabilities>;
}

export async function sendChat(message: string, signal?: AbortSignal, systemPrompt?: string): Promise<ChatResponse> {
  const res = await fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, system_prompt: systemPrompt }),
    signal,
  });
  if (!res.ok) throw new Error('Chat request failed');
  return res.json() as Promise<ChatResponse>;
}

export async function clearConversation(): Promise<void> {
  try {
    await fetch('/clear', { method: 'POST' });
  } catch {
    // older agents may not support /clear yet — that's fine
  }
}

export async function setPersona(persona: string): Promise<void> {
  try {
    await fetch('/persona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona }),
    });
  } catch {
    // older agents may not support /persona yet — that's fine
  }
}

export async function fetchThreshold(): Promise<number> {
  try {
    const res = await fetch('/config');
    if (!res.ok) return 7;
    const data = await res.json();
    return data.threshold ?? 7;
  } catch {
    return 7;
  }
}

export async function setThreshold(threshold: number): Promise<void> {
  try {
    await fetch('/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threshold }),
    });
  } catch {
    // older agents may not support /config yet
  }
}
