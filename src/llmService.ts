import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';
import { AgentConfig, LLMService, EnhancedLLMService, AgentAction, Result, WorkspaceContext, ContextItem } from './types';

// Define structured output schemas using Zod
const agentActionSchema = z.object({
  type: z.enum(['create', 'edit', 'search', 'analyze', 'respond']),
  content: z.string().optional(),
  target: z.string().optional(),
  reasoning: z.string()
});

const fileOperationSchema = z.object({
  type: z.enum(['create', 'edit', 'delete', 'read']),
  filePath: z.string().optional(),
  content: z.string().optional(),
  reasoning: z.string()
});

// Simple JSON parsing helper with schema validation
const parseWithSchema = <T>(content: string, schema: z.ZodSchema<T>): T | null => {
  try {
    const parsed = JSON.parse(content);
    return schema.parse(parsed);
  } catch (error) {
    console.error('Schema parsing failed:', error);
    return null;
  }
};

// Helper function to extract JSON from LLM response
const extractJSON = (content: string): string => {
  // Try to find JSON block in markdown
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    return jsonMatch[1];
  }
  
  // Try to find JSON object
  const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    return jsonObjectMatch[0];
  }
  
  return content;
};

// Create enhanced mock LLM service when no API key is provided
const createEnhancedMockLLMService = (): EnhancedLLMService => {
  const mockResponse = async (prompt: string): Promise<string> => {
    console.log('🎭 Enhanced Mock LLM Service: Generating response for prompt:', prompt);
    
    // Check if this is an action determination request
    if (prompt.includes('Analyze this user request and determine the best action')) {
      // Extract the actual user request
      const requestMatch = prompt.match(/User Request: (.*?)(?:\n|$)/);
      const userRequest = requestMatch ? requestMatch[1] : '';
      console.log('🎯 Mock LLM: Determining action for request:', userRequest);
      
      // Simple logic to determine action type
      let actionType = 'respond';
      let reasoning = 'Default mock response';
      
      if (userRequest.toLowerCase().includes('create') || userRequest.toLowerCase().includes('new')) {
        actionType = 'create';
        reasoning = 'Request contains file creation keywords';
      } else if (userRequest.toLowerCase().includes('edit') || userRequest.toLowerCase().includes('modify')) {
        actionType = 'edit';
        reasoning = 'Request contains edit keywords';
      } else if (userRequest.toLowerCase().includes('search') || userRequest.toLowerCase().includes('find')) {
        actionType = 'search';
        reasoning = 'Request contains search keywords';
      } else if (userRequest.toLowerCase().includes('analyze') || userRequest.toLowerCase().includes('review')) {
        actionType = 'analyze';
        reasoning = 'Request contains analysis keywords';
      }
      
      const mockActionResponse = JSON.stringify({
        type: actionType,
        reasoning: reasoning
      });
      
      console.log('🎭 Mock LLM: Returning action determination:', mockActionResponse);
      return mockActionResponse;
    }
    
    // For other requests
    const response = `Mock AI Response: I received your request "${prompt}". Please configure your API key in the settings to enable real AI responses.`;
    console.log('🎭 Mock LLM: Returning general response:', response);
    return response;
  };

  const mockContextResponse = async (prompt: string, context: WorkspaceContext): Promise<string> => {
    console.log('🎭 Enhanced Mock LLM: Context-aware response');
    console.log('📁 Workspace:', context.workspaceInfo.name);
    console.log('📄 Files in context:', context.files.length);
    console.log('⚠️ Errors in context:', context.errors.length);
    
    const contextSummary = [
      `Workspace: ${context.workspaceInfo.name} (${context.workspaceInfo.fileCount} files)`,
      `Context includes ${context.files.length} files and ${context.errors.length} errors`,
      context.currentFile ? `Current file: ${context.currentFile}` : '',
      context.selectedText ? `Selected text: ${context.selectedText.substring(0, 100)}...` : ''
    ].filter(Boolean).join(', ');
    
    return `Mock Context-Aware Response: ${contextSummary}. Request: "${prompt}". Please configure your API key for real responses.`;
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
    },
    generateContextAwareResponse: mockContextResponse,
    generateContextAwareResponseStream: async (prompt: string, context: WorkspaceContext, onToken: (token: string) => void) => {
      const response = await mockContextResponse(prompt, context);
      const words = response.split(' ');
      for (let i = 0; i < words.length; i++) {
        onToken(words[i] + (i < words.length - 1 ? ' ' : ''));
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return response;
    },
    determineAction: async (prompt: string, context: WorkspaceContext) => {
      return {
        type: 'respond',
        content: await mockContextResponse(prompt, context),
        reasoning: 'Mock action determination'
      };
    },
    suggestFileOperation: async (intent: string, context: WorkspaceContext) => {
      return {
        type: 'create',
        content: `Mock file operation suggestion for: ${intent}`,
        reasoning: 'Mock file operation due to missing API key'
      };
    }
  };
};

// Factory function to create enhanced LLM service based on configuration
export const createLLMService = (config: AgentConfig): Result<EnhancedLLMService> => {
  try {
    // Check if API key is provided
    if (!config.apiKey || config.apiKey.trim() === '') {
      return {
        success: true,
        data: createEnhancedMockLLMService() // Return enhanced mock service when no API key
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
          suggestEdits(llm, code, intent),
        generateContextAwareResponse: (prompt: string, workspaceContext: WorkspaceContext) =>
          generateContextAwareResponseImpl(llm, prompt, workspaceContext),
        generateContextAwareResponseStream: (prompt: string, workspaceContext: WorkspaceContext, onToken: (token: string) => void) =>
          generateContextAwareResponseStreamImpl(llm, prompt, workspaceContext, onToken),
        determineAction: (prompt: string, workspaceContext: WorkspaceContext) =>
          determineActionImpl(llm, prompt, workspaceContext),
        suggestFileOperation: (intent: string, workspaceContext: WorkspaceContext) =>
          suggestFileOperationImpl(llm, intent, workspaceContext)
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
  llm: any,
  prompt: string,
  context: ReadonlyArray<string>
): Promise<string> => {
  console.log('🚀 LLM generateResponse called');
  console.log('📝 Input prompt:', prompt);
  console.log('📚 Context length:', context.length);
  
  const contextStr = context.length > 0 
    ? `Context:\n${context.join('\n\n')}\n\n`
    : '';
  
  const fullPrompt = `${contextStr}User Request: ${prompt}`;
  console.log('🔗 Full prompt to LLM:', fullPrompt);
  
  try {
    console.log('⏳ Streaming LLM response...');
    
    let fullResponse = '';
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('LLM request timeout after 30 seconds')), 30000);
    });
    
    const streamPromise = (async () => {
      const stream = await llm.stream(fullPrompt);
      for await (const chunk of stream) {
        const content = chunk.content.toString();
        fullResponse += content;
      }
      return fullResponse;
    })();
    
    const responseContent = await Promise.race([streamPromise, timeoutPromise]) as string;
    
    console.log('✅ LLM response received, length:', responseContent.length);
    console.log('📤 LLM response content:', responseContent);
    
    return responseContent;
  } catch (error) {
    console.error('❌ LLM streaming failed:', error);
    throw error;
  }
};

// Generate streaming response with context
const generateResponseStream = async (
  llm: any,
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
  llm: any,
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

  let fullResponse = '';
  const stream = await llm.stream(prompt);
  
  for await (const chunk of stream) {
    const content = chunk.content.toString();
    fullResponse += content;
  }
  
  return fullResponse;
};

// Suggest code edits based on intent using schema validation
const suggestEdits = async (
  llm: any,
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
- type: "create" | "edit" | "search" | "analyze" | "respond"
- content: the new or modified code (if applicable)
- target: target file or location (if applicable)
- reasoning: explanation of the suggested change

Be specific and actionable in your suggestions.

Example response:
\`\`\`json
{
  "type": "edit",
  "content": "modified code here",
  "target": "file.ts",
  "reasoning": "Added error handling to improve robustness"
}
\`\`\`
`;

  try {
    let fullResponse = '';
    const stream = await llm.stream(prompt);
    
    for await (const chunk of stream) {
      const content = chunk.content.toString();
      fullResponse += content;
    }
    
    const jsonContent = extractJSON(fullResponse);
    
    // Try schema validation first
    const parsed = parseWithSchema(jsonContent, agentActionSchema);
    if (parsed) {
      return parsed as AgentAction;
    }
    
    // Fallback to manual parsing
    const manualParsed = JSON.parse(jsonContent);
    return {
      type: manualParsed.type || 'respond',
      content: manualParsed.content,
      target: manualParsed.target,
      reasoning: manualParsed.reasoning || 'No reasoning provided'
    } as AgentAction;
  } catch (error) {
    console.error('❌ Failed to parse response:', error);
    // Fallback to text response
    return {
      type: 'respond',
      content: 'Unable to parse structured response',
      reasoning: 'Parsing failed, manual intervention required'
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

// Helper function to build context string from WorkspaceContext
const buildContextString = (workspaceContext: WorkspaceContext): string => {
  const contextParts: string[] = [];
  
  // Add workspace info
  contextParts.push(`Workspace: ${workspaceContext.workspaceInfo.name}`);
  contextParts.push(`Total Files: ${workspaceContext.workspaceInfo.fileCount}`);
  contextParts.push(`Languages: ${workspaceContext.workspaceInfo.languages.join(', ')}`);
  
  // Add current file info
  if (workspaceContext.currentFile) {
    contextParts.push(`\nCurrent File: ${workspaceContext.currentFile}`);
  }
  
  // Add selected text
  if (workspaceContext.selectedText) {
    contextParts.push(`\nSelected Text:\n${workspaceContext.selectedText}`);
  }
  
  // Add files to context
  if (workspaceContext.files.length > 0) {
    contextParts.push('\nRelevant Files:');
    workspaceContext.files.forEach(file => {
      contextParts.push(`\nFile: ${file.path || file.label}`);
      contextParts.push(`Type: ${file.type}`);
      if (file.content) {
        contextParts.push(`Content:\n${file.content}`);
      }
      if (file.summary) {
        contextParts.push(`Summary: ${file.summary}`);
      }
    });
  }
  
  // Add errors/problems
  if (workspaceContext.errors.length > 0) {
    contextParts.push('\nWorkspace Problems:');
    workspaceContext.errors.forEach(error => {
      contextParts.push(`- ${error.file || error.label}: ${error.message || error.content} ${error.line ? `(Line ${error.line})` : ''}`);
    });
  }
  
  // Add git info if available
  if (workspaceContext.gitInfo) {
    contextParts.push(`\nGit Info:`);
    contextParts.push(`Branch: ${workspaceContext.gitInfo.branch}`);
    contextParts.push(`Repository: ${workspaceContext.gitInfo.repository}`);
    if (workspaceContext.gitInfo.changedFiles.length > 0) {
      contextParts.push(`Changed Files: ${workspaceContext.gitInfo.changedFiles.join(', ')}`);
    }
  }
  
  return contextParts.join('\n');
};

// Enhanced context-aware response generation
const generateContextAwareResponseImpl = async (
  llm: any,
  prompt: string,
  workspaceContext: WorkspaceContext
): Promise<string> => {
  console.log('🚀 Enhanced LLM generateContextAwareResponse called');
  console.log('📝 Input prompt:', prompt);
  console.log('📁 Workspace context:', workspaceContext.workspaceInfo.name);
  
  const contextStr = buildContextString(workspaceContext);
  
  const fullPrompt = `${contextStr}\n\nUser Request: ${prompt}`;
  console.log('🔗 Full context-aware prompt to LLM:', fullPrompt);
  
  try {
    console.log('⏳ Streaming LLM with context...');
    
    let fullResponse = '';
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('LLM request timeout after 30 seconds')), 30000);
    });
    
    const streamPromise = (async () => {
      const stream = await llm.stream(fullPrompt);
      for await (const chunk of stream) {
        const content = chunk.content.toString();
        fullResponse += content;
      }
      return fullResponse;
    })();
    
    const responseContent = await Promise.race([streamPromise, timeoutPromise]) as string;
    
    console.log('✅ Context-aware LLM response received, length:', responseContent.length);
    
    return responseContent;
  } catch (error) {
    console.error('❌ Context-aware LLM invocation failed:', error);
    throw error;
  }
};

// Enhanced streaming context-aware response
const generateContextAwareResponseStreamImpl = async (
  llm: any,
  prompt: string,
  workspaceContext: WorkspaceContext,
  onToken: (token: string) => void
): Promise<string> => {
  const contextStr = buildContextString(workspaceContext);
  const fullPrompt = `${contextStr}\n\nUser Request: ${prompt}`;
  
  let fullResponse = '';
  
  try {
    const stream = await llm.stream(fullPrompt);
    
    for await (const chunk of stream) {
      const content = chunk.content.toString();
      fullResponse += content;
      onToken(content);
    }
    
    return fullResponse;
  } catch (error) {
    console.error('❌ Context-aware streaming failed:', error);
    throw error;
  }
};

// Determine action based on user request and context using schema validation
const determineActionImpl = async (
  llm: any,
  prompt: string,
  workspaceContext: WorkspaceContext
): Promise<AgentAction> => {
  const contextStr = buildContextString(workspaceContext);
  
  const actionPrompt = `
Analyze the following user request and workspace context to determine the best action to take.

Workspace Context:
${contextStr}

User Request: ${prompt}

Consider the current workspace state, files, errors, and the user's intent to determine whether to:
- create: Create new files or functionality
- edit: Modify existing files
- search: Search for information in the workspace
- analyze: Analyze existing code or provide insights
- respond: Provide a general response or explanation

Respond with a JSON object containing:
- type: "create" | "edit" | "search" | "analyze" | "respond"
- content: specific content or description (if applicable)
- target: target file or location (if applicable)
- reasoning: explanation of your decision

Example response:
\`\`\`json
{
  "type": "edit",
  "content": "Add error handling to the function",
  "target": "src/utils.ts",
  "reasoning": "The user wants to improve error handling in the current file"
}
\`\`\`

Be specific about the reasoning for your decision.
`;

  try {
    let fullResponse = '';
    const stream = await llm.stream(actionPrompt);
    
    for await (const chunk of stream) {
      const content = chunk.content.toString();
      fullResponse += content;
    }
    
    const jsonContent = extractJSON(fullResponse);
    
    // Try schema validation first
    const parsed = parseWithSchema(jsonContent, agentActionSchema);
    if (parsed) {
      return parsed as AgentAction;
    }
    
    // Fallback to manual parsing
    const manualParsed = JSON.parse(jsonContent);
    return {
      type: manualParsed.type || 'respond',
      content: manualParsed.content,
      target: manualParsed.target,
      reasoning: manualParsed.reasoning || 'No reasoning provided'
    } as AgentAction;
  } catch (error) {
    console.error('❌ Failed to parse action determination:', error);
    // Fallback
    return {
      type: 'respond',
      content: 'Unable to determine specific action',
      reasoning: 'Parsing failed, defaulting to respond'
    } as AgentAction;
  }
};

// Suggest file operations based on intent and context using schema validation
const suggestFileOperationImpl = async (
  llm: any,
  intent: string,
  workspaceContext: WorkspaceContext
): Promise<AgentAction> => {
  const contextStr = buildContextString(workspaceContext);
  
  const operationPrompt = `
Based on the user's intent and current workspace context, suggest the most appropriate file operation.

Workspace Context:
${contextStr}

User Intent: ${intent}

Determine the best file operation (create, edit, delete, read) and provide specific details about:
- What type of operation should be performed
- Which file(s) should be targeted (if applicable)
- What content should be created or how files should be modified
- Clear reasoning for the suggested operation

Respond with a JSON object containing:
- type: "create" | "edit" | "delete" | "read"
- filePath: path to the target file (if applicable)
- content: content to create or modification description
- reasoning: explanation of the suggested operation

Example response:
\`\`\`json
{
  "type": "create",
  "filePath": "src/components/NewComponent.tsx",
  "content": "React component with props interface",
  "reasoning": "User wants to create a new component for the feature"
}
\`\`\`

Consider the existing project structure, current files, and any errors that need to be addressed.
`;

  try {
    let fullResponse = '';
    const stream = await llm.stream(operationPrompt);
    
    for await (const chunk of stream) {
      const content = chunk.content.toString();
      fullResponse += content;
    }
    
    const jsonContent = extractJSON(fullResponse);
    
    // Try schema validation first
    const parsed = parseWithSchema(jsonContent, fileOperationSchema);
    if (parsed) {
      return {
        type: parsed.type,
        content: parsed.content,
        target: parsed.filePath,
        reasoning: parsed.reasoning
      } as AgentAction;
    }
    
    // Fallback to manual parsing
    const manualParsed = JSON.parse(jsonContent);
    return {
      type: manualParsed.type || 'respond',
      content: manualParsed.content,
      target: manualParsed.filePath || manualParsed.target,
      reasoning: manualParsed.reasoning || 'No reasoning provided'
    } as AgentAction;
  } catch (error) {
    console.error('❌ Failed to parse file operation suggestion:', error);
    // Fallback
    return {
      type: 'respond',
      content: 'Unable to suggest specific file operation',
      reasoning: 'Parsing failed, manual intervention required'
    } as AgentAction;
  }
};
