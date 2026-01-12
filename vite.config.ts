import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';
    const shouldAnalyze = process.env.ANALYZE === 'true';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        // Bundle analyzer (only when ANALYZE=true)
        shouldAnalyze && visualizer({
          open: true,
          filename: 'dist/stats.html',
          gzipSize: true,
          brotliSize: true,
        }),
      ].filter(Boolean),
      define: {
        // Expose environment variables to client (only VITE_ prefixed are safe)
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.DEEPSEEK_API_KEY': JSON.stringify(env.DEEPSEEK_API_KEY),
      },
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
              if (id.includes('@google/genai')) return 'vendor-genai';

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
