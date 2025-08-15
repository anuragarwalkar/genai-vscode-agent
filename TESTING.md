## Testing the Simplified VSCode Extension

The extension has been simplified to focus on just showing the webview on startup. Here's what was changed:

### Changes Made:

1. **package.json**:
   - Removed all commands except `avior.openWelcome`
   - Removed keybindings
   - Removed dependencies (LangChain, etc.)
   - Simplified configuration
   - Only activate on startup

2. **extension.ts**:
   - Completely simplified to only register webview provider
   - Removed all agent, plugin, and service dependencies
   - Only one command: `avior.openWelcome`
   - Shows webview automatically on startup with 1-second delay

3. **webviewProvider.ts**:
   - Removed React dependencies
   - Simple HTML with vanilla JavaScript
   - Basic interactive chat interface with test functionality
   - No complex agent integration

### What the Extension Now Does:

1. ✅ Activates on VSCode startup
2. ✅ Registers a webview provider for the sidebar
3. ✅ Shows a simple HTML interface with:
   - Welcome message
   - Status indicator
   - Text input and send button
   - Test button
   - Message area
4. ✅ Automatically opens the webview sidebar after 1 second
5. ✅ Handles basic message passing between webview and extension

### To Test:

1. Press F5 to launch the extension in Development Host
2. The webview should automatically appear in the sidebar
3. If not visible, run the command "Open Avior" from Command Palette (Cmd+Shift+P)
4. You should see a working webview with a robot icon and interactive elements
5. Test typing messages and clicking the test button

The extension is now minimal and should help debug any webview display issues.
