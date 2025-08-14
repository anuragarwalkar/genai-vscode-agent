export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AgentConfig {
  llmProvider: 'openai' | 'anthropic';
  model: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  description: string;
}
