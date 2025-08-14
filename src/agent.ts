import * as vscode from 'vscode';
import { 
  AgentState, 
  AgentConfig, 
  AgentRequest, 
  AgentResponse, 
  AgentAction,
  LLMService,
  FileService,
  UIService,
  Result 
} from './types';

// Agent state - kept immutable
let agentState: AgentState = {
  isActive: false,
  currentTask: null,
  workspaceFiles: [],
  config: {
    llmProvider: 'openai',
    apiKey: '',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000
  }
};

// Factory function to create agent
export const createAgent = (
  llmService: LLMService,
  fileService: FileService,
  uiService: UIService
) => ({
  start: () => startAgent(llmService, fileService, uiService),
  stop: () => stopAgent(uiService),
  processRequest: (request: AgentRequest) => 
    processAgentRequest(request, llmService, fileService, uiService),
  getState: () => agentState,
  updateConfig: (config: Partial<AgentConfig>) => updateAgentConfig(config),
  isActive: () => agentState.isActive
});

// Start the agent
const startAgent = async (
  llmService: LLMService,
  fileService: FileService,
  uiService: UIService
): Promise<Result<void>> => {
  try {
    if (agentState.isActive) {
      await uiService.showMessage('Agent is already active', 'info');
      return { success: true, data: undefined };
    }

    // Get workspace files
    const workspaceFiles = await fileService.getWorkspaceFiles();
    
    // Update state
    agentState = {
      ...agentState,
      isActive: true,
      workspaceFiles
    };

    await uiService.showMessage('AI Agent started successfully! Use Cmd+Shift+A to interact.', 'info');
    return { success: true, data: undefined };
    
  } catch (error) {
    await uiService.showMessage(`Failed to start agent: ${error}`, 'error');
    return { success: false, error: error as Error };
  }
};

// Stop the agent
const stopAgent = async (uiService: UIService): Promise<Result<void>> => {
  try {
    agentState = {
      ...agentState,
      isActive: false,
      currentTask: null
    };

    await uiService.showMessage('AI Agent stopped', 'info');
    return { success: true, data: undefined };
    
  } catch (error) {
    await uiService.showMessage(`Failed to stop agent: ${error}`, 'error');
    return { success: false, error: error as Error };
  }
};

// Process an agent request
const processAgentRequest = async (
  request: AgentRequest,
  llmService: LLMService,
  fileService: FileService,
  uiService: UIService
): Promise<AgentResponse> => {
  // Update current task
  agentState = {
    ...agentState,
    currentTask: request.prompt
  };

  try {
    // Determine the type of request and route accordingly
    const action = await determineAction(request, llmService);
    
    // Execute the action
    const result = await executeAction(action, request, llmService, fileService, uiService);
    
    // Clear current task
    agentState = {
      ...agentState,
      currentTask: null
    };

    return {
      requestId: request.id,
      action: result,
      reasoning: `Processed request: ${request.prompt}`,
      timestamp: new Date()
    };
    
  } catch (error) {
    // Clear current task on error
    agentState = {
      ...agentState,
      currentTask: null
    };

    await uiService.showMessage(`Agent error: ${error}`, 'error');
    
    return {
      requestId: request.id,
      action: {
        type: 'respond',
        content: `Error: ${error}`
      },
      reasoning: 'Failed to process request',
      timestamp: new Date()
    };
  }
};

// Determine what action to take based on the request
const determineAction = async (
  request: AgentRequest,
  llmService: LLMService
): Promise<AgentAction> => {
  const analysisPrompt = `
Analyze this user request and determine the best action to take:

Request: "${request.prompt}"

Available actions:
- search: Search for specific code patterns or functionality
- edit: Modify existing files
- create: Create new files
- analyze: Analyze existing code
- respond: Provide a text response

Respond with a JSON object containing:
- type: one of the action types above
- reasoning: why you chose this action

Be specific and actionable.
`;

  try {
    const response = await llmService.generateResponse(analysisPrompt, request.context);
    const parsed = JSON.parse(response);
    
    return {
      type: parsed.type || 'respond',
      content: parsed.content,
      reasoning: parsed.reasoning || 'Determined action based on request analysis'
    };
  } catch {
    // Fallback to simple keyword analysis
    return analyzeRequestKeywords(request.prompt);
  }
};

// Simple keyword-based action determination
const analyzeRequestKeywords = (prompt: string): AgentAction => {
  const lowerPrompt = prompt.toLowerCase();
  
  if (lowerPrompt.includes('search') || lowerPrompt.includes('find')) {
    return { type: 'search', reasoning: 'Request contains search keywords' };
  }
  
  if (lowerPrompt.includes('edit') || lowerPrompt.includes('modify') || lowerPrompt.includes('change')) {
    return { type: 'edit', reasoning: 'Request contains edit keywords' };
  }
  
  if (lowerPrompt.includes('create') || lowerPrompt.includes('new') || lowerPrompt.includes('add')) {
    return { type: 'create', reasoning: 'Request contains creation keywords' };
  }
  
  if (lowerPrompt.includes('analyze') || lowerPrompt.includes('review') || lowerPrompt.includes('explain')) {
    return { type: 'analyze', reasoning: 'Request contains analysis keywords' };
  }
  
  return { type: 'respond', reasoning: 'Default to response action' };
};

// Execute the determined action
const executeAction = async (
  action: AgentAction,
  request: AgentRequest,
  llmService: LLMService,
  fileService: FileService,
  uiService: UIService
): Promise<AgentAction> => {
  switch (action.type) {
    case 'search':
      return await executeSearchAction(request, fileService, uiService);
    
    case 'edit':
      return await executeEditAction(request, llmService, fileService, uiService);
    
    case 'create':
      return await executeCreateAction(request, llmService, fileService, uiService);
    
    case 'analyze':
      return await executeAnalyzeAction(request, llmService, fileService, uiService);
    
    default:
      return await executeResponseAction(request, llmService, uiService);
  }
};

// Execute search action
const executeSearchAction = async (
  request: AgentRequest,
  fileService: FileService,
  uiService: UIService
): Promise<AgentAction> => {
  await uiService.showProgress(async (progress) => {
    progress.report({ message: 'Searching workspace files...' });
    
    // Extract search terms from the request
    const searchTerms = extractSearchTerms(request.prompt);
    const results = await fileService.searchInFiles(searchTerms);
    
    if (results.length === 0) {
      await uiService.showMessage('No results found for your search', 'info');
    } else {
      // Show results to user
      await uiService.showMessage(`Found ${results.length} matches`, 'info');
      
      // Optionally open the first result
      if (results.length > 0) {
        await fileService.openFile(results[0].filePath);
      }
    }
  });

  return {
    type: 'search',
    content: `Searched for: ${request.prompt}`,
    reasoning: 'Completed search operation'
  };
};

// Execute edit action
const executeEditAction = async (
  request: AgentRequest,
  llmService: LLMService,
  fileService: FileService,
  uiService: UIService
): Promise<AgentAction> => {
  // Ask user to select file to edit
  const files = await fileService.getWorkspaceFiles();
  const fileItems = files.slice(0, 20).map(file => ({
    label: file.split('/').pop() || file,
    description: file,
    value: file
  }));

  const selectedFile = await uiService.showQuickPick(fileItems, {
    title: 'Select file to edit',
    placeHolder: 'Choose the file you want to modify'
  });

  if (!selectedFile) {
    return {
      type: 'respond',
      content: 'No file selected for editing',
      reasoning: 'User cancelled file selection'
    };
  }

  // Read the file and get AI suggestions
  const fileContent = await fileService.readFile(selectedFile.value);
  const editSuggestion = await llmService.suggestEdits(fileContent, request.prompt);

  // Apply the edit if it contains content
  if (editSuggestion.content) {
    await fileService.openFile(selectedFile.value);
    await uiService.showMessage('File opened for review. Please apply suggested changes manually.', 'info');
  }

  return editSuggestion;
};

// Execute create action
const executeCreateAction = async (
  request: AgentRequest,
  llmService: LLMService,
  fileService: FileService,
  uiService: UIService
): Promise<AgentAction> => {
  // Get file path from user
  const filePath = await uiService.showInputBox({
    title: 'Create new file',
    prompt: 'Enter the path for the new file (relative to workspace)',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'File path is required';
      }
      return undefined;
    }
  });

  if (!filePath) {
    return {
      type: 'respond',
      content: 'No file path provided',
      reasoning: 'User cancelled file creation'
    };
  }

  // Generate file content using AI
  const prompt = `Create file content for: ${filePath}\nUser request: ${request.prompt}`;
  const content = await llmService.generateResponse(prompt, request.context);

  try {
    // Create the file
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder found');
    }

    const fullPath = `${workspaceFolder.uri.fsPath}/${filePath}`;
    await fileService.writeFile(fullPath, content);
    await fileService.openFile(fullPath);

    await uiService.showMessage(`Created file: ${filePath}`, 'info');

    return {
      type: 'create',
      target: fullPath,
      content: content,
      reasoning: 'Successfully created new file'
    };
  } catch (error) {
    await uiService.showMessage(`Failed to create file: ${error}`, 'error');
    return {
      type: 'respond',
      content: `Error creating file: ${error}`,
      reasoning: 'File creation failed'
    };
  }
};

// Execute analyze action
const executeAnalyzeAction = async (
  request: AgentRequest,
  llmService: LLMService,
  fileService: FileService,
  uiService: UIService
): Promise<AgentAction> => {
  // Get current active editor or ask user to select file
  const activeEditor = vscode.window.activeTextEditor;
  let targetFile: string;
  let content: string;

  if (activeEditor) {
    targetFile = activeEditor.document.fileName;
    content = activeEditor.document.getText();
  } else {
    // Ask user to select file
    const files = await fileService.getWorkspaceFiles();
    const fileItems = files.slice(0, 20).map(file => ({
      label: file.split('/').pop() || file,
      description: file,
      value: file
    }));

    const selectedFile = await uiService.showQuickPick(fileItems, {
      title: 'Select file to analyze',
      placeHolder: 'Choose the file you want to analyze'
    });

    if (!selectedFile) {
      return {
        type: 'respond',
        content: 'No file selected for analysis',
        reasoning: 'User cancelled file selection'
      };
    }

    targetFile = selectedFile.value;
    content = await fileService.readFile(targetFile);
  }

  // Analyze the code
  const analysis = await llmService.analyzeCode(content, request.prompt);
  
  // Show analysis result
  await uiService.showMessage('Code analysis complete. Check output for details.', 'info');

  return {
    type: 'analyze',
    target: targetFile,
    content: analysis,
    reasoning: 'Completed code analysis'
  };
};

// Execute response action
const executeResponseAction = async (
  request: AgentRequest,
  llmService: LLMService,
  uiService: UIService
): Promise<AgentAction> => {
  const response = await llmService.generateResponse(request.prompt, request.context);
  await uiService.showMessage(response, 'info');

  return {
    type: 'respond',
    content: response,
    reasoning: 'Generated AI response'
  };
};

// Update agent configuration
const updateAgentConfig = (config: Partial<AgentConfig>): void => {
  agentState = {
    ...agentState,
    config: {
      ...agentState.config,
      ...config
    }
  };
};

// Utility functions
const extractSearchTerms = (prompt: string): string => {
  // Simple extraction - in a real implementation, this could be more sophisticated
  const words = prompt.toLowerCase().split(' ');
  const stopWords = ['search', 'find', 'for', 'the', 'a', 'an', 'in', 'on', 'at'];
  return words.filter(word => !stopWords.includes(word)).join('|');
};

// Export getter for current state
export const getAgentState = (): AgentState => agentState;
