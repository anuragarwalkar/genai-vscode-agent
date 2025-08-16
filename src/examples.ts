import { createLLMService } from './llmService';
import { createContextBuilder, parseContextCommands } from './contextBuilder';
import { AgentConfig } from './types';

/**
 * Example usage of the enhanced LLM service with Cline-style context management
 */

// Example configuration
const config: AgentConfig = {
  llmProvider: 'openai',
  apiKey: 'your-api-key-here',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000
};

/**
 * Example: Basic context-aware chat
 */
export async function exampleContextAwareChat() {
  const llmResult = createLLMService(config);
  
  if (!llmResult.success) {
    console.error('Failed to create LLM service:', llmResult.error);
    return;
  }
  
  const llm = llmResult.data;
  
  // Build context
  const contextBuilder = createContextBuilder();
  await contextBuilder.addFile('src/llmService.ts');
  await contextBuilder.addProblems();
  await contextBuilder.addSelection();
  const context = await contextBuilder.build();
  
  // Generate context-aware response
  const response = await llm.generateContextAwareResponse(
    'Analyze the current file and suggest improvements',
    context
  );
  
  console.log('Response:', response);
}

/**
 * Example: Handle user input with Cline-style commands
 */
export async function exampleHandleUserInput(userInput: string) {
  const llmResult = createLLMService(config);
  
  if (!llmResult.success) {
    console.error('Failed to create LLM service:', llmResult.error);
    return;
  }
  
  const llm = llmResult.data;
  
  // Parse Cline-style commands from user input
  const { commands, cleanPrompt } = parseContextCommands(userInput);
  
  // Build context based on commands
  let contextBuilder = createContextBuilder();
  
  for (const command of commands) {
    switch (command.type) {
      case 'file':
        contextBuilder = await contextBuilder.addFile(command.value);
        break;
      case 'folder':
        contextBuilder = await contextBuilder.addFolder(command.value);
        break;
      case 'problems':
        contextBuilder = await contextBuilder.addProblems();
        break;
      case 'url':
        contextBuilder = await contextBuilder.addUrl(command.value);
        break;
    }
  }
  
  const context = await contextBuilder.build();
  
  // Determine what action to take
  const action = await llm.determineAction(cleanPrompt, context);
  
  console.log('Determined action:', action);
  
  // Execute based on action type
  switch (action.type) {
    case 'create':
      const fileOp = await llm.suggestFileOperation(cleanPrompt, context);
      console.log('File operation suggestion:', fileOp);
      break;
      
    case 'edit':
      if (context.currentFile) {
        const editSuggestion = await llm.suggestEdits(
          context.files.find(f => f.type === 'file')?.content || '',
          cleanPrompt
        );
        console.log('Edit suggestion:', editSuggestion);
      }
      break;
      
    case 'analyze':
    case 'respond':
    default:
      const response = await llm.generateContextAwareResponse(cleanPrompt, context);
      console.log('Response:', response);
      break;
  }
}

/**
 * Example: Streaming response with context
 */
export async function exampleStreamingResponse() {
  const llmResult = createLLMService(config);
  
  if (!llmResult.success) {
    console.error('Failed to create LLM service:', llmResult.error);
    return;
  }
  
  const llm = llmResult.data;
  
  const contextBuilder = createContextBuilder();
  await contextBuilder.addFile('package.json');
  await contextBuilder.addFolder('src');
  await contextBuilder.addProblems();
  const context = await contextBuilder.build();
  
  console.log('Streaming response:');
  
  await llm.generateContextAwareResponseStream(
    'Review this project structure and suggest improvements',
    context,
    (token) => {
      process.stdout.write(token); // Stream tokens as they arrive
    }
  );
  
  console.log('\nStreaming complete.');
}

/**
 * Example: Mock service usage (when no API key is provided)
 */
export async function exampleMockService() {
  const mockConfig: AgentConfig = {
    llmProvider: 'openai',
    apiKey: '', // Empty API key triggers mock service
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000
  };
  
  const llmResult = createLLMService(mockConfig);
  
  if (!llmResult.success) {
    console.error('Failed to create LLM service:', llmResult.error);
    return;
  }
  
  const llm = llmResult.data;
  
  const contextBuilder = createContextBuilder();
  await contextBuilder.addFile('src/types.ts');
  const context = await contextBuilder.build();
  
  const response = await llm.generateContextAwareResponse(
    'Explain the type definitions in this file',
    context
  );
  
  console.log('Mock response:', response);
}

/**
 * Example prompt templates for different scenarios
 */
export const promptTemplates = {
  // Cline-style context commands
  addFileAndAnalyze: '@file src/agent.ts Analyze this file for potential improvements',
  addFolderAndReview: '@folder src @problems Review the entire src folder and fix any issues',
  addUrlAndCompare: '@url https://docs.example.com/api Compare our implementation with these docs',
  
  // File operation prompts
  createNewFile: 'Create a new utility file for handling file operations',
  editExistingFile: 'Modify the current file to add error handling',
  analyzeCodeStructure: 'Analyze the project structure and suggest refactoring',
  
  // Context-aware prompts
  fixErrors: '@problems Fix all the errors in the workspace',
  improvePerformance: '@folder src Analyze performance bottlenecks and suggest optimizations',
  addFeature: '@file src/types.ts Add new interface for user preferences'
};

/**
 * Example: Process different types of prompts
 */
export async function exampleProcessPrompts() {
  const llmResult = createLLMService(config);
  
  if (!llmResult.success) {
    console.error('Failed to create LLM service:', llmResult.error);
    return;
  }
  
  const llm = llmResult.data;
  
  // Process each template
  for (const [name, prompt] of Object.entries(promptTemplates)) {
    console.log(`\n--- Processing: ${name} ---`);
    console.log(`Prompt: ${prompt}`);
    
    await exampleHandleUserInput(prompt);
  }
}
