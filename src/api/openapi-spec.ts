/**
 * OpenAPI 3.0 Specification Generator
 * Comprehensive API documentation for Universal AI Tools
 */

// OpenAPI specification types
interface OpenAPISpec {
  [key: string]: any;
}

export function generateOpenAPISpec(): OpenAPISpec {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Universal AI Tools API',
      version: '2.0.0',
      description: `
# Universal AI Tools API Documentation

A comprehensive AI platform providing multiple AI models, agents, and services through a unified API.

## Key Features

- **Multi-Model Support**: Access to GPT-4, Claude, Gemini, LLaMA, and more
- **Agent System**: 50+ specialized AI agents for various tasks
- **Real-time Communication**: WebSocket and Socket.IO support
- **Voice & Vision**: Speech synthesis, transcription, and image analysis
- **Memory Management**: Intelligent context and conversation management
- **Security**: JWT authentication, rate limiting, and input validation

## Getting Started

1. **Authentication**: Obtain an API key or JWT token
2. **Choose an Endpoint**: Select the appropriate endpoint for your use case
3. **Make Requests**: Send HTTP requests with proper authentication
4. **Handle Responses**: Process standardized JSON responses

## Base URL

\`\`\`
https://api.universal-ai-tools.com/api/v1
\`\`\`

## Authentication

All API requests require authentication using one of the following methods:

### Bearer Token (JWT)
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

### API Key
\`\`\`
X-API-Key: <your-api-key>
\`\`\`

## Rate Limiting

- **Standard**: 100 requests per minute
- **Premium**: 1000 requests per minute
- **Burst**: Up to 10 requests per second

Rate limit headers are included in all responses:
- \`X-RateLimit-Limit\`: Maximum requests allowed
- \`X-RateLimit-Remaining\`: Requests remaining
- \`X-RateLimit-Reset\`: Time when limit resets (Unix timestamp)

## Error Handling

All errors follow a consistent format:

\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
\`\`\`

## Response Format

All successful responses follow this structure:

\`\`\`json
{
  "success": true,
  "data": {},
  "metadata": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "uuid",
    "processingTime": 123
  }
}
\`\`\`
      `.trim(),
      contact: {
        name: 'API Support',
        email: 'support@universal-ai-tools.com',
        url: 'https://universal-ai-tools.com/support'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001/api/v1',
        description: 'Local Development Server'
      },
      {
        url: 'https://api.universal-ai-tools.com/api/v1',
        description: 'Production Server'
      }
    ],
    tags: [
      {
        name: 'Chat',
        description: 'Conversational AI endpoints for managing chats and messages'
      },
      {
        name: 'Agents',
        description: 'AI agent discovery, management, and execution'
      },
      {
        name: 'Models',
        description: 'LLM model information and selection'
      },
      {
        name: 'Vision',
        description: 'Image analysis and computer vision capabilities'
      },
      {
        name: 'Voice',
        description: 'Speech synthesis and transcription services'
      },
      {
        name: 'Memory',
        description: 'Context and memory management for conversations'
      },
      {
        name: 'Auth',
        description: 'Authentication and authorization'
      },
      {
        name: 'Monitoring',
        description: 'System health, metrics, and monitoring'
      },
      {
        name: 'WebSocket',
        description: 'Real-time communication via WebSocket'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /auth/login endpoint'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key obtained from dashboard'
        }
      },
      schemas: {
        // Common Schemas
        Error: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR'
                },
                message: {
                  type: 'string',
                  example: 'Invalid request parameters'
                },
                details: {
                  type: 'object',
                  additionalProperties: true
                }
              }
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object',
              additionalProperties: true
            },
            metadata: {
              type: 'object',
              properties: {
                timestamp: {
                  type: 'string',
                  format: 'date-time'
                },
                requestId: {
                  type: 'string',
                  format: 'uuid'
                },
                processingTime: {
                  type: 'number',
                  description: 'Processing time in milliseconds'
                }
              }
            }
          }
        },
        
        // Chat Schemas
        ChatMessage: {
          type: 'object',
          required: ['id', 'role', 'content', 'timestamp'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            role: {
              type: 'string',
              enum: ['user', 'assistant', 'system'],
              description: 'Role of the message sender'
            },
            content: {
              type: 'string',
              description: 'Message content'
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            },
            metadata: {
              type: 'object',
              properties: {
                agentName: {
                  type: 'string'
                },
                confidence: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1
                },
                tokens: {
                  type: 'integer'
                },
                model: {
                  type: 'string'
                }
              }
            }
          }
        },
        
        Conversation: {
          type: 'object',
          required: ['id', 'userId', 'title', 'messages', 'createdAt', 'updatedAt'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            userId: {
              type: 'string'
            },
            title: {
              type: 'string'
            },
            messages: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/ChatMessage'
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            },
            metadata: {
              type: 'object',
              properties: {
                totalTokens: {
                  type: 'integer'
                },
                agentUsage: {
                  type: 'object',
                  additionalProperties: {
                    type: 'integer'
                  }
                }
              }
            }
          }
        },
        
        // Agent Schemas
        Agent: {
          type: 'object',
          required: ['name', 'description', 'category', 'type', 'status'],
          properties: {
            name: {
              type: 'string',
              example: 'code-assistant'
            },
            description: {
              type: 'string',
              example: 'Helps with coding tasks and debugging'
            },
            category: {
              type: 'string',
              enum: ['general', 'development', 'data', 'security', 'photos', 'creative'],
              example: 'development'
            },
            type: {
              type: 'string',
              enum: ['main', 'singleFile'],
              example: 'main'
            },
            status: {
              type: 'string',
              enum: ['available', 'busy', 'offline'],
              example: 'available'
            },
            capabilities: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            keywords: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            priority: {
              type: 'integer',
              minimum: 1,
              maximum: 10
            },
            usageExamples: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            metadata: {
              type: 'object',
              properties: {
                averageResponseTime: {
                  type: 'string'
                },
                successRate: {
                  type: 'string'
                },
                lastUpdated: {
                  type: 'string',
                  format: 'date-time'
                }
              }
            }
          }
        },
        
        // Model Schemas
        Model: {
          type: 'object',
          required: ['id', 'name', 'provider'],
          properties: {
            id: {
              type: 'string',
              example: 'gpt-4-turbo'
            },
            name: {
              type: 'string',
              example: 'GPT-4 Turbo'
            },
            provider: {
              type: 'string',
              enum: ['openai', 'anthropic', 'google', 'meta', 'local'],
              example: 'openai'
            },
            contextWindow: {
              type: 'integer',
              example: 128000
            },
            maxTokens: {
              type: 'integer',
              example: 4096
            },
            costPer1kTokens: {
              type: 'object',
              properties: {
                input: {
                  type: 'number',
                  example: 0.01
                },
                output: {
                  type: 'number',
                  example: 0.03
                }
              }
            },
            capabilities: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['chat', 'completion', 'vision', 'function-calling', 'streaming']
              }
            },
            status: {
              type: 'string',
              enum: ['available', 'unavailable', 'degraded'],
              example: 'available'
            }
          }
        },
        
        // Request Schemas
        ChatRequest: {
          type: 'object',
          required: ['message'],
          properties: {
            message: {
              type: 'string',
              description: 'User message',
              example: 'Help me write a Python function'
            },
            conversationId: {
              type: 'string',
              format: 'uuid',
              description: 'Optional conversation ID to continue existing chat'
            },
            agentName: {
              type: 'string',
              description: 'Optional specific agent to use',
              example: 'code-assistant'
            },
            model: {
              type: 'string',
              description: 'Optional model override',
              example: 'gpt-4-turbo'
            },
            stream: {
              type: 'boolean',
              description: 'Enable streaming response',
              default: false
            },
            temperature: {
              type: 'number',
              minimum: 0,
              maximum: 2,
              default: 0.7
            },
            maxTokens: {
              type: 'integer',
              minimum: 1,
              maximum: 32000,
              default: 2048
            }
          }
        },
        
        // Health Check Schemas
        HealthStatus: {
          type: 'object',
          required: ['status', 'timestamp'],
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'degraded', 'unhealthy'],
              example: 'healthy'
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            },
            services: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    enum: ['up', 'down', 'degraded']
                  },
                  latency: {
                    type: 'number',
                    description: 'Latency in milliseconds'
                  },
                  lastCheck: {
                    type: 'string',
                    format: 'date-time'
                  }
                }
              }
            },
            metrics: {
              type: 'object',
              properties: {
                cpu: {
                  type: 'number',
                  description: 'CPU usage percentage'
                },
                memory: {
                  type: 'object',
                  properties: {
                    used: {
                      type: 'integer',
                      description: 'Used memory in MB'
                    },
                    total: {
                      type: 'integer',
                      description: 'Total memory in MB'
                    },
                    percentage: {
                      type: 'number',
                      description: 'Memory usage percentage'
                    }
                  }
                },
                uptime: {
                  type: 'integer',
                  description: 'Uptime in seconds'
                }
              }
            }
          }
        }
      },
      
      parameters: {
        ConversationId: {
          name: 'conversationId',
          in: 'path',
          required: true,
          description: 'Unique conversation identifier',
          schema: {
            type: 'string',
            format: 'uuid'
          }
        },
        AgentName: {
          name: 'agentName',
          in: 'path',
          required: true,
          description: 'Agent name identifier',
          schema: {
            type: 'string'
          }
        },
        Limit: {
          name: 'limit',
          in: 'query',
          description: 'Maximum number of items to return',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20
          }
        },
        Offset: {
          name: 'offset',
          in: 'query',
          description: 'Number of items to skip',
          schema: {
            type: 'integer',
            minimum: 0,
            default: 0
          }
        }
      },
      
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: {
                  code: 'UNAUTHORIZED',
                  message: 'Authentication required'
                }
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: {
                  code: 'FORBIDDEN',
                  message: 'Insufficient permissions to access this resource'
                }
              }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'The requested resource was not found'
                }
              }
            }
          }
        },
        ValidationError: {
          description: 'Invalid request parameters',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Invalid request parameters',
                  details: {
                    field: 'message',
                    reason: 'Required field missing'
                  }
                }
              }
            }
          }
        },
        RateLimitError: {
          description: 'Rate limit exceeded',
          headers: {
            'X-RateLimit-Limit': {
              description: 'Request limit per window',
              schema: {
                type: 'integer'
              }
            },
            'X-RateLimit-Remaining': {
              description: 'Remaining requests in window',
              schema: {
                type: 'integer'
              }
            },
            'X-RateLimit-Reset': {
              description: 'Time when rate limit resets (Unix timestamp)',
              schema: {
                type: 'integer'
              }
            },
            'Retry-After': {
              description: 'Seconds until rate limit resets',
              schema: {
                type: 'integer'
              }
            }
          },
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: {
                  code: 'RATE_LIMIT_EXCEEDED',
                  message: 'Too many requests. Please retry after some time.'
                }
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: {
                  code: 'INTERNAL_ERROR',
                  message: 'An unexpected error occurred'
                }
              }
            }
          }
        }
      }
    },
    
    paths: {} // Will be populated by endpoint definitions
  };
}