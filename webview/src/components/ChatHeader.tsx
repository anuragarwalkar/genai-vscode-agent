import React from "react";

interface ChatHeaderProps {
  onConfigClick: () => void;
  isConfigOpen: boolean;
  onClearChat: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  onConfigClick,
  isConfigOpen,
  onClearChat,
}) => {
  return (
    <div className="header">
      <div className="header-content">
        <h2 className="header-title">
          <span className="header-icon">🤖</span>
          Avior AI Coding Agent
        </h2>
        <div className="header-actions">
          <button
            className="clear-btn"
            onClick={onClearChat}
            title="Clear Chat & Start New Session"
          >
            🗑️
          </button>
          <button
            className={`config-btn ${isConfigOpen ? "active" : ""}`}
            onClick={onConfigClick}
            title="Configure AI Models"
          >
            ⚙️
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
