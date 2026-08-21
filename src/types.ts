export interface MediaAttachment {
  url: string;
  type: 'image' | 'video';
  name: string;
  size?: number;
  duration?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  media?: MediaAttachment | MediaAttachment[];
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
