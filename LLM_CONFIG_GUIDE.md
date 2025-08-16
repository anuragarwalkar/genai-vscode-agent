# LLM Configuration Guide

Avior supports multiple LLM providers with persistent configuration storage. This guide will help you set up and configure your preferred AI provider.

## Supported Providers

### OpenAI
- **Models**: GPT-4, GPT-4 Turbo, GPT-4o, GPT-3.5 Turbo
- **API Key Format**: `sk-...`
- **Setup**: Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
- **Custom Endpoints**: Supports OpenAI-compatible endpoints

### OpenAI-Compatible
- **Models**: Llama2, CodeLlama, Mistral, Mixtral, Vertex AI models, and more
- **API Key Format**: Varies by provider (optional for local models)
- **Setup Examples**:
  - **Ollama**: `http://localhost:11434/v1` (no API key needed)
  - **OpenRouter**: `https://openrouter.ai/api/v1` (requires API key)
  - **Saia AI**: `https://api.saia.ai` (requires API key, supports Vertex AI models)
  - **Together AI**: `https://api.together.xyz/v1` (requires API key)
  - **Azure OpenAI**: `https://your-resource.openai.azure.com` (requires API key)
  - **Local vLLM**: `http://localhost:8000/v1` (no API key needed)
- **Use Cases**: Local models, cost-effective alternatives, specialized models, Vertex AI access

### Anthropic Claude
- **Models**: Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku
- **API Key Format**: `sk-ant-...`
- **Setup**: Get your API key from [Anthropic Console](https://console.anthropic.com/settings/keys)

### Google Gemini
- **Models**: Gemini Pro, Gemini Pro Vision, Gemini 1.5 Pro, Gemini 1.5 Flash
- **API Key Format**: `AIza...`
- **Setup**: Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

## Configuration Commands

### Quick Setup
1. Open Command Palette (`Cmd+Shift+P`)
2. Run `Avior: Configure LLM Provider`
3. Follow the wizard to select provider and configure settings

### Available Commands
- `Avior: Configure LLM Provider` - Launch configuration wizard
- `Avior: Select LLM Provider` - Quick provider selection
- `Avior: View Current Configuration` - Display current settings

### Keyboard Shortcuts
- `Cmd+Shift+C` - Open configuration wizard
- `Cmd+Shift+A` - Ask AI Agent

## Setting Up Local Models

### Ollama (Recommended)
1. Install Ollama: `curl -fsSL https://ollama.ai/install.sh | sh`
2. Start Ollama: `ollama serve`
3. Pull a model: `ollama pull llama2`
4. Configure Avior:
   - Provider: OpenAI-Compatible
   - API Endpoint: `http://localhost:11434/v1`
   - Model: `llama2`
   - API Key: (leave empty)

### vLLM Server
1. Install vLLM: `pip install vllm`
2. Start server: `python -m vllm.entrypoints.openai.api_server --model microsoft/DialoGPT-medium`
3. Configure Avior:
   - Provider: OpenAI-Compatible
   - API Endpoint: `http://localhost:8000/v1`
   - Model: (your model name)
   - API Key: (leave empty)

### LM Studio
1. Download and install LM Studio
2. Load a model and start the server
3. Configure Avior:
   - Provider: OpenAI-Compatible
   - API Endpoint: `http://localhost:1234/v1`
   - Model: (your loaded model)
   - API Key: (leave empty)

### Saia AI (Vertex AI Access)
1. Sign up at [Saia AI](https://saia.ai)
2. Get your API key from the dashboard
3. Configure Avior:
   - Provider: OpenAI-Compatible
   - API Endpoint: `https://api.saia.ai`
   - Model: `vertex_ai/gemini-2.5-pro` (or other Vertex models)
   - API Key: (your Saia AI key)

### OpenRouter (Multiple Models)
1. Sign up at [OpenRouter](https://openrouter.ai)
2. Get your API key from the dashboard
3. Configure Avior:
   - Provider: OpenAI-Compatible
   - API Endpoint: `https://openrouter.ai/api/v1`
   - Model: `openrouter/anthropic/claude-3-opus` (or any available model)
   - API Key: (your OpenRouter key)

### Azure OpenAI
1. Set up Azure OpenAI resource
2. Get your endpoint and API key
3. Configure Avior:
   - Provider: OpenAI-Compatible
   - API Endpoint: `https://your-resource.openai.azure.com`
   - Model: (your deployment name)
   - API Key: (your Azure API key)

## Configuration Options

### Basic Settings
- **Provider**: Choose between OpenAI, Anthropic, or Gemini
- **Model**: Select specific model version
- **API Key**: Your provider's API key (stored securely)

### Advanced Settings
- **Temperature**: Controls creativity (0.0 - 2.0)
  - 0.0: Deterministic, focused
  - 0.7: Balanced (recommended)
  - 1.0+: More creative, varied
- **Max Tokens**: Response length limit (100 - 8000)
- **API Endpoint**: Custom endpoint URL (OpenAI only)

## Configuration Storage

Avior uses VS Code's secure storage system:
- **API Keys**: Stored in VS Code's secure secret storage
- **Settings**: Persistent across VS Code sessions
- **Provider Selection**: Remembered for future use

## Preset Configurations

### OpenAI GPT-4 (Recommended)
- Provider: OpenAI
- Model: gpt-4
- Temperature: 0.7
- Max Tokens: 2000

### OpenAI GPT-4 Turbo (High Performance)
- Provider: OpenAI
- Model: gpt-4-turbo
- Temperature: 0.7
- Max Tokens: 4000

### Anthropic Claude Sonnet (Balanced)
- Provider: Anthropic
- Model: claude-3-sonnet-20240229
- Temperature: 0.7
- Max Tokens: 2000

### Google Gemini Pro (Fast)
- Provider: Gemini
- Model: gemini-pro
- Temperature: 0.7
- Max Tokens: 2000

### Ollama Local (Free)
- Provider: OpenAI-Compatible
- Model: llama2
- API Endpoint: http://localhost:11434/v1
- API Key: (not required)
- Temperature: 0.7
- Max Tokens: 2000

### Saia AI Vertex (Advanced)
- Provider: OpenAI-Compatible
- Model: vertex_ai/gemini-2.5-pro
- API Endpoint: https://api.saia.ai
- API Key: (your Saia AI key)
- Temperature: 0.7
- Max Tokens: 2000

### Azure OpenAI (Enterprise)
- Provider: OpenAI-Compatible
- Model: gpt-4
- API Endpoint: https://your-resource.openai.azure.com
- API Key: (your Azure API key)
- Temperature: 0.7
- Max Tokens: 2000

### Together AI (Fast Inference)
- Provider: OpenAI-Compatible
- Model: meta-llama/Llama-2-70b-chat-hf
- API Endpoint: https://api.together.xyz/v1
- API Key: (your Together AI key)
- Temperature: 0.7
- Max Tokens: 2000

## Usage Tips

1. **Start with Defaults**: Use recommended settings initially
2. **Local Models**: Use OpenAI-Compatible provider with Ollama for free, private AI
3. **Cost Optimization**: Consider OpenRouter or local models for budget-friendly options
4. **Adjust Temperature**: Lower for code generation, higher for creative tasks
5. **Monitor Token Usage**: Higher limits = longer responses but more API costs
6. **Test Configuration**: Use "Ask AI Agent" to verify setup

## Troubleshooting

### Invalid API Key
- Verify key format matches provider requirements
- Check key hasn't expired or been revoked
- Ensure sufficient API credits/usage limits

### Connection Issues
- Check internet connectivity
- Verify API endpoint URL (if using custom)
- Review provider status pages for outages

### Performance Issues
- Reduce max tokens for faster responses
- Consider switching to faster models (e.g., GPT-3.5, Gemini Flash)
- Check API rate limits

## Security

- API keys are stored in VS Code's secure storage
- Keys are not logged or transmitted outside provider APIs
- Configuration data is stored locally only
- No telemetry or data sharing
