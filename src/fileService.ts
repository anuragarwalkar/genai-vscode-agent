import * as vscode from 'vscode';
import * as path from 'path';
import { FileService, FileSearchResult, Result } from './types';

// Factory function to create file service
export const createFileService = (): FileService => ({
  readFile: readFileContent,
  writeFile: writeFileContent,
  searchInFiles: searchInWorkspaceFiles,
  getWorkspaceFiles: getWorkspaceFileList,
  openFile: openFileInEditor
});

// Read file content
const readFileContent = async (filePath: string): Promise<string> => {
  try {
    const uri = vscode.Uri.file(filePath);
    const uint8Array = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(uint8Array).toString('utf8');
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error}`);
  }
};

// Write file content
const writeFileContent = async (filePath: string, content: string): Promise<void> => {
  try {
    const uri = vscode.Uri.file(filePath);
    const uint8Array = Buffer.from(content, 'utf8');
    await vscode.workspace.fs.writeFile(uri, uint8Array);
  } catch (error) {
    throw new Error(`Failed to write file ${filePath}: ${error}`);
  }
};

// Get all workspace files
const getWorkspaceFileList = async (): Promise<ReadonlyArray<string>> => {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return [];
  }

  const files: string[] = [];
  
  for (const folder of workspaceFolders) {
    const pattern = new vscode.RelativePattern(folder, '**/*');
    const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
    
    for (const uri of uris) {
      // Only include text files
      if (isTextFile(uri.fsPath)) {
        files.push(uri.fsPath);
      }
    }
  }

  return files;
};

// Search for pattern in files
const searchInWorkspaceFiles = async (
  pattern: string,
  files?: ReadonlyArray<string>
): Promise<ReadonlyArray<FileSearchResult>> => {
  const searchFiles = files || await getWorkspaceFileList();
  const results: FileSearchResult[] = [];

  for (const filePath of searchFiles) {
    try {
      const content = await readFileContent(filePath);
      const matches = searchInFileContent(content, pattern);
      
      if (matches.length > 0) {
        results.push({
          filePath,
          matches
        });
      }
    } catch (error) {
      // Skip files that can't be read
      console.warn(`Could not search in file ${filePath}: ${error}`);
    }
  }

  return results;
};

// Search within file content
const searchInFileContent = (
  content: string,
  pattern: string
): ReadonlyArray<{line: number; content: string; context: string}> => {
  const lines = content.split('\n');
  const matches: {line: number; content: string; context: string}[] = [];
  const regex = new RegExp(pattern, 'gi');

  lines.forEach((line, index) => {
    if (regex.test(line)) {
      const contextLines = getContextLines(lines, index, 2);
      matches.push({
        line: index + 1,
        content: line.trim(),
        context: contextLines.join('\n')
      });
    }
  });

  return matches;
};

// Get context lines around a specific line
const getContextLines = (lines: string[], targetLine: number, contextSize: number): string[] => {
  const start = Math.max(0, targetLine - contextSize);
  const end = Math.min(lines.length, targetLine + contextSize + 1);
  
  return lines.slice(start, end).map((line, index) => {
    const lineNumber = start + index + 1;
    const marker = lineNumber === targetLine + 1 ? '> ' : '  ';
    return `${marker}${lineNumber}: ${line}`;
  });
};

// Open file in editor
const openFileInEditor = async (filePath: string): Promise<vscode.TextEditor> => {
  const uri = vscode.Uri.file(filePath);
  const document = await vscode.workspace.openTextDocument(uri);
  return await vscode.window.showTextDocument(document);
};

// Check if file is a text file based on extension
const isTextFile = (filePath: string): boolean => {
  const ext = path.extname(filePath).toLowerCase();
  const textExtensions = [
    '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.c', '.cpp', '.cs', '.go',
    '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.clj', '.hs', '.ml',
    '.txt', '.md', '.json', '.xml', '.html', '.css', '.scss', '.sass',
    '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf', '.env',
    '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd'
  ];
  
  return textExtensions.includes(ext);
};

// Utility function to get relative path within workspace
export const getRelativePath = (filePath: string): string => {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return filePath;
  }

  for (const folder of workspaceFolders) {
    if (filePath.startsWith(folder.uri.fsPath)) {
      return path.relative(folder.uri.fsPath, filePath);
    }
  }

  return filePath;
};

// Apply text edits to a document
export const applyTextEdit = async (
  filePath: string,
  edit: vscode.TextEdit
): Promise<Result<void>> => {
  try {
    const editor = await openFileInEditor(filePath);
    const success = await editor.edit(editBuilder => {
      editBuilder.replace(edit.range, edit.newText);
    });

    if (success) {
      await editor.document.save();
      return { success: true, data: undefined };
    } else {
      return { success: false, error: new Error('Failed to apply edit') };
    }
  } catch (error) {
    return { success: false, error: error as Error };
  }
};

// Insert text at position
export const insertTextAtPosition = async (
  filePath: string,
  position: vscode.Position,
  text: string
): Promise<Result<void>> => {
  const edit = new vscode.TextEdit(new vscode.Range(position, position), text);
  return applyTextEdit(filePath, edit);
};

// Replace text in range
export const replaceTextInRange = async (
  filePath: string,
  range: vscode.Range,
  newText: string
): Promise<Result<void>> => {
  const edit = new vscode.TextEdit(range, newText);
  return applyTextEdit(filePath, edit);
};
