import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Vite Configuration
 * 
 * Two-Model Architecture API Keys:
 *   - DEEPSEEK_API_KEY: Required for "The Writer" (DeepSeek-V3.2)
 *   - GEMINI_API_KEY: Required for "The Clerk" (Gemini Flash)
 *   - PINECONE_API_KEY: Optional for vector database
 *   - OPENAI_API_KEY: Optional for embeddings (required by Pinecone)
 */

export default defineConfig(({ mode }) => {
    // Load from .env files (for local development)
    const fileEnv = loadEnv(mode, '.', '');
    
    // Helper to get env var from either process.env (Vercel) or .env files (local)
    // process.env takes priority as it contains Vercel's environment variables during build
    const getEnv = (key: string): string | undefined => {
      return process.env[key] || fileEnv[key] || undefined;
    };
    
    const shouldAnalyze = process.env.ANALYZE === 'true';
    
    // Conditionally import visualizer only when needed
    let visualizerPlugin: any = null;
    if (shouldAnalyze) {
      try {
        // Dynamic import only when ANALYZE=true
        // Use createRequire for ES module compatibility
        const { visualizer } = require('rollup-plugin-visualizer');
        visualizerPlugin = visualizer({
          open: true,
          filename: 'dist/stats.html',
          gzipSize: true,
          brotliSize: true,
        });
      } catch (e) {
        // Plugin not installed - that's okay, bundle analysis is optional
        // Only warn in development to avoid cluttering production builds
        if (mode === 'development') {
          console.warn('rollup-plugin-visualizer not installed. Install it with: npm install --save-dev rollup-plugin-visualizer');
        }
      }
    }
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        // Bundle analyzer (only when ANALYZE=true and plugin is installed)
        visualizerPlugin,
      ].filter(Boolean),
      define: {
        // Expose environment variables to client
        // Uses process.env (Vercel build) with fallback to .env files (local dev)
        // 
        // Two-Model Architecture:
        //   - DEEPSEEK_API_KEY: "The Writer" - DeepSeek-V3.2 for chapter generation
        //   - GEMINI_API_KEY: "The Clerk" - Gemini Flash for state extraction
        //   - PINECONE_API_KEY: Optional - Vector database for semantic search
        //   - OPENAI_API_KEY: Optional - Required for generating embeddings (Pinecone)
        'process.env.DEEPSEEK_API_KEY': JSON.stringify(getEnv('DEEPSEEK_API_KEY')),
        'process.env.GEMINI_API_KEY': JSON.stringify(getEnv('GEMINI_API_KEY')),
        'process.env.PINECONE_API_KEY': JSON.stringify(getEnv('PINECONE_API_KEY')),
        'process.env.OPENAI_API_KEY': JSON.stringify(getEnv('OPENAI_API_KEY')),
      },
      // Expose VITE_ prefixed env vars to the client
      envPrefix: 'VITE_',
      build: {
        // Generate source maps for production debugging (optional, increases build time)
        sourcemap: false,
        // Minification settings
        minify: 'esbuild',
        // Chunk size warning threshold (500KB)
        chunkSizeWarningLimit: 500,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) return;

              // Split big vendors to reduce the main bundle size.
              if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
              if (id.includes('@supabase')) return 'vendor-supabase';
              if (id.includes('zod')) return 'vendor-zod';

              return 'vendor';
            },
          },
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
