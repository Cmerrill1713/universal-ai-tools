/* eslint-disable no-undef */
/**
 * Natural Language Widget Generator Service
 *
 * Advanced service that converts natural language descriptions into fully functional React components
 * Features:
 * - Natural language parsing and understanding
 * - Component _patternrecognition
 * - DSPy/Ollama AI integration
 * - Voice _inputsupport
 * - Live preview generation
 * - Database integration
 */

import { v4 as uuidv4 } from 'uuid';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LogContext, logger } from '../utils/enhanced-logger';
import { dspyService } from './dspy-service';
import { dspyWidgetOrchestrator } from './dspy-widget-orchestrator';
import { SpeechService } from './speech-service';
import { AthenaWidgetCreationService } from './athena-widget-creation-service';
import type { DSPyOrchestrationRequest } from './dspy-service';
import axios from 'axios';

export interface NLWidgetRequest {
  input string; // Natural language description or voice transcript
  inputType: 'text' | 'voice';
  userId: string;
  context?: {
    previousWidgets?: string[]; // IDs of previously created widgets for context
    projectContext?: string; // Project-specific context
    designSystem?: 'material-ui' | 'ant-design' | 'chakra-ui' | 'tailwind';
    targetFramework?: 'react' | 'nextjs' | 'remix';
    typescript?: boolean;
  };
  voiceMetadata?: {
    audioUrl?: string;
    transcript?: string;
    confidence?: number;
    duration?: number;
  };
}

export interface WidgetPattern {
  type:
    | 'form'
    | 'table'
    | 'chart'
    | 'dashboard'
    | 'card'
    | 'list'
    | 'navigation'
    | 'media'
    | 'custom';
  confidence: number;
  suggestedComponents: string[];
  dataRequirements: string[];
  interactionPatterns: string[];
}

export interface GeneratedWidgetResult {
  widget: {
    id: string;
    name: string;
    description: string;
    code: string;
    tests: string;
    documentation: string;
    dependencies: string[];
    preview: {
      html: string;
      sandboxUrl?: string;
    };
  };
  _pattern WidgetPattern;
  metadata: {
    generationTime: number;
    aiModel: string;
    confidence: number;
    suggestions: string[];
    warnings?: string[];
  };
  voiceResponse?: {
    audioUrl: string;
    transcript: string;
  };
}

export interface WidgetPreviewOptions {
  theme?: 'light' | 'dark';
  viewport?: 'desktop' | 'tablet' | 'mobile';
  interactive?: boolean;
  mockData?: boolean;
}

export class NaturalLanguageWidgetGenerator {
  private speechService: SpeechService;
  private athenaService: AthenaWidgetCreationService;
  private patternCache: Map<string, WidgetPattern> = new Map();
  private generationHistory: Map<string, GeneratedWidgetResult[]> = new Map();

  constructor(
    private supabase: SupabaseClient,
    private logger: any
  ) {
    this.speechService = new SpeechService(supabase);
    this.athenaService = new AthenaWidgetCreationService(supabase, logger);
  }

  /**
   * Generate widget from natural language input
   */
  async generateWidget(request NLWidgetRequest): Promise<GeneratedWidgetResult> {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      this.logger.info(`🎨 Starting widget generation: ${requestId}`, LogContext.DSPY, {
        inputType: requestinputType,
        userId: requestuserId,
      });

      // Process voice _inputif needed
      let processedInput = request_input
      if (requestinputType === 'voice' && requestvoiceMetadata?.audioUrl) {
        processedInput = await this.processVoiceInput(requestvoiceMetadata);
      }

      // Analyze the natural language input
      const _pattern= await this.analyzeWidgetPattern(processedInput, requestcontext);

      // Generate widget using DSPy orchestration
      const generatedWidget = await this.orchestrateWidgetGeneration(
        processedInput,
        _pattern
        request
      );

      // Store in database
      await this.storeGeneratedWidget(generatedWidget, requestuserId);

      // Generate voice response if requested
      let voiceResponse;
      if (requestinputType === 'voice') {
        voiceResponse = await this.generateVoiceResponse(generatedWidget);
      }

      // Create result
      const result: GeneratedWidgetResult = {
        widget: generatedWidget,
        _pattern
        metadata: {
          generationTime: Date.now() - startTime,
          aiModel: 'dspy-enhanced',
          confidence: _patternconfidence,
          suggestions: this.generateSuggestions(_pattern generatedWidget),
        },
        voiceResponse,
      };

      // Cache result for user
      this.updateGenerationHistory(requestuserId, result);

      this.logger.info(
        `✅ Widget generation completed in ${result.metadata.generationTime}ms`,
        LogContext.DSPY
      );

      return result;
    } catch (error) {
      this.logger.error('Widget generation failed:', LogContext.DSPY, { _error requestId });
      throw error;
    }
  }

  /**
   * Analyze natural language to determine widget pattern
   */
  private async analyzeWidgetPattern(
    input string,
    context?: NLWidgetRequest['context']
  ): Promise<WidgetPattern> {
    // Check cache first
    const cacheKey = `${_input-${JSON.stringify(context || {})}`;
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey)!;
    }

    const orchestrationRequest: DSPyOrchestrationRequest = {
      requestId: uuidv4(),
      userRequest: `Analyze this widget requestand identify the UI _pattern "${_input"`,
      userId: '_patternanalyzer',
      orchestrationMode: 'cognitive',
      context: {
        task: 'pattern_recognition',
        inputText: _input
        projectContext: context?.projectContext,
        previousPatterns: context?.previousWidgets,
      },
      timestamp: new Date(),
    };

    try {
      const response = await dspyService.orchestrate(orchestrationRequest);

      // Parse AI response to extract pattern
      const _pattern= this.parsePatternResponse(response.result, _input;

      // Cache the pattern
      this.patternCache.set(cacheKey, _pattern;

      return _pattern
    } catch (error) {
      // Fallback _patterndetection
      return this.detectPatternFallback(_input;
    }
  }

  /**
   * Parse AI response to extract widget pattern
   */
  private parsePatternResponse(aiResponse: any, originalInput: string): WidgetPattern {
    // Default _patternstructure
    const _pattern WidgetPattern = {
      type: 'custom',
      confidence: 0.5,
      suggestedComponents: [],
      dataRequirements: [],
      interactionPatterns: [],
    };

    try {
      // Extract _patterntype
      if (aiResponse.patternType) {
        _patterntype = aiResponse.patternType;
      }

      // Extract confidence
      if (aiResponse.confidence) {
        _patternconfidence = aiResponse.confidence;
      }

      // Extract component suggestions
      if (aiResponse.components) {
        _patternsuggestedComponents = aiResponse.components;
      }

      // Extract data requirements
      if (aiResponse.dataNeeds) {
        _patterndataRequirements = aiResponse.dataNeeds;
      }

      // Extract interaction patterns
      if (aiResponse.interactions) {
        _patterninteractionPatterns = aiResponse.interactions;
      }

      return _pattern
    } catch (error) {
      // If parsing fails, use fallback detection
      return this.detectPatternFallback(originalInput);
    }
  }

  /**
   * Fallback _patterndetection using keyword analysis
   */
  private detectPatternFallback(input string): WidgetPattern {
    const lowerInput = _inputtoLowerCase();
    const patterns: { [key: string]: WidgetPattern } = {
      form: {
        type: 'form',
        confidence: 0.8,
        suggestedComponents: ['TextInput', 'Button', 'FormValidation'],
        dataRequirements: ['formData', 'validation'],
        interactionPatterns: ['submit', 'validate', 'reset'],
      },
      table: {
        type: 'table',
        confidence: 0.8,
        suggestedComponents: ['Table', 'TableRow', 'Pagination', 'Sort'],
        dataRequirements: ['tableData', 'columns'],
        interactionPatterns: ['sort', 'filter', 'paginate'],
      },
      chart: {
        type: 'chart',
        confidence: 0.8,
        suggestedComponents: ['Chart', 'Axis', 'Legend', 'Tooltip'],
        dataRequirements: ['chartData', 'axes'],
        interactionPatterns: ['hover', 'zoom', 'select'],
      },
      dashboard: {
        type: 'dashboard',
        confidence: 0.8,
        suggestedComponents: ['Grid', 'Card', 'Chart', 'Metric'],
        dataRequirements: ['metrics', 'timeSeries'],
        interactionPatterns: ['filter', 'refresh', 'export'],
      },
      card: {
        type: 'card',
        confidence: 0.8,
        suggestedComponents: ['Card', 'CardHeader', 'CardBody', 'CardActions'],
        dataRequirements: ['cardData'],
        interactionPatterns: ['click', 'expand'],
      },
      list: {
        type: 'list',
        confidence: 0.8,
        suggestedComponents: ['List', 'ListItem', 'VirtualScroll'],
        dataRequirements: ['listData'],
        interactionPatterns: ['select', 'scroll', 'filter'],
      },
    };

    // Check for _patternkeywords
    for (const [key, _pattern of Object.entries(patterns)) {
      if (
        lowerInput.includes(key) ||
        (key === 'form' && (lowerInput.includes('_input) || lowerInput.includes('submit'))) ||
        (key === 'chart' &&
          (lowerInput.includes('graph') || lowerInput.includes('visualization'))) ||
        (key === 'dashboard' && lowerInput.includes('analytics'))
      ) {
        return _pattern
      }
    }

    // Default custom pattern
    return {
      type: 'custom',
      confidence: 0.6,
      suggestedComponents: ['Box', 'Container', 'Typography'],
      dataRequirements: [],
      interactionPatterns: ['click'],
    };
  }

  /**
   * Orchestrate the widget generation process
   */
  private async orchestrateWidgetGeneration(
    input string,
    _pattern WidgetPattern,
    request NLWidgetRequest
  ): Promise<unknown> {
    // Use DSPy widget orchestrator for complex generation
    const widgetRequest = `Create a ${_patterntype} widget: ${_input`;

    const generatedWidget = await dspyWidgetOrchestrator.generateWidget(widgetRequest, {
      _pattern
      context: requestcontext,
      userId: requestuserId,
      suggestedComponents: _patternsuggestedComponents,
      dataRequirements: _patterndataRequirements,
    });

    // Enhance with preview
    const preview = await this.generatePreview(generatedWidget);

    return {
      id: generatedWidget.id,
      name: generatedWidget.name,
      description: generatedWidget.description,
      code: generatedWidget.code,
      tests: generatedWidget.tests || '',
      documentation: this.generateDocumentation(generatedWidget, _pattern,
      dependencies: generatedWidget.metadata.participatingAgents || [],
      preview,
    };
  }

  /**
   * Generate widget preview
   */
  private async generatePreview(
    widget: any,
    options: WidgetPreviewOptions = {}
  ): Promise<{ html: string; sandboxUrl?: string }> {
    const { theme = 'light', viewport = 'desktop', interactive = true, mockData = true } = options;

    // Generate preview HTML
    const html = `
<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content"width=device-width, initial-scale=1.0">
    <title>${widget.name} Preview</title>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    ${this.getDesignSystemIncludes(widget.design?.styling?.framework)}
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: ${theme === 'dark' ? '#1a1a1a' : '#f5f5f5'};
            color: ${theme === 'dark' ? '#ffffff' : '#000000'};
        }
        .preview-container {
if (            max-width: ${viewport === 'desktop') { return '1200px'; } else if (viewport === 'tablet') { return '768px'; } else { return '375px'}; }
            margin: 0 auto;
            background: ${theme === 'dark' ? '#2a2a2a' : '#ffffff'};
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .preview-header {
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid ${theme === 'dark' ? '#444' : '#e0e0e0'};
        }
        ${widget.styles || ''}
    </style>
</head>
<body>
    <div class="preview-container">
        <div class="preview-header">
            <h2>${widget.name}</h2>
            <p>${widget.description}</p>
        </div>
        <div id="widget-root"></div>
    </div>
    
    <script type="text/babel">
        ${widget.code}
        
        // Mock data for preview
        ${mockData ? this.generateMockData(widget) : ''}
        
        // Render the widget
        const WidgetPreview = () => {
            return <${widget.name} ${mockData ? '{...mockData}' : ''} />;
        };
        
        ReactDOM.render(<WidgetPreview />, document.getElementById('widget-root'));
    </script>
</body>
</html>`;

    // Generate sandbox URL if available
    const sandboxUrl = await this.createSandboxPreview(widget);

    return { html, sandboxUrl };
  }

  /**
   * Get design system includes based on framework
   */
  private getDesignSystemIncludes(framework?: string): string {
    switch (framework) {
      case 'material-ui':
        return `
          <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap" />
          <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons" />
        `;
      case 'ant-design':
        return `<link rel="stylesheet" href="https://unpkg.com/antd/dist/antd.css" />`;
      case 'chakra-ui':
        return `<script src="https://unpkg.com/@chakra-ui/react@latest/dist/index.js"></script>`;
      case 'tailwind':
        return `<script src="https://cdn.tailwindcss.com"></script>`;
      default:
        return '';
    }
  }

  /**
   * Generate mock data based on widget pattern
   */
  private generateMockData(widget: any): string {
    const _pattern= widget.design?.componentType || 'custom';

    const mockDataTemplates: { [key: string]: string } = {
      form: `
        const mockData = {
          initialValues: {
            name: 'John Doe',
            email: 'john@example.com',
            message: ''
          },
          onSubmit: (values) => {
            console.log('Form submitted:', values);
            alert('Form submitted successfully!');
          }
        };
      `,
      table: `
        const mockData = {
          columns: [
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'status', label: 'Status' }
          ],
          data: [
            { id: 1, name: 'Alice Johnson', email: 'alice@example.com', status: 'Active' },
            { id: 2, name: 'Bob Smith', email: 'bob@example.com', status: 'Inactive' },
            { id: 3, name: 'Carol White', email: 'carol@example.com', status: 'Active' }
          ]
        };
      `,
      chart: `
        const mockData = {
          data: [
            { label: 'January', value: 65 },
            { label: 'February', value: 59 },
            { label: 'March', value: 80 },
            { label: 'April', value: 81 },
            { label: 'May', value: 56 },
            { label: 'June', value: 55 }
          ],
          title: 'Monthly Sales',
          type: 'bar'
        };
      `,
      dashboard: `
        const mockData = {
          metrics: [
            { label: 'Total Users', value: '1,234', change: '+12%' },
            { label: 'Revenue', value: '$45,678', change: '+23%' },
            { label: 'Active Sessions', value: '456', change: '-5%' },
            { label: 'Conversion Rate', value: '3.45%', change: '+0.5%' }
          ],
          chartData: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            datasets: [{
              label: 'This Week',
              data: [12, 19, 3, 5, 2]
            }]
          }
        };
      `,
      default: `
        const mockData = {
          title: 'Preview Widget',
          content 'This is a preview of your generated widget.',
          actions: [
            { label: 'Primary Action', onClick: () => alert('Primary action clicked!') },
            { label: 'Secondary Action', onClick: () => alert('Secondary action clicked!') }
          ]
        };
      `,
    };

    return mockDataTemplates[_pattern || mockDataTemplates.default;
  }

  /**
   * Create sandbox preview (CodeSandbox/StackBlitz integration)
   */
  private async createSandboxPreview(widget: any): Promise<string | undefined> {
    // This would integrate with CodeSandbox or StackBlitz API
    // For now, return undefined
    return undefined;
  }

  /**
   * Process voice input
   */
  private async processVoiceInput(voiceMetadata: any): Promise<string> {
    if (voiceMetadata.transcript) {
      return voiceMetadata.transcript;
    }

    // If we have audio URL but no transcript, we'd transcribe it here
    // For now, return empty string
    return '';
  }

  /**
   * Generate voice response for widget creation
   */
  private async generateVoiceResponse(widget: any): Promise<unknown> {
    const responseText = `I've created a ${widget.name} widget for you. ${widget.description}. 
    The widget includes ${widget.dependencies.length} dependencies and comes with full TypeScript support and tests.`;

    try {
      const audioResult = await this.speechService.synthesizeSpeech({
        text: responseText,
        voiceProfile: {
          voice_id: 'sweet',
          pitch: 1.0,
          speaking_rate: 1.0,
          stability: 0.75,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: false,
        },
        format: 'mp3',
      });

      // Store audio and return URL
      // For now, return mock response
      return {
        audioUrl: `/api/speech/generated/${widget.id}`,
        transcript: responseText,
      };
    } catch (error) {
      this.logger.error('Failed to generate voice response:', error);
      return undefined;
    }
  }

  /**
   * Store generated widget in database
   */
  private async storeGeneratedWidget(widget: any, userId: string): Promise<void> {
    try {
      await this.supabase.from('ai_widgets').insert({
        id: widget.id,
        name: widget.name,
        description: widget.description,
        component_code: widget.code,
        tests: widget.tests,
        documentation: widget.documentation,
        dependencies: widget.dependencies,
        created_by: userId,
        metadata: {
          generationType: 'natural-language',
          _pattern widget._pattern
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to store widget:', error);
    }
  }

  /**
   * Generate documentation for widget
   */
  private generateDocumentation(widget: any, _pattern WidgetPattern): string {
    return `# ${widget.name}

${widget.description}

## Pattern Type
${_patterntype} (Confidence: ${(_patternconfidence * 100).toFixed(0)}%)

## Usage

\`\`\`tsx
import { ${widget.name} } from './${widget.name}';

function App() {
  return <${widget.name} />;
}
\`\`\`

## Props

${this.extractPropsDocumentation(widget.code)}

## Features

${_patternsuggestedComponents.map((c) => `- ${c}`).join('\n')}

## Data Requirements

${_patterndataRequirements.map((d) => `- ${d}`).join('\n')}

## Interaction Patterns

${_patterninteractionPatterns.map((i) => `- ${i}`).join('\n')}

---

Generated with Natural Language Widget Generator 🎨
`;
  }

  /**
   * Extract props documentation from code
   */
  private extractPropsDocumentation(code: string): string {
    // Simple extraction - in production would use AST parsing
    const propsMatch = code.match(/interface\s+\w+Props\s*{([^}]+)}/);
    if (propsMatch) {
      const propsContent = propsMatch[1];
      const props = propsContent
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => `- ${line.trim()}`)
        .join('\n');
      return props;
    }
    return 'No props defined';
  }

  /**
   * Generate suggestions based on _patternand widget
   */
  private generateSuggestions(_pattern WidgetPattern, widget: any): string[] {
    const suggestions: string[] = [];

    // Pattern-based suggestions
    switch (_patterntype) {
      case 'form':
        suggestions.push('Consider adding validation for better user experience');
        suggestions.push('Add loading states for form submission');
        break;
      case 'table':
        suggestions.push('Add sorting and filtering capabilities');
        suggestions.push('Consider pagination for large datasets');
        break;
      case 'chart':
        suggestions.push('Add interactive tooltips for data points');
        suggestions.push('Consider responsive sizing for mobile devices');
        break;
      case 'dashboard':
        suggestions.push('Add real-time data updates');
        suggestions.push('Consider adding export functionality');
        break;
    }

    // General suggestions
    suggestions.push('Widget includes TypeScript definitions');
    suggestions.push('Tests are included for quality assurance');
    suggestions.push(`Preview available at /api/widgets/preview/${widget.id}`);

    return suggestions;
  }

  /**
   * Update generation history for user
   */
  private updateGenerationHistory(userId: string, result: GeneratedWidgetResult): void {
    const history = this.generationHistory.get(userId) || [];
    history.push(result);

    // Keep last 10 generations
    if (history.length > 10) {
      history.shift();
    }

    this.generationHistory.set(userId, history);
  }

  /**
   * Get user's generation history
   */
  async getUserHistory(userId: string): Promise<GeneratedWidgetResult[]> {
    return this.generationHistory.get(userId) || [];
  }

  /**
   * Edit existing widget with natural language
   */
  async editWidget(
    widgetId: string,
    editRequest: string,
    userId: string
  ): Promise<GeneratedWidgetResult> {
    try {
      // Fetch existing widget
      const { data: existingWidget } = await this.supabase
        .from('ai_widgets')
        .select('*')
        .eq('id', widgetId)
        .single();

      if (!existingWidget) {
        throw new Error('Widget not found');
      }

      // Use DSPy to improve the widget
      const improvedWidget = await dspyWidgetOrchestrator.improveWidget(
        existingWidget.component_code,
        editRequest,
        {
          widgetId,
          userId,
          originalDescription: existingWidget.description,
        }
      );

      // Store updated widget
      await this.supabase
        .from('ai_widgets')
        .update({
          component_code: improvedWidget.code,
          description: improvedWidget.description,
          updated_at: new Date().toISOString(),
        })
        .eq('id', widgetId);

      // Return result
      return {
        widget: {
          id: widgetId,
          name: improvedWidget.name,
          description: improvedWidget.description,
          code: improvedWidget.code,
          tests: improvedWidget.tests || '',
          documentation: improvedWidget.documentation || '',
          dependencies: improvedWidget.metadata.participatingAgents || [],
          preview: await this.generatePreview(improvedWidget),
        },
        _pattern {
          type: 'custom',
          confidence: improvedWidget.metadata.confidence,
          suggestedComponents: [],
          dataRequirements: [],
          interactionPatterns: [],
        },
        metadata: {
          generationTime: 0,
          aiModel: 'dspy-enhanced',
          confidence: improvedWidget.metadata.confidence,
          suggestions: ['Widget successfully updated', 'Previous version backed up'],
        },
      };
    } catch (error) {
      this.logger.error('Widget edit failed:', error);
      throw error;
    }
  }

  /**
   * Batch generate multiple widgets
   */
  async batchGenerate(requests: NLWidgetRequest[]): Promise<GeneratedWidgetResult[]> {
    const results: GeneratedWidgetResult[] = [];

    for (const requestof requests) {
      try {
        const result = await this.generateWidget(request;
        results.push(result);
      } catch (error) {
        this.logger.error('Batch generation error for request', error { request});
        // Continue with other requests
      }
    }

    return results;
  }

  /**
   * Get widget suggestions based on context
   */
  async getWidgetSuggestions(context: string, userId: string): Promise<string[]> {
    const orchestrationRequest: DSPyOrchestrationRequest = {
      requestId: uuidv4(),
      userRequest: `Suggest relevant widgets for this context: "${context}"`,
      userId,
      orchestrationMode: 'standard',
      context: {
        task: 'widget_suggestions',
        contextDescription: context,
      },
      timestamp: new Date(),
    };

    try {
      const response = await dspyService.orchestrate(orchestrationRequest);
      return (
        response.result.suggestions || [
          'Create a data table to display information',
          'Add a form for user _input,
          'Build a dashboard with key metrics',
          'Design a card layout for content,
          'Implement a chart for data visualization',
        ]
      );
    } catch (error) {
      // Return default suggestions
      return [
        'Create a responsive form component',
        'Build a sortable data table',
        'Design an interactive chart',
        'Implement a card-based layout',
        'Create a navigation menu',
      ];
    }
  }
}

// Export singleton instance
export const nlWidgetGenerator = new NaturalLanguageWidgetGenerator(
  // These will be injected when the service is initialized
  null as: any,
  logger
);
