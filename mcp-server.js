#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const {
  StdioServerTransport,
} = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

class UniversalAIToolsMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'universal-ai-tools-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'test_llm_router',
          description: 'Test the LLM Router service health and functionality',
          inputSchema: {
            type: 'object',
            properties: {
              endpoint: {
                type: 'string',
                description: 'The endpoint to test',
                enum: ['health', 'smart', 'models', 'providers'],
              },
              message: {
                type: 'string',
                description: 'Test message for smart endpoint',
                default: 'Hello, this is a test message',
              },
            },
            required: ['endpoint'],
          },
        },
        {
          name: 'test_hrm_mlx',
          description: 'Test the HRM-MLX service health and processing',
          inputSchema: {
            type: 'object',
            properties: {
              endpoint: {
                type: 'string',
                description: 'The endpoint to test',
                enum: ['health', 'process'],
              },
              input: {
                type: 'string',
                description: 'Input for processing endpoint',
                default: 'What is the capital of France?',
              },
            },
            required: ['endpoint'],
          },
        },
        {
          name: 'test_fastvlm',
          description: 'Test the FastVLM service health and vision processing',
          inputSchema: {
            type: 'object',
            properties: {
              endpoint: {
                type: 'string',
                description: 'The endpoint to test',
                enum: ['health', 'vision'],
              },
              prompt: {
                type: 'string',
                description: 'Vision prompt',
                default: 'What do you see in this image?',
              },
            },
            required: ['endpoint'],
          },
        },
        {
          name: 'run_playwright_test',
          description:
            'Run Playwright tests for the Universal AI Tools frontend',
          inputSchema: {
            type: 'object',
            properties: {
              testFile: {
                type: 'string',
                description: 'Specific test file to run',
                enum: [
                  'backend-services.spec.ts',
                  'frontend-integration.spec.ts',
                  'all',
                ],
              },
              browser: {
                type: 'string',
                description: 'Browser to test with',
                enum: ['chromium', 'firefox', 'webkit', 'all'],
              },
            },
            required: ['testFile'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'test_llm_router':
            return await this.testLLMRouter(args);
          case 'test_hrm_mlx':
            return await this.testHRMMLX(args);
          case 'test_fastvlm':
            return await this.testFastVLM(args);
          case 'run_playwright_test':
            return await this.runPlaywrightTest(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  async testLLMRouter(args) {
    const { endpoint, message } = args;
    const baseUrl = process.env.LLM_ROUTER_URL || 'http://127.0.0.1:3033';

    try {
      const url = `${baseUrl}/${endpoint}`;
      let response;

      if (endpoint === 'smart') {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: message }],
            model: 'hrm-mlx',
          }),
        });
      } else {
        response = await fetch(url);
      }

      const data = await response.json();

      return {
        content: [
          {
            type: 'text',
            text: `LLM Router ${endpoint} test:\nStatus: ${
              response.status
            }\nResponse: ${JSON.stringify(data, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `LLM Router ${endpoint} test failed: ${error.message}`,
          },
        ],
      };
    }
  }

  async testHRMMLX(args) {
    const { endpoint, input } = args;
    const baseUrl = process.env.HRM_MLX_URL || 'http://127.0.0.1:8002';

    try {
      const url = `${baseUrl}/${
        endpoint === 'process' ? 'hrm/process' : 'health'
      }`;
      let response;

      if (endpoint === 'process') {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: input,
            taskType: 'reasoning',
            complexity: 'simple',
          }),
        });
      } else {
        response = await fetch(url);
      }

      const data = await response.json();

      return {
        content: [
          {
            type: 'text',
            text: `HRM-MLX ${endpoint} test:\nStatus: ${
              response.status
            }\nResponse: ${JSON.stringify(data, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `HRM-MLX ${endpoint} test failed: ${error.message}`,
          },
        ],
      };
    }
  }

  async testFastVLM(args) {
    const { endpoint, prompt } = args;
    const baseUrl = process.env.FASTVLM_URL || 'http://127.0.0.1:8003';

    try {
      const url = `${baseUrl}/${
        endpoint === 'vision' ? 'v1/vision' : 'health'
      }`;
      let response;

      if (endpoint === 'vision') {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt,
            image_data: 'test_base64_data',
            max_tokens: 100,
            temperature: 0.7,
          }),
        });
      } else {
        response = await fetch(url);
      }

      const data = await response.json();

      return {
        content: [
          {
            type: 'text',
            text: `FastVLM ${endpoint} test:\nStatus: ${
              response.status
            }\nResponse: ${JSON.stringify(data, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `FastVLM ${endpoint} test failed: ${error.message}`,
          },
        ],
      };
    }
  }

  async runPlaywrightTest(args) {
    const { testFile, browser = 'chromium' } = args;

    try {
      const { execSync } = require('child_process');
      let command = 'npx playwright test';

      if (testFile !== 'all') {
        command += ` tests/${testFile}`;
      }

      if (browser !== 'all') {
        command += ` --project=${browser}`;
      }

      const output = execSync(command, {
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 60000, // 60 second timeout
      });

      return {
        content: [
          {
            type: 'text',
            text: `Playwright test results for ${testFile} (${browser}):\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Playwright test failed: ${error.message}\nOutput: ${
              error.stdout || ''
            }\nError: ${error.stderr || ''}`,
          },
        ],
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Universal AI Tools MCP server running on stdio');
  }
}

const server = new UniversalAIToolsMCPServer();
server.run().catch(console.error);
