import * as vscode from 'vscode';
import { Plugin, PluginRegistry, PluginHandler } from './types';

// Plugin registry state - kept immutable
let pluginRegistry: PluginRegistry = {
  plugins: [],
  enabledPlugins: new Set()
};

// Factory function to create plugin manager
export const createPluginManager = () => ({
  registerPlugin: registerNewPlugin,
  listPlugins: getPluginList,
  enablePlugin: enablePluginById,
  disablePlugin: disablePluginById,
  getEnabledPlugins: getEnabledPluginList,
  executePlugin: executePluginAction,
  getPluginRegistry: () => pluginRegistry
});

// Register a new plugin
const registerNewPlugin = (plugin: Plugin): boolean => {
  try {
    // Check if plugin already exists
    const existingIndex = pluginRegistry.plugins.findIndex(p => p.id === plugin.id);
    
    if (existingIndex >= 0) {
      // Update existing plugin
      const updatedPlugins = [...pluginRegistry.plugins];
      updatedPlugins[existingIndex] = plugin;
      
      pluginRegistry = {
        ...pluginRegistry,
        plugins: updatedPlugins
      };
    } else {
      // Add new plugin
      pluginRegistry = {
        ...pluginRegistry,
        plugins: [...pluginRegistry.plugins, plugin]
      };
    }
    
    return true;
  } catch (error) {
    console.error(`Failed to register plugin ${plugin.id}:`, error);
    return false;
  }
};

// Get list of all plugins
const getPluginList = (): ReadonlyArray<Plugin> => {
  return pluginRegistry.plugins;
};

// Enable a plugin by ID
const enablePluginById = async (pluginId: string, _context: vscode.ExtensionContext): Promise<boolean> => {
  try {
    const plugin = pluginRegistry.plugins.find(p => p.id === pluginId);
    if (!plugin) {
      return false;
    }

    // Activate the plugin
    await plugin.handler.activate(_context);
    
    // Update registry
    const newEnabledPlugins = new Set(pluginRegistry.enabledPlugins);
    newEnabledPlugins.add(pluginId);
    
    pluginRegistry = {
      ...pluginRegistry,
      enabledPlugins: newEnabledPlugins
    };
    
    return true;
  } catch (error) {
    console.error(`Failed to enable plugin ${pluginId}:`, error);
    return false;
  }
};

// Disable a plugin by ID
const disablePluginById = async (pluginId: string): Promise<boolean> => {
  try {
    const plugin = pluginRegistry.plugins.find(p => p.id === pluginId);
    if (!plugin) {
      return false;
    }

    // Deactivate the plugin
    await plugin.handler.deactivate();
    
    // Update registry
    const newEnabledPlugins = new Set(pluginRegistry.enabledPlugins);
    newEnabledPlugins.delete(pluginId);
    
    pluginRegistry = {
      ...pluginRegistry,
      enabledPlugins: newEnabledPlugins
    };
    
    return true;
  } catch (error) {
    console.error(`Failed to disable plugin ${pluginId}:`, error);
    return false;
  }
};

// Get list of enabled plugins
const getEnabledPluginList = (): ReadonlyArray<Plugin> => {
  return pluginRegistry.plugins.filter(plugin => 
    pluginRegistry.enabledPlugins.has(plugin.id)
  );
};

// Execute a plugin action
const executePluginAction = async (
  pluginId: string,
  action: string,
  params: Record<string, unknown>
): Promise<unknown> => {
  const plugin = pluginRegistry.plugins.find(p => p.id === pluginId);
  
  if (!plugin) {
    throw new Error(`Plugin ${pluginId} not found`);
  }
  
  if (!pluginRegistry.enabledPlugins.has(pluginId)) {
    throw new Error(`Plugin ${pluginId} is not enabled`);
  }
  
  return await plugin.handler.execute(action, params);
};

// Initialize with mock plugins for the plugin store
export const initializeMockPlugins = (): void => {
  const mockPlugins: Plugin[] = [
    createJiraMockPlugin(),
    createGitMockPlugin(),
    createCodeAnalysisMockPlugin()
  ];
  
  mockPlugins.forEach(plugin => {
    registerNewPlugin(plugin);
  });
};

// Create mock Jira plugin
const createJiraMockPlugin = (): Plugin => ({
  id: 'jira-integration',
  name: 'Jira Integration',
  version: '1.0.0',
  description: 'Integrate with Jira for task management and issue tracking',
  author: 'Avior Team',
  enabled: false,
  handler: createMockPluginHandler('jira-integration'),
  metadata: {
    category: 'Project Management',
    tags: ['jira', 'issues', 'project-management'],
    commands: ['create-issue', 'update-issue', 'list-issues'],
    dependencies: []
  }
});

// Create mock Git plugin
const createGitMockPlugin = (): Plugin => ({
  id: 'git-assistant',
  name: 'Git Assistant',
  version: '1.0.0',
  description: 'AI-powered Git operations and commit message generation',
  author: 'Avior Team',
  enabled: false,
  handler: createMockPluginHandler('git-assistant'),
  metadata: {
    category: 'Source Control',
    tags: ['git', 'version-control', 'commits'],
    commands: ['generate-commit', 'create-branch', 'review-changes'],
    dependencies: []
  }
});

// Create mock Code Analysis plugin
const createCodeAnalysisMockPlugin = (): Plugin => ({
  id: 'code-analysis',
  name: 'Advanced Code Analysis',
  version: '1.0.0',
  description: 'Deep code analysis with security and performance insights',
  author: 'Avior Team',
  enabled: false,
  handler: createMockPluginHandler('code-analysis'),
  metadata: {
    category: 'Code Quality',
    tags: ['analysis', 'security', 'performance'],
    commands: ['analyze-security', 'performance-audit', 'code-quality'],
    dependencies: []
  }
});

// Create a mock plugin handler
const createMockPluginHandler = (pluginId: string): PluginHandler => ({
  activate: async (_context: vscode.ExtensionContext) => {
    console.log(`Mock plugin ${pluginId} activated`);
    // Mock activation logic
  },
  
  deactivate: async () => {
    console.log(`Mock plugin ${pluginId} deactivated`);
    // Mock deactivation logic
  },
  
  execute: async (action: string, _params: Record<string, unknown>) => {
    console.log(`Mock plugin ${pluginId} executing action: ${action}`, _params);
    
    // Mock responses based on plugin type
    switch (pluginId) {
      case 'jira-integration':
        return mockJiraAction(action, _params);
      case 'git-assistant':
        return mockGitAction(action, _params);
      case 'code-analysis':
        return mockCodeAnalysisAction(action, _params);
      default:
        return `Mock response from ${pluginId} for action ${action}`;
    }
  }
});

// Mock Jira actions
const mockJiraAction = (action: string, _params: Record<string, unknown>): string => {
  switch (action) {
    case 'create-issue':
      return 'Mock: Created Jira issue PROJ-123';
    case 'list-issues':
      return 'Mock: Found 5 open issues assigned to you';
    default:
      return `Mock Jira action: ${action}`;
  }
};

// Mock Git actions
const mockGitAction = (action: string, _params: Record<string, unknown>): string => {
  switch (action) {
    case 'generate-commit':
      return 'Mock: feat: add new user authentication system\n\nImplements OAuth2 flow with JWT tokens';
    case 'create-branch':
      return 'Mock: Created branch feature/user-auth';
    default:
      return `Mock Git action: ${action}`;
  }
};

// Mock Code Analysis actions
const mockCodeAnalysisAction = (action: string, _params: Record<string, unknown>): string => {
  switch (action) {
    case 'analyze-security':
      return 'Mock: No security vulnerabilities found';
    case 'performance-audit':
      return 'Mock: Found 3 performance optimization opportunities';
    default:
      return `Mock Code Analysis action: ${action}`;
  }
};

// Utility function to toggle plugin state
export const togglePluginState = async (
  pluginId: string,
  context: vscode.ExtensionContext
): Promise<boolean> => {
  const isEnabled = pluginRegistry.enabledPlugins.has(pluginId);
  
  if (isEnabled) {
    return await disablePluginById(pluginId);
  } else {
    return await enablePluginById(pluginId, context);
  }
};

// Get plugin by ID
export const getPluginById = (pluginId: string): Plugin | undefined => {
  return pluginRegistry.plugins.find(p => p.id === pluginId);
};

// Check if plugin is enabled
export const isPluginEnabled = (pluginId: string): boolean => {
  return pluginRegistry.enabledPlugins.has(pluginId);
};
