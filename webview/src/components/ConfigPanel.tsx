import React, { useState, useEffect } from 'react';
import { AgentConfig, WebviewMessage } from '../types';

// VS Code API
declare global {
  interface Window {
    acquireVsCodeApi(): {
      postMessage(message: any): void;
      setState(state: any): void;
      getState(): any;
    };
    vscodeApi?: {
      postMessage(message: any): void;
      setState(state: any): void;
      getState(): any;
    };
  }
}

// Use the global API if available, otherwise try to acquire it
const getVscodeApi = () => {
  if (window.vscodeApi) {
    return window.vscodeApi;
  }
  
  try {
    if (typeof window.acquireVsCodeApi === 'function') {
      const api = window.acquireVsCodeApi();
      window.vscodeApi = api;
      return api;
    }
  } catch (error) {
    console.warn('Could not acquire VS Code API:', error);
  }
  
  return null;
};

interface ConfigPanelProps {
  config: AgentConfig;
  onSave: (config: AgentConfig) => void;
  onCancel: () => void;
}

interface ProviderPreset {
  name: string;
  endpoint: string;
}

interface ProviderConfig {
  name: string;
  models: string[];
  defaultModel: string;
  requiresEndpoint: boolean;
  apiKeyPlaceholder: string;
  presets?: ProviderPreset[];
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onSave, onCancel }) => {
  const [formData, setFormData] = useState<AgentConfig>(config);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderValue, setNewHeaderValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Handle messages from VS Code extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message: WebviewMessage = event.data;
      
      switch (message.command) {
        case 'configUpdate':
          if (message.config) {
            setFormData(message.config);
          }
          break;
        case 'configSaved':
          setSaving(false);
          if (message.success) {
            console.log('Configuration saved successfully');
            onSave(formData);
          } else {
            console.error('Failed to save configuration:', message.error);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Request current config on mount
    const vscode = getVscodeApi();
    if (vscode) {
      vscode.postMessage({ command: 'getConfig' });
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [formData, onSave]);

  // Provider configurations
  const providerConfigs: Record<AgentConfig['llmProvider'], ProviderConfig> = {
    openai: {
      name: 'OpenAI',
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-3.5-turbo'],
      defaultModel: 'gpt-4',
      requiresEndpoint: false,
      apiKeyPlaceholder: 'sk-...'
    },
    anthropic: {
      name: 'Anthropic Claude',
      models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
      defaultModel: 'claude-3-sonnet-20240229',
      requiresEndpoint: false,
      apiKeyPlaceholder: 'sk-ant-...'
    },
    gemini: {
      name: 'Google Gemini',
      models: ['gemini-pro', 'gemini-pro-vision', 'gemini-1.5-pro', 'gemini-1.5-flash'],
      defaultModel: 'gemini-pro',
      requiresEndpoint: false,
      apiKeyPlaceholder: 'AIza...'
    },
    'openai-compatible': {
      name: 'OpenAI-Compatible',
      models: [
        'llama2', 'llama2:7b', 'llama2:13b', 'llama2:70b',
        'codellama', 'codellama:7b', 'codellama:13b',
        'mistral', 'mixtral:8x7b', 'neural-chat',
        'vertex_ai/gemini-2.5-pro', 'custom-model'
      ],
      defaultModel: 'llama2',
      requiresEndpoint: true,
      apiKeyPlaceholder: 'API key (optional for local)',
      presets: [
        { name: 'Ollama (Local)', endpoint: 'http://localhost:11434/v1' },
        { name: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1' },
        { name: 'Saia AI', endpoint: 'https://api.saia.ai' },
        { name: 'Together AI', endpoint: 'https://api.together.xyz/v1' },
        { name: 'Azure OpenAI', endpoint: 'https://your-resource.openai.azure.com' }
      ]
    }
  };

  const currentProviderConfig = providerConfigs[formData.llmProvider];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const vscode = getVscodeApi();
    if (vscode) {
      vscode.postMessage({ command: 'saveConfig', config: formData });
    }
  };

  const handleInputChange = (field: keyof AgentConfig, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleProviderChange = (provider: AgentConfig['llmProvider']) => {
    const providerConfig = providerConfigs[provider];
    setFormData(prev => ({
      ...prev,
      llmProvider: provider,
      model: providerConfig.defaultModel,
      apiEndpoint: provider === 'openai-compatible' ? 'http://localhost:11434/v1' : '',
      apiKey: ''
    }));
  };

  const handlePresetSelect = (endpoint: string) => {
    setFormData(prev => ({
      ...prev,
      apiEndpoint: endpoint
    }));
  };

  const addCustomHeader = () => {
    if (newHeaderKey && newHeaderValue) {
      setFormData(prev => ({
        ...prev,
        customHeaders: {
          ...prev.customHeaders,
          [newHeaderKey]: newHeaderValue
        }
      }));
      setNewHeaderKey('');
      setNewHeaderValue('');
    }
  };

  const removeCustomHeader = (key: string) => {
    setFormData(prev => {
      const headers = { ...prev.customHeaders };
      delete headers[key];
      return {
        ...prev,
        customHeaders: headers
      };
    });
  };

  return (
    <div className="config-panel">
      <div className="config-header">
        <h3>🔧 AI Configuration</h3>
      </div>
      
      <form onSubmit={handleSubmit} className="config-form">
        {/* Provider Selection */}
        <div className="form-group">
          <label htmlFor="provider">Provider:</label>
          <select 
            id="provider"
            value={formData.llmProvider}
            onChange={(e) => handleProviderChange(e.target.value as AgentConfig['llmProvider'])}
          >
            <option value="openai">🤖 OpenAI</option>
            <option value="anthropic">🧠 Anthropic Claude</option>
            <option value="gemini">✨ Google Gemini</option>
            <option value="openai-compatible">🏠 OpenAI-Compatible</option>
          </select>
        </div>

        {/* Preset Selection for OpenAI-Compatible */}
        {formData.llmProvider === 'openai-compatible' && (
          <div className="form-group">
            <label>Quick Setup:</label>
            <div className="preset-buttons">
              {currentProviderConfig.presets?.map((preset, index) => (
                <button
                  key={index}
                  type="button"
                  className="preset-btn"
                  onClick={() => handlePresetSelect(preset.endpoint)}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* API Endpoint for OpenAI-Compatible or Custom OpenAI */}
        {(formData.llmProvider === 'openai-compatible' || showAdvanced) && (
          <div className="form-group">
            <label htmlFor="apiEndpoint">
              API Endpoint:
              {formData.llmProvider === 'openai-compatible' && <span className="required">*</span>}
            </label>
            <input 
              type="url" 
              id="apiEndpoint"
              value={formData.apiEndpoint || ''}
              onChange={(e) => handleInputChange('apiEndpoint', e.target.value)}
              placeholder={formData.llmProvider === 'openai-compatible' ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1'}
              required={formData.llmProvider === 'openai-compatible'}
            />
          </div>
        )}

        {/* Model Selection */}
        <div className="form-group">
          <label htmlFor="model">Model:</label>
          <select 
            id="model"
            value={formData.model}
            onChange={(e) => handleInputChange('model', e.target.value)}
          >
            {currentProviderConfig.models.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>

        {/* API Key */}
        <div className="form-group">
          <label htmlFor="apiKey">
            API Key:
            {formData.llmProvider !== 'openai-compatible' && <span className="required">*</span>}
          </label>
          <input 
            type="password" 
            id="apiKey"
            value={formData.apiKey}
            onChange={(e) => handleInputChange('apiKey', e.target.value)}
            placeholder={currentProviderConfig.apiKeyPlaceholder}
            required={formData.llmProvider !== 'openai-compatible'}
          />
          {formData.llmProvider === 'openai-compatible' && (
            <small className="help-text">Optional for local models like Ollama</small>
          )}
        </div>

        {/* Temperature */}
        <div className="form-group">
          <label htmlFor="temperature">
            Temperature: <span className="value-display">{formData.temperature}</span>
          </label>
          <input 
            type="range" 
            id="temperature"
            min="0" 
            max="2" 
            step="0.1"
            value={formData.temperature}
            onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
          />
          <div className="range-labels">
            <span>Focused (0.0)</span>
            <span>Balanced (0.7)</span>
            <span>Creative (2.0)</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div className="form-group">
          <label htmlFor="maxTokens">Max Tokens:</label>
          <input 
            type="number" 
            id="maxTokens"
            min="100" 
            max="8000"
            value={formData.maxTokens}
            onChange={(e) => handleInputChange('maxTokens', parseInt(e.target.value))}
          />
        </div>

        {/* Advanced Settings Toggle */}
        <div className="form-group">
          <button
            type="button"
            className="toggle-btn"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '▼' : '▶'} Advanced Settings
          </button>
        </div>

        {/* Custom Headers */}
        {showAdvanced && (
          <div className="form-group">
            <label>Custom Headers:</label>
            <div className="custom-headers">
              {Object.entries(formData.customHeaders || {}).map(([key, value]) => (
                <div key={key} className="header-item">
                  <span className="header-key">{key}:</span>
                  <span className="header-value">{value}</span>
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => removeCustomHeader(key)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="add-header">
                <input
                  type="text"
                  placeholder="Header name"
                  value={newHeaderKey}
                  onChange={(e) => setNewHeaderKey(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Header value"
                  value={newHeaderValue}
                  onChange={(e) => setNewHeaderValue(e.target.value)}
                />
                <button
                  type="button"
                  className="add-btn"
                  onClick={addCustomHeader}
                >
                  Add Header
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="primary-btn" disabled={saving}>
            {saving ? '💾 Saving...' : '💾 Save Configuration'}
          </button>
          <button type="button" className="secondary-btn" onClick={onCancel} disabled={saving}>
            ❌ Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default ConfigPanel;
