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
        // SwiftMCP Tools
        {
          name: 'swift_compile',
          description: 'Compile Swift code with iOS 26 target support',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Swift code to compile',
              },
              target: {
                type: 'string',
                description: 'Compilation target',
                enum: ['executable', 'library', 'static-library', 'dynamic-library'],
                default: 'executable',
              },
              ios_version: {
                type: 'string',
                description: 'iOS deployment target',
                default: '26.0',
              },
              swift_version: {
                type: 'string',
                description: 'Swift version',
                default: '6.0',
              },
            },
            required: ['code'],
          },
        },
        {
          name: 'swift_run',
          description: 'Run Swift code and return output',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Swift code to run',
              },
            },
            required: ['code'],
          },
        },
        {
          name: 'swift_lint',
          description: 'Lint Swift code for style and errors',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Swift code to lint',
              },
            },
            required: ['code'],
          },
        },
        {
          name: 'swift_format',
          description: 'Format Swift code according to style guidelines',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Swift code to format',
              },
            },
            required: ['code'],
          },
        },
        {
          name: 'swift_package_init',
          description: 'Initialize a new Swift package',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Package name',
              },
              type: {
                type: 'string',
                description: 'Package type',
                enum: ['library', 'executable', 'system-module', 'manifest-only'],
                default: 'library',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'ios26_app_template',
          description: 'Generate iOS 26 app template with SwiftUI',
          inputSchema: {
            type: 'object',
            properties: {
              app_name: {
                type: 'string',
                description: 'App name',
              },
              bundle_id: {
                type: 'string',
                description: 'Bundle identifier',
              },
              features: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['SwiftUI', 'CoreData', 'CloudKit', 'WidgetKit', 'AppIntents'],
                },
                description: 'iOS 26 features to include',
              },
            },
            required: ['app_name'],
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
          // SwiftMCP Tools
          case 'swift_compile':
            return await this.compileSwift(args);
          case 'swift_run':
            return await this.runSwift(args);
          case 'swift_lint':
            return await this.lintSwift(args);
          case 'swift_format':
            return await this.formatSwift(args);
          case 'swift_package_init':
            return await this.initSwiftPackage(args);
          case 'ios26_app_template':
            return await this.generateIOS26Template(args);
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

  // MARK: - SwiftMCP Implementation Methods

  async compileSwift(args) {
    const { code, target = 'executable', ios_version = '26.0', swift_version = '6.0' } = args;
    const { execSync } = require('child_process');
    const fs = require('fs').promises;
    const path = require('path');

    // Create temporary file
    const tempFile = path.join(process.cwd(), 'temp_swift_compile.swift');
    
    try {
      await fs.writeFile(tempFile, code);

      const command = `swift build --target ${target} --swift-version ${swift_version} --ios-version ${ios_version} ${tempFile}`;
      const result = execSync(command, {
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 30000,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Swift compilation successful!\n\nOutput:\n${result}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Swift compilation failed:\n\nError: ${error.message}\n\nStderr: ${error.stderr || ''}`,
          },
        ],
      };
    } finally {
      // Clean up temporary file
      try {
        await fs.unlink(tempFile);
      } catch (cleanupError) {
        console.error('Failed to cleanup temp file:', cleanupError);
      }
    }
  }

  async runSwift(args) {
    const { code } = args;
    const { execSync } = require('child_process');
    const fs = require('fs').promises;
    const path = require('path');

    // Create temporary file
    const tempFile = path.join(process.cwd(), 'temp_swift_run.swift');
    
    try {
      await fs.writeFile(tempFile, code);

      const result = execSync(`swift ${tempFile}`, {
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 10000,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Swift execution completed!\n\nOutput:\n${result}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Swift execution failed:\n\nError: ${error.message}\n\nStderr: ${error.stderr || ''}`,
          },
        ],
      };
    } finally {
      // Clean up temporary file
      try {
        await fs.unlink(tempFile);
      } catch (cleanupError) {
        console.error('Failed to cleanup temp file:', cleanupError);
      }
    }
  }

  async lintSwift(args) {
    const { code } = args;
    const { execSync } = require('child_process');
    const fs = require('fs').promises;
    const path = require('path');

    try {
      // Create temporary file and try to compile it to check syntax
      const tempFile = path.join(process.cwd(), 'temp_swift_lint.swift');
      await fs.writeFile(tempFile, code);

      execSync(`swift -parse ${tempFile}`, {
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 5000,
      });

      await fs.unlink(tempFile);

      return {
        content: [
          {
            type: 'text',
            text: 'Swift code linting passed! No syntax errors found.',
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Swift linting found issues:\n\nError: ${error.message}\n\nStderr: ${error.stderr || ''}`,
          },
        ],
      };
    }
  }

  async formatSwift(args) {
    const { code } = args;

    // Basic formatting - indent with 2 spaces
    const lines = code.split('\n');
    let indentLevel = 0;
    const indentSize = 2;

    const formatted = lines
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';

        // Decrease indent for closing braces
        if (trimmed === '}' || trimmed === '])' || trimmed === '))') {
          indentLevel = Math.max(0, indentLevel - 1);
        }

        const indented = ' '.repeat(indentLevel * indentSize) + trimmed;

        // Increase indent for opening braces
        if (trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(')) {
          indentLevel++;
        }

        return indented;
      })
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Swift code formatted:\n\n${formatted}`,
        },
      ],
    };
  }

  async initSwiftPackage(args) {
    const { name, type = 'library' } = args;
    const { execSync } = require('child_process');

    try {
      const command = `swift package init --type ${type} --name ${name}`;
      
      execSync(command, {
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 10000,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Swift package '${name}' initialized successfully as ${type}!`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to initialize Swift package:\n\nError: ${error.message}\n\nStderr: ${error.stderr || ''}`,
          },
        ],
      };
    }
  }

  async generateIOS26Template(args) {
    const { app_name, bundle_id, features = ['SwiftUI'] } = args;
    const bundleIdentifier = bundle_id || `com.example.${app_name.toLowerCase().replace(/\s+/g, '')}`;
    
    let imports = ['import SwiftUI'];
    if (features.includes('CoreData')) imports.push('import CoreData');
    if (features.includes('CloudKit')) imports.push('import CloudKit');
    if (features.includes('WidgetKit')) imports.push('import WidgetKit');
    if (features.includes('AppIntents')) imports.push('import AppIntents');

    const template = `// ${app_name} - iOS 26 App Template
// Generated by SwiftMCP Server

${imports.join('\n')}

@main
struct ${app_name.replace(/\s+/g, '')}App: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    var body: some View {
        VStack {
            Image(systemName: "globe")
                .imageScale(.large)
                .foregroundStyle(.tint)
            Text("Hello, ${app_name}!")
        }
        .padding()
    }
}

#Preview {
    ContentView()
}`;

    return {
      content: [
        {
          type: 'text',
          text: `iOS 26 app template generated for '${app_name}':\n\n${template}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Universal AI Tools MCP server running on stdio');
  }
}

const server = new UniversalAIToolsMCPServer();
server.run().catch(console.error);
