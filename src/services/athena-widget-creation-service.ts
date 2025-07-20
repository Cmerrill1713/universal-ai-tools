/**
 * Athena Widget Creation Service
 * 
 * Natural language to React component generation pipeline
 * Bridges Sweet Athena's conversation engine with the tool maker agent
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';
import { ToolMakerAgent } from '../agents/personal/tool_maker_agent';
import { AthenaConversationEngine } from './athena-conversation-engine';
import type { AgentContext } from '../agents/base_agent';
import axios from 'axios';
import { promises as fs } from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { v4 as uuidv4 } from 'uuid';

export interface WidgetRequest {
  description: string;
  userId: string;
  requirements?: {
    style?: 'material-ui' | 'styled-components' | 'tailwind' | 'custom';
    features?: string[];
    dataSource?: 'static' | 'api' | 'props';
    responsive?: boolean;
    theme?: 'light' | 'dark' | 'auto';
  };
  examples?: string[];
}

export interface WidgetComponent {
  id: string;
  name: string;
  description: string;
  code: string;
  styles?: string;
  tests?: string;
  dependencies: string[];
  propInterface?: string;
  documentation: string;
  preview?: string;
  exportReady: boolean;
}

export interface WidgetCreationResult {
  success: boolean;
  widget?: WidgetComponent;
  error?: string;
  warnings?: string[];
  suggestions?: string[];
}

interface ParsedWidgetRequirements {
  componentName: string;
  componentType: 'form' | 'table' | 'chart' | 'card' | 'list' | 'custom';
  props: Array<{ name: string; type: string; required: boolean }>;
  state: Array<{ name: string; type: string; initial: any }>;
  events: Array<{ name: string; handler: string }>;
  styling: {
    framework: string;
    theme: string;
    responsive: boolean;
  };
  features: string[];
}

export class AthenaWidgetCreationService {
  private toolMaker: ToolMakerAgent;
  private widgetCache: Map<string, WidgetComponent> = new Map();
  private templateCache: Map<string, string> = new Map();
  
  constructor(
    private supabase: SupabaseClient,
    private logger: Logger
  ) {
    this.toolMaker = new ToolMakerAgent(supabase);
    this.initializeTemplates();
  }

  /**
   * Create a widget from natural language description
   */
  async createWidget(request: WidgetRequest): Promise<WidgetCreationResult> {
    try {
      this.logger.info(`Creating widget from description: ${request.description}`);

      // Parse the natural language description
      const parsed = await this.parseWidgetDescription(request);
      
      // Generate the React component
      const component = await this.generateReactComponent(parsed, request);
      
      // Validate the generated code
      const validation = await this.validateComponent(component);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Generated component failed validation',
          warnings: validation.errors,
          suggestions: validation.suggestions
        };
      }
      
      // Generate tests
      component.tests = await this.generateComponentTests(component, parsed);
      
      // Generate documentation
      component.documentation = await this.generateDocumentation(component, parsed);
      
      // Store widget in database
      await this.storeWidget(component, request.userId);
      
      // Cache the widget
      this.widgetCache.set(component.id, component);
      
      return {
        success: true,
        widget: component,
        suggestions: [
          'You can preview the widget at /api/widgets/preview/' + component.id,
          'Export as a zip file at /api/widgets/export/' + component.id,
          'The widget includes TypeScript definitions and tests'
        ]
      };

    } catch (error) {
      this.logger.error('Widget creation failed:', error);
      return {
        success: false,
        error: (error as Error).message,
        suggestions: ['Try providing more specific requirements', 'Include example usage']
      };
    }
  }

  /**
   * Parse natural language description into structured requirements
   */
  private async parseWidgetDescription(request: WidgetRequest): Promise<ParsedWidgetRequirements> {
    const prompt = `Parse this widget description into structured requirements:

Description: "${request.description}"
Additional Requirements: ${JSON.stringify(request.requirements || {})}
Examples: ${JSON.stringify(request.examples || [])}

Extract:
1. Component name (PascalCase)
2. Component type (form, table, chart, card, list, custom)
3. Props needed (name, type, required)
4. State variables (name, type, initial value)
5. Event handlers needed
6. Styling framework preference
7. Key features

Respond with JSON matching this structure:
{
  "componentName": "string",
  "componentType": "string",
  "props": [{"name": "string", "type": "string", "required": boolean}],
  "state": [{"name": "string", "type": "string", "initial": any}],
  "events": [{"name": "string", "handler": "string"}],
  "styling": {
    "framework": "string",
    "theme": "string",
    "responsive": boolean
  },
  "features": ["string"]
}`;

    try {
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'deepseek-r1:14b',
        prompt,
        stream: false,
        format: 'json'
      });

      return JSON.parse(response.data.response);
    } catch (error) {
      // Fallback parsing
      return this.fallbackParsing(request);
    }
  }

  /**
   * Generate React component code
   */
  private async generateReactComponent(
    parsed: ParsedWidgetRequirements,
    request: WidgetRequest
  ): Promise<WidgetComponent> {
    const template = this.getTemplate(parsed.componentType);
    const stylingFramework = request.requirements?.style || parsed.styling.framework;
    
    const prompt = `Generate a production-ready React component with TypeScript:

Component Name: ${parsed.componentName}
Type: ${parsed.componentType}
Description: ${request.description}

Props: ${JSON.stringify(parsed.props, null, 2)}
State: ${JSON.stringify(parsed.state, null, 2)}
Events: ${JSON.stringify(parsed.events, null, 2)}
Features: ${parsed.features.join(', ')}

Styling: ${stylingFramework}
Theme: ${parsed.styling.theme}
Responsive: ${parsed.styling.responsive}

Template Context:
${template}

Generate:
1. Complete React component with TypeScript
2. Proper prop interface definition
3. ${stylingFramework} styles (styled-components, Material-UI, or Tailwind)
4. Error handling and loading states
5. Accessibility features (ARIA labels, keyboard navigation)
6. Performance optimizations (React.memo, useMemo where appropriate)

The component should be:
- Self-contained and reusable
- Well-documented with JSDoc comments
- Following React best practices
- Properly typed with TypeScript

Respond with JSON:
{
  "componentCode": "Complete component code",
  "propInterface": "TypeScript interface definition",
  "styles": "CSS/styled-components code",
  "dependencies": ["package names"],
  "usage": "Example usage code"
}`;

    try {
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'deepseek-r1:14b',
        prompt,
        stream: false,
        format: 'json'
      });

      const generated = JSON.parse(response.data.response);
      
      const widgetId = uuidv4();
      
      return {
        id: widgetId,
        name: parsed.componentName,
        description: request.description,
        code: this.formatComponentCode(generated.componentCode, parsed.componentName),
        styles: generated.styles,
        propInterface: generated.propInterface,
        dependencies: this.extractDependencies(generated.dependencies, stylingFramework),
        documentation: '',
        preview: generated.usage,
        exportReady: true
      };

    } catch (error) {
      throw new Error(`Component generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Format component code with proper imports and structure
   */
  private formatComponentCode(code: string, componentName: string): string {
    // Ensure proper imports are at the top
    const imports = [
      `import React from 'react';`,
      `import type { FC } from 'react';`
    ];

    // Add imports based on code content
    if (code.includes('useState')) {
      imports.push(`import { useState } from 'react';`);
    }
    if (code.includes('useEffect')) {
      imports.push(`import { useEffect } from 'react';`);
    }
    if (code.includes('useMemo')) {
      imports.push(`import { useMemo } from 'react';`);
    }
    if (code.includes('useCallback')) {
      imports.push(`import { useCallback } from 'react';`);
    }

    // Remove duplicate imports from generated code
    const codeWithoutImports = code.replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '');
    
    return `${imports.join('\n')}\n\n${codeWithoutImports}\n\nexport default ${componentName};`;
  }

  /**
   * Extract and normalize dependencies
   */
  private extractDependencies(deps: string[], stylingFramework: string): string[] {
    const baseDeps = ['react', '@types/react'];
    
    // Add framework-specific dependencies
    switch (stylingFramework) {
      case 'material-ui':
        baseDeps.push('@mui/material', '@emotion/react', '@emotion/styled');
        break;
      case 'styled-components':
        baseDeps.push('styled-components', '@types/styled-components');
        break;
      case 'tailwind':
        baseDeps.push('tailwindcss');
        break;
    }
    
    // Add any additional dependencies from generation
    const allDeps = [...new Set([...baseDeps, ...deps])];
    
    // Filter out invalid or internal dependencies
    return allDeps.filter(dep => 
      dep && !dep.startsWith('./') && !dep.startsWith('../')
    );
  }

  /**
   * Validate generated component
   */
  private async validateComponent(component: WidgetComponent): Promise<{
    valid: boolean;
    errors?: string[];
    suggestions?: string[];
  }> {
    const errors: string[] = [];
    const suggestions: string[] = [];

    // Basic syntax validation
    try {
      // Check for basic React component structure
      if (!component.code.includes('export default') && !component.code.includes('export {')) {
        errors.push('Component must have a default export');
      }

      // Check for proper TypeScript types
      if (component.propInterface && !component.code.includes(component.propInterface.split(' ')[1])) {
        suggestions.push('Consider using the defined prop interface in the component');
      }

      // Check for accessibility
      if (component.code.includes('<button') && !component.code.includes('aria-')) {
        suggestions.push('Consider adding ARIA labels for better accessibility');
      }

      // Check for key props in lists
      if (component.code.includes('.map(') && !component.code.includes('key=')) {
        errors.push('Lists should have unique key props');
      }

    } catch (error) {
      errors.push(`Validation error: ${(error as Error).message}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  }

  /**
   * Generate component tests
   */
  private async generateComponentTests(
    component: WidgetComponent,
    parsed: ParsedWidgetRequirements
  ): Promise<string> {
    const prompt = `Generate comprehensive tests for this React component:

Component: ${component.name}
Props: ${JSON.stringify(parsed.props)}
Events: ${JSON.stringify(parsed.events)}

Generate Jest/React Testing Library tests that cover:
1. Component rendering
2. Prop validation
3. Event handler testing
4. State changes
5. Error states
6. Accessibility

Return complete test file code.`;

    try {
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'deepseek-r1:14b',
        prompt,
        stream: false
      });

      return response.data.response;
    } catch (error) {
      // Return basic test template
      return `import React from 'react';
import { render, screen } from '@testing-library/react';
import ${component.name} from './${component.name}';

describe('${component.name}', () => {
  it('renders without crashing', () => {
    render(<${component.name} />);
  });

  // TODO: Add more comprehensive tests
});`;
    }
  }

  /**
   * Generate component documentation
   */
  private async generateDocumentation(
    component: WidgetComponent,
    parsed: ParsedWidgetRequirements
  ): Promise<string> {
    const props = parsed.props.map(p => 
      `- **${p.name}** (${p.type}${p.required ? ', required' : ''})`
    ).join('\n');

    const events = parsed.events.map(e => 
      `- **${e.name}**: ${e.handler}`
    ).join('\n');

    return `# ${component.name}

${component.description}

## Installation

\`\`\`bash
npm install ${component.dependencies.join(' ')}
\`\`\`

## Usage

\`\`\`tsx
${component.preview || `import ${component.name} from './${component.name}';\n\n<${component.name} />`}
\`\`\`

## Props

${props || 'No props required'}

## Events

${events || 'No events'}

## Features

${parsed.features.map(f => `- ${f}`).join('\n')}

## Styling

This component uses ${parsed.styling.framework} for styling and supports ${parsed.styling.theme} theme.

Generated with Sweet Athena Widget Creator 🌸`;
  }

  /**
   * Store widget in database
   */
  private async storeWidget(component: WidgetComponent, userId: string): Promise<void> {
    try {
      await this.supabase
        .from('ai_widgets')
        .insert({
          id: component.id,
          name: component.name,
          description: component.description,
          component_code: component.code,
          styles: component.styles,
          tests: component.tests,
          documentation: component.documentation,
          dependencies: component.dependencies,
          prop_interface: component.propInterface,
          created_by: userId,
          created_at: new Date().toISOString()
        });

      this.logger.info(`Stored widget ${component.id} in database`);
    } catch (error) {
      this.logger.error('Failed to store widget:', error);
    }
  }

  /**
   * Get widget by ID
   */
  async getWidget(widgetId: string): Promise<WidgetComponent | null> {
    // Check cache first
    if (this.widgetCache.has(widgetId)) {
      return this.widgetCache.get(widgetId)!;
    }

    try {
      const { data, error } = await this.supabase
        .from('ai_widgets')
        .select('*')
        .eq('id', widgetId)
        .single();

      if (error || !data) {
        return null;
      }

      const widget: WidgetComponent = {
        id: data.id,
        name: data.name,
        description: data.description,
        code: data.component_code,
        styles: data.styles,
        tests: data.tests,
        dependencies: data.dependencies,
        propInterface: data.prop_interface,
        documentation: data.documentation,
        exportReady: true
      };

      // Cache it
      this.widgetCache.set(widgetId, widget);
      
      return widget;
    } catch (error) {
      this.logger.error('Failed to get widget:', error);
      return null;
    }
  }

  /**
   * Generate live preview HTML
   */
  async generatePreview(widgetId: string): Promise<string | null> {
    const widget = await this.getWidget(widgetId);
    if (!widget) {
      return null;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${widget.name} Preview</title>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    ${widget.styles ? `<style>${widget.styles}</style>` : ''}
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #root {
            max-width: 1200px;
            margin: 0 auto;
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="text/babel">
        ${widget.code}
        
        const App = () => {
            return (
                <div>
                    <h1>${widget.name} Preview</h1>
                    <p>${widget.description}</p>
                    <hr />
                    <${widget.name} />
                </div>
            );
        };
        
        ReactDOM.render(<App />, document.getElementById('root'));
    </script>
</body>
</html>`;

    return html;
  }

  /**
   * Export widget as zip file
   */
  async exportWidget(widgetId: string): Promise<string | null> {
    const widget = await this.getWidget(widgetId);
    if (!widget) {
      return null;
    }

    const exportDir = path.join(process.cwd(), 'exports', widgetId);
    const zipPath = path.join(process.cwd(), 'exports', `${widget.name}-${widgetId}.zip`);

    try {
      // Create export directory
      await fs.mkdir(exportDir, { recursive: true });

      // Write component file
      await fs.writeFile(
        path.join(exportDir, `${widget.name}.tsx`),
        widget.code
      );

      // Write styles if separate
      if (widget.styles && !widget.code.includes('styled-components')) {
        await fs.writeFile(
          path.join(exportDir, `${widget.name}.css`),
          widget.styles
        );
      }

      // Write tests
      if (widget.tests) {
        await fs.writeFile(
          path.join(exportDir, `${widget.name}.test.tsx`),
          widget.tests
        );
      }

      // Write documentation
      await fs.writeFile(
        path.join(exportDir, 'README.md'),
        widget.documentation
      );

      // Write package.json
      const packageJson = {
        name: widget.name.toLowerCase().replace(/\s+/g, '-'),
        version: '1.0.0',
        description: widget.description,
        main: `${widget.name}.tsx`,
        dependencies: widget.dependencies.reduce((acc, dep) => {
          acc[dep] = 'latest';
          return acc;
        }, {} as Record<string, string>),
        devDependencies: {
          '@types/jest': '^29.0.0',
          '@testing-library/react': '^14.0.0',
          'jest': '^29.0.0',
          'typescript': '^5.0.0'
        }
      };

      await fs.writeFile(
        path.join(exportDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create zip file
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.pipe(output);
      archive.directory(exportDir, false);
      await archive.finalize();

      // Clean up export directory
      await fs.rm(exportDir, { recursive: true });

      return zipPath;
    } catch (error) {
      this.logger.error('Failed to export widget:', error);
      return null;
    }
  }

  /**
   * Initialize component templates
   */
  private initializeTemplates(): void {
    this.templateCache.set('form', `
interface FormProps {
  onSubmit: (data: any) => void;
  initialValues?: any;
  validation?: any;
}

const FormComponent: FC<FormProps> = ({ onSubmit, initialValues = {}, validation }) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validation logic
    onSubmit(values);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
};`);

    this.templateCache.set('table', `
interface TableProps<T> {
  data: T[];
  columns: Array<{
    key: keyof T;
    label: string;
    render?: (value: any, item: T) => React.ReactNode;
  }>;
  onRowClick?: (item: T) => void;
}

const TableComponent = <T extends Record<string, any>>({ data, columns, onRowClick }: TableProps<T>) => {
  return (
    <table>
      <thead>
        <tr>
          {columns.map(col => (
            <th key={String(col.key)}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((item, index) => (
          <tr key={index} onClick={() => onRowClick?.(item)}>
            {columns.map(col => (
              <td key={String(col.key)}>
                {col.render ? col.render(item[col.key], item) : item[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};`);

    this.templateCache.set('chart', `
interface ChartProps {
  data: Array<{ label: string; value: number }>;
  type: 'bar' | 'line' | 'pie';
  title?: string;
}

const ChartComponent: FC<ChartProps> = ({ data, type, title }) => {
  // Chart implementation
  return (
    <div className="chart-container">
      {title && <h3>{title}</h3>}
      {/* Chart rendering */}
    </div>
  );
};`);
  }

  private getTemplate(type: string): string {
    return this.templateCache.get(type) || this.templateCache.get('custom') || '';
  }

  private fallbackParsing(request: WidgetRequest): ParsedWidgetRequirements {
    const words = request.description.toLowerCase().split(' ');
    let componentType: ParsedWidgetRequirements['componentType'] = 'custom';
    
    if (words.some(w => ['form', 'input', 'submit'].includes(w))) {
      componentType = 'form';
    } else if (words.some(w => ['table', 'list', 'grid'].includes(w))) {
      componentType = 'table';
    } else if (words.some(w => ['chart', 'graph', 'visualization'].includes(w))) {
      componentType = 'chart';
    }

    const componentName = this.generateComponentName(request.description);

    return {
      componentName,
      componentType,
      props: [],
      state: [],
      events: [],
      styling: {
        framework: request.requirements?.style || 'styled-components',
        theme: request.requirements?.theme || 'light',
        responsive: request.requirements?.responsive !== false
      },
      features: request.requirements?.features || []
    };
  }

  private generateComponentName(description: string): string {
    const words = description
      .split(' ')
      .filter(w => w.length > 2)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    
    return words.slice(0, 3).join('') + 'Widget';
  }
}