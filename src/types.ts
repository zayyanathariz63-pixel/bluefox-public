export interface MediaAttachment {
  url: string;
  type: 'image' | 'video';
  name: string;
  size?: number;
  duration?: number;
}

export interface SearchSource {
  id: string;
  title: string;
  url: string;
  snippet: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  media?: MediaAttachment | MediaAttachment[];
  has_sources?: boolean;
  search_engine_used?: 'tavily' | 'duckduckgo' | string;
  sources?: SearchSource[];
}

export interface Connector {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  isConfigured: boolean;
  apiKey?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  model: string;
  isPinned?: boolean;
}

export type Language = 'id' | 'en';

export interface CustomApiKey {
  id: string;
  name: string;
  provider: string;
  baseUrl?: string;
  apiKey: string;
  model: string;
  isActive: boolean;
  createdAt: number;
}
