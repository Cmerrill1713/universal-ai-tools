import express from 'express';
import { logger } from './utils/logger';
import cors from 'cors';

const app = express();
const port = 9999;

logger.info('Starting minimal server...');

// Middleware
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:9999'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-AI-Service'],
  })
);
app.use(express.json());

// Add requestlogging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    headers: req.headers,
    body: req.method !== 'GET' ? req.body : undefined,
  });
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Assistant chat endpoint
app.post('/api/assistant/chat', async (req, res) => {
  try {
    const { message, model = 'llama3.2:3b', conversation_id = 'default' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Call Supabase Ollama function directly
    const supabaseUrl = 'http://127.0.0.1:54321';
    const anonKey = process.env.SUPABASE_ANON_KEY || '';

    const ollamaResponse = await fetch(`${supabaseUrl}/functions/v1/ollama-assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        prompt: message,
        model,
        temperature: 0.7,
        max_tokens: 1000,
        stream: false,
        system:
          'You are Sweet Athena, a helpful and caring AI assistant. Respond in a warm, friendly manner.',
      }),
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama API _error ${ollamaResponse.status}`);
    }

    const data = await ollamaResponse.json();

    logger.info(`Chat requestprocessed: ${message.substring(0, 50)}...`);

    res.json({
      response: data.response,
      model: data.model || model,
      conversation_id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Chat endpoint _error', error);

    // More detailed _errorresponse
    const errorResponse = {
      error: 'Internal server error,
      message: 'Failed to process chat request,
      details: error instanceof Error ? error.message : 'Unknown error,
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(errorResponse);
  }
});

// Speech API stub endpoints
app.get('/api/speech/health', (req, res) => {
  res.json({
    status: 'healthy',
    services: {
      kokoro: false,
      openai: false,
      elevenlabs: false,
    },
  });
});

app.get('/api/speech/voices', (req, res) => {
  res.json({
    kokoroVoices: [],
  });
});

app.post('/api/speech/synthesize/retry', (req, res) => {
  res.status(503).json({
    error: 'TTS service not available',
    message: 'Text-to-speech is not configured',
  });
});

app.post('/api/speech/synthesize/kokoro', (req, res) => {
  res.status(503).json({
    error: 'Kokoro TTS not available',
    message: 'Kokoro TTS is not configured',
  });
});

app.post('/api/speech/test/kokoro/:voiceId', (req, res) => {
  res.status(503).json({
    error: 'Kokoro TTS not available',
    message: 'Voice testing is not configured',
  });
});

app.listen(port, () => {
  logger.info(`Minimal server running on port ${port}`);
});

logger.info('Server setup complete');
