import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { AgentConfig, LLMService, AgentAction, Result } from './types';

// Create mock LLM service when no API key is provided
const createMockLLMService = (): LLMService => {
  const mockResponse = async (prompt: string): Promise<string> => {
    return `Mock AI Response: I received your request "${prompt}". Please configure your API key in the settings to enable real AI responses.`;
  };

  return {
    generateResponse: async (prompt: string, context: ReadonlyArray<string>) => {
      return mockResponse(prompt);
    },
    generateResponseStream: async (prompt: string, context: ReadonlyArray<string>, onToken: (token: string) => void) => {
      const response = await mockResponse(prompt);
      // Simulate streaming by sending chunks
      const words = response.split(' ');
      for (let i = 0; i < words.length; i++) {
        onToken(words[i] + (i < words.length - 1 ? ' ' : ''));
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay to simulate streaming
      }
      return response;
    },
    analyzeCode: async (code: string, question: string) => {
      return `Mock Code Analysis: Please configure your API key to analyze the code. Question: ${question}`;
    },
    suggestEdits: async (code: string, intent: string) => {
      return { 
        type: 'edit', 
        content: 'Please configure API key to get real suggestions', 
        target: 'configuration', 
        reasoning: 'Mock response due to missing API key' 
      };
    }
  };
};

// Factory function to create LLM service based on configuration
export const createLLMService = (config: AgentConfig): Result<LLMService> => {
  try {
    // Check if API key is provided
    if (!config.apiKey || config.apiKey.trim() === '') {
      return {
        success: true,
        data: createMockLLMService() // Return mock service when no API key
      };
    }

    const llm = createLLMInstance(config);
    
    return {
      success: true,
      data: {
        generateResponse: (prompt: string, context: ReadonlyArray<string>) => 
          generateResponse(llm, prompt, context),
        generateResponseStream: (prompt: string, context: ReadonlyArray<string>, onToken: (token: string) => void) => 
          generateResponseStream(llm, prompt, context, onToken),
        analyzeCode: (code: string, question: string) => 
          analyzeCode(llm, code, question),
        suggestEdits: (code: string, intent: string) => 
          suggestEdits(llm, code, intent)
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error as Error
    };
  }
};

// Pure function to create LLM instance
const createLLMInstance = (config: AgentConfig) => {
  const baseConfig = {
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  };

  switch (config.llmProvider) {
    case 'openai':
      return new ChatOpenAI({
        ...baseConfig,
        modelName: config.model,
        openAIApiKey: config.apiKey,
        ...(config.apiEndpoint && { 
          configuration: { 
            baseURL: config.apiEndpoint,
            defaultHeaders: config.customHeaders || {}
          } 
        })
      });
    
    case 'openai-compatible':
      return new ChatOpenAI({
        ...baseConfig,
        modelName: config.model,
        openAIApiKey: config.apiKey || 'not-needed', // Some local models don't require API key
        configuration: {
          baseURL: config.apiEndpoint || 'http://localhost:11434/v1',
          defaultHeaders: config.customHeaders || {}
        }
      });
    
    case 'anthropic':
      return new ChatAnthropic({
        ...baseConfig,
        modelName: config.model,
        anthropicApiKey: config.apiKey,
        ...(config.apiEndpoint && { baseURL: config.apiEndpoint })
      });
    
    case 'gemini':
      return new ChatGoogleGenerativeAI({
        ...baseConfig,
        modelName: config.model,
        apiKey: config.apiKey,
        ...(config.apiEndpoint && { baseURL: config.apiEndpoint })
      });
    
    default:
      throw new Error(`Unsupported LLM provider: ${config.llmProvider}`);
  }
};

// Generate response with context
const generateResponse = async (
  llm: ChatOpenAI | ChatAnthropic | ChatGoogleGenerativeAI,
  prompt: string,
  context: ReadonlyArray<string>
): Promise<string> => {
  const contextStr = context.length > 0 
    ? `Context:\n${context.join('\n\n')}\n\n`
    : '';
  
  const fullPrompt = `${contextStr}User Request: ${prompt}`;
  
  const response = await llm.invoke(fullPrompt);
  return response.content.toString();
};

// Generate streaming response with context
const generateResponseStream = async (
  llm: ChatOpenAI | ChatAnthropic | ChatGoogleGenerativeAI,
  prompt: string,
  context: ReadonlyArray<string>,
  onToken: (token: string) => void
): Promise<string> => {
  const contextStr = context.length > 0 
    ? `Context:\n${context.join('\n\n')}\n\n`
    : '';
  
  const fullPrompt = `${contextStr}User Request: ${prompt}`;
  
  let fullResponse = '';
  
  // Use streaming
  const stream = await llm.stream(fullPrompt);
  
  for await (const chunk of stream) {
    const content = chunk.content.toString();
    fullResponse += content;
    onToken(content);
  }
  
  return fullResponse;
};

// Analyze code with specific question
const analyzeCode = async (
  llm: ChatOpenAI | ChatAnthropic | ChatGoogleGenerativeAI,
  code: string,
  question: string
): Promise<string> => {
  const prompt = `
Analyze the following code and answer the question:

Code:
\`\`\`
${code}
\`\`\`

Question: ${question}

Provide a clear, concise analysis focusing on the specific question asked.
`;

  const response = await llm.invoke(prompt);
  return response.content.toString();
};

// Suggest code edits based on intent
const suggestEdits = async (
  llm: ChatOpenAI | ChatAnthropic | ChatGoogleGenerativeAI,
  code: string,
  intent: string
): Promise<AgentAction> => {
  const prompt = `
Given the following code and the user's intent, suggest a specific edit action.

Code:
\`\`\`
${code}
\`\`\`

User Intent: ${intent}

Respond with a JSON object containing:
- type: "edit" | "create" | "analyze"
- content: the new or modified code (if applicable)
- reasoning: explanation of the suggested change

Be specific and actionable in your suggestions.
`;

  const response = await llm.invoke(prompt);
  const content = response.content.toString();
  
  try {
    // Try to parse JSON response
    const parsed = JSON.parse(content);
    return {
      type: parsed.type || 'analyze',
      content: parsed.content,
      reasoning: parsed.reasoning || content
    } as AgentAction;
  } catch {
    // Fallback to text response
    return {
      type: 'respond',
      content: content,
      reasoning: 'Generated text response'
    } as AgentAction;
  }
};

// Utility function to validate API key
export const validateApiKey = (provider: string, apiKey: string): boolean => {
  // For OpenAI-compatible providers, API key might not be required (local models)
  if (provider === 'openai-compatible') {
    return true; // Allow empty API key for local models
  }
  
  if (!apiKey || apiKey.trim().length === 0) {
    return false;
  }
  
  switch (provider) {
    case 'openai':
      return apiKey.startsWith('sk-');
    case 'anthropic':
      return apiKey.startsWith('sk-ant-');
    case 'gemini':
      return apiKey.length > 10; // Basic validation for Google API keys
    default:
      return apiKey.length > 10; // Basic validation for custom providers
  }
};

// Default configurations for different providers
export const getDefaultConfig = (provider: 'openai' | 'anthropic' | 'gemini' | 'openai-compatible'): Partial<AgentConfig> => {
  const baseConfig = {
    temperature: 0.7,
    maxTokens: 2000,
  };

  switch (provider) {
    case 'openai':
      return {
        ...baseConfig,
        llmProvider: 'openai',
        model: 'gpt-4',
      };
    
    case 'anthropic':
      return {
        ...baseConfig,
        llmProvider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
      };
    
    case 'gemini':
      return {
        ...baseConfig,
        llmProvider: 'gemini',
        model: 'gemini-pro',
      };
    
    case 'openai-compatible':
      return {
        ...baseConfig,
        llmProvider: 'openai-compatible',
        model: 'llama2', // Common default for local models
        apiEndpoint: 'http://localhost:11434/v1', // Default Ollama endpoint
      };
    
    default:
      return baseConfig;
  }
};
