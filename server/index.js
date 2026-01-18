/**
 * Backend Proxy Server for Anthropic Claude API
 * 
 * This server proxies requests from the frontend to Anthropic's API
 * to bypass CORS restrictions. API keys are kept secure on the server.
 * 
 * Run with: npm run server
 * Or: node server/index.js
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const app = express();
const PORT = process.env.PROXY_PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'anthropic-proxy' });
});

// Proxy endpoint for Claude API
app.post('/api/claude/chat', async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        error: 'ANTHROPIC_API_KEY is not set on the server. Please add it to your .env.local file.'
      });
    }

    const { model, messages, system, system_cache_control, temperature, top_p, max_tokens } = req.body;

    // Validate request
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: 'Invalid request: messages must be an array'
      });
    }

    // Prepare request for Anthropic API
    const anthropicRequest = {
      model: model || 'claude-sonnet-4-5-20250929',
      messages: messages,
      ...(system && { system }),
      ...(system_cache_control && { system_cache_control }),
      ...(temperature !== undefined && { temperature }),
      ...(top_p !== undefined && { top_p }),
      ...(max_tokens !== undefined && { max_tokens }),
    };

    // Forward request to Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(anthropicRequest),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || `Anthropic API error: ${response.statusText}`,
        status: response.status
      });
    }

    // Return the response
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Anthropic Proxy Server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying requests to Anthropic API`);
  console.log(`🔑 API Key: ${process.env.ANTHROPIC_API_KEY ? '✓ Loaded' : '✗ Missing'}`);
  console.log(`\n💡 Make sure your frontend is configured to use: http://localhost:${PORT}/api/claude/chat`);
});
