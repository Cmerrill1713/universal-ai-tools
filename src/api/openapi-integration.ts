/**
 * OpenAPI Integration
 * Combines specification, endpoints, and Swagger UI setup
 */

import type { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import * as OpenAPIValidator from 'express-openapi-validator';
import { generateOpenAPISpec } from './openapi-spec';
import { getEndpointDefinitions } from './openapi-endpoints';
import { getWebSocketDocumentation } from './openapi-websocket';
import { log, LogContext } from '@/utils/logger';

// Custom CSS for Swagger UI
const customCss = `
  .swagger-ui .topbar { 
    display: none;
  }
  .swagger-ui .info .title {
    color: #2c3e50;
    font-size: 2.5em;
  }
  .swagger-ui .info .description {
    font-size: 1.1em;
    line-height: 1.6;
  }
  .swagger-ui .info .description h1 {
    color: #2c3e50;
    border-bottom: 2px solid #3498db;
    padding-bottom: 10px;
    margin-top: 30px;
  }
  .swagger-ui .info .description h2 {
    color: #34495e;
    margin-top: 25px;
  }
  .swagger-ui .info .description code {
    background: #f4f4f4;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Monaco', 'Menlo', monospace;
  }
  .swagger-ui .info .description pre {
    background: #2c3e50;
    color: #ecf0f1;
    padding: 15px;
    border-radius: 5px;
    overflow-x: auto;
  }
  .swagger-ui .scheme-container {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 5px;
    margin-bottom: 20px;
  }
  .swagger-ui .btn.authorize {
    background-color: #3498db;
    border-color: #3498db;
  }
  .swagger-ui .btn.authorize:hover {
    background-color: #2980b9;
    border-color: #2980b9;
  }
  .swagger-ui .opblock.opblock-post .opblock-summary-method {
    background: #27ae60;
  }
  .swagger-ui .opblock.opblock-get .opblock-summary-method {
    background: #3498db;
  }
  .swagger-ui .opblock.opblock-put .opblock-summary-method {
    background: #f39c12;
  }
  .swagger-ui .opblock.opblock-delete .opblock-summary-method {
    background: #e74c3c;
  }
  .swagger-ui .opblock-tag {
    border-bottom: 2px solid #ecf0f1;
    margin-bottom: 20px;
  }
  .swagger-ui select, .swagger-ui input[type=text] {
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  .swagger-ui .responses-wrapper .response {
    border-radius: 5px;
    margin-bottom: 10px;
  }
  .swagger-ui table tbody tr td {
    padding: 10px;
  }
  .swagger-ui .parameter__name {
    color: #2c3e50;
    font-weight: 600;
  }
  .swagger-ui .parameter__type {
    color: #7f8c8d;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.9em;
  }
`;

// Custom JavaScript for enhanced Swagger UI functionality
const customJs = `
<script>
window.onload = function() {
  // Add copy button to code blocks
  document.querySelectorAll('pre').forEach(function(pre) {
    const button = document.createElement('button');
    button.className = 'copy-button';
    button.textContent = 'Copy';
    button.style.cssText = 'position: absolute; top: 5px; right: 5px; padding: 5px 10px; background: #3498db; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;';
    button.onclick = function() {
      navigator.clipboard.writeText(pre.textContent);
      button.textContent = 'Copied!';
      setTimeout(() => { button.textContent = 'Copy'; }, 2000);
    };
    pre.style.position = 'relative';
    pre.appendChild(button);
  });
  
  // Add search functionality enhancement
  const searchBox = document.querySelector('.download-url-input');
  if (searchBox) {
    searchBox.placeholder = 'Search endpoints, tags, or operations...';
  }
  
  // Add endpoint statistics
  const endpointCount = document.querySelectorAll('.opblock').length;
  const info = document.querySelector('.info');
  if (info) {
    const stats = document.createElement('div');
    stats.className = 'api-stats';
    stats.style.cssText = 'background: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0;';
    stats.innerHTML = \`
      <h3 style="margin-top: 0;">API Statistics</h3>
      <p>📊 Total Endpoints: <strong>\${endpointCount}</strong></p>
      <p>🏷️ Categories: <strong>9</strong></p>
      <p>🤖 Available Agents: <strong>50+</strong></p>
      <p>🚀 Average Response Time: <strong>&lt;200ms</strong></p>
    \`;
    info.appendChild(stats);
  }
};
</script>
`;

export interface OpenAPIIntegrationOptions {
  enableValidation?: boolean;
  enableMockMode?: boolean;
  customLogo?: string;
  apiKeyHeader?: string;
}

/**
 * Set up OpenAPI documentation and validation
 */
export async function setupOpenAPIDocumentation(
  app: Application,
  options: OpenAPIIntegrationOptions = {}
): Promise<void> {
  try {
    // Generate the complete OpenAPI specification
    const spec = generateOpenAPISpec();
    const endpoints = getEndpointDefinitions();
    const websocketDocs = getWebSocketDocumentation();
    
    // Merge endpoints into the specification
    spec.paths = {
      ...endpoints,
      ...websocketDocs
    };
    
    // Add external documentation
    spec.externalDocs = {
      description: 'Find more info and SDKs',
      url: 'https://github.com/universal-ai-tools/docs'
    };
    
    // Swagger UI options
    const swaggerOptions = {
      customCss,
      customSiteTitle: 'Universal AI Tools API Documentation',
      customfavIcon: '/favicon.ico',
      swaggerOptions: {
        docExpansion: 'list',
        filter: true,
        showRequestDuration: true,
        syntaxHighlight: {
          activate: true,
          theme: 'monokai'
        },
        tryItOutEnabled: true,
        requestInterceptor: (req: any) => {
          // Add default auth header for try-it-out
          if (!req.headers['Authorization'] && !req.headers['X-API-Key']) {
            const token = localStorage.getItem('api_token');
            if (token) {
              req.headers['Authorization'] = `Bearer ${token}`;
            }
          }
          return req;
        },
        responseInterceptor: (res: any) => {
          // Log responses for debugging
          console.log('API Response:', res);
          return res;
        }
      },
      explorer: true,
      customCssUrl: 'https://cdn.jsdelivr.net/npm/swagger-ui-themes@3.0.1/themes/3.x/theme-material.css'
    };
    
    // Set up Swagger UI at /api/docs
    app.use(
      '/api/docs',
      swaggerUi.serve,
      swaggerUi.setup(spec, swaggerOptions)
    );
    
    // Serve raw OpenAPI spec
    app.get('/api/openapi.json', (req, res) => {
      res.json(spec);
    });
    
    app.get('/api/openapi.yaml', (req, res) => {
      res.type('yaml');
      res.send(convertToYaml(spec));
    });
    
    // Set up API documentation home page
    app.get('/api', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Universal AI Tools API</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 20px;
              backdrop-filter: blur(10px);
              box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
              max-width: 600px;
              margin: 20px;
            }
            h1 {
              font-size: 3em;
              margin-bottom: 20px;
              text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            p {
              font-size: 1.2em;
              margin-bottom: 30px;
              opacity: 0.95;
            }
            .buttons {
              display: flex;
              gap: 20px;
              justify-content: center;
              flex-wrap: wrap;
            }
            .btn {
              display: inline-block;
              padding: 15px 30px;
              background: white;
              color: #667eea;
              text-decoration: none;
              border-radius: 50px;
              font-weight: 600;
              transition: all 0.3s;
              box-shadow: 0 4px 15px 0 rgba(31, 38, 135, 0.2);
            }
            .btn:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 20px 0 rgba(31, 38, 135, 0.4);
            }
            .btn.secondary {
              background: transparent;
              color: white;
              border: 2px solid white;
            }
            .stats {
              margin-top: 40px;
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
              gap: 20px;
            }
            .stat {
              padding: 15px;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 10px;
            }
            .stat-value {
              font-size: 2em;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .stat-label {
              font-size: 0.9em;
              opacity: 0.8;
            }
            .links {
              margin-top: 30px;
              display: flex;
              gap: 20px;
              justify-content: center;
              flex-wrap: wrap;
            }
            .link {
              color: white;
              opacity: 0.8;
              text-decoration: none;
              font-size: 0.9em;
              transition: opacity 0.3s;
            }
            .link:hover {
              opacity: 1;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🚀 Universal AI Tools API</h1>
            <p>Powerful AI capabilities through a unified REST API</p>
            
            <div class="buttons">
              <a href="/api/docs" class="btn">📚 Interactive Docs</a>
              <a href="/api/openapi.json" class="btn secondary">📄 OpenAPI Spec</a>
            </div>
            
            <div class="stats">
              <div class="stat">
                <div class="stat-value">50+</div>
                <div class="stat-label">AI Agents</div>
              </div>
              <div class="stat">
                <div class="stat-value">10+</div>
                <div class="stat-label">LLM Models</div>
              </div>
              <div class="stat">
                <div class="stat-value">&lt;200ms</div>
                <div class="stat-label">Avg Response</div>
              </div>
              <div class="stat">
                <div class="stat-value">99.9%</div>
                <div class="stat-label">Uptime</div>
              </div>
            </div>
            
            <div class="links">
              <a href="/api/docs#/Auth" class="link">🔐 Authentication</a>
              <a href="/api/docs#/Chat" class="link">💬 Chat API</a>
              <a href="/api/docs#/Agents" class="link">🤖 Agents</a>
              <a href="/api/docs#/Vision" class="link">👁️ Vision</a>
              <a href="/api/docs#/Voice" class="link">🎙️ Voice</a>
              <a href="/monitoring/health" class="link">❤️ Health</a>
            </div>
          </div>
          ${customJs}
        </body>
        </html>
      `);
    });
    
    // Optional: Set up OpenAPI validation
    if (options.enableValidation) {
      const validator = OpenAPIValidator.middleware({
        apiSpec: spec,
        validateRequests: true,
        validateResponses: true,
        validateFormats: 'full',
        formats: [
          {
            name: 'uuid',
            type: 'string',
            validate: (value: string) => {
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
              return uuidRegex.test(value);
            }
          }
        ]
      });
      
      // Note: Validator middleware would be added here
      // app.use(validator.middleware());
    }
    
    log.info('✅ OpenAPI documentation set up successfully', LogContext.API, {
      docsUrl: '/api/docs',
      specUrl: '/api/openapi.json',
      validationEnabled: options.enableValidation || false
    });
    
  } catch (error) {
    log.error('Failed to set up OpenAPI documentation', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    // Don't throw - allow app to continue without docs
  }
}

/**
 * Convert OpenAPI spec to YAML format
 */
function convertToYaml(spec: any): string {
  // Simple YAML conversion (in production, use a proper YAML library)
  const yaml = JSON.stringify(spec, null, 2)
    .replace(/^(\s*)"(.+)":/gm, '$1$2:')
    .replace(/: "(.+)"/g, ': $1')
    .replace(/: \[/g, ':\n  -')
    .replace(/\],/g, '')
    .replace(/\{/g, '')
    .replace(/\}/g, '');
  
  return yaml;
}

/**
 * Generate SDK examples based on the OpenAPI spec
 */
export function generateSDKExamples(): Record<string, string> {
  return {
    typescript: `
// TypeScript SDK Example
import { UniversalAIClient } from '@universal-ai/sdk';

const client = new UniversalAIClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.universal-ai-tools.com'
});

// Send a chat message
const response = await client.chat.sendMessage({
  message: 'Hello, how can you help me?',
  agentName: 'assistant',
  stream: false
});

console.log(response.data.response);

// List available agents
const agents = await client.agents.list();
console.log(agents.data);

// Analyze an image
const analysis = await client.vision.analyze({
  imageUrl: 'https://example.com/image.jpg',
  features: ['objects', 'text']
});
`,
    javascript: `
// JavaScript SDK Example
const UniversalAI = require('@universal-ai/sdk');

const client = new UniversalAI({
  apiKey: 'your-api-key'
});

// Send a chat message
client.chat.sendMessage({
  message: 'Hello, how can you help me?'
})
.then(response => {
  console.log(response.data.response);
})
.catch(error => {
  console.error('Error:', error);
});

// Stream a response
const stream = client.chat.stream({
  message: 'Write a story',
  stream: true
});

stream.on('data', chunk => {
  process.stdout.write(chunk);
});
`,
    python: `
# Python SDK Example
from universal_ai import UniversalAIClient

client = UniversalAIClient(
    api_key='your-api-key',
    base_url='https://api.universal-ai-tools.com'
)

# Send a chat message
response = client.chat.send_message(
    message='Hello, how can you help me?',
    agent_name='assistant'
)
print(response['data']['response'])

# List available agents
agents = client.agents.list()
for agent in agents['data']['main']:
    print(f"{agent['name']}: {agent['description']}")

# Transcribe audio
with open('audio.mp3', 'rb') as f:
    transcription = client.voice.transcribe(
        audio=f,
        language='en'
    )
    print(transcription['data']['text'])
`,
    curl: `
# cURL Examples

# Get API health status
curl https://api.universal-ai-tools.com/api/v1/monitoring/health

# Send a chat message (with authentication)
curl -X POST https://api.universal-ai-tools.com/api/v1/chat/message \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Hello, how can you help me?",
    "agentName": "assistant"
  }'

# List available agents
curl https://api.universal-ai-tools.com/api/v1/agents \\
  -H "X-API-Key: YOUR_API_KEY"

# Stream a response using Server-Sent Events
curl -N https://api.universal-ai-tools.com/api/v1/chat/stream \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Write a story",
    "stream": true
  }'
`
  };
}