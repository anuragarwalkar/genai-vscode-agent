export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AgentConfig {
  llmProvider: 'openai' | 'anthropic' | 'gemini' | 'openai-compatible';
  model: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  apiEndpoint?: string;
  customHeaders?: Record<string, string>;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export interface ProviderPreset {
  name: string;
  endpoint: string;
  headers?: Record<string, string>;
  models: string[];
  description?: string;
}

export interface ProviderConfig {
  presets: {
    [key: string]: ProviderPreset;
  };
  defaultModels: {
    [key: string]: string[];
  };
}

export interface WebviewMessage {
  command: string;
  config?: AgentConfig;
  success?: boolean;
  error?: string;
}
