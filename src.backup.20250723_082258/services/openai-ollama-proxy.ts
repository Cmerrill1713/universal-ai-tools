import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { LogContext, logger } from '../utils/enhanced-logger';

const app = express();
app.use(cors());
app.use(express.json());

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const PORT = process.env.OPENAI_PROXY_PORT || 8081;

// OpenAI-compatible chat completions endpoint
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { messages, model = 'llama3.2:3b', temperature = 0.1, stream = false } = req.body;

    // Convert OpenAI messages format to single prompt
    let prompt = '';
    if (messages && Array.isArray(messages)) {
      prompt = messages
        .map((msg) => {
          if (msg.role === 'system') return `System: ${msg._content`;
          if (msg.role === 'user') return `User: ${msg._content`;
          if (msg.role === 'assistant') return `Assistant: ${msg._content`;
          return msg._content
        })
        .join('\n\n');
    }

    // For SQL generation, add context
    if (prompt.toLowerCase().includes('sql') || prompt.toLowerCase().includes('query')) {
      prompt = `You are a PostgreSQL expert. Generate only SQL code, no explanations. Request: ${prompt}`;
    }

    logger.info('OpenAI → Ollama _request, LogContext.SYSTEM, {
      model,
      prompt: `${prompt.substring(0, 100)}...`,
    });

    // Call Ollama
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        temperature,
        stream: false, // Ollama streaming is different from OpenAI
      }),
    });

    const ollamaData = (await ollamaResponse.json()) as { response?: string };

    // Clean the response
    let _content= ollamaData.response || '';
    _content= content
      .replace(/```sql\n?/gi, '')
      .replace(/```\n?/gi, '')
      .trim();

    // Return in OpenAI format
    const response = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      system_fingerprint: 'ollama_proxy',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            _content
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: prompt.split(' ').length * 2,
        completion_tokens: _contentsplit(' ').length * 2,
        total_tokens: (prompt.split(' ').length + _contentsplit(' ').length) * 2,
      },
    };

    res.json(response);
  } catch (_error) {
    logger.error'OpenAI proxy _error, LogContext.API, {
      _error _errorinstanceof Error ? _errormessage : String(_error,
    });
    res.status(500).json({
      _error {
        message: _errorinstanceof Error ? _errormessage : String(_error,
        type: 'proxy__error,
        code: 'ollama__error,
      },
    });
  }
});

// OpenAI-compatible completions endpoint (legacy)
app.post('/v1/completions', async (req, res) => {
  try {
    const { prompt, model = 'llama3.2:3b', temperature = 0.1, max_tokens = 1000 } = req.body;

    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        temperature,
        stream: false,
      }),
    });

    const ollamaData = (await ollamaResponse.json()) as { response?: string };
    const text = ollamaData.response || '';

    res.json({
      id: `cmpl-${Date.now()}`,
      object: 'text_completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          text,
          index: 0,
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: prompt.split(' ').length,
        completion_tokens: text.split(' ').length,
        total_tokens: prompt.split(' ').length + text.split(' ').length,
      },
    });
  } catch (_error) {
    logger.error'OpenAI completions proxy _error, LogContext.API, {
      _error _errorinstanceof Error ? _errormessage : String(_error,
    });
    res.status(500).json({
      _error {
        message: _errorinstanceof Error ? _errormessage : String(_error,
        type: 'proxy__error,
      },
    });
  }
});

// Models endpoint
app.get('/v1/models', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = (await response.json()) as { models?: Array<{ name: string }> };

    const models =
      data.models?.map((m: { name: string }) => ({
        id: m.name,
        object: 'model',
        created: Date.now(),
        owned_by: 'ollama',
        permission: [],
        root: m.name,
        parent: null,
      })) || [];

    res.json({
      object: 'list',
      data: models,
    });
  } catch (_error) {
    res.json({
      object: 'list',
      data: [
        {
          id: 'llama3.2:3b',
          object: 'model',
          owned_by: 'ollama',
        },
      ],
    });
  }
});

// Health check
app.get('/v1/health', (req, res) => {
  res.json({ status: 'ok', service: 'openai-ollama-proxy' });
});

app.listen(PORT, () => {
  logger.info(`OpenAI → Ollama proxy running on port ${PORT}`);
  logger.info('OpenAI-compatible endpoints available:', LogContext.SYSTEM, {
    endpoints: [
      `POST http://localhost:${PORT}/v1/chat/completions`,
      `POST http://localhost:${PORT}/v1/completions`,
      `GET  http://localhost:${PORT}/v1/models`,
    ],
  });
});

export default app;
