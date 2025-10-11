import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

const PORT = parseInt(process.env.PORT || '8080', 10);
const ASSISTANTD_URL = process.env.ASSISTANTD_URL || 'http://localhost:3033';

const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', gateway: true, assistantd: ASSISTANTD_URL, ts: new Date().toISOString() });
});

// Simple proxy to assistantd chat
app.post('/api/v1/assistant/chat', async (req, res) => {
  try {
    const { messages, model, tools, tool_choice } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: 'messages array is required' });
    }
    const url = `${ASSISTANTD_URL}/chat`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model, tools, tool_choice })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res.status(502).json({ success: false, error: 'assistantd error', details: data });
    }
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
});

// Convenience echo and index
app.get('/', (_req, res) => {
  res.json({
    service: 'universal-ai-gateway',
    status: 'running',
    endpoints: {
      health: '/health',
      chat: '/api/v1/assistant/chat'
    }
  });
});

server.listen(PORT, () => {
  console.log(`Gateway listening on http://localhost:${PORT}`);
  console.log(`Assistantd target: ${ASSISTANTD_URL}`);
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));

