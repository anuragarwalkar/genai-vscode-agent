import * as vscode from 'vscode';

// Core types for the AI coding agent
export interface AgentConfig {
  readonly llmProvider: 'openai' | 'anthropic' | 'custom';
  readonly apiKey: string;
  readonly model: string;
  readonly temperature: number;
  readonly maxTokens: number;
}

export interface AgentState {
  readonly isActive: boolean;
  readonly currentTask: string | null;
  readonly workspaceFiles: ReadonlyArray<string>;
  readonly config: AgentConfig;
}

export interface FileSearchResult {
  readonly filePath: string;
  readonly matches: ReadonlyArray<{
    readonly line: number;
    readonly content: string;
    readonly context: string;
  }>;
}

export interface AgentRequest {
  readonly id: string;
  readonly prompt: string;
  readonly timestamp: Date;
  readonly context: ReadonlyArray<string>;
}

export interface AgentResponse {
  readonly requestId: string;
  readonly action: AgentAction;
  readonly reasoning: string;
  readonly timestamp: Date;
}

export interface AgentAction {
  readonly type: 'search' | 'edit' | 'create' | 'analyze' | 'respond';
  readonly target?: string;
  readonly content?: string;
  readonly position?: vscode.Position;
  readonly reasoning?: string;
}

// Plugin system types
export interface Plugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly enabled: boolean;
  readonly handler: PluginHandler;
  readonly metadata: PluginMetadata;
}

export interface PluginHandler {
  readonly activate: (context: vscode.ExtensionContext) => Promise<void>;
  readonly deactivate: () => Promise<void>;
  readonly execute: (action: string, params: Record<string, unknown>) => Promise<unknown>;
}

export interface PluginMetadata {
  readonly category: string;
  readonly tags: ReadonlyArray<string>;
  readonly commands: ReadonlyArray<string>;
  readonly dependencies: ReadonlyArray<string>;
}

export interface PluginRegistry {
  readonly plugins: ReadonlyArray<Plugin>;
  readonly enabledPlugins: ReadonlySet<string>;
}

// Service interfaces
export interface LLMService {
  readonly generateResponse: (prompt: string, context: ReadonlyArray<string>) => Promise<string>;
  readonly analyzeCode: (code: string, question: string) => Promise<string>;
  readonly suggestEdits: (code: string, intent: string) => Promise<AgentAction>;
}

export interface FileService {
  readonly readFile: (filePath: string) => Promise<string>;
  readonly writeFile: (filePath: string, content: string) => Promise<void>;
  readonly searchInFiles: (pattern: string, files?: ReadonlyArray<string>) => Promise<ReadonlyArray<FileSearchResult>>;
  readonly getWorkspaceFiles: () => Promise<ReadonlyArray<string>>;
  readonly openFile: (filePath: string) => Promise<vscode.TextEditor>;
}

export interface UIService {
  readonly showMessage: (message: string, type?: 'info' | 'warning' | 'error') => Promise<void>;
  readonly showInputBox: (options: vscode.InputBoxOptions) => Promise<string | undefined>;
  readonly showQuickPick: <T extends vscode.QuickPickItem>(items: T[], options?: vscode.QuickPickOptions) => Promise<T | undefined>;
  readonly showProgress: <T>(task: (progress: vscode.Progress<{message?: string; increment?: number}>) => Promise<T>) => Promise<T>;
}

// Utility types
export type Result<T, E = Error> = 
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;
