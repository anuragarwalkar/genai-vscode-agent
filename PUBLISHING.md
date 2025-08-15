# VS Code Extension Publishing Guide

## Prerequisites

1. Install the VS Code Extension Manager CLI:
   ```bash
   npm install -g @vscode/vsce
   ```

2. Create a Personal Access Token (PAT) on Azure DevOps:
   - Go to https://dev.azure.com/
   - Sign in with your Microsoft account
   - Go to User Settings > Personal Access Tokens
   - Create a new token with "Marketplace (manage)" scope
   - Save the token securely

3. Create a publisher account:
   ```bash
   vsce create-publisher <publisher-name>
   ```
   Or login with existing publisher:
   ```bash
   vsce login <publisher-name>
   ```

## Building and Packaging

1. Build the extension:
   ```bash
   npm run package
   ```

2. Package the extension:
   ```bash
   npm run package-extension
   ```
   This creates a `.vsix` file that can be installed locally or shared.

## Publishing

1. Publish to the marketplace:
   ```bash
   npm run publish
   ```

2. Publish with version bump:
   ```bash
   npm run publish-minor  # bumps 0.0.1 -> 0.1.0
   npm run publish-major  # bumps 0.0.1 -> 1.0.0
   ```

## Local Installation

To install the packaged extension locally:
```bash
code --install-extension avior-0.0.1.vsix
```

## Pre-publish Checklist

- [x] `.vscodeignore` file configured
- [x] `package.json` has all required fields
- [x] License file exists
- [x] Extension builds without errors
- [x] Extension packages successfully
- [ ] Publisher account created
- [ ] Personal Access Token configured
- [ ] Extension tested locally

## Notes

- Make sure to update the publisher field in `package.json` to match your publisher name
- Test your extension thoroughly before publishing
- Consider adding an icon (128x128 PNG) for better visibility in the marketplace
