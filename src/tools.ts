import { DynamicTool } from "langchain/tools";
import { FileService, UIService } from './types';
import * as vscode from 'vscode';

/**
 * LangChain Tools for VS Code Agent
 * These tools wrap the existing functionality to be used by LangChain agents
 */

// Tool for creating files
const createFileTool = (fileService: FileService, uiService: UIService) => 
  new DynamicTool({
    name: "create_file",
    description: "Create a new file with specified name and content. Use this when user wants to create, generate, or make a new file. Input must be JSON with 'fileName' (including extension) and 'content' properties. Example: {\"fileName\": \"my-script.js\", \"content\": \"console.log('Hello');\"}",
    func: async (input: string) => {
      try {
        console.log('🔧 CreateFile tool called with input:', input);
        const { fileName, content } = JSON.parse(input);
        
        // Get workspace folder
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          throw new Error('No workspace folder found');
        }

        const fullPath = `${workspaceFolder.uri.fsPath}/${fileName}`;
        console.log('💾 Creating file at:', fullPath);
        
        await fileService.writeFile(fullPath, content);
        await fileService.openFile(fullPath);
        await uiService.showMessage(`Created file: ${fileName}`, 'info');
        
        return `Successfully created file: ${fileName} with ${content.length} characters`;
      } catch (error) {
        console.error('❌ CreateFile tool error:', error);
        return `Error creating file: ${error}`;
      }
    }
  });

// Tool for editing files
const editFileTool = (fileService: FileService, uiService: UIService) => 
  new DynamicTool({
    name: "edit_file", 
    description: "Edit an existing file by replacing its content. Use this when user wants to modify, update, or change existing code. Input must be JSON with 'filePath' and 'content' properties. Example: {\"filePath\": \"/path/to/file.js\", \"content\": \"new content\"}",
    func: async (input: string) => {
      try {
        console.log('🔧 EditFile tool called with input:', input);
        const { filePath, content } = JSON.parse(input);
        
        await fileService.writeFile(filePath, content);
        await fileService.openFile(filePath);
        const fileName = filePath.split('/').pop() || filePath;
        await uiService.showMessage(`Updated file: ${fileName}`, 'info');
        
        return `Successfully updated file: ${filePath} with ${content.length} characters`;
      } catch (error) {
        console.error('❌ EditFile tool error:', error);
        return `Error editing file: ${error}`;
      }
    }
  });

// Tool for searching files
const searchFilesTool = (fileService: FileService, uiService: UIService) => 
  new DynamicTool({
    name: "search_files",
    description: "Search for code patterns or text in workspace files. Use this when user wants to find or locate something in the codebase. Input must be JSON with 'searchTerms' property. Example: {\"searchTerms\": \"function myFunction\"}",
    func: async (input: string) => {
      try {
        console.log('🔧 SearchFiles tool called with input:', input);
        const { searchTerms } = JSON.parse(input);
        
        const results = await fileService.searchInFiles(searchTerms);
        
        if (results.length === 0) {
          await uiService.showMessage('No results found for your search', 'info');
          return `No results found for search terms: ${searchTerms}`;
        } else {
          await uiService.showMessage(`Found ${results.length} matches`, 'info');
          
          // Open the first result if available
          if (results.length > 0) {
            await fileService.openFile(results[0].filePath);
          }
          
          // Return summary of results
          const summary = results.slice(0, 5).map(result => 
            `${result.filePath}: ${result.matches.length} matches`
          ).join(', ');
          
          return `Found ${results.length} matches for "${searchTerms}". Top results: ${summary}`;
        }
      } catch (error) {
        console.error('❌ SearchFiles tool error:', error);
        return `Error searching: ${error}`;
      }
    }
  });

// Tool for analyzing code
const analyzeCodeTool = (fileService: FileService, uiService: UIService) => 
  new DynamicTool({
    name: "analyze_code",
    description: "Analyze code in a specific file. Use this when user wants to review, explain, check, or examine code. Input must be JSON with 'filePath' and optional 'analysisType' properties. Example: {\"filePath\": \"/path/to/file.js\", \"analysisType\": \"overview\"}",
    func: async (input: string) => {
      try {
        console.log('🔧 AnalyzeCode tool called with input:', input);
        const { filePath, analysisType = 'overview' } = JSON.parse(input);
        
        const content = await fileService.readFile(filePath);
        const fileName = filePath.split('/').pop() || filePath;
        
        // Basic code analysis
        const lineCount = content.split('\n').length;
        const charCount = content.length;
        const wordCount = content.split(/\s+/).length;
        
        // Check for common patterns
        const hasImports = content.includes('import ') || content.includes('require(');
        const hasExports = content.includes('export ') || content.includes('module.exports');
        const hasFunctions = content.includes('function ') || content.includes('=>') || content.includes('def ');
        const hasClasses = content.includes('class ');
        
        const analysis = `Code analysis for ${fileName}:
- File size: ${charCount} characters, ${lineCount} lines, ${wordCount} words
- Analysis type: ${analysisType}
- Contains imports: ${hasImports}
- Contains exports: ${hasExports}
- Contains functions: ${hasFunctions}
- Contains classes: ${hasClasses}
- Programming patterns detected: ${hasImports ? 'Modular' : 'Standalone'} code`;
        
        await uiService.showMessage('Code analysis complete', 'info');
        return analysis;
      } catch (error) {
        console.error('❌ AnalyzeCode tool error:', error);
        return `Error analyzing code: ${error}`;
      }
    }
  });

// Tool for providing responses
const respondTool = (uiService: UIService) => 
  new DynamicTool({
    name: "respond_to_user",
    description: "Provide a text response to the user. Use this for general questions, explanations, or when no file operation is needed. Input must be JSON with 'response' property. Example: {\"response\": \"Hello, how can I help?\"}",
    func: async (input: string) => {
      try {
        console.log('🔧 Respond tool called with input:', input);
        const { response } = JSON.parse(input);
        await uiService.showMessage(response, 'info');
        return `Responded to user: ${response.substring(0, 100)}${response.length > 100 ? '...' : ''}`;
      } catch (error) {
        console.error('❌ Respond tool error:', error);
        return `Error responding: ${error}`;
      }
    }
  });

// Tool for getting file content (useful for analysis)
const getFileContentTool = (fileService: FileService) => 
  new DynamicTool({
    name: "get_file_content",
    description: "Read the content of a specific file. Use this when you need to examine existing code before editing or analyzing. Input must be JSON with 'filePath' property. Example: {\"filePath\": \"/path/to/file.js\"}",
    func: async (input: string) => {
      try {
        console.log('🔧 GetFileContent tool called with input:', input);
        const { filePath } = JSON.parse(input);
        
        const content = await fileService.readFile(filePath);
        const fileName = filePath.split('/').pop() || filePath;
        
        return `Content of ${fileName} (${content.length} characters):\n\n${content}`;
      } catch (error) {
        console.error('❌ GetFileContent tool error:', error);
        return `Error reading file: ${error}`;
      }
    }
  });

// Function to create all tools
export const createAgentTools = (
  fileService: FileService, 
  uiService: UIService
) => [
  createFileTool(fileService, uiService),
  editFileTool(fileService, uiService), 
  searchFilesTool(fileService, uiService),
  analyzeCodeTool(fileService, uiService),
  getFileContentTool(fileService),
  respondTool(uiService)
];

// Export individual tool creators
export {
  createFileTool,
  editFileTool,
  searchFilesTool,
  analyzeCodeTool,
  getFileContentTool,
  respondTool
};
