import * as vscode from 'vscode';
import { createConfigManager } from './configManager';

export class WebviewManager implements vscode.WebviewViewProvider {
	public static readonly viewType = 'avior.webview';
	private readonly _extensionUri: vscode.Uri;
	private readonly _context: vscode.ExtensionContext;
	private _view?: vscode.WebviewView;
	private _agentInstance: any = null;

	constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
		this._extensionUri = extensionUri;
		this._context = context;
	}

	public setAgentInstance(agentInstance: any) {
		this._agentInstance = agentInstance;
	}

	public notifyAgentReady() {
		if (this._view) {
			this._view.webview.postMessage({
				command: 'agentReady'
			});
		}
	}

	private requiresActionProcessing(text: string): boolean {
		const lowerText = text.toLowerCase();
		const actionKeywords = [
			'create', 'new', 'add', 'generate',
			'edit', 'modify', 'change', 'update', 'refactor',
			'search', 'find', 'look for', 'locate',
			'analyze', 'review', 'explain', 'check'
		];
		
		return actionKeywords.some(keyword => lowerText.includes(keyword));
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;
		
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist')
			]
		};

		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

		// Handle messages from webview
		webviewView.webview.onDidReceiveMessage(
			async (data) => {
				switch (data.command) {
					case 'webviewReady':
						// If agent is already initialized, notify webview
						if (this._agentInstance) {
							this.notifyAgentReady();
						}
						break;
					case 'getConfig':
						await this.sendCurrentConfig();
						break;
					case 'saveConfig':
					case 'updateConfig':
						await this.saveConfiguration(data.config);
						break;
					case 'sendMessage':
						await this.handleChatMessage(data.text);
						break;
					case 'clearChat':
						await this.handleClearChat();
						break;
				}
			}
		);

		// Send initial config when webview loads
		this.sendCurrentConfig();
	}

	private async sendCurrentConfig() {
		if (!this._view) {
			return;
		}

		try {
			const configManager = createConfigManager(this._context);
			const config = await configManager.getConfig();
			
			// Send config data to webview
			this._view.webview.postMessage({
				command: 'configData',
				config: config
			});
		} catch (error) {
			console.error('Failed to get config:', error);
		}
	}

	private async saveConfiguration(config: any) {
		if (!this._view) {
			return;
		}

		try {
			const configManager = createConfigManager(this._context);
			await configManager.updateConfig(config);
			
			this._view.webview.postMessage({
				command: 'configSaved',
				success: true
			});
			
			vscode.window.showInformationMessage('Configuration saved successfully!');
		} catch (error) {
			console.error('Failed to save config:', error);
			
			const errorMessage = error instanceof Error ? error.message : String(error);
			
			this._view.webview.postMessage({
				command: 'configSaved',
				success: false,
				error: errorMessage
			});
			
			vscode.window.showErrorMessage(`Failed to save configuration: ${errorMessage}`);
		}
	}

	private async handleChatMessage(text: string) {
		if (!this._view) {
			return;
		}

		try {
			// Check if agent instance exists
			if (!this._agentInstance) {
				this._view.webview.postMessage({
					command: 'removeThinking'
				});
				
				this._view.webview.postMessage({
					command: 'addMessage',
					message: {
						role: 'assistant',
						content: '⚠️ Agent is not initialized. Please reload VS Code or check the extension configuration.',
						timestamp: new Date().toISOString(),
						isThinking: false
					}
				});
				return;
			}

			// Create agent request
			const request = {
				id: Date.now().toString(),
				prompt: text,
				timestamp: new Date(),
				context: []
			};

			// Check if this requires special action processing
			const needsActionProcessing = this.requiresActionProcessing(text);
			
			if (needsActionProcessing) {
				// Set thinking state without adding messages
				// (The App.tsx already shows thinking state from handleSendMessage)
				
				// Use full processRequest for file operations
				const response = await this._agentInstance.processRequest(request);
				
				// Remove thinking indicator
				this._view.webview.postMessage({
					command: 'removeThinking'
				});
				
				// Use the content from the agent's response (which is already nicely formatted)
				const responseContent = response.action.content || `${response.action.type} action completed: ${response.reasoning}`;
				
				// Send the response
				this._view.webview.postMessage({
					command: 'addMessage',
					message: {
						role: 'assistant',
						content: responseContent,
						timestamp: new Date().toISOString(),
						isThinking: false
					}
				});
			} else {
				// Use streaming for simple responses
				// Start streaming response
				let streamingMessageId = `streaming-${Date.now()}`;
				let accumulatedContent = '';
				
				// Send initial message to show streaming has started
				this._view.webview.postMessage({
					command: 'startStreaming',
					messageId: streamingMessageId,
					message: {
						role: 'assistant',
						content: '',
						timestamp: new Date().toISOString()
					}
				});

				// Process the request with streaming
				await this._agentInstance.processRequestStream(request, (token: string) => {
					accumulatedContent += token;
					this._view?.webview.postMessage({
						command: 'updateStreamingMessage',
						messageId: streamingMessageId,
						content: accumulatedContent
					});
				});
				
				// Remove thinking indicator and finalize message
				this._view.webview.postMessage({
					command: 'removeThinking'
				});
				
				// Finalize streaming message
				this._view.webview.postMessage({
					command: 'finalizeStreamingMessage',
					messageId: streamingMessageId
				});
			}

		} catch (error) {
			console.error('Failed to process chat message:', error);
			
			// Remove thinking indicator
			this._view.webview.postMessage({
				command: 'removeThinking'
			});
			
			// Send error message
			this._view.webview.postMessage({
				command: 'addMessage',
				message: {
					role: 'assistant',
					content: `❌ Error processing your request: ${error instanceof Error ? error.message : String(error)}`,
					timestamp: new Date().toISOString(),
					isThinking: false
				}
			});
		}
	}

	private async handleClearChat() {
		if (!this._view) {
			return;
		}

		try {
			// Send clear chat command to webview to confirm the action
			this._view.webview.postMessage({
				command: 'chatCleared'
			});
			
			// Optional: Also reset any agent state if needed
			// This could include clearing context, conversation history, etc.
			if (this._agentInstance && this._agentInstance.clearSession) {
				await this._agentInstance.clearSession();
			}
			
			console.log('Chat session cleared successfully');
		} catch (error) {
			console.error('Failed to clear chat:', error);
		}
	}

	private getHtmlForWebview(webview: vscode.Webview): string {
		try {
			console.log('WebviewManager: Loading React application');
			const distPath = vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist');
			const htmlPath = vscode.Uri.joinPath(distPath, 'index.html');
			
			console.log('WebviewManager: HTML path:', htmlPath.fsPath);
			
			// Check if file exists
			const fs = require('fs');
			if (!fs.existsSync(htmlPath.fsPath)) {
				console.error('WebviewManager: HTML file does not exist:', htmlPath.fsPath);
				return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Avior AI Agent</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
    </style>
</head>
<body>
    <h1>Error: React build not found</h1>
    <p>Please run: cd webview && npm run build</p>
</body>
</html>`;
			}
			
			// Read the HTML file
			const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');
			console.log('WebviewManager: Read HTML content, length:', htmlContent.length);
			
			// Get webview URIs for assets
			const assetsPath = vscode.Uri.joinPath(distPath, 'assets');
			const assetsUri = webview.asWebviewUri(assetsPath);
			
			console.log('WebviewManager: Assets URI:', assetsUri.toString());
			
			// Replace asset paths with webview URIs
			const updatedHtml = htmlContent
				.replace(/\/assets\//g, `${assetsUri}/`)
				.replace(/<script[^>]*crossorigin[^>]*>/g, (match: string) => {
					return match.replace(' crossorigin', '');
				})
				.replace('</head>', `
    <script>
        // Prevent multiple VS Code API acquisitions
        if (typeof window.acquireVsCodeApi === 'function' && !window.vscodeApi) {
            window.vscodeApi = window.acquireVsCodeApi();
        }
    </script>
</head>`);
			
			console.log('WebviewManager: HTML processing complete');
			return updatedHtml;
		} catch (error) {
			console.error('WebviewManager: Error generating HTML:', error);
			return `<html><body><h1>Error loading webview</h1><p>${error}</p></body></html>`;
		}
	}
}
