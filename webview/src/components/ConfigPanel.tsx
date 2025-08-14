import React, { useState } from 'react';
import { AgentConfig } from '../types';

interface ConfigPanelProps {
  config: AgentConfig;
  onSave: (config: AgentConfig) => void;
  onCancel: () => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onSave, onCancel }) => {
  const [formData, setFormData] = useState<AgentConfig>(config);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleInputChange = (field: keyof AgentConfig, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="config-panel">
      <div className="config-header">
        <h3>🔧 AI Configuration</h3>
      </div>
      
      <form onSubmit={handleSubmit} className="config-form">
        <div className="form-group">
          <label htmlFor="provider">Provider:</label>
          <select 
            id="provider"
            value={formData.llmProvider}
            onChange={(e) => handleInputChange('llmProvider', e.target.value as 'openai' | 'anthropic')}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="model">Model:</label>
          <select 
            id="model"
            value={formData.model}
            onChange={(e) => handleInputChange('model', e.target.value)}
          >
            {formData.llmProvider === 'openai' ? (
              <>
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </>
            ) : (
              <>
                <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                <option value="claude-3-haiku">Claude 3 Haiku</option>
                <option value="claude-2">Claude 2</option>
              </>
            )}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="apiKey">API Key:</label>
          <input 
            type="password" 
            id="apiKey"
            value={formData.apiKey}
            onChange={(e) => handleInputChange('apiKey', e.target.value)}
            placeholder="Enter your API key"
          />
        </div>

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
        </div>

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

        <div className="form-actions">
          <button type="submit" className="primary-btn">
            💾 Save Configuration
          </button>
          <button type="button" className="secondary-btn" onClick={onCancel}>
            ❌ Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default ConfigPanel;
