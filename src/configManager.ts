import * as vscode from 'vscode';
import { AgentConfig } from './types';
import { validateApiKey, getDefaultConfig } from './llmService';

// Configuration keys
const CONFIG_SECTION = 'avior';
const API_KEY_STORAGE = 'apiKey';
const PROVIDER_STORAGE = 'provider';

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
  const provider = context.globalState.get<'openai' | 'anthropic'>(PROVIDER_STORAGE) || 'openai';
  
  return {
    llmProvider: provider,
    apiKey: apiKey,
    model: config.get('model', getDefaultModel(provider)),
    temperature: config.get('temperature', 0.7),
    maxTokens: config.get('maxTokens', 2000)
  };
};

// Update agent configuration
const updateAgentConfig = async (
  configUpdate: Partial<AgentConfig>,
  context: vscode.ExtensionContext
): Promise<void> => {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  
  // Update VS Code settings
  if (configUpdate.model !== undefined) {
    await config.update('model', configUpdate.model, vscode.ConfigurationTarget.Global);
  }
  
  if (configUpdate.temperature !== undefined) {
    await config.update('temperature', configUpdate.temperature, vscode.ConfigurationTarget.Global);
  }
  
  if (configUpdate.maxTokens !== undefined) {
    await config.update('maxTokens', configUpdate.maxTokens, vscode.ConfigurationTarget.Global);
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
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  
  // Reset to defaults
  await config.update('model', undefined, vscode.ConfigurationTarget.Global);
  await config.update('temperature', undefined, vscode.ConfigurationTarget.Global);
  await config.update('maxTokens', undefined, vscode.ConfigurationTarget.Global);
  
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
const getDefaultModel = (provider: 'openai' | 'anthropic'): string => {
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
        'gpt-4',
        'gpt-4-turbo',
        'gpt-3.5-turbo',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307'
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
    }
  }
});

// Initialize default configuration on first run
export const initializeDefaultConfig = async (context: vscode.ExtensionContext): Promise<void> => {
  const hasRunBefore = context.globalState.get('hasInitialized', false);
  
  if (!hasRunBefore) {
    // Set default values
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    
    if (!config.has('model')) {
      await config.update('model', 'gpt-4', vscode.ConfigurationTarget.Global);
    }
    
    if (!config.has('temperature')) {
      await config.update('temperature', 0.7, vscode.ConfigurationTarget.Global);
    }
    
    if (!config.has('maxTokens')) {
      await config.update('maxTokens', 2000, vscode.ConfigurationTarget.Global);
    }
    
    await context.globalState.update('hasInitialized', true);
  }
};
