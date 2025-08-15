import React, { useState, useEffect, useRef } from 'react';
import ChatHeader from './components/ChatHeader';
import ConfigPanel from './components/ConfigPanel';
import ChatMessages from './components/ChatMessages';
import ChatInput from './components/ChatInput';
import { Message, AgentConfig } from './types';

declare global {
  interface Window {
    acquireVsCodeApi(): any;
  }
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [config, setConfig] = useState<AgentConfig>({
    llmProvider: 'openai',
    model: 'gpt-4',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 2000
  });
  const [isThinking, setIsThinking] = useState(false);
  
  const vscode = useRef<any>(null);

  useEffect(() => {
    console.log('App component mounting...');
    
    // Get VS Code API
    if (typeof window.acquireVsCodeApi === 'function') {
      vscode.current = window.acquireVsCodeApi();
      console.log('VS Code API acquired successfully');
    } else {
      console.error('VS Code API not available');
    }

    // Listen for messages from extension
    const messageListener = (event: MessageEvent) => {
      console.log('Received message from extension:', event.data);
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
      console.log('Sending webviewReady message');
      vscode.current.postMessage({ command: 'webviewReady' });
      
      // Request current config
      setTimeout(() => {
        console.log('Requesting config');
        vscode.current?.postMessage({ command: 'getConfig' });
      }, 100);
    }

    // Add welcome message
    setMessages([{
      id: '1',
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

    return () => {
      window.removeEventListener('message', messageListener);
    };
  }, []);

  const handleSendMessage = (text: string) => {
    console.log('Sending message:', text);
    
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
      console.log('Posting message to extension');
      vscode.current.postMessage({
        command: 'sendMessage',
        text: text
      });
    } else {
      console.error('VS Code API not available for sending message');
    }
  };

  const handleConfigSave = (newConfig: AgentConfig) => {
    setConfig(newConfig);
    setIsConfigOpen(false);
    
    // Send to extension
    vscode.current?.postMessage({
      command: 'updateConfig',
      config: newConfig
    });
  };

  const handleQuickAction = (action: string) => {
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
  };

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
