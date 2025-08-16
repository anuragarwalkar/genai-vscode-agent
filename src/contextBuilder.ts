import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceContext, ContextItem, GitInfo, ContextBuilder } from './types';

/**
 * Context builder implementation following Cline's approach
 * Provides @file, @folder, @problems, @url functionality
 */
export class VSCodeContextBuilder implements ContextBuilder {
  private files: ContextItem[] = [];
  private errors: ContextItem[] = [];
  private workspacePath: string;
  private workspaceName: string;

  constructor() {
    const workspace = vscode.workspace.workspaceFolders?.[0];
    this.workspacePath = workspace?.uri.fsPath || '';
    this.workspaceName = workspace?.name || 'Unknown';
  }

  /**
   * Add a specific file to context (@file functionality)
   */
  async addFile(filePath: string): Promise<ContextBuilder> {
    try {
      // Resolve relative paths
      const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(this.workspacePath, filePath);

      const uri = vscode.Uri.file(absolutePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const content = document.getText();
      
      this.files.push({
        type: 'file',
        label: path.relative(this.workspacePath, absolutePath),
        content: content,
        path: absolutePath,
        metadata: {
          language: document.languageId,
          lineCount: document.lineCount,
          size: content.length
        }
      });
    } catch (error) {
      console.error(`Failed to add file ${filePath}:`, error);
      // Add error info instead
      this.errors.push({
        type: 'error',
        label: `File not found: ${filePath}`,
        content: `Unable to read file: ${error}`,
        path: filePath
      });
    }
    
    return this;
  }

  /**
   * Add all files in a folder to context (@folder functionality)
   */
  async addFolder(folderPath: string): Promise<ContextBuilder> {
    try {
      const absolutePath = path.isAbsolute(folderPath) 
        ? folderPath 
        : path.join(this.workspacePath, folderPath);

      const uri = vscode.Uri.file(absolutePath);
      const entries = await vscode.workspace.fs.readDirectory(uri);
      
      for (const [name, type] of entries) {
        if (type === vscode.FileType.File) {
          const filePath = path.join(absolutePath, name);
          // Skip binary files and large files
          if (this.shouldIncludeFile(name)) {
            await this.addFile(filePath);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to add folder ${folderPath}:`, error);
      this.errors.push({
        type: 'error',
        label: `Folder not found: ${folderPath}`,
        content: `Unable to read folder: ${error}`,
        path: folderPath
      });
    }
    
    return this;
  }

  /**
   * Add current workspace problems/errors (@problems functionality)
   */
  async addProblems(): Promise<ContextBuilder> {
    const diagnostics = vscode.languages.getDiagnostics();
    
    for (const [uri, diags] of diagnostics) {
      for (const diag of diags) {
        this.errors.push({
          type: 'error',
          label: `${path.relative(this.workspacePath, uri.fsPath)}:${diag.range.start.line + 1}`,
          content: diag.message,
          file: path.relative(this.workspacePath, uri.fsPath),
          line: diag.range.start.line + 1,
          message: diag.message,
          metadata: {
            severity: diag.severity,
            source: diag.source,
            code: diag.code
          }
        });
      }
    }
    
    return this;
  }

  /**
   * Add content from a URL (@url functionality)
   */
  async addUrl(url: string): Promise<ContextBuilder> {
    try {
      // For now, just add a placeholder - in a real implementation,
      // you'd fetch the URL content and convert to markdown
      this.files.push({
        type: 'url',
        label: `URL: ${url}`,
        content: `[Content from ${url} would be fetched here]`,
        metadata: { url }
      });
    } catch (error) {
      this.errors.push({
        type: 'error',
        label: `Failed to fetch URL: ${url}`,
        content: `Unable to fetch URL: ${error}`
      });
    }
    
    return this;
  }

  /**
   * Add current selection to context (@selection functionality)
   */
  async addSelection(): Promise<ContextBuilder> {
    const editor = vscode.window.activeTextEditor;
    if (editor && !editor.selection.isEmpty) {
      const selectedText = editor.document.getText(editor.selection);
      const filePath = editor.document.uri.fsPath;
      
      this.files.push({
        type: 'selection',
        label: `Selection from ${path.relative(this.workspacePath, filePath)}`,
        content: selectedText,
        path: filePath,
        metadata: {
          startLine: editor.selection.start.line + 1,
          endLine: editor.selection.end.line + 1,
          startChar: editor.selection.start.character,
          endChar: editor.selection.end.character
        }
      });
    }
    
    return this;
  }

  /**
   * Build the final workspace context
   */
  async build(): Promise<WorkspaceContext> {
    const fileCount = await this.getWorkspaceFileCount();
    const languages = await this.getWorkspaceLanguages();
    const gitInfo = await this.getGitInfo();
    
    // Get current file info
    const editor = vscode.window.activeTextEditor;
    const currentFile = editor 
      ? path.relative(this.workspacePath, editor.document.uri.fsPath)
      : undefined;
    
    // Get selected text
    const selectedText = editor && !editor.selection.isEmpty
      ? editor.document.getText(editor.selection)
      : undefined;

    return {
      files: this.files,
      errors: this.errors,
      selectedText,
      currentFile,
      workspaceInfo: {
        name: this.workspaceName,
        path: this.workspacePath,
        fileCount,
        languages
      },
      gitInfo
    };
  }

  /**
   * Helper method to determine if a file should be included
   */
  private shouldIncludeFile(fileName: string): boolean {
    const excludePatterns = [
      /\.git/,
      /node_modules/,
      /\.vsix$/,
      /\.png$/,
      /\.jpg$/,
      /\.jpeg$/,
      /\.gif$/,
      /\.svg$/,
      /\.ico$/,
      /\.pdf$/,
      /\.zip$/,
      /\.tar$/,
      /\.gz$/
    ];
    
    return !excludePatterns.some(pattern => pattern.test(fileName));
  }

  /**
   * Get total file count in workspace
   */
  private async getWorkspaceFileCount(): Promise<number> {
    try {
      const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
      return files.length;
    } catch {
      return 0;
    }
  }

  /**
   * Get programming languages used in workspace
   */
  private async getWorkspaceLanguages(): Promise<string[]> {
    try {
      const files = await vscode.workspace.findFiles('**/*.{ts,js,py,java,cpp,c,cs,php,rb,go,rs,swift}', '**/node_modules/**');
      const languages = new Set<string>();
      
      for (const file of files) {
        const ext = path.extname(file.fsPath).toLowerCase();
        const langMap: Record<string, string> = {
          '.ts': 'TypeScript',
          '.js': 'JavaScript',
          '.py': 'Python',
          '.java': 'Java',
          '.cpp': 'C++',
          '.c': 'C',
          '.cs': 'C#',
          '.php': 'PHP',
          '.rb': 'Ruby',
          '.go': 'Go',
          '.rs': 'Rust',
          '.swift': 'Swift'
        };
        
        if (langMap[ext]) {
          languages.add(langMap[ext]);
        }
      }
      
      return Array.from(languages);
    } catch {
      return [];
    }
  }

  /**
   * Get Git repository information
   */
  private async getGitInfo(): Promise<GitInfo | undefined> {
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
      if (!gitExtension) {
        return undefined;
      }

      const api = gitExtension.getAPI(1);
      if (!api || api.repositories.length === 0) {
        return undefined;
      }

      const repo = api.repositories[0];
      const branch = repo.state.HEAD?.name || 'unknown';
      const repository = path.basename(repo.rootUri.fsPath);
      
      // Get changed files
      const changes = repo.state.workingTreeChanges || [];
      const changedFiles = changes.map((change: any) => 
        path.relative(this.workspacePath, change.uri.fsPath)
      );

      return {
        branch,
        repository,
        changedFiles
      };
    } catch {
      return undefined;
    }
  }
}

/**
 * Factory function to create a new context builder
 */
export function createContextBuilder(): ContextBuilder {
  return new VSCodeContextBuilder();
}

/**
 * Utility function to parse Cline-style context commands
 * @param input User input that may contain @file, @folder, etc.
 * @returns Object with parsed commands and cleaned prompt
 */
export function parseContextCommands(input: string): {
  commands: Array<{ type: string; value: string }>;
  cleanPrompt: string;
} {
  const commands: Array<{ type: string; value: string }> = [];
  let cleanPrompt = input;

  // Match @file, @folder, @problems, @url patterns
  const patterns = [
    { type: 'file', regex: /@file\s+([^\s]+)/g },
    { type: 'folder', regex: /@folder\s+([^\s]+)/g },
    { type: 'problems', regex: /@problems/g },
    { type: 'url', regex: /@url\s+(https?:\/\/[^\s]+)/g }
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.regex.exec(input)) !== null) {
      commands.push({
        type: pattern.type,
        value: match[1] || '' // Some commands like @problems don't have values
      });
      
      // Remove the command from the prompt
      cleanPrompt = cleanPrompt.replace(match[0], '').trim();
    }
  }

  return { commands, cleanPrompt };
}
