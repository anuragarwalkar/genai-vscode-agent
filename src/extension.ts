import * as vscode from 'vscode';
import { createLLMService } from './llmService';
import { showConfigurationDialog, showQuickActionsMenu, logToChannel, showPluginManagementDialog, createOutputChannel } from './uiService';
import { createAgent } from './agent';
import { isConfigurationComplete, createConfigManager, initializeDefaultConfig } from './configManager';
import { createConfigWizard } from './configWizard';
import { createUIService } from './uiService';
import { createFileService } from './fileService';
import { AgentRequest } from './types';
import { WebviewManager } from './webviewManager';

let outputChannel: vscode.OutputChannel;
let agentInstance: any = null;
let pluginManager: any = null;
let webviewProvider: WebviewManager | null = null;

export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "ai-agent" is now active!');
	outputChannel = createOutputChannel('Avior AI Agent');

	// Initialize default configuration
	initializeDefaultConfig(context);

	// Create services
	const configManager = createConfigManager(context);
	const uiService = createUIService();
	const fileService = createFileService();
	const configWizard = createConfigWizard(context);

	// Register the webview provider
	console.log('Registering webview provider...');
	webviewProvider = new WebviewManager(context.extensionUri, context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(WebviewManager.viewType, webviewProvider)
	);
	console.log('Webview provider registered successfully');

	// Register commands
	const disposable = vscode.commands.registerCommand('avior.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from ai-agent!');
	});

	// Register configuration wizard commands
	const configureCommand = vscode.commands.registerCommand('avior.configure', async () => {
		await configWizard.showConfigurationWizard();
	});

	const selectProviderCommand = vscode.commands.registerCommand('avior.selectProvider', async () => {
		await configWizard.showProviderSelection();
	});

	const viewConfigCommand = vscode.commands.registerCommand('avior.viewConfig', async () => {
		await configWizard.showCurrentConfig();
	});

	// Register agent commands
	const askAgentCommand = vscode.commands.registerCommand('avior.askAgent', async () => {
		await askAgent(uiService, context);
	});

	// Register LangChain command
	const initLangChainCommand = vscode.commands.registerCommand('avior.initLangChain', async () => {
		await initializeLangChain(uiService);
	});

	// Auto-start the agent when extension activates (non-blocking)
	startAgent(configManager, fileService, uiService, context).catch(error => {
		console.error('Failed to start agent during activation:', error);
	});

	context.subscriptions.push(
		disposable,
		configureCommand,
		selectProviderCommand,
		viewConfigCommand,
		askAgentCommand,
		initLangChainCommand
	);
}

// Start the agent
async function startAgent(
	configManager: any,
	fileService: any,
	uiService: any,
	context: vscode.ExtensionContext
) {
	try {
		if (agentInstance?.isActive()) {
			await uiService.showMessage('Agent is already running', 'info');
			return;
		}

		// Get configuration
		let config = await configManager.getConfig();

		// If configuration is incomplete, set defaults instead of showing dialog
		if (!isConfigurationComplete(config)) {
			// Set default configuration instead of prompting user
			await configManager.updateConfig({
				llmProvider: 'openai',
				apiKey: '', // User can configure later via UI
				model: 'gpt-4',
				temperature: 0.7,
				maxTokens: 2000
			});

			config = await configManager.getConfig();
			logToChannel(outputChannel, 'Using default configuration - user can update via UI');
		}

		// Create LLM service
		const llmServiceResult = createLLMService(config);
		if (!llmServiceResult.success) {
			await uiService.showMessage(`Failed to initialize LLM service: ${llmServiceResult.error}`, 'error');
			return;
		}

		// Create agent
		agentInstance = createAgent(llmServiceResult.data, fileService, uiService);

		// Pass agent instance to webview provider
		webviewProvider?.setAgentInstance(agentInstance);

		// Start the agent
		const result = await agentInstance.start();
		if (result.success) {
			logToChannel(outputChannel, 'Agent started successfully');
			
			// Notify webview that agent is ready (with a small delay to ensure webview is loaded)
			setTimeout(() => {
				if (webviewProvider) {
					webviewProvider.notifyAgentReady();
				}
			}, 1000);
		} else {
			logToChannel(outputChannel, `Failed to start agent: ${result.error}`, 'error');
		}

	} catch (error) {
		logToChannel(outputChannel, `Error starting agent: ${error}`, 'error');
		await uiService.showMessage(`Failed to start agent: ${error}`, 'error');
	}
}

// Stop the agent
async function stopAgent(uiService: any) {
	try {
		if (!agentInstance?.isActive()) {
			await uiService.showMessage('Agent is not running', 'info');
			return;
		}

		const result = await agentInstance.stop();
		if (result.success) {
			logToChannel(outputChannel, 'Agent stopped successfully');
		} else {
			logToChannel(outputChannel, `Failed to stop agent: ${result.error}`, 'error');
		}

	} catch (error) {
		logToChannel(outputChannel, `Error stopping agent: ${error}`, 'error');
		await uiService.showMessage(`Failed to stop agent: ${error}`, 'error');
	}
}

// Ask the agent to perform a task
async function askAgent(uiService: any, context: vscode.ExtensionContext) {
	try {
		// Show quick actions menu first
		const actionType = await showQuickActionsMenu();
		if (!actionType) {
			return;
		}

		let prompt: string | undefined;

		// Get specific prompt based on action type
		switch (actionType) {
			case 'search':
				prompt = await uiService.showInputBox({
					title: 'Search Code',
					prompt: 'What functionality are you looking for?',
					placeHolder: 'e.g., authentication, database connection, error handling'
				});
				break;

			case 'edit':
				prompt = await uiService.showInputBox({
					title: 'Edit Request',
					prompt: 'What changes would you like to make?',
					placeHolder: 'e.g., add error handling, refactor function, fix bug'
				});
				break;

			case 'create':
				prompt = await uiService.showInputBox({
					title: 'Create File',
					prompt: 'What file would you like to create?',
					placeHolder: 'e.g., create a new React component, add utility function'
				});
				break;

			case 'analyze':
				prompt = await uiService.showInputBox({
					title: 'Code Analysis',
					prompt: 'What would you like to analyze?',
					placeHolder: 'e.g., check for security issues, review performance, explain logic'
				});
				break;

			case 'plugins':
				await managePlugins(uiService, context);
				return;

			case 'config': {
				const configResult = await showConfigurationDialog();
				if (configResult) {
					await uiService.showMessage('Configuration updated successfully', 'info');
				}
				return;
			}

			default:
				prompt = await uiService.showInputBox({
					title: 'Ask AI Agent',
					prompt: 'What would you like the agent to do?',
					placeHolder: 'Describe your request in natural language...'
				});
		}

		if (!prompt) {
			return;
		}

		// Create agent request
		const request: AgentRequest = {
			id: Date.now().toString(),
			prompt: prompt,
			timestamp: new Date(),
			context: [] // Could be enhanced to include current file context
		};

		// Process the request
		logToChannel(outputChannel, `Processing request: ${prompt}`);
		const response = await agentInstance.processRequest(request);
		
		logToChannel(outputChannel, `Agent response: ${response.action.type} - ${response.reasoning}`);

	} catch (error) {
		logToChannel(outputChannel, `Error processing agent request: ${error}`, 'error');
		await uiService.showMessage(`Failed to process request: ${error}`, 'error');
	}
}

// Manage plugins
async function managePlugins(uiService: any, context: vscode.ExtensionContext) {
	try {
		const plugins = pluginManager.listPlugins();
		const pluginItems = buildPluginItems(plugins);

		if (pluginItems.length === 0) {
			await uiService.showMessage('No plugins available', 'info');
			return;
		}

		await handlePluginSelection(pluginItems, uiService, context);

	} catch (error) {
		logToChannel(outputChannel, `Error managing plugins: ${error}`, 'error');
		await uiService.showMessage(`Failed to manage plugins: ${error}`, 'error');
	}
}

// Helper function to build plugin items
function buildPluginItems(plugins: any[]) {
	return plugins.map((plugin: any) => ({
		id: plugin.id,
		name: plugin.name,
		description: plugin.description,
		enabled: pluginManager.getPluginRegistry().enabledPlugins.has(plugin.id)
	}));
}

// Helper function to handle plugin selection and toggle
async function handlePluginSelection(pluginItems: any[], uiService: any, context: vscode.ExtensionContext) {
	const selectedPluginId = await showPluginManagementDialog(pluginItems);

	if (!selectedPluginId) {
		return;
	}

	const wasEnabled = pluginItems.find((p: any) => p.id === selectedPluginId)?.enabled;
	const success = wasEnabled 
		? await pluginManager.disablePlugin(selectedPluginId)
		: await pluginManager.enablePlugin(selectedPluginId, context);

	const action = wasEnabled ? 'disabled' : 'enabled';
	const message = success ? `Plugin ${action} successfully` : `Failed to ${action.slice(0, -1)} plugin`;
	
	await uiService.showMessage(message, success ? 'info' : 'error');
	logToChannel(outputChannel, `Plugin ${selectedPluginId} ${action}`);
}

// Initialize LangChain agent
async function initializeLangChain(uiService: any) {
	try {
		if (!agentInstance) {
			await uiService.showMessage('Agent not started. Please start the agent first.', 'error');
			return;
		}

		await uiService.showMessage('Initializing LangChain agent...', 'info');
		const result = await agentInstance.useLangChain();
		
		if (result.success) {
			await uiService.showMessage('LangChain agent is now active! Your agent will use structured tools for better reliability.', 'info');
		} else {
			await uiService.showMessage(`Failed to initialize LangChain: ${result.error}`, 'error');
		}
	} catch (error) {
		await uiService.showMessage(`Error initializing LangChain: ${error}`, 'error');
	}
}

export function deactivate() {
	
	if (agentInstance?.isActive()) {
		agentInstance.stop();
	}
	
	// Cleanup plugins
	if (pluginManager) {
		const enabledPlugins = pluginManager.getEnabledPlugins();
		enabledPlugins.forEach(async (plugin: any) => {
			await pluginManager.disablePlugin(plugin.id);
		});
	}
	
}
