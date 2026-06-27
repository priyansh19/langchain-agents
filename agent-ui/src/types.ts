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
  memory_used?: boolean;
  facts_learned?: number;
  timestamp?: string;
  bookmarked?: boolean;
  loading?: boolean;
}

export interface ChatResponse {
  response: string;
  tool_steps?: ToolStep[];
  sources?: Source[];
  confidence?: number;
  handled_by?: string;
  memory_used?: boolean;
  facts_learned?: number;
}

export interface Session {
  id: string;
  name?: string;
  pinned?: boolean;
  archived?: boolean;
  projectId?: string;
  createdAt: string;
  messages: ChatMessage[];
  agentName?: string;
}

export interface Project {
  id:        string;
  name:      string;
  color:     string;
  createdAt: string;
  collapsed?: boolean;
}
