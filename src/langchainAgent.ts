import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createAgentTools } from './tools';
import { FileService, UIService, AgentConfig } from './types';

/**
 * LangChain Agent Service for VS Code Extension
 * This service creates and manages a LangChain agent with tools for file operations
 */

export class LangChainAgentService {
  private agentExecutor: AgentExecutor | null = null;
  private config: AgentConfig;
  private fileService: FileService;
  private uiService: UIService;

  constructor(config: AgentConfig, fileService: FileService, uiService: UIService) {
    this.config = config;
    this.fileService = fileService;
    this.uiService = uiService;
  }

  /**
   * Initialize the LangChain agent with tools
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing LangChain agent...');
      
      // Create LLM based on provider
      const llm = this.createLLM();
      
      // Create tools
      const tools = createAgentTools(this.fileService, this.uiService);
      console.log(`🔧 Created ${tools.length} tools:`, tools.map(t => t.name));

      // Create prompt template
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", this.getSystemPrompt()],
        ["human", "{input}"],
        ["placeholder", "{agent_scratchpad}"],
      ]);

      // Create the agent
      const agent = await createToolCallingAgent({
        llm,
        tools,
        prompt,
      });

      // Create agent executor
      this.agentExecutor = new AgentExecutor({
        agent,
        tools,
        verbose: true,
        maxIterations: 3, // Limit iterations to prevent infinite loops
        returnIntermediateSteps: true
      });

      console.log('✅ LangChain agent initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize LangChain agent:', error);
      throw error;
    }
  }

  /**
   * Process a user request using the LangChain agent
   */
  async processRequest(input: string): Promise<string> {
    if (!this.agentExecutor) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    try {
      console.log('🤖 Processing request with LangChain agent:', input);
      
      const result = await this.agentExecutor.invoke({
        input: input
      });

      console.log('✅ Agent execution completed');
      console.log('📤 Agent output:', result.output);

      return result.output || 'No output generated';
    } catch (error) {
      console.error('❌ Agent execution failed:', error);
      return `Error: ${error}`;
    }
  }

  /**
   * Create LLM instance based on configuration
   */
  private createLLM() {
    const { llmProvider, apiKey, model, temperature, maxTokens } = this.config;

    switch (llmProvider) {
      case 'openai':
        return new ChatOpenAI({
          openAIApiKey: apiKey,
          modelName: model,
          temperature: temperature,
          maxTokens: maxTokens,
        });

      case 'anthropic':
        return new ChatAnthropic({
          anthropicApiKey: apiKey,
          modelName: model,
          temperature: temperature,
          maxTokens: maxTokens,
        });

      case 'openai-compatible':
        return new ChatOpenAI({
          openAIApiKey: apiKey,
          modelName: model,
          temperature: temperature,
          maxTokens: maxTokens,
          configuration: {
            baseURL: this.config.apiEndpoint,
          },
        });

      default:
        throw new Error(`Unsupported LLM provider: ${llmProvider}`);
    }
  }

  /**
   * Get system prompt for the agent
   */
  private getSystemPrompt(): string {
    return `You are an AI coding assistant integrated into VS Code. You have access to tools that let you:

1. **create_file**: Create new files with specified names and content
2. **edit_file**: Modify existing files 
3. **search_files**: Search for code patterns in the workspace
4. **analyze_code**: Analyze existing code files
5. **get_file_content**: Read file contents
6. **respond_to_user**: Provide text responses

**IMPORTANT GUIDELINES:**

**For File Creation:**
- When creating files, extract the filename from user requests or LLM responses
- If you see content like "// my-file.js" at the start, use "my-file.js" as the filename
- Always include the appropriate file extension (.js, .ts, .tsx, .css, .html, etc.)
- Provide clean code content without markdown formatting

**For Tool Usage:**
- Always provide tool inputs as valid JSON
- Include all required parameters for each tool
- Use descriptive filenames that match the user's intent

**Examples:**

User: "Create a simple JavaScript file called my-script.js"
→ Use create_file with: {"fileName": "my-script.js", "content": "console.log('Hello World!');"}

User: "Make a React component for a button"
→ Use create_file with: {"fileName": "Button.tsx", "content": "import React from 'react';\\n\\nconst Button = () => {\\n  return <button>Click me</button>;\\n};\\n\\nexport default Button;"}

Be helpful, precise, and always aim to understand what the user wants to accomplish.`;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Check if agent is initialized
   */
  isInitialized(): boolean {
    return this.agentExecutor !== null;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.agentExecutor = null;
  }
}
