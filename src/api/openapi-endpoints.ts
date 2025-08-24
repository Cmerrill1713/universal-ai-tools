/**
 * OpenAPI Endpoint Definitions
 * Complete API endpoint documentation
 */

// OpenAPI endpoint definitions
interface PathsObject {
  [path: string]: any;
}

export function getEndpointDefinitions(): PathsObject {
  return {
    // ============================================
    // CHAT ENDPOINTS
    // ============================================
    '/chat/conversations': {
      get: {
        tags: ['Chat'],
        summary: 'List user conversations',
        description: 'Retrieve all conversations for the authenticated user, sorted by most recent',
        operationId: 'listConversations',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of conversations to return',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20
            }
          },
          {
            name: 'offset',
            in: 'query',
            description: 'Number of conversations to skip',
            schema: {
              type: 'integer',
              minimum: 0,
              default: 0
            }
          }
        ],
        responses: {
          '200': {
            description: 'List of conversations',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        conversations: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string', format: 'uuid' },
                              title: { type: 'string' },
                              messageCount: { type: 'integer' },
                              lastMessage: { type: 'string' },
                              createdAt: { type: 'string', format: 'date-time' },
                              updatedAt: { type: 'string', format: 'date-time' }
                            }
                          }
                        },
                        total: { type: 'integer' }
                      }
                    }
                  }
                },
                example: {
                  success: true,
                  data: {
                    conversations: [
                      {
                        id: '123e4567-e89b-12d3-a456-426614174000',
                        title: 'Python debugging help',
                        messageCount: 15,
                        lastMessage: 'The issue has been resolved!',
                        createdAt: '2024-01-01T10:00:00Z',
                        updatedAt: '2024-01-01T11:30:00Z'
                      }
                    ],
                    total: 1
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      },
      post: {
        tags: ['Chat'],
        summary: 'Create new conversation',
        description: 'Start a new conversation with an initial message',
        operationId: 'createConversation',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'message'],
                properties: {
                  title: {
                    type: 'string',
                    description: 'Conversation title',
                    example: 'Help with Python code'
                  },
                  message: {
                    type: 'string',
                    description: 'Initial message',
                    example: 'I need help debugging this Python function'
                  },
                  agentName: {
                    type: 'string',
                    description: 'Optional specific agent to use'
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Conversation created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Conversation' }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    
    '/chat/history/{conversationId}': {
      get: {
        tags: ['Chat'],
        summary: 'Get conversation history',
        description: 'Retrieve the complete message history for a specific conversation',
        operationId: 'getConversationHistory',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        parameters: [
          { $ref: '#/components/parameters/ConversationId' }
        ],
        responses: {
          '200': {
            description: 'Conversation history',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Conversation' }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '403': { $ref: '#/components/responses/ForbiddenError' },
          '404': { $ref: '#/components/responses/NotFoundError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    
    '/chat/message': {
      post: {
        tags: ['Chat'],
        summary: 'Send chat message',
        description: 'Send a message to the AI and receive a response. Supports streaming.',
        operationId: 'sendMessage',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ChatRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'AI response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        response: { type: 'string' },
                        conversationId: { type: 'string', format: 'uuid' },
                        messageId: { type: 'string', format: 'uuid' },
                        agentName: { type: 'string' },
                        model: { type: 'string' },
                        tokens: {
                          type: 'object',
                          properties: {
                            input: { type: 'integer' },
                            output: { type: 'integer' },
                            total: { type: 'integer' }
                          }
                        }
                      }
                    }
                  }
                },
                example: {
                  success: true,
                  data: {
                    response: "Here's how you can fix that Python function...",
                    conversationId: '123e4567-e89b-12d3-a456-426614174000',
                    messageId: '987fcdeb-51a2-43f1-9876-543210fedcba',
                    agentName: 'code-assistant',
                    model: 'gpt-4-turbo',
                    tokens: {
                      input: 150,
                      output: 250,
                      total: 400
                    }
                  }
                }
              },
              'text/event-stream': {
                schema: {
                  type: 'string',
                  description: 'Server-sent events stream for real-time responses'
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    
    '/chat/stream': {
      post: {
        tags: ['Chat', 'WebSocket'],
        summary: 'Stream chat messages',
        description: 'Send a message and receive streaming response via Server-Sent Events',
        operationId: 'streamMessage',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ChatRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Streaming response',
            content: {
              'text/event-stream': {
                schema: {
                  type: 'string',
                  description: 'Server-sent events with incremental response chunks'
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    
    // ============================================
    // AGENT ENDPOINTS
    // ============================================
    '/agents': {
      get: {
        tags: ['Agents'],
        summary: 'List available agents',
        description: 'Get a list of all available AI agents with their capabilities and status',
        operationId: 'listAgents',
        parameters: [
          {
            name: 'category',
            in: 'query',
            description: 'Filter agents by category',
            schema: {
              type: 'string',
              enum: ['general', 'development', 'data', 'security', 'photos', 'creative']
            }
          },
          {
            name: 'status',
            in: 'query',
            description: 'Filter agents by status',
            schema: {
              type: 'string',
              enum: ['available', 'busy', 'offline']
            }
          }
        ],
        responses: {
          '200': {
            description: 'List of available agents',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        main: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Agent' }
                        },
                        singleFile: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Agent' }
                        },
                        categories: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              name: { type: 'string' },
                              count: { type: 'integer' },
                              description: { type: 'string' },
                              icon: { type: 'string' }
                            }
                          }
                        },
                        total: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          },
          '429': { $ref: '#/components/responses/RateLimitError' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    
    '/agents/{agentName}': {
      get: {
        tags: ['Agents'],
        summary: 'Get agent details',
        description: 'Get detailed information about a specific agent',
        operationId: 'getAgent',
        parameters: [
          { $ref: '#/components/parameters/AgentName' }
        ],
        responses: {
          '200': {
            description: 'Agent details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Agent' }
                  }
                }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFoundError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    
    '/agents/{agentName}/execute': {
      post: {
        tags: ['Agents'],
        summary: 'Execute agent task',
        description: 'Execute a specific task with the selected agent',
        operationId: 'executeAgent',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        parameters: [
          { $ref: '#/components/parameters/AgentName' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['task'],
                properties: {
                  task: {
                    type: 'string',
                    description: 'Task description for the agent',
                    example: 'Analyze this code for potential bugs'
                  },
                  context: {
                    type: 'object',
                    description: 'Additional context for the task',
                    additionalProperties: true
                  },
                  options: {
                    type: 'object',
                    properties: {
                      stream: { type: 'boolean', default: false },
                      timeout: { type: 'integer', description: 'Timeout in seconds', default: 30 },
                      priority: { type: 'string', enum: ['low', 'normal', 'high'], default: 'normal' }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Agent execution result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        result: { type: 'string' },
                        agentName: { type: 'string' },
                        executionTime: { type: 'number' },
                        confidence: { type: 'number' },
                        metadata: { type: 'object', additionalProperties: true }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '404': { $ref: '#/components/responses/NotFoundError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    
    // ============================================
    // MODEL ENDPOINTS
    // ============================================
    '/models': {
      get: {
        tags: ['Models'],
        summary: 'List available models',
        description: 'Get a list of all available LLM models with their specifications',
        operationId: 'listModels',
        parameters: [
          {
            name: 'provider',
            in: 'query',
            description: 'Filter models by provider',
            schema: {
              type: 'string',
              enum: ['openai', 'anthropic', 'google', 'meta', 'local']
            }
          },
          {
            name: 'capability',
            in: 'query',
            description: 'Filter models by capability',
            schema: {
              type: 'string',
              enum: ['chat', 'completion', 'vision', 'function-calling', 'streaming']
            }
          }
        ],
        responses: {
          '200': {
            description: 'List of available models',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        models: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Model' }
                        },
                        defaultModel: { type: 'string' },
                        total: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          },
          '429': { $ref: '#/components/responses/RateLimitError' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    
    '/models/{modelId}/test': {
      post: {
        tags: ['Models'],
        summary: 'Test model',
        description: 'Test a specific model with a sample prompt',
        operationId: 'testModel',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        parameters: [
          {
            name: 'modelId',
            in: 'path',
            required: true,
            description: 'Model identifier',
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['prompt'],
                properties: {
                  prompt: {
                    type: 'string',
                    description: 'Test prompt',
                    example: 'Hello, can you help me?'
                  },
                  temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
                  maxTokens: { type: 'integer', minimum: 1, maximum: 4096, default: 100 }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Model test result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        response: { type: 'string' },
                        model: { type: 'string' },
                        latency: { type: 'number' },
                        tokens: {
                          type: 'object',
                          properties: {
                            input: { type: 'integer' },
                            output: { type: 'integer' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '404': { $ref: '#/components/responses/NotFoundError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    
    // ============================================
    // VISION ENDPOINTS
    // ============================================
    '/vision/analyze': {
      post: {
        tags: ['Vision'],
        summary: 'Analyze image',
        description: 'Analyze an image using computer vision models',
        operationId: 'analyzeImage',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['image'],
                properties: {
                  image: {
                    type: 'string',
                    format: 'binary',
                    description: 'Image file to analyze'
                  },
                  prompt: {
                    type: 'string',
                    description: 'Optional prompt for guided analysis',
                    example: 'What objects are in this image?'
                  },
                  features: {
                    type: 'array',
                    items: {
                      type: 'string',
                      enum: ['objects', 'faces', 'text', 'landmarks', 'colors', 'nsfw']
                    },
                    description: 'Specific features to analyze'
                  }
                }
              }
            },
            'application/json': {
              schema: {
                type: 'object',
                required: ['imageUrl'],
                properties: {
                  imageUrl: {
                    type: 'string',
                    format: 'uri',
                    description: 'URL of the image to analyze'
                  },
                  prompt: {
                    type: 'string',
                    description: 'Optional prompt for guided analysis'
                  },
                  features: {
                    type: 'array',
                    items: {
                      type: 'string',
                      enum: ['objects', 'faces', 'text', 'landmarks', 'colors', 'nsfw']
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Image analysis results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        description: { type: 'string' },
                        objects: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              label: { type: 'string' },
                              confidence: { type: 'number' },
                              boundingBox: {
                                type: 'object',
                                properties: {
                                  x: { type: 'number' },
                                  y: { type: 'number' },
                                  width: { type: 'number' },
                                  height: { type: 'number' }
                                }
                              }
                            }
                          }
                        },
                        text: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              text: { type: 'string' },
                              confidence: { type: 'number' }
                            }
                          }
                        },
                        metadata: {
                          type: 'object',
                          properties: {
                            width: { type: 'integer' },
                            height: { type: 'integer' },
                            format: { type: 'string' },
                            model: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '413': {
            description: 'Image too large',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          '429': { $ref: '#/components/responses/RateLimitError' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    
    // ============================================
    // VOICE ENDPOINTS
    // ============================================
    '/voice/synthesize': {
      post: {
        tags: ['Voice'],
        summary: 'Text to speech',
        description: 'Convert text to speech using various voice models',
        operationId: 'synthesizeSpeech',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: {
                    type: 'string',
                    description: 'Text to convert to speech',
                    maxLength: 5000,
                    example: 'Hello, how can I help you today?'
                  },
                  voice: {
                    type: 'string',
                    description: 'Voice model to use',
                    enum: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
                    default: 'alloy'
                  },
                  model: {
                    type: 'string',
                    description: 'TTS model',
                    enum: ['tts-1', 'tts-1-hd'],
                    default: 'tts-1'
                  },
                  speed: {
                    type: 'number',
                    description: 'Speech speed',
                    minimum: 0.25,
                    maximum: 4.0,
                    default: 1.0
                  },
                  format: {
                    type: 'string',
                    description: 'Output audio format',
                    enum: ['mp3', 'opus', 'aac', 'flac', 'wav'],
                    default: 'mp3'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Generated audio',
            content: {
              'audio/mpeg': {
                schema: {
                  type: 'string',
                  format: 'binary'
                }
              },
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        audioUrl: { type: 'string', format: 'uri' },
                        duration: { type: 'number' },
                        format: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    
    '/voice/transcribe': {
      post: {
        tags: ['Voice'],
        summary: 'Speech to text',
        description: 'Transcribe audio to text',
        operationId: 'transcribeSpeech',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['audio'],
                properties: {
                  audio: {
                    type: 'string',
                    format: 'binary',
                    description: 'Audio file to transcribe'
                  },
                  language: {
                    type: 'string',
                    description: 'Language code (ISO 639-1)',
                    example: 'en'
                  },
                  prompt: {
                    type: 'string',
                    description: 'Optional prompt to guide transcription'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Transcription result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        text: { type: 'string' },
                        language: { type: 'string' },
                        duration: { type: 'number' },
                        confidence: { type: 'number' }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '413': {
            description: 'Audio file too large',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          '429': { $ref: '#/components/responses/RateLimitError' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    
    // ============================================
    // MEMORY ENDPOINTS
    // ============================================
    '/memory/context': {
      get: {
        tags: ['Memory'],
        summary: 'Get context',
        description: 'Retrieve stored context for the current session',
        operationId: 'getContext',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        parameters: [
          {
            name: 'conversationId',
            in: 'query',
            description: 'Optional conversation ID',
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'Context data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        context: { type: 'object', additionalProperties: true },
                        conversationId: { type: 'string' },
                        lastUpdated: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '404': { $ref: '#/components/responses/NotFoundError' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      },
      post: {
        tags: ['Memory'],
        summary: 'Update context',
        description: 'Update stored context for the current session',
        operationId: 'updateContext',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['context'],
                properties: {
                  context: {
                    type: 'object',
                    description: 'Context data to store',
                    additionalProperties: true
                  },
                  conversationId: {
                    type: 'string',
                    format: 'uuid',
                    description: 'Optional conversation ID'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Context updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        message: { type: 'string' },
                        conversationId: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    
    // ============================================
    // MONITORING ENDPOINTS
    // ============================================
    '/monitoring/health': {
      get: {
        tags: ['Monitoring'],
        summary: 'Health check',
        description: 'Check the health status of the API and its services',
        operationId: 'healthCheck',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthStatus' }
              }
            }
          },
          '503': {
            description: 'Service unhealthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthStatus' }
              }
            }
          }
        }
      }
    },
    
    '/monitoring/metrics': {
      get: {
        tags: ['Monitoring'],
        summary: 'Get metrics',
        description: 'Retrieve system and application metrics',
        operationId: 'getMetrics',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        responses: {
          '200': {
            description: 'System metrics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        system: {
                          type: 'object',
                          properties: {
                            cpu: { type: 'number' },
                            memory: {
                              type: 'object',
                              properties: {
                                used: { type: 'integer' },
                                total: { type: 'integer' },
                                percentage: { type: 'number' }
                              }
                            },
                            uptime: { type: 'integer' }
                          }
                        },
                        application: {
                          type: 'object',
                          properties: {
                            requests: {
                              type: 'object',
                              properties: {
                                total: { type: 'integer' },
                                success: { type: 'integer' },
                                error: { type: 'integer' },
                                averageLatency: { type: 'number' }
                              }
                            },
                            activeConnections: { type: 'integer' },
                            queuedTasks: { type: 'integer' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    
    // ============================================
    // WEBSOCKET ENDPOINTS
    // ============================================
    '/ws': {
      get: {
        tags: ['WebSocket'],
        summary: 'WebSocket connection',
        description: 'Establish a WebSocket connection for real-time communication',
        operationId: 'websocketConnect',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        responses: {
          '101': {
            description: 'Switching Protocols - WebSocket connection established',
            headers: {
              'Upgrade': {
                schema: { type: 'string', example: 'websocket' }
              },
              'Connection': {
                schema: { type: 'string', example: 'Upgrade' }
              }
            }
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '426': {
            description: 'Upgrade Required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    }
  };
}