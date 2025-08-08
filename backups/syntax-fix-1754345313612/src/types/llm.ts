// LLM-related types;

export interface LLMProvider {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'ollama' | 'lm-studio' | 'custom';
  endpoint: string;
  models: string[];
  isActive: boolean;
  rateLimits?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface LLMRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  stop?: string[];
  tools?: LLMTool[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface LLMResponse {
  id: string;
  model: string;
  choices: Array<{
    message: ChatMessage;
    finish_reason: string;
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
  capabilities: string[];
}