/**
 * Vite Configuration for Web Renderer Build
 *
 * This configuration builds the Cherry Studio renderer as a standalone web app.
 */
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'
import { defineConfig } from 'vite'

const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  plugins: [tailwindcss(), react({ tsDecorators: true })],

  root: resolve(__dirname, 'src/renderer'),

  define: {
    'import.meta.env.VITE_IS_WEB': JSON.stringify(true),
    'import.meta.env.VITE_PLATFORM': JSON.stringify('web'),
    'process.env.ELECTRON_DISABLE_SECURITY_WARNINGS': JSON.stringify(true)
  },

  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'packages/shared'),
      '@types': resolve(__dirname, 'src/renderer/src/types'),
      '@logger': resolve(__dirname, 'src/renderer/src/services/LoggerService'),
      '@mcp-trace/trace-core': resolve(__dirname, 'packages/mcp-trace/trace-core'),
      '@mcp-trace/trace-web': resolve(__dirname, 'packages/mcp-trace/trace-web'),
      '@cherrystudio/ai-core/provider': resolve(__dirname, 'packages/aiCore/src/core/providers'),
      '@cherrystudio/ai-core/built-in/plugins': resolve(__dirname, 'packages/aiCore/src/core/plugins/built-in'),
      '@cherrystudio/ai-core': resolve(__dirname, 'packages/aiCore/src'),
      '@cherrystudio/extension-table-plus': resolve(__dirname, 'packages/extension-table-plus/src'),
      '@cherrystudio/ai-sdk-provider': resolve(__dirname, 'packages/ai-sdk-provider/src'),
      // Shim the preload imports for web
      '../preload': resolve(__dirname, 'extension/shim.ts')
    }
  },

  optimizeDeps: {
    exclude: ['pyodide', 'btcp-browser-agent'],
    esbuildOptions: {
      target: 'esnext'
    }
  },

  worker: {
    format: 'es'
  },

  server: {
    port: 5173,
    open: true
  },

  build: {
    outDir: resolve(__dirname, 'dist-web'),
    target: 'esnext',
    emptyOutDir: true,
    sourcemap: !isProd
  },

  esbuild: isProd ? { legalComments: 'none' } : {}
})
