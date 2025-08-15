import React from "react";

interface ChatHeaderProps {
  onConfigClick: () => void;
  isConfigOpen: boolean;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  onConfigClick,
  isConfigOpen,
}) => {
  return (
    <div className="header">
      <div className="header-content">
        <h2 className="header-title">
          <span className="header-icon">🤖</span>
          Avior AI Coding Agent
        </h2>
        <button
          className={`config-btn ${isConfigOpen ? "active" : ""}`}
          onClick={onConfigClick}
          title="Configure AI Models"
        >
          ⚙️
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
