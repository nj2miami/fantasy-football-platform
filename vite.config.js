import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(process.env.NETLIFY_COMMIT_REF || process.env.COMMIT_REF || Date.now().toString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Offseason Fantasy Football',
        short_name: 'Offseason FF',
        description: 'A mobile-friendly fantasy football platform built around hidden randomized historical NFL weeks.',
        theme_color: '#ff6b35',
        background_color: '#fafaf9',
        display: 'standalone',
        start_url: '/',
      },
    }),
  ],
  server: {
    allowedHosts: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-dom') || id.includes('react-router-dom') || /node_modules[\\/]react[\\/]/.test(id)) {
            return 'react-vendor';
          }
          if (id.includes('@tanstack/react-query')) {
            return 'query-vendor';
          }
          if (id.includes('@supabase/supabase-js')) {
            return 'supabase-vendor';
          }
          if (id.includes('@radix-ui')) {
            return 'ui-vendor';
          }
          if (id.includes('recharts')) {
            return 'charts-vendor';
          }
          if (id.includes('react-hook-form') || id.includes('@hookform/resolvers') || id.includes('zod')) {
            return 'forms-vendor';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
}) 
