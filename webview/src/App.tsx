import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChatHeader from './components/ChatHeader';
import ConfigPanel from './components/ConfigPanel';
import ChatMessages from './components/ChatMessages';
import ChatInput from './components/ChatInput';
import { Message, AgentConfig } from './types';

declare global {
  interface Window {
    acquireVsCodeApi(): any;
    vscodeApi?: {
      postMessage(message: any): void;
      setState(state: any): void;
      getState(): any;
    };
  }
}

// Global VS Code API instance to prevent multiple acquisitions
let globalVscodeApi: any = null;

const getVscodeApi = () => {
  if (globalVscodeApi) {
    return globalVscodeApi;
  }
  
  if (typeof window.acquireVsCodeApi === 'function') {
    try {
      globalVscodeApi = window.acquireVsCodeApi();
      return globalVscodeApi;
    } catch (error) {
      // Try to use cached API if available
      if (window.vscodeApi) {
        globalVscodeApi = window.vscodeApi;
        return globalVscodeApi;
      }
    }
  }
  
  return null;
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome-1',
    role: 'assistant',
    content: `👋 Welcome to Avior AI Agent!

I can help you with:
• 🔍 Search your codebase
• ✏️ Edit and refactor code  
• 📝 Create new files
• 🔧 Analyze code quality
• 🐛 Debug issues

Start by typing a message below!`,
    timestamp: new Date()
  }]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [config, setConfig] = useState<AgentConfig>({
    llmProvider: 'openai',
    model: 'gpt-4',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 2000,
    apiEndpoint: '',
    customHeaders: {}
  });
  const [isThinking, setIsThinking] = useState(false);
  const [streamingMessages, setStreamingMessages] = useState<Map<string, Message>>(new Map());
  
  const vscode = useRef<any>(null);

  useEffect(() => {
    // Get VS Code API safely
    vscode.current = getVscodeApi();

    // Listen for messages from extension
    const messageListener = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.command) {
        case 'addMessage':
          if (message.message.isThinking) {
            setIsThinking(true);
          } else {
            setIsThinking(false);
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: message.message.role,
              content: message.message.content,
              timestamp: new Date(message.message.timestamp)
            }]);
          }
          break;
          
        case 'startStreaming':
          setIsThinking(false);
          const newStreamingMessage = {
            id: message.messageId,
            role: message.message.role,
            content: '',
            timestamp: new Date(message.message.timestamp)
          };
          setStreamingMessages(prev => new Map(prev.set(message.messageId, newStreamingMessage)));
          setMessages(prev => [...prev, newStreamingMessage]);
          break;
          
        case 'updateStreamingMessage':
          setStreamingMessages(prev => {
            const updated = new Map(prev);
            const existing = updated.get(message.messageId);
            if (existing) {
              existing.content = message.content;
              updated.set(message.messageId, existing);
            }
            return updated;
          });
          setMessages(prev => prev.map(msg => 
            msg.id === message.messageId 
              ? { ...msg, content: message.content }
              : msg
          ));
          break;
          
        case 'finalizeStreamingMessage':
          setStreamingMessages(prev => {
            const updated = new Map(prev);
            updated.delete(message.messageId);
            return updated;
          });
          break;
          
        case 'removeThinking':
          setIsThinking(false);
          break;
          
        case 'configData':
          setConfig(message.config);
          break;
      }
    };

    window.addEventListener('message', messageListener);

    // Send ready signal to extension
    if (vscode.current) {
      vscode.current.postMessage({ command: 'webviewReady' });
      
      // Request current config
      setTimeout(() => {
        vscode.current?.postMessage({ command: 'getConfig' });
      }, 100);
    }

    return () => {
      window.removeEventListener('message', messageListener);
    };
  }, []);

  const handleSendMessage = useCallback((text: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsThinking(true);

    // Send to extension
    if (vscode.current) {
      vscode.current.postMessage({
        command: 'sendMessage',
        text: text
      });
    }
  }, []);

  const handleConfigSave = useCallback((newConfig: AgentConfig) => {
    setConfig(newConfig);
    setIsConfigOpen(false);
    
    // Send to extension
    vscode.current?.postMessage({
      command: 'updateConfig',
      config: newConfig
    });
  }, []);

  const handleQuickAction = useCallback((action: string) => {
    const prompts = {
      search: "Search for specific functionality in my codebase",
      edit: "Help me edit or refactor some code",
      create: "Create a new file or component",
      analyze: "Analyze my code for issues or improvements"
    };
    
    const prompt = prompts[action as keyof typeof prompts];
    if (prompt) {
      handleSendMessage(prompt);
    }
  }, [handleSendMessage]);

  return (
    <div className="app">
      <ChatHeader 
        onConfigClick={() => setIsConfigOpen(!isConfigOpen)}
        isConfigOpen={isConfigOpen}
      />
      
      {isConfigOpen && (
        <ConfigPanel
          config={config}
          onSave={handleConfigSave}
          onCancel={() => setIsConfigOpen(false)}
        />
      )}
      
      <div className={`chat-container ${isConfigOpen ? 'with-config' : ''}`}>
        <ChatMessages 
          messages={messages} 
          isThinking={isThinking}
          streamingMessages={streamingMessages}
        />
        
        <ChatInput
          onSendMessage={handleSendMessage}
          onQuickAction={handleQuickAction}
        />
      </div>
    </div>
  );
};

export default App;
