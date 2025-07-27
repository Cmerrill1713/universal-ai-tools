/* eslint-disable no-undef */
/**
 * Framework Pattern Extractor Service
 * Analyzes codebases to identify and extract design patterns from popular frameworks
 * Supports _patternbased code generation and best practices enforcement
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

interface FrameworkPattern {
  id: string;
  name: string;
  framework: string;
  category: 'component' | 'service' | 'hook' | 'utility' | 'architecture' | 'state' | 'routing';
  description: string;
  structure: PatternStructure;
  examples: CodeExample[];
  bestPractices: string[];
  antiPatterns: string[];
  metadata: {
    frequency: number;
    complexity: 'simple' | 'medium' | 'complex';
    dependencies: string[];
    compatibleVersions: string[];
  };
}

interface PatternStructure {
  files: FilePattern[];
  imports: ImportPattern[];
  exports: ExportPattern[];
  conventions: NamingConvention[];
  relationships: PatternRelationship[];
}

interface FilePattern {
  name: string;
  type: 'component' | 'service' | 'test' | 'config' | 'type' | 'style';
  template: string;
  required: boolean;
}

interface ImportPattern {
  source: string;
  imports: string[];
  isRelative: boolean;
  isDefault: boolean;
}

interface ExportPattern {
  name: string;
  type: 'default' | 'named' | 'namespace';
  isReExport: boolean;
}

interface NamingConvention {
  type: 'file' | 'component' | 'function' | 'variable' | 'class';
  _pattern RegExp;
  example: string;
}

interface PatternRelationship {
  _pattern string;
  relationship: 'uses' | 'extends' | 'implements' | 'composes' | 'depends';
  optional: boolean;
}

interface CodeExample {
  title: string;
  code: string;
  language: string;
  highlights: number[]; // Line numbers to highlight
}

interface AnalysisResult {
  framework: string;
  version: string;
  patterns: FrameworkPattern[];
  statistics: {
    totalPatterns: number;
    byCategory: Record<string, number>;
    byComplexity: Record<string, number>;
    mostFrequent: string[];
  };
  recommendations: string[];
}

interface ExtractorConfig {
  maxDepth?: number;
  includeTests?: boolean;
  includeStyles?: boolean;
  customPatterns?: FrameworkPattern[];
  ignorePaths?: string[];
}

interface FrameworkDetector {
  name: string;
  detect: (code: string, filePath: string) => boolean;
  patterns: FrameworkPattern[];
}

export class FrameworkPatternExtractor {
  private supabase: any;
  private patterns: Map<string, FrameworkPattern> = new Map();
  private frameworkDetectors: Map<string, FrameworkDetector> = new Map();

  constructor(private config: ExtractorConfig = {}) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    this.initializeFrameworkDetectors();
    this.loadBuiltInPatterns();
  }

  /**
   * Analyze a codebase to extract framework patterns
   */
  async analyzeCodebase(rootPath: string): Promise<AnalysisResult> {
    // Detect framework
    const framework = await this.detectFramework(rootPath);
    if (!framework) {
      throw new Error('Could not detect framework in codebase');
    }

    // Extract patterns
    const patterns = await this.extractPatterns(rootPath, framework);

    // Analyze _patternusage
    const statistics = this.generateStatistics(patterns);

    // Generate recommendations
    const recommendations = this.generateRecommendations(patterns, statistics);

    // Store patterns if Supabase is configured
    if (this.supabase) {
      await this.storePatternsInSupabase(patterns);
    }

    return {
      framework: framework.name,
      version: framework.version,
      patterns,
      statistics,
      recommendations,
    };
  }

  /**
   * Extract patterns from a specific directory
   */
  async extractPatterns(
    rootPath: string,
    framework: { name: string; version: string }
  ): Promise<FrameworkPattern[]> {
    const patterns: FrameworkPattern[] = [];
    const visited = new Set<string>();

    const extractFromDirectory = async (dirPath: string, depth = 0) => {
      if (depth > (this.config.maxDepth || 5)) return;

      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Skip ignored paths
        if (this.shouldIgnorePath(fullPath)) continue;

        if (entry.isDirectory()) {
          await extractFromDirectory(fullPath, depth + 1);
        } else if (entry.isFile() && this.isSourceFile(entry.name)) {
          const filePatterns = await this.extractPatternsFromFile(fullPath, rootPath, framework);
          patterns.push(...filePatterns);
        }
      }
    };

    await extractFromDirectory(rootPath);

    // Deduplicate and merge similar patterns
    return this.consolidatePatterns(patterns);
  }

  /**
   * Extract patterns from a single file
   */
  private async extractPatternsFromFile(
    filePath: string,
    rootPath: string,
    framework: { name: string; version: string }
  ): Promise<FrameworkPattern[]> {
    const content= await fs.readFile(filePath, 'utf-8');
    const relativePath = path.relative(rootPath, filePath);
    const patterns: FrameworkPattern[] = [];

    // React patterns
    if (framework.name === 'React') {
      patterns.push(...this.extractReactPatterns(content relativePath));
    }

    // Vue patterns
    else if (framework.name === 'Vue') {
      patterns.push(...this.extractVuePatterns(content relativePath));
    }

    // Angular patterns
    else if (framework.name === 'Angular') {
      patterns.push(...this.extractAngularPatterns(content relativePath));
    }

    // Next.js patterns
    else if (framework.name === 'Next.js') {
      patterns.push(...this.extractNextPatterns(content relativePath));
    }

    // Generic patterns
    patterns.push(...this.extractGenericPatterns(content relativePath));

    return patterns;
  }

  /**
   * Extract React-specific patterns
   */
  private extractReactPatterns(content string, filePath: string): FrameworkPattern[] {
    const patterns: FrameworkPattern[] = [];

    // Function Component Pattern
    const functionComponentMatch = contentmatch(
      /(?:export\s+)?(?:const|function)\s+(\w+).*?(?::\s*(?:React\.)?FC|=.*?=>.*?<)/
    );
    if (functionComponentMatch) {
      patterns.push(
        this.createReactFunctionComponentPattern(functionComponentMatch[1], content filePath)
      );
    }

    // Custom Hook Pattern
    const hookMatch = contentmatch(/(?:export\s+)?(?:const|function)\s+(use\w+)/);
    if (hookMatch) {
      patterns.push(this.createReactHookPattern(hookMatch[1], content filePath));
    }

    // Context Pattern
    const contextMatch = contentmatch(
      /(?:const|let)\s+(\w+Context)\s*=\s*(?:React\.)?createContext/
    );
    if (contextMatch) {
      patterns.push(this.createReactContextPattern(contextMatch[1], content filePath));
    }

    // HOC Pattern
    const hocMatch = contentmatch(
      /(?:const|function)\s+(with\w+).*?=.*?(?:Component|WrappedComponent)/
    );
    if (hocMatch) {
      patterns.push(this.createReactHOCPattern(hocMatch[1], content filePath));
    }

    return patterns;
  }

  /**
   * Extract Vue-specific patterns
   */
  private extractVuePatterns(content string, filePath: string): FrameworkPattern[] {
    const patterns: FrameworkPattern[] = [];

    // Composition API Pattern
    if (contentincludes('setup()') || contentincludes('<script setup>')) {
      patterns.push(this.createVueCompositionPattern(content filePath));
    }

    // Composable Pattern
    const composableMatch = contentmatch(/(?:export\s+)?(?:const|function)\s+(use\w+)/);
    if (composableMatch && filePath.includes('composables')) {
      patterns.push(this.createVueComposablePattern(composableMatch[1], content filePath));
    }

    // Single File Component Pattern
    if (contentincludes('<template>') && contentincludes('<script>')) {
      patterns.push(this.createVueSFCPattern(content filePath));
    }

    return patterns;
  }

  /**
   * Extract Angular-specific patterns
   */
  private extractAngularPatterns(content string, filePath: string): FrameworkPattern[] {
    const patterns: FrameworkPattern[] = [];

    // Component Pattern
    if (contentincludes('@Component')) {
      patterns.push(this.createAngularComponentPattern(content filePath));
    }

    // Service Pattern
    if (contentincludes('@Injectable')) {
      patterns.push(this.createAngularServicePattern(content filePath));
    }

    // Directive Pattern
    if (contentincludes('@Directive')) {
      patterns.push(this.createAngularDirectivePattern(content filePath));
    }

    // Module Pattern
    if (contentincludes('@NgModule')) {
      patterns.push(this.createAngularModulePattern(content filePath));
    }

    return patterns;
  }

  /**
   * Extract Next.js-specific patterns
   */
  private extractNextPatterns(content string, filePath: string): FrameworkPattern[] {
    const patterns: FrameworkPattern[] = [];

    // Page Component Pattern
    if (filePath.includes('pages/') || filePath.includes('app/')) {
      patterns.push(this.createNextPagePattern(content filePath));
    }

    // API Route Pattern
    if (filePath.includes('api/')) {
      patterns.push(this.createNextAPIPattern(content filePath));
    }

    // Server Component Pattern
    if (contentincludes('use server') || filePath.includes('.server.')) {
      patterns.push(this.createNextServerComponentPattern(content filePath));
    }

    return patterns;
  }

  /**
   * Extract generic patterns applicable to multiple frameworks
   */
  private extractGenericPatterns(content string, filePath: string): FrameworkPattern[] {
    const patterns: FrameworkPattern[] = [];

    // Singleton Pattern
    if (contentmatch(/class\s+\w+\s*{[\s\S]*?static\s+instance/)) {
      patterns.push(this.createSingletonPattern(content filePath));
    }

    // Factory Pattern
    if (contentmatch(/(?:create|make|build)\w+\s*\(/)) {
      patterns.push(this.createFactoryPattern(content filePath));
    }

    // Observer Pattern
    if (contentmatch(/(?:subscribe|observe|listen|on)\s*\(/)) {
      patterns.push(this.createObserverPattern(content filePath));
    }

    return patterns;
  }

  /**
   * Create _patternobjects for different framework patterns
   */
  private createReactFunctionComponentPattern(
    name: string,
    content string,
    filePath: string
  ): FrameworkPattern {
    return {
      id: `react-fc-${name}`,
      name: 'React Function Component',
      framework: 'React',
      category: 'component',
      description: 'Functional component using hooks',
      structure: {
        files: [
          {
            name: `${name}.tsx`,
            type: 'component',
            template: this.generateReactFCTemplate(name),
            required: true,
          },
        ],
        imports: this.extractImports(content,
        exports: this.extractExports(content,
        conventions: [
          {
            type: 'component',
            _pattern /^[A-Z][a-zA-Z0-9]*$/,
            example: 'MyComponent',
          },
        ],
        relationships: [],
      },
      examples: [
        {
          title: 'Basic Function Component',
          code: this.generateReactFCTemplate(name),
          language: 'typescript',
          highlights: [1, 5],
        },
      ],
      bestPractices: [
        'Use TypeScript for prop types',
        'Keep components focused and small',
        'Extract complex logic to custom hooks',
        'Memoize expensive computations',
      ],
      antiPatterns: [
        'Avoid inline function definitions in JSX',
        "Don't mutate state directly",
        'Avoid excessive prop drilling',
      ],
      metadata: {
        frequency: 1,
        complexity: 'simple',
        dependencies: ['react'],
        compatibleVersions: ['16.8+', '17.x', '18.x'],
      },
    };
  }

  private createReactHookPattern(
    name: string,
    content string,
    filePath: string
  ): FrameworkPattern {
    return {
      id: `react-hook-${name}`,
      name: 'React Custom Hook',
      framework: 'React',
      category: 'hook',
      description: 'Custom hook for reusable logic',
      structure: {
        files: [
          {
            name: `${name}.ts`,
            type: 'component',
            template: this.generateReactHookTemplate(name),
            required: true,
          },
        ],
        imports: this.extractImports(content,
        exports: this.extractExports(content,
        conventions: [
          {
            type: 'function',
            _pattern /^use[A-Z][a-zA-Z0-9]*$/,
            example: 'useCustomHook',
          },
        ],
        relationships: [],
      },
      examples: [
        {
          title: 'Custom Hook Example',
          code: this.generateReactHookTemplate(name),
          language: 'typescript',
          highlights: [1, 3],
        },
      ],
      bestPractices: [
        'Start hook names with "use"',
        'Return consistent value types',
        'Handle cleanup in useEffect',
        'Document hook parameters and return values',
      ],
      antiPatterns: [
        "Don't call hooks conditionally",
        'Avoid excessive dependencies',
        "Don't return unstable references",
      ],
      metadata: {
        frequency: 1,
        complexity: 'medium',
        dependencies: ['react'],
        compatibleVersions: ['16.8+', '17.x', '18.x'],
      },
    };
  }

  private createReactContextPattern(
    name: string,
    content string,
    filePath: string
  ): FrameworkPattern {
    return {
      id: `react-context-${name}`,
      name: 'React Context Provider',
      framework: 'React',
      category: 'state',
      description: 'Context for global state management',
      structure: {
        files: [
          {
            name: `${name}.tsx`,
            type: 'component',
            template: this.generateReactContextTemplate(name),
            required: true,
          },
        ],
        imports: this.extractImports(content,
        exports: this.extractExports(content,
        conventions: [
          {
            type: 'variable',
            _pattern /^[A-Z][a-zA-Z0-9]*Context$/,
            example: 'ThemeContext',
          },
        ],
        relationships: [
          {
            _pattern 'React Function Component',
            relationship: 'uses',
            optional: false,
          },
        ],
      },
      examples: [
        {
          title: 'Context Provider Example',
          code: this.generateReactContextTemplate(name),
          language: 'typescript',
          highlights: [1, 5, 10],
        },
      ],
      bestPractices: [
        'Provide TypeScript types for context value',
        'Split contexts by concern',
        'Memoize context value to prevent rerenders',
        'Create custom hook for using context',
      ],
      antiPatterns: [
        'Avoid overusing context for local state',
        "Don't put all state in a single context",
        'Avoid frequent context value changes',
      ],
      metadata: {
        frequency: 1,
        complexity: 'medium',
        dependencies: ['react'],
        compatibleVersions: ['16.3+', '17.x', '18.x'],
      },
    };
  }

  private createReactHOCPattern(name: string, content string, filePath: string): FrameworkPattern {
    return {
      id: `react-hoc-${name}`,
      name: 'React Higher-Order Component',
      framework: 'React',
      category: 'component',
      description: 'HOC for component enhancement',
      structure: {
        files: [
          {
            name: `${name}.tsx`,
            type: 'component',
            template: this.generateReactHOCTemplate(name),
            required: true,
          },
        ],
        imports: this.extractImports(content,
        exports: this.extractExports(content,
        conventions: [
          {
            type: 'function',
            _pattern /^with[A-Z][a-zA-Z0-9]*$/,
            example: 'withAuth',
          },
        ],
        relationships: [
          {
            _pattern 'React Function Component',
            relationship: 'extends',
            optional: false,
          },
        ],
      },
      examples: [
        {
          title: 'HOC Example',
          code: this.generateReactHOCTemplate(name),
          language: 'typescript',
          highlights: [1, 3, 8],
        },
      ],
      bestPractices: [
        'Pass through props correctly',
        'Copy static methods',
        'Use display name for debugging',
        'Consider hooks as alternative',
      ],
      antiPatterns: [
        "Don't mutate the wrapped component",
        'Avoid HOC inside render methods',
        "Don't create HOCs dynamically",
      ],
      metadata: {
        frequency: 1,
        complexity: 'complex',
        dependencies: ['react'],
        compatibleVersions: ['16.x', '17.x', '18.x'],
      },
    };
  }

  /**
   * Generate template code for patterns
   */
  private generateReactFCTemplate(name: string): string {
    return `import React from 'react';

interface ${name}Props {
  // Define props here
}

export const ${name}: React.FC<${name}Props> = (props) => {
  return (
    <div>
      {/* Component content*/}
    </div>
  );
};`;
  }

  private generateReactHookTemplate(name: string): string {
    return `import { useState, useEffect } from 'react';

export const ${name} = () => {
  const [state, setState] = useState();

  useEffect(() => {
    // Effect logic
  }, []);

  return { state };
};`;
  }

  private generateReactContextTemplate(name: string): string {
    const baseName = name.replace('Context', '');
    return `import React, { createContext, useContext, useState } from 'react';

interface ${baseName}ContextType {
  // Define context type
}

const ${name} = createContext<${baseName}ContextType | undefined>(undefined);

export const ${baseName}Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState();

  return (
    <${name}.Provider value={{ state }}>
      {children}
    </${name}.Provider>
  );
};

export const use${baseName} = () => {
  const context = useContext(${name});
  if (!context) {
    throw new Error('use${baseName} must be used within ${baseName}Provider');
  }
  return context;
};`;
  }

  private generateReactHOCTemplate(name: string): string {
    return `import React, { ComponentType } from 'react';

export const ${name} = <P extends object>(
  Component: ComponentType<P>
): ComponentType<P> => {
  const WithComponent = (props: P) => {
    // HOC logic here
    return <Component {...props} />;
  };

  WithComponent.displayName = \`${name}(\${Component.displayName || Component.name})\`;
  
  return WithComponent;
};`;
  }

  /**
   * Vue _patterncreators
   */
  private createVueCompositionPattern(content string, filePath: string): FrameworkPattern {
    return {
      id: `vue-composition-${path.basename(filePath)}`,
      name: 'Vue Composition API Component',
      framework: 'Vue',
      category: 'component',
      description: 'Component using Composition API',
      structure: {
        files: [
          {
            name: 'Component.vue',
            type: 'component',
            template: this.generateVueCompositionTemplate(),
            required: true,
          },
        ],
        imports: this.extractImports(content,
        exports: this.extractExports(content,
        conventions: [
          {
            type: 'file',
            _pattern /^[A-Z][a-zA-Z0-9]+\.vue$/,
            example: 'MyComponent.vue',
          },
        ],
        relationships: [],
      },
      examples: [
        {
          title: 'Composition API Example',
          code: this.generateVueCompositionTemplate(),
          language: 'vue',
          highlights: [2, 6],
        },
      ],
      bestPractices: [
        'Use <script setup> for cleaner syntax',
        'Extract reusable logic to composables',
        'Type props with TypeScript',
        'Use computed for derived state',
      ],
      antiPatterns: [
        'Avoid mixing Options and Composition API',
        "Don't mutate props",
        'Avoid excessive reactivity',
      ],
      metadata: {
        frequency: 1,
        complexity: 'medium',
        dependencies: ['vue'],
        compatibleVersions: ['3.x'],
      },
    };
  }

  private createVueComposablePattern(
    name: string,
    content string,
    filePath: string
  ): FrameworkPattern {
    return {
      id: `vue-composable-${name}`,
      name: 'Vue Composable',
      framework: 'Vue',
      category: 'hook',
      description: 'Reusable composition function',
      structure: {
        files: [
          {
            name: `${name}.ts`,
            type: 'service',
            template: this.generateVueComposableTemplate(name),
            required: true,
          },
        ],
        imports: this.extractImports(content,
        exports: this.extractExports(content,
        conventions: [
          {
            type: 'function',
            _pattern /^use[A-Z][a-zA-Z0-9]*$/,
            example: 'useCounter',
          },
        ],
        relationships: [],
      },
      examples: [
        {
          title: 'Composable Example',
          code: this.generateVueComposableTemplate(name),
          language: 'typescript',
          highlights: [1, 3],
        },
      ],
      bestPractices: [
        'Return refs and reactive objects',
        'Accept options parameter',
        'Handle lifecycle correctly',
        'Provide TypeScript types',
      ],
      antiPatterns: [
        "Don't use outside setup()",
        'Avoid side effects in composables',
        "Don't return non-reactive values",
      ],
      metadata: {
        frequency: 1,
        complexity: 'medium',
        dependencies: ['vue'],
        compatibleVersions: ['3.x'],
      },
    };
  }

  private createVueSFCPattern(content string, filePath: string): FrameworkPattern {
    return {
      id: `vue-sfc-${path.basename(filePath)}`,
      name: 'Vue Single File Component',
      framework: 'Vue',
      category: 'component',
      description: 'Single File Component with template, script, and style',
      structure: {
        files: [
          {
            name: 'Component.vue',
            type: 'component',
            template: this.generateVueSFCTemplate(),
            required: true,
          },
        ],
        imports: this.extractImports(content,
        exports: this.extractExports(content,
        conventions: [
          {
            type: 'file',
            _pattern /^[A-Z][a-zA-Z0-9]+\.vue$/,
            example: 'MyComponent.vue',
          },
        ],
        relationships: [],
      },
      examples: [
        {
          title: 'SFC Example',
          code: this.generateVueSFCTemplate(),
          language: 'vue',
          highlights: [1, 7, 15],
        },
      ],
      bestPractices: [
        'Use scoped styles',
        'Keep templates simple',
        'Extract complex logic',
        'Use semantic HTML',
      ],
      antiPatterns: [
        'Avoid inline styles',
        "Don't use global CSS",
        'Avoid complex template expressions',
      ],
      metadata: {
        frequency: 1,
        complexity: 'simple',
        dependencies: ['vue'],
        compatibleVersions: ['2.x', '3.x'],
      },
    };
  }

  /**
   * Generate Vue templates
   */
  private generateVueCompositionTemplate(): string {
    return `<template>
  <div>
    <!-- Template content-->
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

// Component logic
const count = ref(0);
</script>

<style scoped>
/* Component styles */
</style>`;
  }

  private generateVueComposableTemplate(name: string): string {
    return `import { ref, computed, Ref } from 'vue';

export interface ${name}Options {
  // Options
}

export const ${name} = (options?: ${name}Options) => {
  const state = ref();

  const computedValue = computed(() => {
    // Computed logic
  });

  return {
    state,
    computedValue
  };
};`;
  }

  private generateVueSFCTemplate(): string {
    return `<template>
  <div class="component">
    <h1>{{ title }}</h1>
  </div>
</template>

<script>
export default {
  name: 'MyComponent',
  data() {
    return {
      title: 'Hello Vue'
    };
  }
};
</script>

<style scoped>
.component {
  padding: 20px;
}
</style>`;
  }

  /**
   * Angular _patterncreators
   */
  private createAngularComponentPattern(content string, filePath: string): FrameworkPattern {
    return {
      id: `angular-component-${path.basename(filePath)}`,
      name: 'Angular Component',
      framework: 'Angular',
      category: 'component',
      description: 'Angular component with decorator',
      structure: {
        files: [
          {
            name: 'component.ts',
            type: 'component',
            template: this.generateAngularComponentTemplate(),
            required: true,
          },
          {
            name: 'component.html',
            type: 'component',
            template: '<div>Template</div>',
            required: true,
          },
          {
            name: 'component.scss',
            type: 'style',
            template: ':host { display: block; }',
            required: false,
          },
        ],
        imports: this.extractImports(content,
        exports: this.extractExports(content,
        conventions: [
          {
            type: 'class',
            _pattern /^[A-Z][a-zA-Z0-9]*Component$/,
            example: 'MyComponent',
          },
        ],
        relationships: [],
      },
      examples: [
        {
          title: 'Component Example',
          code: this.generateAngularComponentTemplate(),
          language: 'typescript',
          highlights: [1, 8],
        },
      ],
      bestPractices: [
        'Use OnPush change detection',
        'Implement lifecycle hooks properly',
        'Use async pipe for observables',
        'Keep components focused',
      ],
      antiPatterns: [
        'Avoid logic in templates',
        "Don't subscribe in components",
        'Avoid deep component trees',
      ],
      metadata: {
        frequency: 1,
        complexity: 'medium',
        dependencies: ['@angular/core'],
        compatibleVersions: ['12+', '13+', '14+', '15+'],
      },
    };
  }

  private createAngularServicePattern(content string, filePath: string): FrameworkPattern {
    return {
      id: `angular-service-${path.basename(filePath)}`,
      name: 'Angular Service',
      framework: 'Angular',
      category: 'service',
      description: 'Injectable service for business logic',
      structure: {
        files: [
          {
            name: 'service.ts',
            type: 'service',
            template: this.generateAngularServiceTemplate(),
            required: true,
          },
        ],
        imports: this.extractImports(content,
        exports: this.extractExports(content,
        conventions: [
          {
            type: 'class',
            _pattern /^[A-Z][a-zA-Z0-9]*Service$/,
            example: 'DataService',
          },
        ],
        relationships: [],
      },
      examples: [
        {
          title: 'Service Example',
          code: this.generateAngularServiceTemplate(),
          language: 'typescript',
          highlights: [1, 5],
        },
      ],
      bestPractices: [
        "Use providedIn: 'root'",
        'Return observables',
        'Handle errors properly',
        'Keep services stateless when possible',
      ],
      antiPatterns: [
        'Avoid circular dependencies',
        "Don't use services for UI logic",
        'Avoid global state mutations',
      ],
      metadata: {
        frequency: 1,
        complexity: 'simple',
        dependencies: ['@angular/core'],
        compatibleVersions: ['12+', '13+', '14+', '15+'],
      },
    };
  }

  private createAngularDirectivePattern(content string, filePath: string): FrameworkPattern {
    return {
      id: `angular-directive-${path.basename(filePath)}`,
      name: 'Angular Directive',
      framework: 'Angular',
      category: 'component',
      description: 'Attribute or structural directive',
      structure: {
        files: [
          {
            name: 'directive.ts',
            type: 'component',
            template: this.generateAngularDirectiveTemplate(),
            required: true,
          },
        ],
        imports: this.extractImports(content,
        exports: this.extractExports(content,
        conventions: [
          {
            type: 'class',
            _pattern /^[A-Z][a-zA-Z0-9]*Directive$/,
            example: 'HighlightDirective',
          },
        ],
        relationships: [],
      },
      examples: [
        {
          title: 'Directive Example',
          code: this.generateAngularDirectiveTemplate(),
          language: 'typescript',
          highlights: [1, 6],
        },
      ],
      bestPractices: [
        'Use renderer for DOM manipulation',
        'Clean up in ngOnDestroy',
        'Use @HostListener for events',
        'Keep directives focused',
      ],
      antiPatterns: [
        'Avoid direct DOM access',
        "Don't create heavy directives",
        'Avoid complex logic',
      ],
      metadata: {
        frequency: 1,
        complexity: 'medium',
        dependencies: ['@angular/core'],
        compatibleVersions: ['12+', '13+', '14+', '15+'],
      },
    };
  }

  private createAngularModulePattern(content string, filePath: string): FrameworkPattern {
    return {
      id: `angular-module-${path.basename(filePath)}`,
      name: 'Angular Module',
      framework: 'Angular',
      category: 'architecture',
      description: 'Feature or shared module',
      structure: {
        files: [
          {
            name: 'module.ts',
            type: 'component',
            template: this.generateAngularModuleTemplate(),
            required: true,
          },
        ],
        imports: this.extractImports(content,
        exports: this.extractExports(content,
        conventions: [
          {
            type: 'class',
            _pattern /^[A-Z][a-zA-Z0-9]*Module$/,
            example: 'FeatureModule',
          },
        ],
        relationships: [
          {
            _pattern 'Angular Component',
            relationship: 'composes',
            optional: false,
          },
        ],
      },
      examples: [
        {
          title: 'Module Example',
          code: this.generateAngularModuleTemplate(),
          language: 'typescript',
          highlights: [1, 10],
        },
      ],
      bestPractices: [
        'Use feature modules',
        'Lazy load when possible',
        'Export only needed components',
        'Use barrel exports',
      ],
      antiPatterns: [
        'Avoid circular dependencies',
        "Don't import everything",
        'Avoid shared mutable state',
      ],
      metadata: {
        frequency: 1,
        complexity: 'simple',
        dependencies: ['@angular/core'],
        compatibleVersions: ['12+', '13+', '14+', '15+'],
      },
    };
  }

  /**
   * Generate Angular templates
   */
  private generateAngularComponentTemplate(): string {
    return `import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-component',
  templateUrl: './component.html',
  styleUrls: ['./component.scss']
})
export class MyComponent implements OnInit {
  title = 'My Component';

  ngOnInit(): void {
    // Initialization logic
  }
}`;
  }

  private generateAngularServiceTemplate(): string {
    return `import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  constructor() {}

  getData(): Observable<any> {
    // Service logic
  }
}`;
  }

  private generateAngularDirectiveTemplate(): string {
    return `import { Directive, ElementRef, HostListener, Input } from '@angular/core';

@Directive({
  selector: '[appHighlight]'
})
export class HighlightDirective {
  @Input() appHighlight = '';

  constructor(private el: ElementRef) {}

  @HostListener('mouseenter') onMouseEnter() {
    this.highlight(this.appHighlight || 'yellow');
  }

  @HostListener('mouseleave') onMouseLeave() {
    this.highlight('');
  }

  private highlight(color: string) {
    this.el.nativeElement.style.backgroundColor = color;
  }
}`;
  }

  private generateAngularModuleTemplate(): string {
    return `import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MyComponent } from './my.component';
import { DataService } from './data.service';

@NgModule({
  declarations: [
    MyComponent
  ],
  imports: [
    CommonModule
  ],
  providers: [
    DataService
  ],
  exports: [
    MyComponent
  ]
})
export class FeatureModule { }`;
  }

  /**
   * Next.js _patterncreators
   */
  private createNextPagePattern(content string, filePath: string): FrameworkPattern {
    const isAppDir = filePath.includes('app/');
    return {
      id: `nextjs-page-${path.basename(filePath)}`,
      name: isAppDir ? 'Next.js App Route' : 'Next.js Page',
      framework: 'Next.js',
      category: 'routing',
      description: isAppDir ? 'App directory route component' : 'Pages directory route',
      structure: {
        files: [
          {
            name: isAppDir ? 'page.tsx' : '[page].tsx',
            type: 'component',
            template: isAppDir
              ? this.generateNextAppRouteTemplate()
              : this.generateNextPageTemplate(),
            required: true,
          },
        ],
        imports: this.extractImports(content,
        exports: this.extractExports(content,
        conventions: [
          {
            type: 'file',
            _pattern isAppDir ? /^page\.(tsx?|jsx?)$/ : /^[a-z\-]+\.(tsx?|jsx?)$/,
            example: isAppDir ? 'page.tsx' : 'index.tsx',
          },
        ],
        relationships: [],
      },
      examples: [
        {
          title: isAppDir ? 'App Route Example' : 'Page Example',
          code: isAppDir ? this.generateNextAppRouteTemplate() : this.generateNextPageTemplate(),
          language: 'typescript',
          highlights: [1, 3],
        },
      ],
      bestPractices: [
        'Use TypeScript for type safety',
        'Implement proper SEO with metadata',
        'Use dynamic imports for code splitting',
        'Handle loading and _errorstates',
      ],
      antiPatterns: [
        'Avoid blocking data fetching',
        "Don't use getInitialProps",
        'Avoid large bundle sizes',
      ],
      metadata: {
        frequency: 1,
        complexity: 'simple',
        dependencies: ['next', 'react'],
        compatibleVersions: isAppDir ? ['13.4+', '14.x'] : ['12.x', '13.x', '14.x'],
      },
    };
  }

  private createNextAPIPattern(content string, filePath: string): FrameworkPattern {
    const isAppDir = filePath.includes('app/');
    return {
      id: `nextjs-api-${path.basename(filePath)}`,
      name: 'Next.js API Route',
      framework: 'Next.js',
      category: 'service',
      description: 'API endpoint handler',
      structure: {
        files: [
          {
            name: isAppDir ? 'route.ts' : 'api.ts',
            type: 'service',
            template: isAppDir ? this.generateNextAppAPITemplate() : this.generateNextAPITemplate(),
            required: true,
          },
        ],
        imports: this.extractImports(content,
        exports: this.extractExports(content,
        conventions: [
          {
            type: 'file',
            _pattern isAppDir ? /^route\.(ts|js)$/ : /^[a-z\-]+\.(ts|js)$/,
            example: isAppDir ? 'route.ts' : 'users.ts',
          },
        ],
        relationships: [],
      },
      examples: [
        {
          title: 'API Route Example',
          code: isAppDir ? this.generateNextAppAPITemplate() : this.generateNextAPITemplate(),
          language: 'typescript',
          highlights: [1, 3],
        },
      ],
      bestPractices: [
        'Validate requestdata',
        'Handle errors properly',
        'Use proper HTTP methods',
        'Implement authentication',
      ],
      antiPatterns: [
        "Don't expose sensitive data",
        'Avoid synchronous operations',
        "Don't trust client _input,
      ],
      metadata: {
        frequency: 1,
        complexity: 'medium',
        dependencies: ['next'],
        compatibleVersions: isAppDir ? ['13.4+', '14.x'] : ['12.x', '13.x', '14.x'],
      },
    };
  }

  private createNextServerComponentPattern(content string, filePath: string): FrameworkPattern {
    return {
      id: `nextjs-rsc-${path.basename(filePath)}`,
      name: 'Next.js Server Component',
      framework: 'Next.js',
      category: 'component',
      description: 'React Server Component',
      structure: {
        files: [
          {
            name: 'ServerComponent.tsx',
            type: 'component',
            template: this.generateNextServerComponentTemplate(),
            required: true,
          },
        ],
        imports: this.extractImports(content,
        exports: this.extractExports(content,
        conventions: [
          {
            type: 'component',
            _pattern /^[A-Z][a-zA-Z0-9]*$/,
            example: 'ServerComponent',
          },
        ],
        relationships: [],
      },
      examples: [
        {
          title: 'Server Component Example',
          code: this.generateNextServerComponentTemplate(),
          language: 'typescript',
          highlights: [1, 3],
        },
      ],
      bestPractices: [
        'Fetch data directly in component',
        'Use async/await for data fetching',
        'Keep server-only code secure',
        'Minimize client components',
      ],
      antiPatterns: [
        "Don't use hooks in server components",
        'Avoid browser-only APIs',
        "Don't pass functions as props",
      ],
      metadata: {
        frequency: 1,
        complexity: 'medium',
        dependencies: ['next', 'react'],
        compatibleVersions: ['13.4+', '14.x'],
      },
    };
  }

  /**
   * Generate Next.js templates
   */
  private generateNextPageTemplate(): string {
    return `import { GetServerSideProps } from 'next';

interface PageProps {
  data: any;
}

export default function Page({ data }: PageProps) {
  return (
    <div>
      <h1>Page Title</h1>
      {/* Page content*/}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  // Fetch data
  return {
    props: {
      data: {}
    }
  };
};`;
  }

  private generateNextAppRouteTemplate(): string {
    return `export default function Page() {
  return (
    <div>
      <h1>Page Title</h1>
      {/* Page content*/}
    </div>
  );
}

export const metadata = {
  title: 'Page Title',
  description: 'Page description',
};`;
  }

  private generateNextAPITemplate(): string {
    return `import type { NextApiRequest, NextApiResponse } from 'next';

type Data = {
  message: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method === 'GET') {
    res.status(200).json({ message: 'Success' });
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}`;
  }

  private generateNextAppAPITemplate(): string {
    return `import { NextRequest, NextResponse } from 'next/server';

export async function GET(request NextRequest) {
  // Handle GET request
  return NextResponse.json({ message: 'Success' });
}

export async function POST(request NextRequest) {
  const body = await requestjson();
  // Handle POST request
  return NextResponse.json({ message: 'Created' }, { status: 201 });
}`;
  }

  private generateNextServerComponentTemplate(): string {
    return `async function getData() {
  const res = await fetch('https://api.example.com/data', {
    cache: 'no-store' // or 'force-cache' or revalidate
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch data');
  }
  
  return res.json();
}

export default async function ServerComponent() {
  const data = await getData();
  
  return (
    <div>
      <h1>Server Component</h1>
      {/* Render data */}
    </div>
  );
}`;
  }

  /**
   * Generic _patterncreators
   */
  private createSingletonPattern(content string, filePath: string): FrameworkPattern {
    return {
      id: `singleton-${path.basename(filePath)}`,
      name: 'Singleton Pattern',
      framework: 'Generic',
      category: 'architecture',
      description: 'Ensures single instance of a class',
      structure: {
        files: [
          {
            name: 'Singleton.ts',
            type: 'service',
            template: this.generateSingletonTemplate(),
            required: true,
          },
        ],
        imports: this.extractImports(content,
        exports: this.extractExports(content,
        conventions: [
          {
            type: 'class',
            _pattern /^[A-Z][a-zA-Z0-9]*$/,
            example: 'ConfigManager',
          },
        ],
        relationships: [],
      },
      examples: [
        {
          title: 'Singleton Example',
          code: this.generateSingletonTemplate(),
          language: 'typescript',
          highlights: [2, 5],
        },
      ],
      bestPractices: [
        'Make constructor private',
        'Use lazy initialization',
        'Consider thread safety',
        'Provide reset method for testing',
      ],
      antiPatterns: [
        'Avoid overuse of singletons',
        "Don't use for simple utilities",
        'Avoid global state',
      ],
      metadata: {
        frequency: 1,
        complexity: 'simple',
        dependencies: [],
        compatibleVersions: ['*'],
      },
    };
  }

  private createFactoryPattern(content string, filePath: string): FrameworkPattern {
    return {
      id: `factory-${path.basename(filePath)}`,
      name: 'Factory Pattern',
      framework: 'Generic',
      category: 'architecture',
      description: 'Creates objects without specifying exact classes',
      structure: {
        files: [
          {
            name: 'Factory.ts',
            type: 'service',
            template: this.generateFactoryTemplate(),
            required: true,
          },
        ],
        imports: this.extractImports(content,
        exports: this.extractExports(content,
        conventions: [
          {
            type: 'function',
            _pattern /^(create|make|build)[A-Z][a-zA-Z0-9]*$/,
            example: 'createProduct',
          },
        ],
        relationships: [],
      },
      examples: [
        {
          title: 'Factory Example',
          code: this.generateFactoryTemplate(),
          language: 'typescript',
          highlights: [1, 10],
        },
      ],
      bestPractices: [
        'Use interfaces for products',
        'Keep factory methods simple',
        'Support extensibility',
        'Use type guards',
      ],
      antiPatterns: [
        'Avoid complex factory logic',
        "Don't couple to implementations",
        'Avoid factory factories',
      ],
      metadata: {
        frequency: 1,
        complexity: 'medium',
        dependencies: [],
        compatibleVersions: ['*'],
      },
    };
  }

  private createObserverPattern(content string, filePath: string): FrameworkPattern {
    return {
      id: `observer-${path.basename(filePath)}`,
      name: 'Observer Pattern',
      framework: 'Generic',
      category: 'architecture',
      description: 'Notifies multiple objects about state changes',
      structure: {
        files: [
          {
            name: 'Observer.ts',
            type: 'service',
            template: this.generateObserverTemplate(),
            required: true,
          },
        ],
        imports: this.extractImports(content,
        exports: this.extractExports(content,
        conventions: [
          {
            type: 'class',
            _pattern /^[A-Z][a-zA-Z0-9]*(Observer|Subject|EventEmitter)$/,
            example: 'EventEmitter',
          },
        ],
        relationships: [],
      },
      examples: [
        {
          title: 'Observer Example',
          code: this.generateObserverTemplate(),
          language: 'typescript',
          highlights: [2, 8, 14],
        },
      ],
      bestPractices: [
        'Use weak references when possible',
        'Provide unsubscribe mechanism',
        'Handle errors in observers',
        'Use type-safe events',
      ],
      antiPatterns: [
        'Avoid memory leaks',
        "Don't create observer chains",
        'Avoid synchronous notifications',
      ],
      metadata: {
        frequency: 1,
        complexity: 'medium',
        dependencies: [],
        compatibleVersions: ['*'],
      },
    };
  }

  /**
   * Generate generic _patterntemplates
   */
  private generateSingletonTemplate(): string {
    return `export class Singleton {
  private static instance: Singleton;
  
  private constructor() {
    // Private constructor
  }
  
  public static getInstance(): Singleton {
    if (!Singleton.instance) {
      Singleton.instance = new Singleton();
    }
    return Singleton.instance;
  }
  
  // Instance methods
}`;
  }

  private generateFactoryTemplate(): string {
    return `interface Product {
  operation(): string;
}

class ConcreteProductA implements Product {
  operation(): string {
    return 'Product A';
  }
}

class ConcreteProductB implements Product {
  operation(): string {
    return 'Product B';
  }
}

export function createProduct(type: 'A' | 'B'): Product {
  switch (type) {
    case 'A':
      return new ConcreteProductA();
    case 'B':
      return new ConcreteProductB();
    default:
      throw new Error(\`Unknown product type: \${type}\`);
  }
}`;
  }

  private generateObserverTemplate(): string {
    return `type Listener<T> = (data: T) => void;

export class EventEmitter<T = any> {
  private listeners: Set<Listener<T>> = new Set();
  
  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  emit(data: T): void {
    this.listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console._error'Observer error', error);
      }
    });
  }
  
  clear(): void {
    this.listeners.clear();
  }
}`;
  }

  /**
   * Helper methods
   */
  private extractImports(content string): ImportPattern[] {
    const imports: ImportPattern[] = [];
    const importRegex = /import\s+(?:(\*\s+as\s+\w+)|(\w+)|({[^}]+}))\s+from\s+['"]([^'"]+)['"]/g;

    let match;
    while ((match = importRegex.exec(content) !== null) {
      const [, namespace, defaultImport, namedImports, source] = match;

      imports.push({
        source,
        imports: namespace
          ? [namespace]
          : defaultImport
            ? [defaultImport]
            : namedImports
              ? namedImports
                  .replace(/[{}]/g, '')
                  .split(',')
                  .map((i) => i.trim())
              : [],
        isRelative: source.startsWith('.'),
        isDefault: !!defaultImport,
      });
    }

    return imports;
  }

  private extractExports(content string): ExportPattern[] {
    const exports: ExportPattern[] = [];
    const exportRegex =
      /export\s+(?:(default)\s+)?(?:(class|function|const|interface|type)\s+)?(\w+)/g;

    let match;
    while ((match = exportRegex.exec(content) !== null) {
      const [, isDefault, declarationType, name] = match;

      exports.push({
        name,
        type: isDefault ? 'default' : 'named',
        isReExport: false,
      });
    }

    return exports;
  }

  private consolidatePatterns(patterns: FrameworkPattern[]): FrameworkPattern[] {
    const consolidated = new Map<string, FrameworkPattern>();

    for (const _patternof patterns) {
      const key = `${_patternframework}-${_patternname}`;

      if (consolidated.has(key)) {
        const existing = consolidated.get(key)!;
        existing.metadata.frequency++;

        // Merge examples
        const uniqueExamples = new Map(existing.examples.map((e) => [e.title, e]));
        _patternexamples.forEach((e) => uniqueExamples.set(e.title, e));
        existing.examples = Array.from(uniqueExamples.values());
      } else {
        consolidated.set(key, { ..._pattern});
      }
    }

    return Array.from(consolidated.values());
  }

  private shouldIgnorePath(path: string): boolean {
    const defaultIgnore = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];
    const allIgnore = [...defaultIgnore, ...(this.config.ignorePaths || [])];

    return allIgnore.some((ignore) => path.includes(ignore));
  }

  private isSourceFile(filename: string): boolean {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte'];
    return extensions.some((ext) => filename.endsWith(ext));
  }

  /**
   * Framework detection
   */
  private async detectFramework(
    rootPath: string
  ): Promise<{ name: string; version: string } | null> {
    try {
      const packageJsonPath = path.join(rootPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // Check for frameworks
      if (deps['next']) {
        return { name: 'Next.js', version: deps['next'] };
      } else if (deps['@angular/core']) {
        return { name: 'Angular', version: deps['@angular/core'] };
      } else if (deps['vue']) {
        return { name: 'Vue', version: deps['vue'] };
      } else if (deps['react']) {
        return { name: 'React', version: deps['react'] };
      } else if (deps['svelte']) {
        return { name: 'Svelte', version: deps['svelte'] };
      }

      return null;
    } catch (error) {
      console._error'Error detecting framework:', error);
      return null;
    }
  }

  private initializeFrameworkDetectors(): void {
    // Framework-specific detectors can be added here
  }

  private loadBuiltInPatterns(): void {
    // Load common patterns that ship with the extractor
    if (this.config.customPatterns) {
      this.config.customPatterns.forEach((_pattern => {
        this.patterns.set(_patternid, _pattern;
      });
    }
  }

  /**
   * Generate statistics from extracted patterns
   */
  private generateStatistics(patterns: FrameworkPattern[]): AnalysisResult['statistics'] {
    const byCategory: Record<string, number> = {};
    const byComplexity: Record<string, number> = {};

    patterns.forEach((_pattern => {
      byCategory[_patterncategory] = (byCategory[_patterncategory] || 0) + 1;
      byComplexity[_patternmetadata.complexity] =
        (byComplexity[_patternmetadata.complexity] || 0) + 1;
    });

    const mostFrequent = patterns
      .sort((a, b) => b.metadata.frequency - a.metadata.frequency)
      .slice(0, 5)
      .map((p) => p.name);

    return {
      totalPatterns: patterns.length,
      byCategory,
      byComplexity,
      mostFrequent,
    };
  }

  /**
   * Generate recommendations based on patterns
   */
  private generateRecommendations(
    patterns: FrameworkPattern[],
    statistics: AnalysisResult['statistics']
  ): string[] {
    const recommendations: string[] = [];

    // Check for missing common patterns
    const hasRouting = patterns.some((p) => p.category === 'routing');
    if (!hasRouting) {
      recommendations.push(
        'Consider implementing routing patterns for better navigation structure'
      );
    }

    const hasStateManagement = patterns.some((p) => p.category === 'state');
    if (!hasStateManagement && patterns.length > 10) {
      recommendations.push(
        'Large application detected - consider adding state management patterns'
      );
    }

    // Check for anti-patterns
    const hasCircularDeps = patterns.some((p) =>
      p.structure.imports.some((imp) => imp.isRelative && imp.source.includes('../'))
    );
    if (hasCircularDeps) {
      recommendations.push('Potential circular dependencies detected - review import structure');
    }

    // Complexity recommendations
    const complexPatterns = statistics.byComplexity['complex'] || 0;
    if (complexPatterns > patterns.length * 0.3) {
      recommendations.push('High complexity detected - consider simplifying patterns');
    }

    return recommendations;
  }

  /**
   * Store patterns in Supabase for persistence
   */
  private async storePatternsInSupabase(patterns: FrameworkPattern[]): Promise<void> {
    if (!this.supabase) return;

    try {
      const { _error} = await this.supabase.from('framework_patterns').upsert(
        patterns.map((_pattern => ({
          id: _patternid,
          name: _patternname,
          framework: _patternframework,
          category: _patterncategory,
          description: _patterndescription,
          structure: _patternstructure,
          examples: _patternexamples,
          best_practices: _patternbestPractices,
          anti_patterns: _patternantiPatterns,
          metadata: _patternmetadata,
          updated_at: new Date().toISOString(),
        }))
      );

      if (_error {
        console._error'Error storing patterns:', error);
      }
    } catch (error) {
      console._error'Error storing patterns:', error);
    }
  }

  /**
   * Generate code from a pattern
   */
  async generateFromPattern(
    patternId: string,
    options: {
      name: string;
      targetPath: string;
      variables?: Record<string, string>;
    }
  ): Promise<string[]> {
    const _pattern= this.patterns.get(patternId);
    if (!_pattern {
      throw new Error(`Pattern ${patternId} not found`);
    }

    const generatedFiles: string[] = [];

    for (const file of _patternstructure.files) {
      if (!file.required && !options.variables?.includeOptional) continue;

      const fileName = file.name.replace(
        /\[(\w+)\]/g,
        (_, key) => options.variables?.[key] || options.name
      );

      const filePath = path.join(options.targetPath, fileName);
      const content= file.template
        .replace(/\$\{name\}/g, options.name)
        .replace(/\$\{(\w+)\}/g, (_, key) => options.variables?.[key] || '');

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content;

      generatedFiles.push(filePath);
    }

    return generatedFiles;
  }

  /**
   * Search for patterns by criteria
   */
  searchPatterns(criteria: {
    framework?: string;
    category?: string;
    complexity?: string;
    keyword?: string;
  }): FrameworkPattern[] {
    let results = Array.from(this.patterns.values());

    if (criteria.framework) {
      results = results.filter((p) => p.framework === criteria.framework);
    }

    if (criteria.category) {
      results = results.filter((p) => p.category === criteria.category);
    }

    if (criteria.complexity) {
      results = results.filter((p) => p.metadata.complexity === criteria.complexity);
    }

    if (criteria.keyword) {
      const keyword = criteria.keyword.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(keyword) || p.description.toLowerCase().includes(keyword)
      );
    }

    return results;
  }

  /**
   * Get _patternby ID
   */
  getPattern(id: string): FrameworkPattern | undefined {
    return this.patterns.get(id);
  }

  /**
   * Get all patterns
   */
  getAllPatterns(): FrameworkPattern[] {
    return Array.from(this.patterns.values());
  }
}

// Type definitions for external use
export type { FrameworkPattern, PatternStructure, AnalysisResult, ExtractorConfig };
