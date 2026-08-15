export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
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
}

export interface CustomApiKey {
  id: string;
  name: string;
  provider: string;
  baseUrl?: string;
  apiKey: string;
  model?: string;
  isActive: boolean;
  createdAt: number;
}
