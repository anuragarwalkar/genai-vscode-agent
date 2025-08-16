import * as vscode from 'vscode';
import { AgentConfig } from './types';
import { validateApiKey, getDefaultConfig } from './llmService';

// Configuration keys
const CONFIG_SECTION = 'avior';
const API_KEY_STORAGE = 'apiKey';
const PROVIDER_STORAGE = 'provider';
const MODEL_STORAGE = 'model';
const TEMPERATURE_STORAGE = 'temperature';
const MAX_TOKENS_STORAGE = 'maxTokens';
const API_ENDPOINT_STORAGE = 'apiEndpoint';
const CUSTOM_HEADERS_STORAGE = 'customHeaders';

// Factory function to create config manager
export const createConfigManager = (context: vscode.ExtensionContext) => ({
  getConfig: () => getAgentConfig(context),
  updateConfig: (config: Partial<AgentConfig>) => updateAgentConfig(config, context),
  resetConfig: () => resetAgentConfig(context),
  validateConfig: (config: AgentConfig) => validateAgentConfig(config)
});

// Get current agent configuration
const getAgentConfig = async (context: vscode.ExtensionContext): Promise<AgentConfig> => {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  
  // Get secure values from secret storage
  const apiKey = await context.secrets.get(API_KEY_STORAGE) || '';
  const provider = context.globalState.get<'openai' | 'anthropic' | 'gemini' | 'openai-compatible'>(PROVIDER_STORAGE) || 'openai';
  
  // Get other configuration values from global state (persistent storage)
  const model = context.globalState.get<string>(MODEL_STORAGE) || getDefaultModel(provider);
  const temperature = context.globalState.get<number>(TEMPERATURE_STORAGE) ?? 0.7;
  const maxTokens = context.globalState.get<number>(MAX_TOKENS_STORAGE) ?? 2000;
  const apiEndpoint = context.globalState.get<string>(API_ENDPOINT_STORAGE);
  const customHeaders = context.globalState.get<Record<string, string>>(CUSTOM_HEADERS_STORAGE);
  
  return {
    llmProvider: provider,
    apiKey: apiKey,
    model: model,
    temperature: temperature,
    maxTokens: maxTokens,
    apiEndpoint: apiEndpoint,
    customHeaders: customHeaders
  };
};

// Update agent configuration
const updateAgentConfig = async (
  configUpdate: Partial<AgentConfig>,
  context: vscode.ExtensionContext
): Promise<void> => {
  // Store all configuration in global state for persistence
  if (configUpdate.model !== undefined) {
    await context.globalState.update(MODEL_STORAGE, configUpdate.model);
  }
  
  if (configUpdate.temperature !== undefined) {
    await context.globalState.update(TEMPERATURE_STORAGE, configUpdate.temperature);
  }
  
  if (configUpdate.maxTokens !== undefined) {
    await context.globalState.update(MAX_TOKENS_STORAGE, configUpdate.maxTokens);
  }
  
  if (configUpdate.apiEndpoint !== undefined) {
    await context.globalState.update(API_ENDPOINT_STORAGE, configUpdate.apiEndpoint);
  }
  
  if (configUpdate.customHeaders !== undefined) {
    await context.globalState.update(CUSTOM_HEADERS_STORAGE, configUpdate.customHeaders);
  }
  
  // Update secure storage
  if (configUpdate.apiKey !== undefined) {
    await context.secrets.store(API_KEY_STORAGE, configUpdate.apiKey);
  }
  
  if (configUpdate.llmProvider !== undefined) {
    await context.globalState.update(PROVIDER_STORAGE, configUpdate.llmProvider);
  }
};

// Reset configuration to defaults
const resetAgentConfig = async (context: vscode.ExtensionContext): Promise<void> => {
  // Clear all stored configuration
  await context.globalState.update(MODEL_STORAGE, undefined);
  await context.globalState.update(TEMPERATURE_STORAGE, undefined);
  await context.globalState.update(MAX_TOKENS_STORAGE, undefined);
  await context.globalState.update(API_ENDPOINT_STORAGE, undefined);
  await context.globalState.update(CUSTOM_HEADERS_STORAGE, undefined);
  
  // Clear secure storage
  await context.secrets.delete(API_KEY_STORAGE);
  await context.globalState.update(PROVIDER_STORAGE, undefined);
};

// Validate agent configuration
const validateAgentConfig = (config: AgentConfig): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Validate API key
  if (!validateApiKey(config.llmProvider, config.apiKey)) {
    errors.push(`Invalid API key for ${config.llmProvider}`);
  }
  
  // Validate model
  if (!config.model || config.model.trim().length === 0) {
    errors.push('Model name is required');
  }
  
  // Validate temperature
  if (config.temperature < 0 || config.temperature > 2) {
    errors.push('Temperature must be between 0 and 2');
  }
  
  // Validate max tokens
  if (config.maxTokens < 100 || config.maxTokens > 8000) {
    errors.push('Max tokens must be between 100 and 8000');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Get default model for provider
const getDefaultModel = (provider: 'openai' | 'anthropic' | 'gemini' | 'openai-compatible'): string => {
  const defaults = getDefaultConfig(provider);
  return defaults.model || 'gpt-4';
};

// Check if configuration is complete
export const isConfigurationComplete = (config: AgentConfig): boolean => {
  return !!(
    config.apiKey &&
    config.model &&
    config.llmProvider &&
    validateApiKey(config.llmProvider, config.apiKey)
  );
};

// Get configuration schema for settings.json
export const getConfigurationSchema = () => ({
  type: 'object',
  title: 'Avior AI Agent Configuration',
  properties: {
    model: {
      type: 'string',
      description: 'The AI model to use',
      enum: [
        // OpenAI models
        'gpt-4',
        'gpt-4-turbo',
        'gpt-4o',
        'gpt-3.5-turbo',
        // Anthropic models
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
        // Google Gemini models
        'gemini-pro',
        'gemini-pro-vision',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        // OpenAI-compatible / Local models
        'llama2',
        'llama2:13b',
        'llama2:70b',
        'codellama',
        'codellama:13b',
        'mistral',
        'mixtral:8x7b',
        'neural-chat',
        'starcode',
        'wizardcoder'
      ],
      default: 'gpt-4'
    },
    temperature: {
      type: 'number',
      description: 'Controls randomness in AI responses (0-2)',
      minimum: 0,
      maximum: 2,
      default: 0.7
    },
    maxTokens: {
      type: 'number',
      description: 'Maximum number of tokens in AI response',
      minimum: 100,
      maximum: 8000,
      default: 2000
    },
    apiEndpoint: {
      type: 'string',
      description: 'Custom API endpoint (optional)',
      default: ''
    }
  }
});

// Initialize default configuration on first run
export const initializeDefaultConfig = async (context: vscode.ExtensionContext): Promise<void> => {
  const hasRunBefore = context.globalState.get('hasInitialized', false);
  
  if (!hasRunBefore) {
    // Set default values in global state for persistence
    await context.globalState.update(MODEL_STORAGE, 'gpt-4');
    await context.globalState.update(TEMPERATURE_STORAGE, 0.7);
    await context.globalState.update(MAX_TOKENS_STORAGE, 2000);
    await context.globalState.update(PROVIDER_STORAGE, 'openai');
    
    await context.globalState.update('hasInitialized', true);
  }
};
