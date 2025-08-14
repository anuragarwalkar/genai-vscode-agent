import * as vscode from 'vscode';
import { UIService } from './types';

// Factory function to create UI service
export const createUIService = (): UIService => ({
  showMessage: showUserMessage,
  showInputBox: showUserInputBox,
  showQuickPick: showUserQuickPick,
  showProgress: showProgressIndicator
});

// Show message to user
const showUserMessage = async (
  message: string,
  type: 'info' | 'warning' | 'error' = 'info'
): Promise<void> => {
  switch (type) {
    case 'info':
      await vscode.window.showInformationMessage(message);
      break;
    case 'warning':
      await vscode.window.showWarningMessage(message);
      break;
    case 'error':
      await vscode.window.showErrorMessage(message);
      break;
  }
};

// Show input box to user
const showUserInputBox = async (
  options: vscode.InputBoxOptions
): Promise<string | undefined> => {
  return await vscode.window.showInputBox(options);
};

// Show quick pick to user
const showUserQuickPick = async <T extends vscode.QuickPickItem>(
  items: T[],
  options?: vscode.QuickPickOptions
): Promise<T | undefined> => {
  return await vscode.window.showQuickPick(items, options);
};

// Show progress indicator
const showProgressIndicator = async <T>(
  task: (progress: vscode.Progress<{message?: string; increment?: number}>) => Promise<T>
): Promise<T> => {
  return await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'AI Agent Processing...',
      cancellable: false
    },
    task
  );
};

// Create output channel for logging
export const createOutputChannel = (channelName: string): vscode.OutputChannel => {
  return vscode.window.createOutputChannel(channelName);
};

// Log to output channel
export const logToChannel = (
  channel: vscode.OutputChannel,
  message: string,
  level: 'info' | 'warning' | 'error' = 'info'
): void => {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  channel.appendLine(formattedMessage);
  
  if (level === 'error') {
    channel.show();
  }
};

// Show configuration dialog
export const showConfigurationDialog = async (): Promise<{
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model: string;
} | undefined> => {
  // Step 1: Choose provider
  const providerItems = [
    { label: 'OpenAI', value: 'openai' as const, description: 'GPT-4, GPT-3.5-turbo models' },
    { label: 'Anthropic', value: 'anthropic' as const, description: 'Claude models' }
  ];

  const selectedProvider = await showUserQuickPick(providerItems, {
    title: 'Select LLM Provider',
    placeHolder: 'Choose your preferred AI provider'
  });

  if (!selectedProvider) {
    return undefined;
  }

  // Step 2: Enter API key
  const apiKey = await showUserInputBox({
    title: 'Enter API Key',
    prompt: `Enter your ${selectedProvider.label} API key`,
    password: true,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'API key is required';
      }
      return undefined;
    }
  });

  if (!apiKey) {
    return undefined;
  }

  // Step 3: Choose model
  const modelItems = getModelOptions(selectedProvider.value);
  const selectedModel = await showUserQuickPick(modelItems, {
    title: 'Select Model',
    placeHolder: 'Choose the AI model to use'
  });

  if (!selectedModel) {
    return undefined;
  }

  return {
    provider: selectedProvider.value,
    apiKey: apiKey.trim(),
    model: selectedModel.value
  };
};

// Get model options based on provider
const getModelOptions = (provider: 'openai' | 'anthropic') => {
  switch (provider) {
    case 'openai':
      return [
        { label: 'GPT-4', value: 'gpt-4', description: 'Most capable model' },
        { label: 'GPT-4 Turbo', value: 'gpt-4-turbo', description: 'Faster and cheaper than GPT-4' },
        { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo', description: 'Fast and cost-effective' }
      ];
    
    case 'anthropic':
      return [
        { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229', description: 'Most capable Claude model' },
        { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229', description: 'Balanced performance and speed' },
        { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307', description: 'Fast and lightweight' }
      ];
    
    default:
      return [];
  }
};

// Show plugin management dialog
export const showPluginManagementDialog = async (
  plugins: ReadonlyArray<{
    id: string;
    name: string;
    description: string;
    enabled: boolean;
  }>
): Promise<string | undefined> => {
  const pluginItems = plugins.map(plugin => ({
    label: plugin.name,
    description: plugin.description,
    detail: plugin.enabled ? '✅ Enabled' : '❌ Disabled',
    value: plugin.id
  }));

  const selected = await showUserQuickPick(pluginItems, {
    title: 'Manage Plugins',
    placeHolder: 'Select a plugin to toggle its state'
  });

  return selected?.value;
};

// Show agent task progress
export const showAgentProgress = async <T>(
  taskName: string,
  task: (progress: vscode.Progress<{message?: string; increment?: number}>) => Promise<T>
): Promise<T> => {
  return await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `AI Agent: ${taskName}`,
      cancellable: true
    },
    async (progress, token) => {
      token.onCancellationRequested(() => {
        console.log('User cancelled the operation');
      });

      return await task(progress);
    }
  );
};

// Show quick actions menu
export const showQuickActionsMenu = async (): Promise<string | undefined> => {
  const actions = [
    { label: '🔍 Search Code', value: 'search', description: 'Search for specific functionality in codebase' },
    { label: '✏️ Edit File', value: 'edit', description: 'Ask agent to edit a specific file' },
    { label: '📝 Create File', value: 'create', description: 'Ask agent to create a new file' },
    { label: '🔧 Analyze Code', value: 'analyze', description: 'Get code analysis and suggestions' },
    { label: '🔌 Manage Plugins', value: 'plugins', description: 'Enable/disable plugins' },
    { label: '⚙️ Configure Agent', value: 'config', description: 'Update agent settings' }
  ];

  const selected = await showUserQuickPick(actions, {
    title: 'AI Agent Actions',
    placeHolder: 'What would you like the agent to do?'
  });

  return selected?.value;
};
