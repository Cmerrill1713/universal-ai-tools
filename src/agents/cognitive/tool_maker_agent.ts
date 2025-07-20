/**
 * Tool Maker Agent - Dynamic tool creation and customization
 * Cognitive version for the agent system
 */

import type { AgentContext } from '../base_agent';
import { RealCognitiveAgent, type CognitiveCapability } from './real_cognitive_agent';

interface ToolSpecification {
  name: string;
  description: string;
  category: string;
  inputs: {
    name: string;
    type: string;
    description: string;
    required: boolean;
  }[];
  outputs: {
    name: string;
    type: string;
    description: string;
  }[];
  implementation: string;
  dependencies: string[];
  testCases: {
    input: any;
    expectedOutput: any;
    description: string;
  }[];
}

interface ToolCreationResult {
  tool: ToolSpecification;
  code: string;
  integrationSteps: string[];
  documentation: string;
  confidence: number;
  warnings: string[];
}

export class ToolMakerAgent extends RealCognitiveAgent {
  private toolTemplates: Map<string, any> = new Map();
  
  constructor(config: any) {
    super({
      ...config,
      name: 'tool_maker',
      description: 'Dynamic tool creation and customization for user needs',
    });
    this.preferredModel = 'llama3.2:3b'; // Good for code generation
  }

  protected async onInitialize(): Promise<void> {
    await super.onInitialize();
    this.loadToolTemplates();
  }

  protected setupCognitiveCapabilities(): void {
    // Tool creation capability
    this.cognitiveCapabilities.set('create_tool', {
      name: 'create_tool',
      execute: async (input: any, context: AgentContext) => {
        return this.createTool(input, context);
      }
    });

    // Tool customization capability
    this.cognitiveCapabilities.set('customize_tool', {
      name: 'customize_tool',
      execute: async (input: any, context: AgentContext) => {
        return this.customizeTool(input, context);
      }
    });

    // Integration generation capability
    this.cognitiveCapabilities.set('generate_integration', {
      name: 'generate_integration',
      execute: async (input: any, context: AgentContext) => {
        return this.generateIntegration(input, context);
      }
    });
  }

  protected async selectCapability(context: AgentContext): Promise<CognitiveCapability | null> {
    const request = context.userRequest.toLowerCase();
    
    if (request.includes('create') || request.includes('make') || request.includes('build')) {
      return this.cognitiveCapabilities.get('create_tool') || null;
    } else if (request.includes('customize') || request.includes('modify') || request.includes('adapt')) {
      return this.cognitiveCapabilities.get('customize_tool') || null;
    } else if (request.includes('integrate') || request.includes('connect')) {
      return this.cognitiveCapabilities.get('generate_integration') || null;
    }
    
    // Default to tool creation
    return this.cognitiveCapabilities.get('create_tool') || null;
  }

  protected async generateReasoning(
    context: AgentContext,
    capability: CognitiveCapability,
    result: any
  ): Promise<string> {
    const prompt = `As a tool maker agent, explain the approach for:

Request: "${context.userRequest}"
Capability used: ${capability.name}
Tool created: ${result.tool?.name || 'None'}
Implementation approach: ${result.approach || 'Standard'}

Provide reasoning for:
1. Why this tool design was chosen
2. How it addresses the user's needs
3. Technical implementation decisions
4. Integration considerations`;

    return this.generateOllamaResponse(prompt, context);
  }

  private async createTool(input: any, context: AgentContext): Promise<ToolCreationResult> {
    const toolRequest = context.userRequest;
    
    // Analyze the tool requirements
    const requirements = await this.analyzeToolRequirements(toolRequest, context);
    
    // Generate tool specification
    const toolSpec = await this.generateToolSpecification(requirements, context);
    
    // Generate implementation code
    const code = await this.generateToolCode(toolSpec, context);
    
    // Generate integration steps
    const integrationSteps = this.generateIntegrationSteps(toolSpec);
    
    // Generate documentation
    const documentation = await this.generateToolDocumentation(toolSpec, context);
    
    return {
      tool: toolSpec,
      code,
      integrationSteps,
      documentation,
      confidence: 0.85,
      warnings: this.validateTool(toolSpec, code),
    };
  }

  private async analyzeToolRequirements(request: string, context: AgentContext): Promise<any> {
    const prompt = `Analyze this tool creation request and extract requirements:

Request: "${request}"

Extract:
1. Tool purpose and functionality
2. Required inputs and their types
3. Expected outputs
4. Any specific constraints or requirements
5. Integration needs

Format as structured JSON.`;

    const response = await this.generateOllamaResponse(prompt, context);
    
    // Parse response or use fallback
    try {
      return JSON.parse(response);
    } catch {
      return {
        purpose: request,
        inputs: [],
        outputs: [],
        constraints: [],
        integration: 'standalone',
      };
    }
  }

  private async generateToolSpecification(requirements: any, context: AgentContext): Promise<ToolSpecification> {
    const prompt = `Create a tool specification based on these requirements:

${JSON.stringify(requirements, null, 2)}

Generate a complete specification including:
1. Tool name and description
2. Input/output schemas
3. Dependencies needed
4. Test cases

Format as a TypeScript interface.`;

    const response = await this.generateOllamaResponse(prompt, context);
    
    // Create a basic specification
    return {
      name: this.generateToolName(requirements.purpose),
      description: requirements.purpose || 'Custom tool',
      category: 'custom',
      inputs: requirements.inputs || [],
      outputs: requirements.outputs || [],
      implementation: 'typescript',
      dependencies: this.inferDependencies(requirements),
      testCases: this.generateTestCases(requirements),
    };
  }

  private async generateToolCode(spec: ToolSpecification, context: AgentContext): Promise<string> {
    const prompt = `Generate TypeScript code for this tool:

Specification:
${JSON.stringify(spec, null, 2)}

Requirements:
1. Clean, well-commented code
2. Error handling
3. Type safety
4. Efficient implementation

Generate the complete implementation.`;

    const response = await this.generateOllamaResponse(prompt, context);
    
    // If no LLM response, generate template code
    if (!response || response === this.generateFallbackResponse(prompt, context)) {
      return this.generateTemplateCode(spec);
    }
    
    return response;
  }

  private generateTemplateCode(spec: ToolSpecification): string {
    return `/**
 * ${spec.name} - ${spec.description}
 * Auto-generated by Tool Maker Agent
 */

interface ${spec.name}Input {
${spec.inputs.map(input => `  ${input.name}: ${input.type};`).join('\n')}
}

interface ${spec.name}Output {
${spec.outputs.map(output => `  ${output.name}: ${output.type};`).join('\n')}
}

export class ${spec.name} {
  constructor() {
    // Initialize tool
  }

  async execute(input: ${spec.name}Input): Promise<${spec.name}Output> {
    try {
      // TODO: Implement tool logic
      ${spec.inputs.map(input => `
      // Process ${input.name}: ${input.description}`).join('')}
      
      // Return result
      return {
${spec.outputs.map(output => `        ${output.name}: {} as ${output.type},`).join('\n')}
      };
    } catch (error) {
      throw new Error(\`${spec.name} execution failed: \${error}\`);
    }
  }
}

export default ${spec.name};`;
  }

  private async customizeTool(input: any, context: AgentContext): Promise<any> {
    // Tool customization logic
    return {
      customized: true,
      modifications: [],
      newCapabilities: [],
    };
  }

  private async generateIntegration(input: any, context: AgentContext): Promise<any> {
    // Integration generation logic
    return {
      integrationCode: '',
      setupSteps: [],
      configuration: {},
    };
  }

  private generateIntegrationSteps(spec: ToolSpecification): string[] {
    const steps = [
      `1. Save the generated code to a new file: ${spec.name.toLowerCase()}.ts`,
      `2. Install dependencies: ${spec.dependencies.join(', ') || 'None required'}`,
      `3. Import the tool in your project: import ${spec.name} from './${spec.name.toLowerCase()}'`,
      `4. Initialize the tool: const tool = new ${spec.name}()`,
      `5. Use the tool: const result = await tool.execute(input)`,
    ];
    
    return steps;
  }

  private async generateToolDocumentation(spec: ToolSpecification, context: AgentContext): Promise<string> {
    return `# ${spec.name}

## Description
${spec.description}

## Installation
\`\`\`bash
# Install dependencies
${spec.dependencies.length > 0 ? `npm install ${spec.dependencies.join(' ')}` : '# No dependencies required'}
\`\`\`

## Usage
\`\`\`typescript
import ${spec.name} from './${spec.name.toLowerCase()}';

const tool = new ${spec.name}();
const result = await tool.execute({
${spec.inputs.map(input => `  ${input.name}: value,`).join('\n')}
});
\`\`\`

## API Reference

### Inputs
${spec.inputs.map(input => `- **${input.name}** (${input.type}): ${input.description}`).join('\n')}

### Outputs
${spec.outputs.map(output => `- **${output.name}** (${output.type}): ${output.description}`).join('\n')}

## Test Cases
${spec.testCases.map((test, i) => `
### Test ${i + 1}: ${test.description}
Input: \`${JSON.stringify(test.input)}\`
Expected Output: \`${JSON.stringify(test.expectedOutput)}\`
`).join('\n')}
`;
  }

  private validateTool(spec: ToolSpecification, code: string): string[] {
    const warnings: string[] = [];
    
    if (!spec.name || spec.name.length < 3) {
      warnings.push('Tool name is too short or missing');
    }
    
    if (spec.inputs.length === 0) {
      warnings.push('Tool has no defined inputs');
    }
    
    if (spec.outputs.length === 0) {
      warnings.push('Tool has no defined outputs');
    }
    
    if (!code || code.length < 100) {
      warnings.push('Generated code seems too short');
    }
    
    if (spec.testCases.length === 0) {
      warnings.push('No test cases generated');
    }
    
    return warnings;
  }

  private generateToolName(purpose: string): string {
    // Extract key words and create a camelCase name
    const words = purpose.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(' ')
      .filter(word => word.length > 2 && !['the', 'and', 'for', 'with'].includes(word))
      .slice(0, 3);
    
    if (words.length === 0) {
      return 'CustomTool';
    }
    
    return words.map((word, i) => 
      i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
    ).join('') + 'Tool';
  }

  private inferDependencies(requirements: any): string[] {
    const deps: string[] = [];
    const purpose = (requirements.purpose || '').toLowerCase();
    
    if (purpose.includes('http') || purpose.includes('api') || purpose.includes('web')) {
      deps.push('axios');
    }
    
    if (purpose.includes('file') || purpose.includes('fs')) {
      deps.push('fs-extra');
    }
    
    if (purpose.includes('database') || purpose.includes('sql')) {
      deps.push('@supabase/supabase-js');
    }
    
    if (purpose.includes('date') || purpose.includes('time')) {
      deps.push('date-fns');
    }
    
    return [...new Set(deps)];
  }

  private generateTestCases(requirements: any): any[] {
    // Generate basic test cases based on inputs/outputs
    const testCases: any[] = [];
    
    if (requirements.inputs && requirements.inputs.length > 0) {
      testCases.push({
        description: 'Basic functionality test',
        input: requirements.inputs.reduce((acc: any, input: any) => {
          acc[input.name] = this.generateSampleValue(input.type);
          return acc;
        }, {}),
        expectedOutput: requirements.outputs?.reduce((acc: any, output: any) => {
          acc[output.name] = this.generateSampleValue(output.type);
          return acc;
        }, {}) || {},
      });
    }
    
    return testCases;
  }

  private generateSampleValue(type: string): any {
    switch (type.toLowerCase()) {
      case 'string':
        return 'sample string';
      case 'number':
        return 42;
      case 'boolean':
        return true;
      case 'array':
        return [];
      case 'object':
        return {};
      default:
        return null;
    }
  }

  private loadToolTemplates(): void {
    // Load common tool templates
    this.toolTemplates.set('api_client', {
      name: 'APIClient',
      template: 'http client with retry logic',
    });
    
    this.toolTemplates.set('data_processor', {
      name: 'DataProcessor',
      template: 'data transformation pipeline',
    });
    
    this.toolTemplates.set('file_handler', {
      name: 'FileHandler',
      template: 'file operations wrapper',
    });
  }
}

export default ToolMakerAgent;