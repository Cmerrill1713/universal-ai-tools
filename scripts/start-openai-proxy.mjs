#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import chalk from 'chalk';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const PORT = process.env.OPENAI_PROXY_PORT || 8081;

console.log(chalk.blue.bold('🤖 Starting OpenAI → Ollama Proxy\n'));

// OpenAI-compatible chat completions endpoint
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { messages, model = 'llama3.2:3b', temperature = 0.1 } = req.body;
    
    // Convert messages to prompt
    let prompt = '';
    if (messages && Array.isArray(messages)) {
      // Focus on the last user message for SQL generation
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        prompt = lastUserMsg.content;
      } else {
        prompt = messages.map(m => m.content).join('\n');
      }
    }
    
    console.log(chalk.yellow('📨 Request:'), prompt.substring(0, 50) + '...');
    
    // Add SQL context
    if (prompt.toLowerCase().includes('sql') || 
        prompt.toLowerCase().includes('query') ||
        prompt.toLowerCase().includes('select') ||
        prompt.toLowerCase().includes('table')) {
      prompt = `You are a PostgreSQL expert. Generate only SQL code for: ${prompt}. No explanations, just SQL.`;
    }
    
    // Call Ollama
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        temperature,
        stream: false
      })
    });
    
    const ollamaData = await ollamaResponse.json();
    let content = ollamaData.response || '';
    
    // Clean SQL responses
    content = content.replace(/```sql\n?/gi, '').replace(/```\n?/gi, '').trim();
    
    console.log(chalk.green('✅ Response:'), content.substring(0, 50) + '...');
    
    // OpenAI format
    res.json({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: content
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 100,
        total_tokens: 200
      }
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
    res.status(500).json({
      error: {
        message: error.message,
        type: 'proxy_error'
      }
    });
  }
});

// Models endpoint
app.get('/v1/models', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await response.json();
    
    res.json({
      object: 'list',
      data: data.models?.map(m => ({
        id: m.name,
        object: 'model',
        owned_by: 'ollama'
      })) || []
    });
  } catch (error) {
    res.json({
      object: 'list',
      data: [{ id: 'llama3.2:3b', object: 'model', owned_by: 'ollama' }]
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'OpenAI → Ollama Proxy',
    endpoints: {
      chat: '/v1/chat/completions',
      models: '/v1/models'
    },
    ollama: OLLAMA_URL,
    status: 'running'
  });
});

app.listen(PORT, () => {
  console.log(chalk.green.bold(`\n✅ OpenAI → Ollama proxy started!\n`));
  console.log(chalk.cyan('Configuration:'));
  console.log(chalk.gray(`   Proxy URL: http://localhost:${PORT}`));
  console.log(chalk.gray(`   Ollama URL: ${OLLAMA_URL}`));
  console.log(chalk.gray(`   Default Model: llama3.2:3b`));
  
  console.log(chalk.cyan('\nOpenAI-compatible endpoints:'));
  console.log(chalk.gray(`   POST http://localhost:${PORT}/v1/chat/completions`));
  console.log(chalk.gray(`   GET  http://localhost:${PORT}/v1/models`));
  
  console.log(chalk.yellow('\nTo use with Supabase Studio:'));
  console.log(chalk.gray(`   1. Set OPENAI_API_KEY=sk-ollama-proxy-key`));
  console.log(chalk.gray(`   2. Configure proxy URL in your client`));
  
  console.log(chalk.blue('\nTesting proxy...'));
  
  // Test Ollama connection
  fetch(`${OLLAMA_URL}/api/tags`)
    .then(r => r.json())
    .then(data => console.log(chalk.green(`✅ Ollama connected: ${data.models?.length || 0} models available`)))
    .catch(() => console.error(chalk.red('❌ Cannot connect to Ollama at'), OLLAMA_URL));
});