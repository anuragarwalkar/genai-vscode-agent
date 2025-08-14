import * as vscode from 'vscode';
import { createLLMService } from './llmService';
import { createFileService } from './fileService';
import { createUIService, showConfigurationDialog, showQuickActionsMenu, createOutputChannel, logToChannel, showPluginManagementDialog } from './uiService';
import { createAgent } from './agent';
import { createPluginManager, initializeMockPlugins } from './pluginManager';
import { createConfigManager, isConfigurationComplete, initializeDefaultConfig } from './configManager';
import { AviorWebviewProvider } from './webviewProvider';
import { AgentRequest } from './types';

let outputChannel: vscode.OutputChannel;
let agentInstance: any = null;
let pluginManager: any = null;
let webviewProvider: AviorWebviewProvider;

export async function activate(context: vscode.ExtensionContext) {
	// Initialize output channel
	outputChannel = createOutputChannel('Avior AI Agent');
	logToChannel(outputChannel, 'Activating Avior AI Agent extension...');

	// Initialize default configuration
	await initializeDefaultConfig(context);

	// Initialize plugin system
	pluginManager = createPluginManager();
	initializeMockPlugins();
	logToChannel(outputChannel, 'Plugin system initialized');

	// Create and register webview provider
	webviewProvider = new AviorWebviewProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			AviorWebviewProvider.viewType,
			webviewProvider
		)
	);

	// Create services
	const fileService = createFileService();
	const uiService = createUIService();
	const configManager = createConfigManager(context);

	// Check if configuration is complete
	const config = await configManager.getConfig();
	if (!isConfigurationComplete(config)) {
		logToChannel(outputChannel, 'Configuration incomplete, will prompt user on first use');
	}

	// Register commands
	const startAgentCommand = vscode.commands.registerCommand('avior.startAgent', async () => {
		await startAgent(configManager, fileService, uiService, context);
	});

	const stopAgentCommand = vscode.commands.registerCommand('avior.stopAgent', async () => {
		await stopAgent(uiService);
	});

	const askAgentCommand = vscode.commands.registerCommand('avior.askAgent', async () => {
		await askAgent(uiService, context);
	});

	const managePluginsCommand = vscode.commands.registerCommand('avior.managePlugins', async () => {
		await managePlugins(uiService, context);
	});

	// Add to subscriptions
	context.subscriptions.push(
		startAgentCommand,
		stopAgentCommand,
		askAgentCommand,
		managePluginsCommand,
		outputChannel
	);

	// Auto-start agent mode (as per requirements)
	await startAgent(configManager, fileService, uiService, context);

	// Automatically show the webview sidebar
	await vscode.commands.executeCommand('workbench.view.extension.avior-sidebar');

	logToChannel(outputChannel, 'Avior AI Agent extension activated successfully!');
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
		webviewProvider.setAgentInstance(agentInstance);

		// Start the agent
		const result = await agentInstance.start();
		if (result.success) {
			logToChannel(outputChannel, 'Agent started successfully');
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
		if (!agentInstance?.isActive()) {
			await uiService.showMessage('Agent is not running. Please start the agent first.', 'warning');
			return;
		}

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

export function deactivate() {
	logToChannel(outputChannel, 'Deactivating Avior AI Agent extension...');
	
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
	
	logToChannel(outputChannel, 'Avior AI Agent extension deactivated');
}
