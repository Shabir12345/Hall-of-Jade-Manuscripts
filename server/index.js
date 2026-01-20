/**
 * Backend Proxy Server (Legacy - Not Required for Two-Model Architecture)
 * 
 * NOTE: This server is no longer required for the two-model architecture.
 * Both DeepSeek and Gemini APIs work directly from the browser without CORS issues.
 * 
 * This file is kept for potential future use if a proxy is needed.
 * 
 * Two-Model Architecture:
 *   - DeepSeek-V3.2 ("The Writer") - Direct API calls from browser
 *   - Gemini Flash ("The Clerk") - Direct API calls from browser
 * 
 * If you need to run a proxy server for other purposes:
 *   npm run server
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
  res.json({ 
    status: 'ok', 
    service: 'hall-of-jade-manuscripts-proxy',
    note: 'This proxy server is not required for the two-model architecture. DeepSeek and Gemini APIs work directly from the browser.',
    architecture: {
      writer: 'DeepSeek-V3.2 - Chapter generation and creative writing',
      clerk: 'Gemini Flash - State extraction and metadata processing'
    }
  });
});

// Info endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Hall of Jade Manuscripts - Proxy Server',
    status: 'running',
    note: 'This server is not required for normal operation. The two-model architecture (DeepSeek + Gemini) works directly from the browser.',
    architecture: {
      deepseek: {
        role: 'The Writer',
        description: 'DeepSeek-V3.2 for chapter generation, arc planning, and creative writing',
        corsRequired: false
      },
      gemini: {
        role: 'The Clerk', 
        description: 'Gemini Flash for state extraction, metadata processing, and Lore Bible updates',
        corsRequired: false
      }
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Proxy Server running on http://localhost:${PORT}`);
  console.log(`\n📝 NOTE: This server is NOT required for the two-model architecture.`);
  console.log(`   Both DeepSeek and Gemini APIs work directly from the browser.\n`);
  console.log(`   Two-Model Architecture:`);
  console.log(`   - DEEPSEEK_API_KEY (The Writer): ${process.env.DEEPSEEK_API_KEY ? '✓ Set' : '✗ Not Set'}`);
  console.log(`   - GEMINI_API_KEY (The Clerk): ${process.env.GEMINI_API_KEY ? '✓ Set' : '✗ Not Set'}`);
});
