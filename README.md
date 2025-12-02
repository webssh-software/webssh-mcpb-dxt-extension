# WebSSH MCP Extension for your AI Workflows 🚀
This extension integrates [WebSSH](https://webssh.net) with your AI workflows, enabling seamless SSH access and management directly from your AI applications. Leverage the power of WebSSH to enhance your AI-driven tasks with secure and efficient SSH connectivity.

## Prerequisites
To ensure smooth installation and operation of the WebSSH MCP Extension, please make sure you have the following prerequisites in place:
- Docker Desktop installed on your machine.
- And, that's it! The extension runs within a Docker container, so no additional software is required.

## Easy Installation
1. Download the latest [release here](https://github.com/webssh-software/webssh-mcpb-dxt-extension/releases)
2. Drag (or open) the .mcpb file into your MCP-compatible application to install the extension.

## Or Build Extension from Source
1. Clone the repository
2. Install dependencies: `npm install`
3. Install MCPB CLI: `npm install -g @anthropic-ai/mcpb`
4. Validate the manifest: `mcpb validate ./manifest.json`
5. Build the extension: `mcpb pack`
6. Install the extension in your MCP-compatible application.