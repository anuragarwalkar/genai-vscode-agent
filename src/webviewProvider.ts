import * as vscode from 'vscode';
import { AgentConfig } from './types';

export class AviorWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'avior.chatView';
    private _view?: vscode.WebviewView;
    private _extensionContext: vscode.ExtensionContext;
    private _agentInstance: any = null;

    constructor(private readonly extensionContext: vscode.ExtensionContext) {
        console.log('AviorWebviewProvider constructor called');
        console.log('ViewType being used:', AviorWebviewProvider.viewType);
        this._extensionContext = extensionContext;
        console.log('AviorWebviewProvider constructor completed');
    }

    // Method to set agent instance from extension.ts
    public setAgentInstance(agentInstance: any) {
        this._agentInstance = agentInstance;
    }

    // Public method to check if webview is ready
    public isWebviewReady(): boolean {
        return this._view !== undefined;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        console.log('=== RESOLVING WEBVIEW VIEW ===');
        console.log('Webview view object:', webviewView);
        console.log('Context:', context);
        
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionContext.extensionUri
            ]
        };

        console.log('Setting webview HTML...');
        try {
            // Use fallback HTML first to test basic functionality
            webviewView.webview.html = this._getFallbackHtml();
            console.log('✓ Webview HTML set successfully with fallback');
        } catch (error) {
            console.error('❌ Failed to set webview HTML:', error);
            // Even simpler fallback
            webviewView.webview.html = `
                <html>
                    <body>
                        <h1>🤖 Avior AI Agent</h1>
                        <p>Extension is working!</p>
                        <button onclick="console.log('Button clicked!')">Test Button</button>
                    </body>
                </html>
            `;
        }

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            message => {
                console.log('Received message from webview:', message);
                switch (message.command) {
                    case 'sendMessage':
                        this.handleChatMessage(message.text);
                        break;
                    case 'updateConfig':
                        this.handleConfigUpdate(message.config);
                        break;
                    case 'getConfig':
                        this.sendCurrentConfig();
                        break;
                    case 'startAgent':
                        this.handleStartAgent();
                        break;
                    case 'showConfig':
                        this.handleShowConfig();
                        break;
                    case 'webviewReady':
                        this.handleWebviewReady();
                        break;
                }
            },
            undefined,
            this._extensionContext.subscriptions
        );
    }

    private async handleChatMessage(message: string) {
        // Add user message to chat
        this.addMessageToChat('user', message);
        
        // Show thinking indicator
        this.addMessageToChat('assistant', 'Thinking...', true);

        try {
            // Here we'll integrate with your existing agent logic
            const response = await this.processAgentRequest(message);
            
            // Remove thinking indicator and add response
            this.removeThinkingMessage();
            this.addMessageToChat('assistant', response);
        } catch (error) {
            this.removeThinkingMessage();
            this.addMessageToChat('assistant', `Error: ${error}`);
        }
    }

    private async processAgentRequest(message: string): Promise<string> {
        try {
            if (!this._agentInstance?.isActive?.()) {
                return "Agent is not active. Please start the agent first using the configuration panel.";
            }

            // Create agent request similar to the askAgent function
            const request = {
                id: Date.now().toString(),
                prompt: message,
                timestamp: new Date(),
                context: []
            };

            // Process the request using the actual agent
            const response = await this._agentInstance.processRequest(request);
            
            if (response?.action) {
                return `**Action**: ${response.action.type}\n\n**Result**: ${response.action.content || 'Action completed successfully'}\n\n**Reasoning**: ${response.reasoning}`;
            } else {
                return "I processed your request, but didn't receive a detailed response.";
            }
        } catch (error) {
            console.error('Error processing agent request:', error);
            return `Sorry, I encountered an error: ${error}`;
        }
    }

    private async handleStartAgent() {
        try {
            // Check if agent is already running
            if (this._agentInstance?.isActive?.()) {
                this.addMessageToChat('assistant', 'Agent is already running!');
                return;
            }

            // Show loading message
            this.addMessageToChat('assistant', 'Starting agent...', true);

            // Small delay to show the loading state
            await new Promise(resolve => setTimeout(resolve, 500));

            // Remove thinking message
            this.removeThinkingMessage();

            if (this._agentInstance) {
                this.addMessageToChat('assistant', '✅ Agent is ready! You can now chat with me. Try asking me to help with your code!');
            } else {
                this.addMessageToChat('assistant', '⚠️ Agent is starting up. Please configure your API key for full functionality.');
            }
        } catch (error) {
            this.removeThinkingMessage();
            this.addMessageToChat('assistant', `❌ Failed to start agent: ${error}`);
        }
    }

    private async handleWebviewReady() {
        // Send initial status to webview
        this.addMessageToChat('assistant', '🚀 AI Agent is ready! Configure your API key to start chatting.');
    }

    private async handleShowConfig() {
        try {
            // Send a message to show configuration panel in the webview
            this._view?.webview.postMessage({
                command: 'showConfigPanel'
            });
            
            // Also send current config
            await this.sendCurrentConfig();
            
            this.addMessageToChat('assistant', '⚙️ Configuration panel opened. Please set your API key to enable full functionality.');
        } catch (error) {
            this.addMessageToChat('assistant', `❌ Failed to open configuration: ${error}`);
        }
    }

    private async handleConfigUpdate(config: Partial<AgentConfig>) {
        try {
            // Get the config manager from the extension context
            const { createConfigManager } = await import('./configManager');
            const configManager = createConfigManager(this._extensionContext);
            
            // Update the configuration
            await configManager.updateConfig(config);
            
            vscode.window.showInformationMessage('Configuration updated successfully!');
            console.log('Config update:', config);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update configuration: ${error}`);
        }
    }

    private async sendCurrentConfig() {
        try {
            // Get current config from the extension
            const { createConfigManager } = await import('./configManager');
            const configManager = createConfigManager(this._extensionContext);
            const currentConfig = await configManager.getConfig();

            this._view?.webview.postMessage({
                command: 'configData',
                config: {
                    llmProvider: currentConfig.llmProvider || 'openai',
                    model: currentConfig.model || 'gpt-4',
                    temperature: currentConfig.temperature || 0.7,
                    maxTokens: currentConfig.maxTokens || 2000,
                    apiKey: currentConfig.apiKey ? '••••••••' : '' // Mask the API key
                }
            });
        } catch (error) {
            console.error('Error sending current config:', error);
        }
    }

    private addMessageToChat(role: 'user' | 'assistant', content: string, isThinking = false) {
        this._view?.webview.postMessage({
            command: 'addMessage',
            message: {
                role,
                content,
                isThinking,
                timestamp: new Date().toISOString()
            }
        });
    }

    private removeThinkingMessage() {
        this._view?.webview.postMessage({
            command: 'removeThinking'
        });
    }

    public addMessage(role: 'user' | 'assistant', content: string) {
        this.addMessageToChat(role, content);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        console.log('_getHtmlForWebview called');
        
        // Get URIs for the built React app assets
        const webviewUri = vscode.Uri.joinPath(this._extensionContext.extensionUri, 'webview', 'dist');
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewUri, 'assets', 'index.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewUri, 'assets', 'index.css'));
        
        const nonce = getNonce();
        
        const html = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; 
                style-src ${webview.cspSource} 'unsafe-inline'; 
                script-src 'nonce-${nonce}' ${webview.cspSource} 'unsafe-eval' 'unsafe-inline';
                connect-src ${webview.cspSource};
                img-src ${webview.cspSource} data:;">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Avior AI Agent</title>
            <link rel="stylesheet" href="${styleUri}">
        </head>
        <body>
            <div id="root"></div>
            <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
        </body>
        </html>`;
        
        console.log('Generated React app HTML with URIs:', { scriptUri: scriptUri.toString(), styleUri: styleUri.toString() });
        return html;
    }

    private _getFallbackHtml() {
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
                .container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    text-align: center;
                }
                .icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                }
                .title {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                .message {
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 16px;
                }
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">🤖</div>
                <div class="title">Avior AI Agent</div>
                <div class="message">Setting up your AI coding assistant...</div>
                <button onclick="location.reload()">Retry</button>
            </div>
        </body>
        </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
