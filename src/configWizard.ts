import * as vscode from 'vscode';
import { AgentConfig } from './types';
import { createConfigManager } from './configManager';
import { createUIService } from './uiService';

// Available LLM providers with their configurations
interface ProviderConfig {
  id: 'openai' | 'anthropic' | 'gemini' | 'openai-compatible';
  name: string;
  description: string;
  apiKeyPlaceholder: string;
  models: string[];
  defaultModel: string;
  apiKeyValidation: (key: string) => boolean;
  setupInstructions: string;
  requiresEndpoint?: boolean;
  defaultEndpoint?: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, GPT-3.5 Turbo (Requires API key)',
    apiKeyPlaceholder: 'sk-...',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4',
    apiKeyValidation: (key: string) => key.startsWith('sk-'),
    setupInstructions: 'Get your API key from https://platform.openai.com/api-keys'
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Claude 3 Opus, Sonnet, Haiku (Requires API key)',
    apiKeyPlaceholder: 'sk-ant-...',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    defaultModel: 'claude-3-sonnet-20240229',
    apiKeyValidation: (key: string) => key.startsWith('sk-ant-'),
    setupInstructions: 'Get your API key from https://console.anthropic.com/settings/keys'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini Pro, Vision (Requires API key)',
    apiKeyPlaceholder: 'AIza...',
    models: ['gemini-pro', 'gemini-pro-vision', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    defaultModel: 'gemini-pro',
    apiKeyValidation: (key: string) => key.length > 10,
    setupInstructions: 'Get your API key from https://aistudio.google.com/app/apikey'
  },
  {
    id: 'openai-compatible',
    name: 'OpenAI-Compatible',
    description: 'Local models, Ollama, OpenRouter, Saia AI, etc.',
    apiKeyPlaceholder: 'API key (optional for local models)',
    models: [
      // Popular local models
      'llama2', 'llama2:7b', 'llama2:13b', 'llama2:70b',
      'codellama', 'codellama:7b', 'codellama:13b', 'codellama:34b',
      'mistral', 'mistral:7b', 'mixtral:8x7b',
      'neural-chat', 'starcode', 'wizardcoder',
      // Vertex AI models
      'vertex_ai/gemini-pro', 'vertex_ai/gemini-2.5-pro',
      // OpenRouter models
      'openrouter/anthropic/claude-3-opus',
      'openrouter/meta-llama/llama-2-70b-chat',
      // Custom model placeholder
      'custom-model'
    ],
    defaultModel: 'llama2',
    apiKeyValidation: () => true, // Allow any key or no key
    setupInstructions: 'Configure your local model server, OpenRouter, Saia AI, or other OpenAI-compatible API',
    requiresEndpoint: true,
    defaultEndpoint: 'http://localhost:11434/v1'
  }
];

// Factory function to create configuration wizard
export const createConfigWizard = (context: vscode.ExtensionContext) => ({
  showConfigurationWizard: () => showConfigurationWizard(context),
  showProviderSelection: () => showProviderSelection(context),
  configureProvider: (providerId: 'openai' | 'anthropic' | 'gemini' | 'openai-compatible') => configureProvider(providerId, context),
  showCurrentConfig: () => showCurrentConfig(context)
});

// Show the main configuration wizard
const showConfigurationWizard = async (context: vscode.ExtensionContext): Promise<void> => {
  const uiService = createUIService();
  const configManager = createConfigManager(context);
  
  const currentConfig = await configManager.getConfig();
  
  const items = [
    {
      label: '$(settings-gear) Configure LLM Provider',
      description: `Current: ${currentConfig.llmProvider} (${currentConfig.model})`,
      value: 'configure'
    },
    {
      label: '$(eye) View Current Configuration',
      description: 'Show current LLM settings',
      value: 'view'
    },
    {
      label: '$(refresh) Reset Configuration',
      description: 'Reset to default settings',
      value: 'reset'
    }
  ];

  const selected = await uiService.showQuickPick(items, {
    title: 'Avior Configuration',
    placeHolder: 'Choose a configuration action'
  });

  if (!selected) {
    return;
  }

  switch (selected.value) {
    case 'configure':
      await showProviderSelection(context);
      break;
    case 'view':
      await showCurrentConfig(context);
      break;
    case 'reset':
      await resetConfiguration(context);
      break;
  }
};

// Show provider selection screen
const showProviderSelection = async (context: vscode.ExtensionContext): Promise<void> => {
  const uiService = createUIService();
  
  const items = PROVIDERS.map(provider => ({
    label: `$(${getProviderIcon(provider.id)}) ${provider.name}`,
    description: provider.description,
    detail: provider.setupInstructions,
    value: provider.id
  }));

  const selected = await uiService.showQuickPick(items, {
    title: 'Select LLM Provider',
    placeHolder: 'Choose your preferred AI provider'
  });

  if (selected) {
    await configureProvider(selected.value, context);
  }
};

// Configure a specific provider
const configureProvider = async (
  providerId: 'openai' | 'anthropic' | 'gemini' | 'openai-compatible',
  context: vscode.ExtensionContext
): Promise<void> => {
  const uiService = createUIService();
  const configManager = createConfigManager(context);
  const provider = PROVIDERS.find(p => p.id === providerId);
  
  if (!provider) {
    await uiService.showMessage('Invalid provider selected', 'error');
    return;
  }

  // Step 1: Get API key
  const isApiKeyOptional = providerId === 'openai-compatible';
  const apiKey = await uiService.showInputBox({
    title: `Configure ${provider.name}`,
    prompt: isApiKeyOptional 
      ? `Enter your ${provider.name} API key (optional for local models)`
      : `Enter your ${provider.name} API key`,
    placeHolder: provider.apiKeyPlaceholder,
    password: !isApiKeyOptional, // Don't hide if optional (might be 'none' or similar)
    validateInput: (value) => {
      // For OpenAI-compatible, allow empty API key
      if (isApiKeyOptional && (!value || value.trim().length === 0)) {
        return undefined;
      }
      if (!isApiKeyOptional && (!value || value.trim().length === 0)) {
        return 'API key is required';
      }
      if (value && !provider.apiKeyValidation(value)) {
        return `Invalid ${provider.name} API key format`;
      }
      return undefined;
    }
  });

  if (!apiKey) {
    return;
  }

  // Step 2: Select model
  const modelItems = provider.models.map(model => ({
    label: model,
    description: model === provider.defaultModel ? '(Recommended)' : '',
    value: model
  }));

  const selectedModel = await uiService.showQuickPick(modelItems, {
    title: `Select ${provider.name} Model`,
    placeHolder: 'Choose the AI model to use'
  });

  if (!selectedModel) {
    return;
  }

  // Step 3: Configure advanced settings (optional)
  const configureAdvanced = await uiService.showQuickPick([
    { label: 'Use Default Settings', description: 'Temperature: 0.7, Max Tokens: 2000', value: false },
    { label: 'Configure Advanced Settings', description: 'Customize temperature and token limits', value: true }
  ], {
    title: 'Advanced Configuration',
    placeHolder: 'Choose configuration option'
  });

  let temperature = 0.7;
  let maxTokens = 2000;
  let apiEndpoint: string | undefined;

  if (configureAdvanced?.value) {
    // Configure temperature
    const tempInput = await uiService.showInputBox({
      title: 'Temperature Setting',
      prompt: 'Enter temperature (0.0 - 2.0, controls creativity)',
      value: '0.7',
      validateInput: (value) => {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0 || num > 2) {
          return 'Temperature must be between 0.0 and 2.0';
        }
        return undefined;
      }
    });

    if (tempInput) {
      temperature = parseFloat(tempInput);
    }

    // Configure max tokens
    const tokensInput = await uiService.showInputBox({
      title: 'Max Tokens',
      prompt: 'Enter maximum tokens (100 - 8000)',
      value: '2000',
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 100 || num > 8000) {
          return 'Max tokens must be between 100 and 8000';
        }
        return undefined;
      }
    });

    if (tokensInput) {
      maxTokens = parseInt(tokensInput);
    }

    // Configure custom API endpoint for OpenAI-compatible providers
    if (provider.requiresEndpoint || providerId === 'openai' || providerId === 'openai-compatible') {
      const isRequired = providerId === 'openai-compatible';
      const endpointInput = await uiService.showInputBox({
        title: isRequired ? 'API Endpoint (Required)' : 'Custom API Endpoint (Optional)',
        prompt: isRequired 
          ? 'Enter the API endpoint for your OpenAI-compatible service'
          : 'Enter custom OpenAI-compatible API endpoint (leave empty for default)',
        placeHolder: provider.defaultEndpoint || 'https://api.openai.com/v1',
        value: provider.defaultEndpoint,
        validateInput: isRequired ? (value) => {
          if (!value || value.trim().length === 0) {
            return 'API endpoint is required for OpenAI-compatible providers';
          }
          try {
            new URL(value);
            return undefined;
          } catch {
            return 'Please enter a valid URL';
          }
        } : undefined
      });

      if (endpointInput && endpointInput.trim().length > 0) {
        apiEndpoint = endpointInput.trim();
      } else if (isRequired && provider.defaultEndpoint) {
        apiEndpoint = provider.defaultEndpoint;
      }
    }
  } else {
    // For OpenAI-compatible, always ask for endpoint even in basic mode
    if (providerId === 'openai-compatible') {
      // First, offer preset configurations
      const presetItems = [
        {
          label: '🏠 Ollama (Local)',
          description: 'http://localhost:11434/v1 - Free local models',
          value: { endpoint: 'http://localhost:11434/v1', needsKey: false, name: 'Ollama' }
        },
        {
          label: '🌐 OpenRouter',
          description: 'https://openrouter.ai/api/v1 - Access to multiple models',
          value: { endpoint: 'https://openrouter.ai/api/v1', needsKey: true, name: 'OpenRouter' }
        },
        {
          label: '🤖 Saia AI',
          description: 'https://api.saia.ai - Vertex AI models',
          value: { endpoint: 'https://api.saia.ai', needsKey: true, name: 'Saia AI' }
        },
        {
          label: '🔧 Together AI',
          description: 'https://api.together.xyz/v1 - Fast inference',
          value: { endpoint: 'https://api.together.xyz/v1', needsKey: true, name: 'Together AI' }
        },
        {
          label: '🏢 Azure OpenAI',
          description: 'Custom Azure endpoint',
          value: { endpoint: 'https://your-resource.openai.azure.com', needsKey: true, name: 'Azure OpenAI' }
        },
        {
          label: '⚙️ Custom Endpoint',
          description: 'Enter your own OpenAI-compatible endpoint',
          value: { endpoint: '', needsKey: true, name: 'Custom' }
        }
      ];

      const selectedPreset = await uiService.showQuickPick(presetItems, {
        title: 'Select OpenAI-Compatible Service',
        placeHolder: 'Choose a preset or configure custom endpoint'
      });

      if (!selectedPreset) {
        return;
      }

      let finalEndpoint = selectedPreset.value.endpoint;
      
      if (selectedPreset.value.name === 'Custom' || !finalEndpoint) {
        const endpointInput = await uiService.showInputBox({
          title: 'API Endpoint',
          prompt: 'Enter the API endpoint for your OpenAI-compatible service',
          placeHolder: 'https://api.example.com/v1',
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return 'API endpoint is required';
            }
            try {
              new URL(value);
              return undefined;
            } catch {
              return 'Please enter a valid URL';
            }
          }
        });

        if (!endpointInput) {
          return;
        }
        finalEndpoint = endpointInput.trim();
      }

      apiEndpoint = finalEndpoint;

      // For services that need API keys, ensure we have one
      if (selectedPreset.value.needsKey && (!apiKey || apiKey.trim().length === 0)) {
        const keyInput = await uiService.showInputBox({
          title: `${selectedPreset.value.name} API Key`,
          prompt: `Enter your ${selectedPreset.value.name} API key`,
          password: true,
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return `API key is required for ${selectedPreset.value.name}`;
            }
            return undefined;
          }
        });

        if (!keyInput) {
          return;
        }
        // Update the apiKey variable - we need to reassign since it's const
        // We'll handle this by creating a new variable
        const finalApiKey = keyInput.trim();
        
        // Save configuration with the updated key
        const newConfig: Partial<AgentConfig> = {
          llmProvider: providerId,
          apiKey: finalApiKey,
          model: selectedModel.value,
          temperature: temperature,
          maxTokens: maxTokens,
          apiEndpoint: apiEndpoint
        };

        try {
          await configManager.updateConfig(newConfig);
          await uiService.showMessage(
            `Successfully configured ${provider.name} with ${selectedPreset.value.name}`,
            'info'
          );
        } catch (error) {
          await uiService.showMessage(
            `Failed to save configuration: ${error}`,
            'error'
          );
        }
        return;
      }
    }
  }

  // Save configuration
  const newConfig: Partial<AgentConfig> = {
    llmProvider: providerId,
    apiKey: apiKey,
    model: selectedModel.value,
    temperature: temperature,
    maxTokens: maxTokens,
    apiEndpoint: apiEndpoint
  };

  try {
    await configManager.updateConfig(newConfig);
    await uiService.showMessage(
      `Successfully configured ${provider.name} with model ${selectedModel.value}`,
      'info'
    );
  } catch (error) {
    await uiService.showMessage(
      `Failed to save configuration: ${error}`,
      'error'
    );
  }
};

// Show current configuration
const showCurrentConfig = async (context: vscode.ExtensionContext): Promise<void> => {
  const uiService = createUIService();
  const configManager = createConfigManager(context);
  
  const config = await configManager.getConfig();
  const provider = PROVIDERS.find(p => p.id === config.llmProvider);
  
  const configInfo = [
    `Provider: ${provider?.name || config.llmProvider}`,
    `Model: ${config.model}`,
    `Temperature: ${config.temperature}`,
    `Max Tokens: ${config.maxTokens}`,
    `API Key: ${config.apiKey ? '***configured***' : 'not set'}`,
    ...(config.apiEndpoint ? [`API Endpoint: ${config.apiEndpoint}`] : [])
  ].join('\\n');

  await uiService.showMessage(configInfo, 'info');
};

// Reset configuration
const resetConfiguration = async (context: vscode.ExtensionContext): Promise<void> => {
  const uiService = createUIService();
  const configManager = createConfigManager(context);
  
  const confirm = await vscode.window.showWarningMessage(
    'This will reset all configuration settings. Are you sure?',
    'Yes, Reset',
    'Cancel'
  );

  if (confirm === 'Yes, Reset') {
    try {
      await configManager.resetConfig();
      await uiService.showMessage('Configuration has been reset to defaults', 'info');
    } catch (error) {
      await uiService.showMessage(`Failed to reset configuration: ${error}`, 'error');
    }
  }
};

// Get icon for provider
const getProviderIcon = (providerId: string): string => {
  switch (providerId) {
    case 'openai':
      return 'symbol-namespace';
    case 'anthropic':
      return 'symbol-class';
    case 'gemini':
      return 'symbol-interface';
    default:
      return 'symbol-misc';
  }
};

// Predefined configuration presets
export const CONFIGURATION_PRESETS = {
  openai_gpt4: {
    llmProvider: 'openai' as const,
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000
  },
  openai_gpt4_turbo: {
    llmProvider: 'openai' as const,
    model: 'gpt-4-turbo',
    temperature: 0.7,
    maxTokens: 4000
  },
  anthropic_claude: {
    llmProvider: 'anthropic' as const,
    model: 'claude-3-sonnet-20240229',
    temperature: 0.7,
    maxTokens: 2000
  },
  gemini_pro: {
    llmProvider: 'gemini' as const,
    model: 'gemini-pro',
    temperature: 0.7,
    maxTokens: 2000
  }
};
