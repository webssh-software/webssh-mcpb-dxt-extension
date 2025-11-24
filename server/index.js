#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourceTemplatesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

class MCPSSEProxy {
  constructor(sseUrl, apiKey = null, serverName = "My MCP Server") {
    this.sseUrl = sseUrl;
    this.apiKey = apiKey;
    this.serverName = serverName;
    this.client = null;
    this.server = null;
  }

  async initialize() {
    // Validate the SSE URL format
    try {
      const url = new URL(this.sseUrl);
      console.error(`Connecting to SSE endpoint: ${this.sseUrl}`);
      console.error(`URL components - protocol: ${url.protocol}, host: ${url.host}, pathname: ${url.pathname}`);
    } catch (error) {
      throw new Error(`Invalid SSE URL format: ${this.sseUrl} - ${error.message}`);
    }

    // Create the client to connect to the remote SSE server
    this.client = new Client(
      {
        name: "proxy-client",
        version: "1.0.0",
      },
      {
        capabilities: {}
      }
    );

    // Create the SSE transport for the client
    // The SSEClientTransport expects a URL object, not a string
    console.error(`Creating SSEClientTransport with URL: ${this.sseUrl}`);
    const urlObject = new URL(this.sseUrl);
    
    // Configure transport options with authentication if provided
    const transportOptions = {};
    if (this.apiKey) {
      transportOptions.eventSourceInit = {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      };
      transportOptions.requestInit = {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      };
      console.error(`Using API key authentication`);
    }
    
    const clientTransport = new SSEClientTransport(urlObject, transportOptions);
    
    // Create the proxy server
    console.error(`Creating MCP server with name: "${this.serverName}"`);
    this.server = new Server(
      {
        name: this.serverName,
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    // Connect client to the remote SSE server with better error handling
    console.error(`Attempting to connect to SSE server...`);
    try {
      await this.client.connect(clientTransport);
      console.error(`Successfully connected to SSE server`);
    } catch (error) {
      console.error(`Failed to connect to SSE server:`, error);
      if (error.stack) {
        console.error(`Stack trace:`, error.stack);
      }
      throw error;
    }

    // Set up proxy handlers
    this.setupProxyHandlers();
  }

  setupProxyHandlers() {
    // Proxy tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        console.error("Attempting to list tools from remote server...");
        const result = await this.client.listTools();
        console.error("Raw client listTools() result:", JSON.stringify(result, null, 2));
        
        // Validate the result format
        if (Array.isArray(result)) {
          console.error(`Successfully retrieved ${result.length} tools`);
          return { tools: result };
        } else if (result && result.tools && Array.isArray(result.tools)) {
          // Handle case where client already returns wrapped format
          console.error(`Client returned wrapped format with ${result.tools.length} tools`);
          return result;
        } else {
          console.error("Unexpected result format from client.listTools():", typeof result, result);
          return { tools: [] };
        }
      } catch (error) {
        console.error("Error listing tools:", error);
        console.error("Error details:", error.message, error.stack);
        return { tools: [] };
      }
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        console.error(`Calling tool: ${request.params.name} with args:`, request.params.arguments);
        const result = await this.client.callTool(request.params);
        console.error("Tool call result:", JSON.stringify(result, null, 2));
        return result;
      } catch (error) {
        console.error("Error calling tool:", error);
        throw error;
      }
    });

    // Proxy resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        console.error("Attempting to list resources from remote server...");
        const result = await this.client.listResources();
        console.error("Raw client listResources() result:", JSON.stringify(result, null, 2));
        
        if (Array.isArray(result)) {
          console.error(`Successfully retrieved ${result.length} resources`);
          return { resources: result };
        } else if (result && result.resources && Array.isArray(result.resources)) {
          console.error(`Client returned wrapped format with ${result.resources.length} resources`);
          return result;
        } else {
          console.error("Unexpected result format from client.listResources():", typeof result, result);
          return { resources: [] };
        }
      } catch (error) {
        console.error("Error listing resources:", error);
        console.error("Error details:", error.message, error.stack);
        return { resources: [] };
      }
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        console.error(`Reading resource: ${request.params.uri}`);
        const result = await this.client.readResource(request.params);
        console.error("Resource read result:", JSON.stringify(result, null, 2));
        return result;
      } catch (error) {
        console.error("Error reading resource:", error);
        throw error;
      }
    });

    // Proxy resource templates
    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
      try {
        console.error("Attempting to list resource templates from remote server...");
        const result = await this.client.listResourceTemplates();
        console.error("Raw client listResourceTemplates() result:", JSON.stringify(result, null, 2));
        
        if (Array.isArray(result)) {
          console.error(`Successfully retrieved ${result.length} resource templates`);
          return { resourceTemplates: result };
        } else if (result && result.resourceTemplates && Array.isArray(result.resourceTemplates)) {
          console.error(`Client returned wrapped format with ${result.resourceTemplates.length} resource templates`);
          return result;
        } else {
          console.error("Unexpected result format from client.listResourceTemplates():", typeof result, result);
          return { resourceTemplates: [] };
        }
      } catch (error) {
        console.error("Error listing resource templates:", error);
        console.error("Error details:", error.message, error.stack);
        return { resourceTemplates: [] };
      }
    });

    // Proxy prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      try {
        console.error("Attempting to list prompts from remote server...");
        const result = await this.client.listPrompts();
        console.error("Raw client listPrompts() result:", JSON.stringify(result, null, 2));
        
        if (Array.isArray(result)) {
          console.error(`Successfully retrieved ${result.length} prompts`);
          return { prompts: result };
        } else if (result && result.prompts && Array.isArray(result.prompts)) {
          console.error(`Client returned wrapped format with ${result.prompts.length} prompts`);
          return result;
        } else {
          console.error("Unexpected result format from client.listPrompts():", typeof result, result);
          return { prompts: [] };
        }
      } catch (error) {
        console.error("Error listing prompts:", error);
        console.error("Error details:", error.message, error.stack);
        return { prompts: [] };
      }
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      try {
        console.error(`Getting prompt: ${request.params.name} with args:`, request.params.arguments);
        const result = await this.client.getPrompt(request.params);
        console.error("Prompt get result:", JSON.stringify(result, null, 2));
        return result;
      } catch (error) {
        console.error("Error getting prompt:", error);
        throw error;
      }
    });
  }

  async run() {
    // Initialize the proxy
    await this.initialize();

    // Create stdio transport for the server
    const transport = new StdioServerTransport();
    
    // Connect and run the server
    await this.server.connect(transport);
    
    console.error(`MCP SSE Proxy "${this.serverName}" running - connecting to ${this.sseUrl}`);
  }

  async close() {
    if (this.client) {
      await this.client.close();
    }
    if (this.server) {
      await this.server.close();
    }
  }
}

// Main execution
async function main() {
  // Debug: Log all command line arguments
  console.error(`Command line arguments:`, process.argv);
  console.error(`Environment variables - SERVER_NAME: ${process.env.SERVER_NAME}, SSE_URL: ${process.env.SSE_URL}, API_KEY: ${process.env.API_KEY ? '[SET]' : '[NOT SET]'}`);
  
  // Default SSE URL - can be overridden via environment variable or command line
  const serverName = process.env.SERVER_NAME || process.argv[2] || "My MCP Server";
  const sseUrl = process.env.SSE_URL || process.argv[3];
  const apiKey = process.env.API_KEY || process.argv[4];

  console.error(`Resolved server name: "${serverName}"`);
  console.error(`Resolved SSE URL: "${sseUrl}"`);
  console.error(`Resolved API key: ${apiKey ? '[SET]' : '[NOT SET]'}`);

  if (!sseUrl) {
    console.error(`Usage: node server.js <SERVER_NAME> <SSE_URL> [API_KEY]`);
    console.error(`   or: SERVER_NAME=<name> SSE_URL=<url> API_KEY=<key> node server.js`);
    console.error(`Example: node server.js "STDIO to SSE Proxy MCP Server" https://example.com/api/sse your-api-key`);
    process.exit(1);
  }

  const proxy = new MCPSSEProxy(sseUrl, apiKey, serverName);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('Shutting down proxy...');
    await proxy.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('Shutting down proxy...');
    await proxy.close();
    process.exit(0);
  });

  try {
    await proxy.run();
  } catch (error) {
    console.error('Failed to start proxy:', error);
    process.exit(1);
  }
}

// Run main function directly
main();

export { MCPSSEProxy };
