/**;
 * Example of a tool-enabled agent that demonstrates how to use the tool execution support
 */

import { BaseAgent, AgentContext, PartialAgentResponse } from './base_agent.js';

export class ExampleToolEnabledAgent extends BaseAgent {
  constructor() {
    super({
      name: 'example_tool_agent',
      description: 'Example agent that demonstrates tool execution capabilities',
      priority: 5,
      capabilities: [;
        {
          name: 'file_operations',
          description: 'Perform file operations using tools',
          inputSchema: { path: { type: 'string', required: true } },
          outputSchema: { result: { type: 'object' } },
          requiresTools: ['READ_FILE', 'WRITE_FILE', 'LIST_FILES'],
        },
        {
          name: 'code_analysis',
          description: 'Analyze code using tools',
          inputSchema: { filePath: { type: 'string', required: true } },
          outputSchema: { analysis: { type: 'object' } },
          requiresTools: ['ANALYZE_CODE', 'SEARCH_FILES'],
        },
      ],
      maxLatencyMs: 30000,
      retryAttempts: 2,
      dependencies: [],
      memoryEnabled: true,
      category: 'examples',
      toolExecutionEnabled: true, // Enable tool execution for this agent
      allowedTools: [;
        'READ_FILE',
        'WRITE_FILE',
        'LIST_FILES',
        'CREATE_FILE',
        'DELETE_FILE',
        'ANALYZE_CODE',
        'SEARCH_FILES',
        'EXECUTE_CODE',
      ], // Specify which tools this agent can use;
    });
  }

  protected async onInitialize(): Promise<void> {
    // Log available tools during initialization
    const availableTools = this.getAvailableTools();
    this.logger.info(`Available tools for ${this.config.name}:`, availableTools);
  }

  protected async process(;
    context: AgentContext & { memoryContext?: unknown }
  ): Promise<PartialAgentResponse> {
    const { userRequest } = context;

    try {
      // Select appropriate tools based on the request
      const selectedTools = await this.selectToolsForTask(userRequest);
      this.logger.info(`Selected tools for task: ${selectedTools.join(', ')}`);

      // Example: Read a file if requested
      if (userRequest.toLowerCase().includes('read file')) {
        const pathMatch = userRequest.match(/read file\s+(.+)/i);
        if (pathMatch) {
          const filePath = pathMatch[1].trim();
          
          // Execute the READ_FILE tool
          const result = await this.executeTool({
            toolName: 'READ_FILE',
            parameters: { path: filePath },
            requestId: context.requestId,
          });

          if (result.success) {
            return {
              success: true,
              data: { fileContent: result.data },
              reasoning: `Successfully read file: ${filePath}`,
              confidence: 0.9,
              metadata: { toolsUsed: ['READ_FILE'] },
            };
          } else {
            return {
              success: false,
              data: null,
              reasoning: `Failed to read file: ${result.error}`,
              confidence: 0.3,
              error: result.error,
            };
          }
        }
      }

      // Example: Analyze code if requested
      if (userRequest.toLowerCase().includes('analyze code')) {
        const pathMatch = userRequest.match(/analyze code\s+in\s+(.+)/i);
        if (pathMatch) {
          const filePath = pathMatch[1].trim();
          
          // Execute the ANALYZE_CODE tool
          const result = await this.executeTool({
            toolName: 'ANALYZE_CODE',
            parameters: { path: filePath },
            requestId: context.requestId,
          });

          if (result.success) {
            return {
              success: true,
              data: { analysis: result.data },
              reasoning: `Successfully analyzed code in: ${filePath}`,
              confidence: 0.85,
              metadata: { toolsUsed: ['ANALYZE_CODE'] },
            };
          }
        }
      }

      // Example: Execute multiple tools in sequence
      if (userRequest.toLowerCase().includes('create and write file')) {
        const match = userRequest.match(/create and write file\s+(.+)\s+with content\s+"([^"]+)"/i);
        if (match) {
          const [, filePath, content] = match;
          
          // Execute tools in sequence
          const results = await this.executeToolChain([
            {
              toolName: 'CREATE_FILE',
              parameters: { path: filePath, content },
            },
            {
              toolName: 'READ_FILE',
              parameters: { path: filePath },
            },
          ]);

          const allSuccessful = results.every(r => r.success);
          
          return {
            success: allSuccessful,
            data: { ;
              created: results[0].success,
              verified: results[1].success,
              content: results[1].data,
            },
            reasoning: allSuccessful ;
              ? `Successfully created and verified file: ${filePath}`;
              : `Failed to complete file operations`,
            confidence: allSuccessful ? 0.9 : 0.4,
            metadata: { toolsUsed: ['CREATE_FILE', 'READ_FILE'] },
          };
        }
      }

      // If no specific tool action was identified
      return {
        success: false,
        data: null,
        reasoning: 'No specific tool action identified in the request',
        confidence: 0.2,
        message: `I can help with file operations and code analysis. Available tools: ${this.getAvailableTools().join(', ')}`,
      };

    } catch (error) {
      this.logger.error('Error processing request:', error);
      return {
        success: false,
        data: null,
        reasoning: `Error processing request: ${error instanceof Error ? error.message : String(error)}`,
        confidence: 0.1,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  protected async onShutdown(): Promise<void> {
    this.logger.info(`Shutting down ${this.config.name}`);
  }
}