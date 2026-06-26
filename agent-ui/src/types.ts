export type ConnectionStatus = 'connecting' | 'online' | 'offline';

export interface Capabilities {
  agent_name: string;
  version: string;
  model?: string;
  features: Record<string, boolean>;
}

export interface ToolStep {
  tool: string;
  input: string;
  output: string;
}

export interface Source {
  title: string;
  page?: number;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  tool_steps?: ToolStep[];
  sources?: Source[];
  confidence?: number;
  handled_by?: string;
  loading?: boolean;
}

export interface ChatResponse {
  response: string;
  tool_steps?: ToolStep[];
  sources?: Source[];
  confidence?: number;
  handled_by?: string;
}

export interface Session {
  id: string;
  createdAt: string;
  messages: ChatMessage[];
  agentName?: string;
}
