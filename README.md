# Avior - AI Coding Agent for VS Code

Avior is an intelligent coding assistant that integrates multiple Large Language Models (LLMs) directly into Visual Studio Code. Built with functional programming principles and designed for extensibility, Avior helps developers with code search, editing, creation, and analysis.

## Features

### 🤖 **AI Agent Mode (Default)**
- **Auto-activation**: The extension starts in agent mode by default
- **Natural language interaction**: Ask the agent to perform tasks using plain English
- **Contextual awareness**: The agent understands your workspace and current files

### 🔍 **Intelligent Code Operations**
- **Search**: Find specific functionality across your codebase
- **Edit**: Automatically modify existing files based on your requirements
- **Create**: Generate new files with AI-powered content
- **Analyze**: Get insights, security analysis, and code reviews

### 🧠 **Multi-LLM Support**
- **OpenAI Models**: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
- **Anthropic Models**: Claude 3 Opus, Sonnet, and Haiku
- **Secure API Management**: API keys stored securely using VS Code's secret storage

### 🔌 **Plugin System**
- **Extensible Architecture**: Built-in plugin manager for easy extensibility
- **Mock Plugin Store**: Ready-to-use plugin templates including:
  - **Jira Integration**: Task management and issue tracking (placeholder)
  - **Git Assistant**: AI-powered Git operations and commit messages (placeholder)
  - **Code Analysis**: Advanced security and performance insights (placeholder)

### ⚡ **Functional Programming Design**
- **No Classes**: Pure functions and function composition throughout
- **Immutable State**: All state changes handled functionally
- **Dependency Injection**: Clean architecture with explicit dependencies
- **Modular Structure**: Organized into focused, testable modules

## Quick Start

### 1. Installation
1. Install the extension in VS Code
2. The agent will start automatically upon activation

### 2. Configuration
- **First Use**: The extension will prompt you to configure your LLM provider
- **Manual Setup**: Use `Cmd+Shift+P` → "Avior: Configure Agent"
- **Supported Providers**: OpenAI and Anthropic

### 3. Using the Agent
- **Quick Access**: Press `Cmd+Shift+A` (Mac) or `Ctrl+Shift+A` (Windows/Linux)
- **Action Menu**: Choose from predefined actions:
  - 🔍 Search Code
  - ✏️ Edit File  
  - 📝 Create File
  - 🔧 Analyze Code
  - 🔌 Manage Plugins
  - ⚙️ Configure Agent

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `Avior: Ask AI Agent` | `Cmd+Shift+A` | Open the agent interaction menu |
| `Avior: Start AI Agent` | - | Start the AI agent |
| `Avior: Stop AI Agent` | - | Stop the AI agent |
| `Avior: Manage Plugins` | - | Enable/disable plugins |

## Configuration

Configure the extension through VS Code settings or the built-in configuration dialog:

```json
{
  "avior.model": "gpt-4",
  "avior.temperature": 0.7,
  "avior.maxTokens": 2000
}
```

### Settings

- **`avior.model`**: AI model to use (default: "gpt-4")
- **`avior.temperature`**: Controls response randomness 0-2 (default: 0.7)
- **`avior.maxTokens`**: Maximum tokens in responses 100-8000 (default: 2000)

API keys are stored securely and not exposed in settings files.

## Usage Examples

### Code Search
1. Press `Cmd+Shift+A`
2. Select "🔍 Search Code"
3. Enter: "authentication functions"
4. Agent searches and opens relevant files

### File Editing
1. Press `Cmd+Shift+A`
2. Select "✏️ Edit File"
3. Enter: "add error handling to login function"
4. Agent suggests and applies changes

### Code Analysis
1. Open a file you want to analyze
2. Press `Cmd+Shift+A`
3. Select "🔧 Analyze Code"
4. Enter: "check for security vulnerabilities"
5. Agent provides detailed analysis

## Architecture

The extension follows functional programming principles with clear separation of concerns:

```
src/
├── types.ts          # Type definitions
├── extension.ts      # Main extension entry point
├── agent.ts          # Core agent logic
├── llmService.ts     # LLM integration
├── fileService.ts    # File operations
├── uiService.ts      # User interface
├── pluginManager.ts  # Plugin system
└── configManager.ts  # Configuration management
```

### Key Principles

- **Pure Functions**: All business logic implemented as pure functions
- **Immutable State**: State changes handled functionally
- **Explicit Dependencies**: Services injected as function parameters
- **Side Effect Isolation**: File I/O and network calls clearly separated

## Plugin Development

The plugin system allows easy extension of functionality:

```typescript
const myPlugin: Plugin = {
  id: 'my-plugin',
  name: 'My Custom Plugin',
  version: '1.0.0',
  description: 'Custom functionality',
  author: 'Your Name',
  enabled: false,
  handler: {
    activate: async (context) => { /* activation logic */ },
    deactivate: async () => { /* cleanup logic */ },
    execute: async (action, params) => { /* action handler */ }
  },
  metadata: {
    category: 'Utility',
    tags: ['custom'],
    commands: ['my-action'],
    dependencies: []
  }
};
```

## Requirements

- Visual Studio Code ^1.74.0
- API key for OpenAI or Anthropic
- Internet connection for LLM interactions

## Extension Settings

All settings are prefixed with `avior.`:

- Model selection
- Temperature control
- Token limits
- Provider configuration

## Known Issues

- Plugin store is currently mock implementation
- Some advanced Git operations not yet implemented
- Large file analysis may timeout with lower token limits

## Release Notes

### 0.0.1

Initial release with:
- Multi-LLM support (OpenAI, Anthropic)
- Agent mode with natural language interaction
- Code search, edit, create, and analyze capabilities
- Plugin system with mock plugins
- Functional programming architecture
- Secure API key management

## Contributing

This extension is built with extensibility in mind. The functional architecture makes it easy to:

- Add new LLM providers
- Create custom plugins
- Extend agent capabilities
- Improve UI components

## License

MIT License - see LICENSE file for details.

---

**Enjoy coding with AI assistance! 🚀**
