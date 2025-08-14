import React, { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onQuickAction: (action: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, onQuickAction }) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
      adjustTextareaHeight();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  const quickActions = [
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'edit', label: 'Edit', icon: '✏️' },
    { id: 'create', label: 'Create', icon: '📝' },
    { id: 'analyze', label: 'Analyze', icon: '🔧' }
  ];

  return (
    <div className="input-container">
      <div className="quick-actions">
        {quickActions.map((action) => (
          <button
            key={action.id}
            className="action-btn"
            onClick={() => onQuickAction(action.id)}
            title={`${action.label} code`}
          >
            <span className="action-icon">{action.icon}</span>
            <span className="action-label">{action.label}</span>
          </button>
        ))}
      </div>
      
      <form onSubmit={handleSubmit} className="input-form">
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your code..."
            className="message-input"
            rows={1}
          />
          <button 
            type="submit" 
            className="send-btn"
            disabled={!message.trim()}
            title="Send message (Enter)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M15.854 7.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708-.708L14.293 8.5H.5a.5.5 0 0 1 0-1h13.793L8.146 1.354a.5.5 0 1 1 .708-.708l7 7z"/>
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
