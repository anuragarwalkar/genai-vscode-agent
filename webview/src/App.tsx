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
      console.warn('Failed to acquire VS Code API:', error);
      // Try to use cached API if available
      if (window.vscodeApi) {
        globalVscodeApi = window.vscodeApi;
        return globalVscodeApi;
      }
      return null;
    }
  }
  
  return null;
};

const App: React.FC = () => {
  const vscode = useRef<any>(null);
  
  // Initialize state from VS Code's persistent state or use defaults
  const getInitialState = () => {
    const vsCodeApi = getVscodeApi();
    let savedState = null;
    
    try {
      savedState = vsCodeApi?.getState();
    } catch (error) {
      console.warn('Failed to get state from VS Code:', error);
    }
    
    // If we have saved messages, restore them with proper timestamp objects
    let messages = [{
      id: 'welcome-1',
      role: 'assistant' as const,
      content: `👋 Welcome to Avior AI Agent!

I can help you with:
• 🔍 Search your codebase
• ✏️ Edit and refactor code  
• 📝 Create new files
• 🔧 Analyze code quality
• 🐛 Debug issues

Start by typing a message below!`,
      timestamp: new Date()
    }];

    if (savedState?.messages) {
      messages = savedState.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp) // Ensure timestamp is a Date object
      }));
    }
    
    return {
      messages,
      isConfigOpen: savedState?.isConfigOpen || false,
      config: savedState?.config || {
        llmProvider: 'openai',
        model: 'gpt-4',
        apiKey: '',
        temperature: 0.7,
        maxTokens: 2000,
        apiEndpoint: '',
        customHeaders: {}
      },
      isThinking: false // Always reset thinking state on reload/initialization
    };
  };

  const initialState = getInitialState();
  
  const [messages, setMessages] = useState<Message[]>(initialState.messages);
  const [isConfigOpen, setIsConfigOpen] = useState(initialState.isConfigOpen);
  const [config, setConfig] = useState<AgentConfig>(initialState.config);
  const [isThinking, setIsThinking] = useState(initialState.isThinking);
  const [streamingMessages, setStreamingMessages] = useState<Map<string, Message>>(new Map());
  const [isWebviewReady, setIsWebviewReady] = useState(false);

  // Function to save state to VS Code's persistent storage with debounce
  const saveState = useCallback(() => {
    if (vscode.current) {
      try {
        vscode.current.setState({
          messages,
          isConfigOpen,
          config,
          isThinking
        });
      } catch (error) {
        console.warn('Failed to save state to VS Code:', error);
      }
    }
  }, [messages, isConfigOpen, config, isThinking]);

  // Debounced state saving to prevent too frequent updates
  const debouncedSaveState = useCallback(() => {
    const timeoutId = setTimeout(saveState, 300);
    return () => clearTimeout(timeoutId);
  }, [saveState]);

  // Save state whenever it changes (debounced)
  useEffect(() => {
    const cleanup = debouncedSaveState();
    return cleanup;
  }, [debouncedSaveState]);

  useEffect(() => {
    console.log('App: Initializing...');
    
    // Get VS Code API safely
    vscode.current = getVscodeApi();
    console.log('App: VS Code API acquired:', !!vscode.current);

    // Listen for messages from extension
    const messageListener = (event: MessageEvent) => {
      const message = event.data;
      console.log('App: Received message:', message.command, message);
      
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
          
        case 'agentReady':
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
      try {
        console.log('App: Sending ready signal...');
        const hasRestoredState = initialState.messages.length > 1;
        vscode.current.postMessage({ 
          command: 'webviewReady',
          hasRestoredState 
        });
        console.log('App: Ready signal sent successfully');
        setIsWebviewReady(true);
        
        // Request current config
        setTimeout(() => {
          try {
            console.log('App: Requesting config...');
            vscode.current?.postMessage({ command: 'getConfig' });
          } catch (error) {
            console.warn('Failed to request config:', error);
          }
        }, 100);
      } catch (error) {
        console.warn('Failed to send ready signal:', error);
        // Still mark as ready even if we can't send the signal
        setIsWebviewReady(true);
      }
    } else {
      console.warn('App: No VS Code API available');
      // Mark as ready anyway to prevent infinite loading
      setIsWebviewReady(true);
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
      try {
        vscode.current.postMessage({
          command: 'sendMessage',
          text: text
        });
      } catch (error) {
        console.warn('Failed to send message to extension:', error);
        setIsThinking(false);
      }
    }
  }, []);

  const handleConfigSave = useCallback((newConfig: AgentConfig) => {
    setConfig(newConfig);
    setIsConfigOpen(false);
    
    // Send to extension
    try {
      vscode.current?.postMessage({
        command: 'updateConfig',
        config: newConfig
      });
    } catch (error) {
      console.warn('Failed to update config:', error);
    }
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

  const handleClearChat = useCallback(() => {
    // Clear all messages and reset to welcome message
    const welcomeMessage: Message = {
      id: Date.now().toString(),
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
    };

    setMessages([welcomeMessage]);
    setIsThinking(false);
    setStreamingMessages(new Map());
    
    // Notify extension about chat clear
    try {
      vscode.current?.postMessage({
        command: 'clearChat'
      });
    } catch (error) {
      console.warn('Failed to notify extension about chat clear:', error);
    }
  }, []);

  if (!isWebviewReady) {
    return (
      <div className="app loading">
        <div className="loading-content">
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
          <p>Initializing Avior AI Agent...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <ChatHeader 
        onConfigClick={() => setIsConfigOpen(!isConfigOpen)}
        isConfigOpen={isConfigOpen}
        onClearChat={handleClearChat}
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
