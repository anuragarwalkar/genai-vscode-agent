import React, { useEffect, useRef } from 'react';
import { Message } from '../types';

interface ChatMessagesProps {
  messages: Message[];
  isThinking: boolean;
  streamingMessages?: Map<string, Message>;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, isThinking, streamingMessages }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const formatMessage = (content: string, messageId: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .split('\n').map((line, i) => (
        <div key={`${messageId}-line-${i}`} dangerouslySetInnerHTML={{ __html: line }} />
      ));
  };

  return (
    <div className="messages">
      {messages.length === 0 && (
        <div className="welcome-message">
          <div className="welcome-content">
            <h3>👋 Welcome to Avior AI Agent!</h3>
            <p>I can help you with:</p>
            <ul>
              <li>🔍 Search your codebase</li>
              <li>✏️ Edit and refactor code</li>
              <li>📝 Create new files</li>
              <li>🔧 Analyze code quality</li>
              <li>🐛 Debug issues</li>
            </ul>
            <p>Start by typing a message below!</p>
          </div>
        </div>
      )}
      
      {messages.map((message) => {
        const isStreaming = streamingMessages?.has(message.id);
        return (
        <div 
          key={message.id} 
          className={`message ${message.role} ${isStreaming ? 'streaming' : ''}`}
        >
          <div className="message-avatar">
            {message.role === 'user' ? '👤' : '🤖'}
          </div>
          <div className="message-content">
            <div className="message-text">
              {formatMessage(message.content, message.id)}
              {isStreaming && (
                <span className="streaming-cursor">▊</span>
              )}
            </div>
            <div className="message-timestamp">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        </div>
        );
      })}
      
      {isThinking && (
        <div className="message assistant thinking">
          <div className="message-avatar">🤖</div>
          <div className="message-content">
            <div className="thinking-indicator">
              <div className="thinking-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span className="thinking-text">Thinking...</span>
            </div>
          </div>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatMessages;
