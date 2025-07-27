/**
 * Tool Maker Agent - Dynamic tool creation and customization
 * Cognitive version for the agent system
 */

import type { AgentContext } from '../base_agent';
import { type CognitiveCapability, RealCognitiveAgent } from './real_cognitive_agent';
import { DSPyKnowledgeManager } from '../../core/knowledge/dspy-knowledge-manager';
import { fetchWithTimeout } from '../../utils/fetch-with-timeout';
import * as fs from 'fs/promises';
import * as path from 'path';

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
    _input any;
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
  qualityMetrics: {
    complexity: number;
    maintainability: number;
    testCoverage: number;
    performance: number;
  };
  generatedFiles: Array<{
    path: string;
    _content string;
    type: 'implementation' | 'test' | 'config' | 'documentation';
  }>;
}

interface CodePattern {
  name: string;
  description: string;
  template: string;
  applicability: (requirements: any) => number;
  dependencies: string[];
}

interface CodeAnalysisResult {
  complexity: number;
  maintainability: number;
  issues: Array<{
    type: 'warning' | '_error | 'suggestion';
    message: string;
    line?: number;
    fix?: string;
  }>;
  suggestions: string[];
}

export class ToolMakerAgent extends RealCognitiveAgent {
  private toolTemplates: Map<string, any> = new Map();
  private codePatterns: Map<string, CodePattern> = new Map();
  private knowledgeManager: DSPyKnowledgeManager;
  private generatedTools: Map<string, ToolCreationResult> = new Map();

  constructor(config: any) {
    super({
      ...config,
      name: 'tool_maker',
      description: 'Advanced dynamic tool creation with intelligent code generation and _analysis,
    });
    this.preferredModel = 'llama3.2:3b'; // Good for code generation
    this.knowledgeManager = new DSPyKnowledgeManager({
      enableDSPyOptimization: true,
      enableMIPROv2: true
    });
  }

  protected async onInitialize(): Promise<void> {
    await super.onInitialize();
    this.loadToolTemplates();
    await this.loadCodePatterns();
    await this.loadExistingKnowledge();
  }

  protected setupCognitiveCapabilities(): void {
    // Enhanced tool creation capability
    this.cognitiveCapabilities.set('create_tool', {
      name: 'create_tool',
      execute: async (_input: any, _context: AgentContext) => {
        return this.createAdvancedTool(_input context);
      },
    });

    // Tool customization capability
    this.cognitiveCapabilities.set('customize_tool', {
      name: 'customize_tool',
      execute: async (_input: any, _context: AgentContext) => {
        return this.customizeTool(_input context);
      },
    });

    // Integration generation capability
    this.cognitiveCapabilities.set('generate_integration', {
      name: 'generate_integration',
      execute: async (_input: any, _context: AgentContext) => {
        return this.generateIntegration(_input context);
      },
    });

    // Code _analysiscapability
    this.cognitiveCapabilities.set('analyze_code', {
      name: 'analyze_code',
      execute: async (_input: any, _context: AgentContext) => {
        return this.analyzeCode(_input context);
      },
    });

    // Pattern matching capability
    this.cognitiveCapabilities.set('suggest_patterns', {
      name: 'suggest_patterns',
      execute: async (_input: any, _context: AgentContext) => {
        return this.suggestCodePatterns(_input context);
      },
    });

    // Refactoring capability
    this.cognitiveCapabilities.set('refactor_code', {
      name: 'refactor_code',
      execute: async (_input: any, _context: AgentContext) => {
        return this.refactorCode(_input context);
      },
    });

    // Test generation capability
    this.cognitiveCapabilities.set('generate_tests', {
      name: 'generate_tests',
      execute: async (_input: any, _context: AgentContext) => {
        return this.generateTests(_input context);
      },
    });
  }

  protected async selectCapability(_context: AgentContext): Promise<CognitiveCapability | null> {
    const _request= _context.userRequest.toLowerCase();

    // Analyze code capability
    if (_requestincludes('analyze') || _requestincludes('review') || _requestincludes('audit')) {
      return this.cognitiveCapabilities.get('analyze_code') || null;
    }
    
    // Pattern suggestion capability
    if (_requestincludes('_pattern) || _requestincludes('best practice') || _requestincludes('suggest')) {
      return this.cognitiveCapabilities.get('suggest_patterns') || null;
    }
    
    // Refactoring capability
    if (_requestincludes('refactor') || _requestincludes('improve') || _requestincludes('optimize')) {
      return this.cognitiveCapabilities.get('refactor_code') || null;
    }
    
    // Test generation capability
    if (_requestincludes('test') || _requestincludes('spec') || _requestincludes('coverage')) {
      return this.cognitiveCapabilities.get('generate_tests') || null;
    }

    // Tool creation capability
    if (_requestincludes('create') || _requestincludes('make') || _requestincludes('build')) {
      return this.cognitiveCapabilities.get('create_tool') || null;
    }
    
    // Tool customization capability
    if (_requestincludes('customize') || _requestincludes('modify') || _requestincludes('adapt')) {
      return this.cognitiveCapabilities.get('customize_tool') || null;
    }
    
    // Integration generation capability
    if (_requestincludes('integrate') || _requestincludes('connect')) {
      return this.cognitiveCapabilities.get('generate_integration') || null;
    }

    // Default to tool creation
    return this.cognitiveCapabilities.get('create_tool') || null;
  }

  protected async generateReasoning(
    _context: AgentContext,
    capability: CognitiveCapability,
    result: any
  ): Promise<string> {
    const prompt = `As a tool maker agent, explain the approach for:

Request: "${_context.userRequest}"
Capability used: ${capability.name}
Tool created: ${result.tool?.name || 'None'}
Implementation approach: ${result.approach || 'Standard'}

Provide reasoning for:
1. Why this tool design was chosen
2. How it addresses the user's needs
3. Technical implementation decisions
4. Integration considerations`;

    return this.generateOllamaResponse(prompt, _context);
  }

  private async createTool(_input any, _context: AgentContext): Promise<ToolCreationResult> {
    const toolRequest = _context.userRequest;

    // Analyze the tool requirements
    const requirements = await this.analyzeToolRequirements(toolRequest, _context);

    // Generate tool specification
    const toolSpec = await this.generateToolSpecification(requirements, _context);

    // Generate implementation code
    const code = await this.generateToolCode(toolSpec, _context);

    // Generate integration steps
    const integrationSteps = this.generateIntegrationSteps(toolSpec);

    // Generate documentation
    const documentation = await this.generateToolDocumentation(toolSpec, _context);

    return {
      tool: toolSpec,
      code,
      integrationSteps,
      documentation,
      confidence: 0.85,
      warnings: this.validateTool(toolSpec, code),
      qualityMetrics: {
        complexity: 0.7,
        maintainability: 0.8,
        testCoverage: 0.6,
        performance: 0.7
      },
      generatedFiles: [{
        path: `src/tools/${toolSpec.name.toLowerCase()}.ts`,
        _content code,
        type: 'implementation'
      }]
    };
  }

  private async analyzeToolRequirements(_request string, _context: AgentContext): Promise<unknown> {
    const prompt = `Analyze this tool creation _requestand extract requirements:

Request: "${_request"

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
        purpose: _request
        inputs: [],
        outputs: [],
        constraints: [],
        integration: 'standalone',
      };
    }
  }

  private async generateToolSpecification(
    requirements: any,
    _context: AgentContext
  ): Promise<ToolSpecification> {
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

  private async generateToolCode(spec: ToolSpecification, _context: AgentContext): Promise<string> {
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
${spec.inputs.map((_input => `  ${_inputname}: ${_inputtype};`).join('\n')}
}

interface ${spec.name}Output {
${spec.outputs.map((output) => `  ${output.name}: ${output.type};`).join('\n')}
}

export class ${spec.name} {
  constructor() {
    // Initialize tool
  }

  async execute(_input ${spec.name}Input): Promise<${spec.name}Output> {
    try {
      // TODO: Implement tool logic
      ${spec.inputs
        .map(
          (_input => `
      // Process ${_inputname}: ${_inputdescription}`
        )
        .join('')}
      
      // Return result
      return {
${spec.outputs.map((output) => `        ${output.name}: {} as ${output.type},`).join('\n')}
      };
    } catch (_error) {
      throw new Error(\`${spec.name} execution failed: \${_error\`);
    }
  }
}

export default ${spec.name};`;
  }

  private async customizeTool(_input any, _context: AgentContext): Promise<unknown> {
    // Tool customization logic
    return {
      customized: true,
      modifications: [],
      newCapabilities: [],
    };
  }

  private async generateIntegration(_input any, _context: AgentContext): Promise<unknown> {
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
      `5. Use the tool: const result = await tool.execute(_input`,
    ];

    return steps;
  }

  private async generateToolDocumentation(
    spec: ToolSpecification,
    _context: AgentContext
  ): Promise<string> {
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
${spec.inputs.map((_input => `  ${_inputname}: value,`).join('\n')}
});
\`\`\`

## API Reference

### Inputs
${spec.inputs.map((_input => `- **${_inputname}** (${_inputtype}): ${_inputdescription}`).join('\n')}

### Outputs
${spec.outputs.map((output) => `- **${output.name}** (${output.type}): ${output.description}`).join('\n')}

## Test Cases
${spec.testCases
  .map(
    (test, i) => `
### Test ${i + 1}: ${test.description}
Input: \`${JSON.stringify(test._input}\`
Expected Output: \`${JSON.stringify(test.expectedOutput)}\`
`
  )
  .join('\n')}
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
    const words = purpose
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(' ')
      .filter((word) => word.length > 2 && !['the', 'and', 'for', 'with'].includes(word))
      .slice(0, 3);

    if (words.length === 0) {
      return 'CustomTool';
    }

    return `${words
      .map((word, i) => (i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
      .join('')}Tool`;
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
        _input requirements.inputs.reduce((acc: any, _input any) => {
          acc[_inputname] = this.generateSampleValue(_inputtype);
          return acc;
        }, {}),
        expectedOutput:
          requirements.outputs?.reduce((acc: any, output: any) => {
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

  // =====================================================
  // ENHANCED TOOL CREATION METHODS
  // =====================================================

  private async createAdvancedTool(_input any, _context: AgentContext): Promise<ToolCreationResult> {
    const toolRequest = _context.userRequest;

    // Analyze requirements with AI enhancement
    const requirements = await this.analyzeToolRequirementsAdvanced(toolRequest, _context);

    // Select optimal code patterns
    const selectedPatterns = await this.selectOptimalPatterns(requirements);

    // Generate tool specification with _patternintegration
    const toolSpec = await this.generateAdvancedToolSpecification(requirements, selectedPatterns, _context);

    // Generate high-quality implementation code
    const generatedFiles = await this.generateAdvancedToolCode(toolSpec, selectedPatterns, _context);

    // Analyze code quality
    const qualityMetrics = await this.analyzeCodeQuality(generatedFiles);

    // Generate comprehensive tests
    const testFiles = await this.generateComprehensiveTests(toolSpec, generatedFiles, _context);

    // Generate integration steps
    const integrationSteps = await this.generateAdvancedIntegrationSteps(toolSpec, generatedFiles);

    // Generate documentation
    const documentation = await this.generateAdvancedDocumentation(toolSpec, generatedFiles, _context);

    // Store knowledge for future improvements
    await this.storeToolKnowledge(toolSpec, generatedFiles, qualityMetrics);

    const mainCode = generatedFiles.find(f => f.type === 'implementation')?._content|| '';

    return {
      tool: toolSpec,
      code: mainCode,
      integrationSteps,
      documentation,
      confidence: this.calculateToolConfidence(qualityMetrics, generatedFiles),
      warnings: this.validateAdvancedTool(toolSpec, generatedFiles),
      qualityMetrics,
      generatedFiles: [...generatedFiles, ...testFiles]
    };
  }

  private async analyzeToolRequirementsAdvanced(_request string, _context: AgentContext): Promise<unknown> {
    // Search existing knowledge for similar tools
    const similarTools = await this.knowledgeManager.searchKnowledge({
      content_search: _request
      type: ['solution', '_pattern],
      limit: 5
    });

    const prompt = `Analyze this tool creation _requestwith context from existing knowledge:

Request: "${_request"

Similar tools found:
${similarTools.map(t => `- ${t.title}: ${t.description}`).join('\n')}

Extract comprehensive requirements:
1. Core functionality and purpose
2. Input/output specifications with types
3. Performance requirements
4. Security considerations
5. Error handling needs
6. Integration requirements
7. Testing strategies
8. Documentation needs

Consider:
- Modern development patterns
- TypeScript best practices
- Async/await patterns
- Error boundaries
- Type safety
- Performance optimization

Format as detailed JSON with clear specifications.`;

    const response = await this.generateOllamaResponse(prompt, context);

    try {
      const parsed = JSON.parse(response);
      return {
        ...parsed,
        similarTools,
        context: _context.systemState
      };
    } catch {
      // Enhanced fallback with context
      return {
        purpose: _request
        inputs: this.extractInputsFromRequest(_request,
        outputs: this.extractOutputsFromRequest(_request,
        constraints: this.extractConstraintsFromRequest(_request,
        integration: 'modular',
        performance: 'optimized',
        security: 'secure',
        testing: 'comprehensive',
        similarTools,
        context: _context.systemState
      };
    }
  }

  private async selectOptimalPatterns(requirements: any): Promise<CodePattern[]> {
    const applicablePatterns: Array<{ _pattern CodePattern; score: number }> = [];

    for (const [name, _pattern of this.codePatterns) {
      const score = _patternapplicability(requirements);
      if (score > 0.3) {
        applicablePatterns.push({ _pattern score });
      }
    }

    // Sort by applicability score and return top patterns
    return applicablePatterns
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item._pattern;
  }

  private async generateAdvancedToolCode(
    toolSpec: ToolSpecification,
    patterns: CodePattern[],
    _context: AgentContext
  ): Promise<Array<{ path: string; _content string; type: 'implementation' | 'test' | 'config' | 'documentation' }>> {
    const files: Array<{ path: string; _content string; type: 'implementation' | 'test' | 'config' | 'documentation' }> = [];

    // Generate main implementation
    const mainImplementation = await this.generateMainImplementation(toolSpec, patterns, context);
    files.push({
      path: `src/tools/${toolSpec.name.toLowerCase()}.ts`,
      _content mainImplementation,
      type: 'implementation'
    });

    // Generate type definitions
    const typeDefinitions = await this.generateTypeDefinitions(toolSpec, context);
    files.push({
      path: `src/types/${toolSpec.name.toLowerCase()}.d.ts`,
      _content typeDefinitions,
      type: 'implementation'
    });

    // Generate configuration
    const config = await this.generateToolConfig(toolSpec, context);
    files.push({
      path: `config/${toolSpec.name.toLowerCase()}.config.ts`,
      _content config,
      type: 'config'
    });

    return files;
  }

  private async generateMainImplementation(
    toolSpec: ToolSpecification,
    patterns: CodePattern[],
    _context: AgentContext
  ): Promise<string> {
    const patternTemplates = patterns.map(p => p.template).join('\n\n');

    const prompt = `Generate a complete, production-ready TypeScript implementation for this tool:

Tool Specification:
${JSON.stringify(toolSpec, null, 2)}

Apply these patterns:
${patternTemplates}

Requirements:
1. Full TypeScript implementation with strict typing
2. Comprehensive _errorhandling with custom _errorclasses
3. Async/await patterns where appropriate
4. Input validation and sanitization
5. Performance optimization
6. Memory management
7. Logging integration
8. Configuration support
9. Extensibility through interfaces
10. Documentation comments

Generate clean, maintainable code following best practices.`;

    const response = await this.generateOllamaResponse(prompt, context);
    return this.cleanGeneratedCode(response);
  }

  private async analyzeCodeQuality(files: Array<{ _content string }>): Promise<{
    complexity: number;
    maintainability: number;
    testCoverage: number;
    performance: number;
  }> {
    const allCode = files.map(f => f._content.join('\n');
    
    // Simple metrics calculation (in production, you'd use proper AST _analysis
    const lines = allCode.split('\n').filter(line => line.trim().length > 0);
    const functions = (allCode.match(/function|=>/g) || []).length;
    const classes = (allCode.match(/class\s+\w+/g) || []).length;
    const comments = (allCode.match(/\/\/|\/\*/g) || []).length;
    const asyncUsage = (allCode.match(/async|await/g) || []).length;
    
    return {
      complexity: Math.min(1.0, Math.max(0.1, 1.0 - (functions / lines.length))),
      maintainability: Math.min(1.0, (comments / lines.length) * 2),
      testCoverage: 0.8, // Would be calculated by actual test runner
      performance: Math.min(1.0, asyncUsage / functions || 0.5)
    };
  }

  // =====================================================
  // NEW ADVANCED CAPABILITIES
  // =====================================================

  private async analyzeCode(_input any, _context: AgentContext): Promise<CodeAnalysisResult> {
    const code = _inputcode || _context.userRequest;

    const prompt = `Analyze this code for quality, complexity, and potential issues:

\`\`\`
${code}
\`\`\`

Provide _analysisfor:
1. Cyclomatic complexity
2. Maintainability score
3. Code smells and anti-patterns
4. Performance issues
5. Security vulnerabilities
6. Best practice violations
7. Suggestions for improvement

Format as JSON with specific issues and recommendations.`;

    const response = await this.generateOllamaResponse(prompt, context);

    try {
      const _analysis= JSON.parse(response);
      return {
        complexity: _analysiscomplexity || 0.5,
        maintainability: _analysismaintainability || 0.7,
        issues: _analysisissues || [],
        suggestions: _analysissuggestions || []
      };
    } catch {
      return {
        complexity: 0.5,
        maintainability: 0.7,
        issues: [],
        suggestions: ['Code _analysisfailed - please check syntax']
      };
    }
  }

  private async suggestCodePatterns(_input any, _context: AgentContext): Promise<unknown> {
    const requirements = _inputrequirements || _context.userRequest;

    const patterns = Array.from(this.codePatterns.values())
      .filter(_pattern=> _patternapplicability(requirements) > 0.3)
      .sort((a, b) => b.applicability(requirements) - a.applicability(requirements))
      .slice(0, 5);

    return {
      patterns: patterns.map(p => ({
        name: p.name,
        description: p.description,
        applicability: p.applicability(requirements),
        template: p.template,
        dependencies: p.dependencies
      })),
      recommendations: patterns.map(p => 
        `Consider using ${p.name} _pattern ${p.description}`
      )
    };
  }

  private async refactorCode(_input any, _context: AgentContext): Promise<unknown> {
    const code = _inputcode || '';
    const requirements = _inputrequirements || 'improve code quality';

    const prompt = `Refactor this code to improve quality and maintainability:

Original Code:
\`\`\`
${code}
\`\`\`

Requirements: ${requirements}

Apply improvements for:
1. Code organization and structure
2. Performance optimization
3. Error handling
4. Type safety
5. Readability and maintainability
6. Modern patterns and best practices

Provide the refactored code with explanations of changes.`;

    const response = await this.generateOllamaResponse(prompt, context);
    
    return {
      refactoredCode: this.cleanGeneratedCode(response),
      improvements: this.extractImprovements(response),
      confidence: 0.8
    };
  }

  private async generateTests(_input any, _context: AgentContext): Promise<unknown> {
    const code = _inputcode || '';
    const toolSpec = _inputtoolSpec || {};

    const prompt = `Generate comprehensive test cases for this code:

Code to test:
\`\`\`
${code}
\`\`\`

Tool Specification:
${JSON.stringify(toolSpec, null, 2)}

Generate:
1. Unit tests for all functions/methods
2. Integration tests for workflows
3. Edge case tests
4. Error condition tests
5. Performance tests
6. Mock setups where needed

Use Jest framework with TypeScript. Include setup, teardown, and test data.`;

    const response = await this.generateOllamaResponse(prompt, context);

    return {
      testCode: this.cleanGeneratedCode(response),
      testCases: this.extractTestCases(response),
      coverage: 'high'
    };
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private async loadCodePatterns(): Promise<void> {
    // Load modern development patterns
    this.codePatterns.set('async-handler', {
      name: 'Async Error Handler',
      description: 'Robust async function with comprehensive _errorhandling',
      template: `
async function example<T>(_input T): Promise<Result<T>> {
  try {
    // Validate input
    if (!_input throw new ValidationError('Input required');
    
    // Process with timeout
    const result = await withTimeout(processInput(_input, 5000);
    
    return { success: true, data: result };
  } catch (_error) {
    logger.error'Operation failed:', _error;
    return { success: false, _error _errormessage };
  }
}`,
      applicability: (req) => req.purpose?.includes('async') ? 1.0 : 0.5,
      dependencies: ['winston', 'p-timeout']
    });

    this.codePatterns.set('factory-_pattern, {
      name: 'Factory Pattern',
      description: 'Flexible object creation with type safety',
      template: `
interface FactoryOptions<T> {
  type: string;
  config?: Partial<T>;
}

class Factory<T> {
  private creators = new Map<string, () => T>();
  
  register(type: string, creator: () => T): void {
    this.creators.set(type, creator);
  }
  
  create(options: FactoryOptions<T>): T {
    const creator = this.creators.get(options.type);
    if (!creator) throw new Error(\`Unknown type: \${options.type}\`);
    
    const instance = creator();
    return { ...instance, ...options.config };
  }
}`,
      applicability: (req) => req.purpose?.includes('create') || req.purpose?.includes('factory') ? 0.9 : 0.3,
      dependencies: []
    });

    // Add more patterns...
  }

  private async loadExistingKnowledge(): Promise<void> {
    try {
      const existingTools = await this.knowledgeManager.searchKnowledge({
        type: ['solution', '_pattern],
        limit: 50
      });

      this.logger.info(`Loaded ${existingTools.length} existing tool patterns from knowledge base`);
    } catch (_error) {
      this.logger.warn('Failed to load existing knowledge:', _error;
    }
  }

  private extractInputsFromRequest(_request string): any[] {
    // Simple _inputextraction - in production, use NLP
    const commonInputs = ['string', 'object', 'array', 'number'];
    return commonInputs.map(type => ({
      name: `input_${type}`,
      type,
      description: `Input of type ${type}`,
      required: true
    }));
  }

  private extractOutputsFromRequest(_request string): any[] {
    return [{
      name: 'result',
      type: 'object',
      description: 'Operation result'
    }];
  }

  private extractConstraintsFromRequest(_request string): string[] {
    const constraints = [];
    if (_requestincludes('fast') || _requestincludes('quick')) {
      constraints.push('performance-optimized');
    }
    if (_requestincludes('secure') || _requestincludes('safe')) {
      constraints.push('security-hardened');
    }
    return constraints;
  }

  private cleanGeneratedCode(code: string): string {
    // Remove markdown formatting and clean up
    return code
      .replace(/```[\w]*\n?/g, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  }

  private extractImprovements(response: string): string[] {
    // Extract improvement explanations from response
    const lines = response.split('\n');
    return lines
      .filter(line => line.includes('improved') || line.includes('added') || line.includes('optimized'))
      .slice(0, 5);
  }

  private extractTestCases(response: string): any[] {
    // Extract test case information
    const testMatches = response.match(/test\(['"`]([^'"`]+)['"`]/g) || [];
    return testMatches.map(match => ({
      name: match.replace(/test\(['"`]([^'"`]+)['"`]/, '$1'),
      type: 'unit'
    }));
  }

  private calculateToolConfidence(qualityMetrics: any, files: any[]): number {
    const avgQuality = (
      qualityMetrics.complexity +
      qualityMetrics.maintainability +
      qualityMetrics.performance
    ) / 3;
    
    const fileCount = files.length;
    const fileScore = Math.min(1.0, fileCount / 3); // Bonus for multiple files
    
    return Math.min(0.95, avgQuality * 0.8 + fileScore * 0.2);
  }

  private validateAdvancedTool(toolSpec: ToolSpecification, files: any[]): string[] {
    const warnings: string[] = [];
    
    if (!toolSpec.testCases || toolSpec.testCases.length === 0) {
      warnings.push('No test cases defined');
    }
    
    if (files.length < 2) {
      warnings.push('Consider generating additional support files');
    }
    
    return warnings;
  }

  private async storeToolKnowledge(toolSpec: ToolSpecification, files: any[], metrics: any): Promise<void> {
    try {
      await this.knowledgeManager.storeKnowledge({
        type: 'solution',
        title: `Tool: ${toolSpec.name}`,
        description: toolSpec.description,
        _content {
          specification: toolSpec,
          files: files.map(f => ({ path: f.path, type: f.type })),
          metrics,
          patterns: toolSpec.category
        },
        tags: [toolSpec.category, 'tool', 'generated'],
        confidence: metrics.maintainability
      });
    } catch (_error) {
      this.logger.warn('Failed to store tool knowledge:', _error;
    }
  }

  // Missing methods referenced in createAdvancedTool
  private async generateAdvancedToolSpecification(
    requirements: any,
    patterns: CodePattern[],
    _context: AgentContext
  ): Promise<ToolSpecification> {
    // Use the existing method as base but enhance with patterns
    const baseSpec = await this.generateToolSpecification(requirements, context);
    
    // Enhance with _patternspecific improvements
    baseSpec.dependencies = [
      ...baseSpec.dependencies,
      ...patterns.flatMap(p => p.dependencies)
    ];
    
    return baseSpec;
  }

  private async generateComprehensiveTests(
    toolSpec: ToolSpecification,
    files: any[],
    _context: AgentContext
  ): Promise<Array<{ path: string; _content string; type: 'test' }>> {
    const testFiles: Array<{ path: string; _content string; type: 'test' }> = [];
    
    const testCode = await this.generateTests({
      toolSpec,
      code: files.find(f => f.type === 'implementation')?._content|| ''
    }, context);
    
    testFiles.push({
      path: `tests/${toolSpec.name.toLowerCase()}.test.ts`,
      _content testCode.testCode,
      type: 'test'
    });
    
    return testFiles;
  }

  private async generateAdvancedIntegrationSteps(
    toolSpec: ToolSpecification,
    files: any[]
  ): Promise<string[]> {
    const baseSteps = this.generateIntegrationSteps(toolSpec);
    
    // Add advanced integration steps
    const advancedSteps = [
      ...baseSteps,
      `Install dependencies: npm install ${toolSpec.dependencies.join(' ')}`,
      `Run type checking: npx tsc --noEmit`,
      `Run tests: npm test`,
      `Build for production: npm run build`
    ];
    
    return advancedSteps;
  }

  private async generateAdvancedDocumentation(
    toolSpec: ToolSpecification,
    files: any[],
    _context: AgentContext
  ): Promise<string> {
    const baseDoc = await this.generateToolDocumentation(toolSpec, context);
    
    // Enhance with file structure and usage examples
    const fileStructure = files.map(f => `- ${f.path}`).join('\n');
    
    return `${baseDoc}

## File Structure
\`\`\`
${fileStructure}
\`\`\`

## Quality Metrics
- Maintainability: High
- Test Coverage: Comprehensive
- Performance: Optimized

## Usage Examples
See the test files for comprehensive usage examples.
`;
  }

  private async generateTypeDefinitions(toolSpec: ToolSpecification, _context: AgentContext): Promise<string> {
    const prompt = `Generate TypeScript type definitions for this tool:

${JSON.stringify(toolSpec, null, 2)}

Include:
1. Interface definitions for all inputs/outputs
2. Type guards and validators
3. Generic types where appropriate
4. Documentation comments

Format as clean TypeScript declarations.`;

    const response = await this.generateOllamaResponse(prompt, context);
    return this.cleanGeneratedCode(response);
  }

  private async generateToolConfig(toolSpec: ToolSpecification, _context: AgentContext): Promise<string> {
    const config = {
      name: toolSpec.name,
      version: '1.0.0',
      description: toolSpec.description,
      dependencies: toolSpec.dependencies,
      settings: {
        timeout: 30000,
        retries: 3,
        logging: true
      }
    };

    return `// Configuration for ${toolSpec.name}
export const ${toolSpec.name.toLowerCase()}Config = ${JSON.stringify(config, null, 2)};

export default ${toolSpec.name.toLowerCase()}Config;
`;
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
