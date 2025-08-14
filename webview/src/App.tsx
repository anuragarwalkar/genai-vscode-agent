import React, { useState, useEffect, useRef } from 'react';
import styled, { ThemeProvider } from 'styled-components';
import ChatHeader from './components/ChatHeader';
import ConfigPanel from './components/ConfigPanel';
import ChatMessages from './components/ChatMessages';
import ChatInput from './components/ChatInput';
import { Message, AgentConfig } from './types';

// Theme setup for VS Code integration
const theme = {
  colors: {
    background: 'var(--vscode-editor-background)',
    foreground: 'var(--vscode-editor-foreground)',
    border: 'var(--vscode-panel-border)',
    accent: 'var(--vscode-button-background)',
    accentHover: 'var(--vscode-button-hoverBackground)',
    input: 'var(--vscode-input-background)',
    inputBorder: 'var(--vscode-input-border)',
    secondary: 'var(--vscode-button-secondaryBackground)',
    error: 'var(--vscode-errorForeground)',
    success: 'var(--vscode-terminal-ansiGreen)',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  borderRadius: '4px',
  fontSize: {
    sm: '12px',
    md: '14px',
    lg: '16px',
  }
};

interface ThemeProps {
  theme: typeof theme;
}

const AppContainer = styled.div<ThemeProps>`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: ${(props: ThemeProps) => props.theme.colors.background};
  color: ${(props: ThemeProps) => props.theme.colors.foreground};
  font-family: var(--vscode-font-family);
  font-size: ${(props: ThemeProps) => props.theme.fontSize.md};
`;

const ChatContainer = styled.div<{ $isConfigOpen: boolean }>`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  transition: all 0.2s ease;
  ${(props: { $isConfigOpen: boolean }) => props.$isConfigOpen && `
    filter: blur(1px);
    opacity: 0.7;
  `}
`;

const Divider = styled.div`
  height: 1px;
  background-color: var(--vscode-panel-border);
  width: 100%;
`;

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
    // Get VS Code API
    vscode.current = window.acquireVsCodeApi();

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
          
        case 'removeThinking':
          setIsThinking(false);
          break;
          
        case 'configData':
          setConfig(message.config);
          break;
      }
    };

    window.addEventListener('message', messageListener);

    // Request current config
    vscode.current?.postMessage({ command: 'getConfig' });

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
    vscode.current?.postMessage({
      command: 'sendMessage',
      text: text
    });
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
    <ThemeProvider theme={theme}>
      <AppContainer>
        <ChatHeader 
          onConfigClick={() => setIsConfigOpen(!isConfigOpen)}
          isConfigOpen={isConfigOpen}
        />
        
        <Divider />
        
        {isConfigOpen && (
          <ConfigPanel
            config={config}
            onSave={handleConfigSave}
            onCancel={() => setIsConfigOpen(false)}
          />
        )}
        
        <ChatContainer $isConfigOpen={isConfigOpen}>
          <ChatMessages 
            messages={messages} 
            isThinking={isThinking}
          />
          
          <ChatInput
            onSendMessage={handleSendMessage}
            onQuickAction={handleQuickAction}
          />
        </ChatContainer>
      </AppContainer>
    </ThemeProvider>
  );
};

export default App;
