import React, { useState } from 'react';
import { Package, FileCode, Globe, FileText, Download, Check } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface ExportManagerProps {
  code: string;
  widgetName: string;
  description?: string;
  dependencies?: Record<string, string>;
  className?: string;
}

type ExportFormat = 'react' | 'npm' | 'html' | 'docs';

interface ExportOption {
  id: ExportFormat;
  label: string;
  description: string;
  icon: React.ElementType;
}

const exportOptions: ExportOption[] = [
  {
    id: 'react',
    label: 'React Component',
    description: 'Export as standalone .tsx file',
    icon: FileCode,
  },
  {
    id: 'npm',
    label: 'NPM Package',
    description: 'Complete package with dependencies',
    icon: Package,
  },
  {
    id: 'html',
    label: 'HTML/CSS/JS',
    description: 'Standalone web files',
    icon: Globe,
  },
  {
    id: 'docs',
    label: 'Documentation',
    description: 'Usage guide and API docs',
    icon: FileText,
  },
];

export const ExportManager: React.FC<ExportManagerProps> = ({
  code,
  widgetName,
  description = '',
  dependencies = {},
  className = '',
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('react');
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  const componentName = widgetName.replace(/\s+/g, '');

  const generateReactComponent = () => {
    return code;
  };

  const generatePackageJson = () => {
    return {
      name: `@widgets/${widgetName.toLowerCase().replace(/\s+/g, '-')}`,
      version: '1.0.0',
      description,
      main: 'dist/index.js',
      module: 'dist/index.esm.js',
      types: 'dist/index.d.ts',
      files: ['dist'],
      scripts: {
        build: 'rollup -c',
        test: 'jest',
        prepublishOnly: 'npm run build',
      },
      peerDependencies: {
        react: '>=16.8.0',
        'react-dom': '>=16.8.0',
      },
      dependencies,
      devDependencies: {
        '@types/react': '^18.0.0',
        rollup: '^3.0.0',
        typescript: '^5.0.0',
      },
    };
  };

  const generateRollupConfig = () => {
    return `import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/index.tsx',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
  ],
  external: ['react', 'react-dom'],
  plugins: [
    nodeResolve(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
    }),
  ],
};`;
  };

  const generateTsConfig = () => {
    return {
      compilerOptions: {
        target: 'es5',
        module: 'esnext',
        lib: ['dom', 'esnext'],
        jsx: 'react',
        declaration: true,
        outDir: './dist',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
      include: ['src'],
      exclude: ['node_modules', 'dist'],
    };
  };

  const generateHTML = () => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${widgetName}</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    #root {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${code}
    
    // Render the component
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<${componentName} />);
  </script>
</body>
</html>`;
  };

  const generateDocumentation = () => {
    return `# ${widgetName}

${description}

## Installation

\`\`\`bash
npm install @widgets/${widgetName.toLowerCase().replace(/\s+/g, '-')}
\`\`\`

## Usage

\`\`\`tsx
import { ${componentName} } from '@widgets/${widgetName.toLowerCase().replace(/\s+/g, '-')}';

function App() {
  return (
    <${componentName} />
  );
}
\`\`\`

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| (Add props documentation here) |

## Examples

### Basic Usage

\`\`\`tsx
<${componentName} />
\`\`\`

### Advanced Usage

\`\`\`tsx
<${componentName}
  // Add example props here
/>
\`\`\`

## Customization

The component supports the following customization options:

- **Styling**: Pass custom CSS classes via the \`className\` prop
- **Theming**: (Add theming information if applicable)

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
`;
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportComplete(false);

    try {
      switch (selectedFormat) {
        case 'react': {
          const blob = new Blob([generateReactComponent()], { type: 'text/plain' });
          saveAs(blob, `${componentName}.tsx`);
          break;
        }

        case 'npm': {
          const zip = new JSZip();
          
          // Add source files
          zip.file('src/index.tsx', generateReactComponent());
          zip.file('package.json', JSON.stringify(generatePackageJson(), null, 2));
          zip.file('rollup.config.js', generateRollupConfig());
          zip.file('tsconfig.json', JSON.stringify(generateTsConfig(), null, 2));
          zip.file('README.md', generateDocumentation());
          zip.file('.gitignore', 'node_modules\ndist\n.DS_Store');
          
          const content = await zip.generateAsync({ type: 'blob' });
          saveAs(content, `${widgetName.toLowerCase().replace(/\s+/g, '-')}-package.zip`);
          break;
        }

        case 'html': {
          const zip = new JSZip();
          
          zip.file('index.html', generateHTML());
          zip.file('widget.js', code);
          zip.file('README.md', `# ${widgetName}\n\nOpen index.html in a web browser to view the widget.`);
          
          const content = await zip.generateAsync({ type: 'blob' });
          saveAs(content, `${widgetName.toLowerCase().replace(/\s+/g, '-')}-html.zip`);
          break;
        }

        case 'docs': {
          const blob = new Blob([generateDocumentation()], { type: 'text/markdown' });
          saveAs(blob, `${componentName}-documentation.md`);
          break;
        }
      }

      setExportComplete(true);
      setTimeout(() => setExportComplete(false), 3000);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`p-6 ${className}`}>
      <h3 className="text-lg font-semibold mb-4">Export Widget</h3>
      
      {/* Export format options */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {exportOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              onClick={() => setSelectedFormat(option.id)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedFormat === option.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start space-x-3">
                <Icon
                  className={`w-5 h-5 mt-0.5 ${
                    selectedFormat === option.id ? 'text-blue-500' : 'text-gray-400'
                  }`}
                />
                <div>
                  <h4 className="font-medium text-gray-900">{option.label}</h4>
                  <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={isExporting}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 ${
          isExporting
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : exportComplete
            ? 'bg-green-500 text-white'
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        {isExporting ? (
          <>
            <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            <span>Exporting...</span>
          </>
        ) : exportComplete ? (
          <>
            <Check className="w-5 h-5" />
            <span>Export Complete!</span>
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            <span>Export as {exportOptions.find(o => o.id === selectedFormat)?.label}</span>
          </>
        )}
      </button>
    </div>
  );
};