export interface MediaAttachment {
  id?: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'file';
  name: string;
  size?: number;
  duration?: number;
  textContent?: string;
  pageCount?: number;
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
  thinking?: string;
  isThinking?: boolean;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
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

export interface BluefoxCustomApi {
  id: string;
  user_id: string;
  name: string;
  api_type: 'image' | 'video';
  endpoint_url: string;
  model_id: string;
  api_key_encrypted: string;
  created_at?: string;
}

