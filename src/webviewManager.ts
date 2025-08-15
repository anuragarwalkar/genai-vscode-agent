import { error } from 'console';
import * as vscode from 'vscode';

export class WebviewManager implements vscode.WebviewViewProvider {
	public static readonly viewType = 'avior.webview';
	private readonly _extensionUri: vscode.Uri;

	constructor(extensionUri: vscode.Uri) {
		this._extensionUri = extensionUri;
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist')
			]
		};

		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
	}

	private getHtmlForWebview(webview: vscode.Webview): string {
			const distPath = vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist');
			const htmlPath = vscode.Uri.joinPath(distPath, 'index.html');
			
			// Read the HTML file
			const htmlContent = require('fs').readFileSync(htmlPath.fsPath, 'utf8');
			
			// Get webview URIs for assets
			const assetsPath = vscode.Uri.joinPath(distPath, 'assets');
			const assetsUri = webview.asWebviewUri(assetsPath);
			
			// Replace asset paths with webview URIs
			const updatedHtml = htmlContent
				.replace(/\/assets\//g, `${assetsUri}/`)
				.replace(/<script[^>]*crossorigin[^>]*>/g, (match: string) => {
					return match.replace('crossorigin', '');
				});
			
			return updatedHtml;
	}
}
