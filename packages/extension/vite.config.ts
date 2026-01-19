/**
 * Vite Configuration for Chrome Extension Build
 *
 * This configuration builds the Cherry Studio renderer as a Chrome extension,
 * reusing the existing React UI with the window.api shim.
 */
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { copyFileSync, cpSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { defineConfig } from 'vite'

const isProd = process.env.NODE_ENV === 'production'

// Root of the monorepo
const rootDir = resolve(__dirname, '../..')

// Plugin to copy manifest and assets
function copyExtensionFiles() {
  return {
    name: 'copy-extension-files',
    buildStart() {
      // Ensure output directory exists before build starts
      const outDir = resolve(__dirname, 'dist')
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true })
      }
    },
    closeBundle() {
      const outDir = resolve(__dirname, 'dist')

      // Ensure output directory exists
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true })
      }

      // Copy manifest
      const manifestSrc = resolve(__dirname, 'src/manifest.json')
      if (existsSync(manifestSrc)) {
        copyFileSync(manifestSrc, resolve(outDir, 'manifest.json'))
      }

      // Create icons directory and copy icons
      const iconsDir = resolve(outDir, 'icons')
      if (!existsSync(iconsDir)) {
        mkdirSync(iconsDir, { recursive: true })
      }

      // Copy logo as icons
      const logoSrc = resolve(rootDir, 'src/renderer/src/assets/images/logo.png')
      if (existsSync(logoSrc)) {
        copyFileSync(logoSrc, resolve(iconsDir, 'icon16.png'))
        copyFileSync(logoSrc, resolve(iconsDir, 'icon48.png'))
        copyFileSync(logoSrc, resolve(iconsDir, 'icon128.png'))
      }

      // Copy assets directory
      const assetsSrc = resolve(rootDir, 'src/renderer/src/assets')
      const assetsDst = resolve(outDir, 'assets')
      if (existsSync(assetsSrc)) {
        cpSync(assetsSrc, assetsDst, { recursive: true })
      }
    }
  }
}

export default defineConfig({
  plugins: [tailwindcss(), react({ tsDecorators: true }), copyExtensionFiles()],

  define: {
    // Mark as extension build
    'import.meta.env.VITE_IS_EXTENSION': JSON.stringify(true),
    'import.meta.env.VITE_PLATFORM': JSON.stringify('extension'),
    // Prevent Electron-specific code from running
    'process.env.ELECTRON_DISABLE_SECURITY_WARNINGS': JSON.stringify(true)
  },

  resolve: {
    alias: {
      '@renderer': resolve(rootDir, 'src/renderer/src'),
      '@shared': resolve(rootDir, 'packages/shared'),
      '@types': resolve(rootDir, 'src/renderer/src/types'),
      '@logger': resolve(rootDir, 'src/renderer/src/services/LoggerService'),
      '@mcp-trace/trace-core': resolve(rootDir, 'packages/mcp-trace/trace-core'),
      '@mcp-trace/trace-web': resolve(rootDir, 'packages/mcp-trace/trace-web'),
      '@cherrystudio/ai-core/provider': resolve(rootDir, 'packages/aiCore/src/core/providers'),
      '@cherrystudio/ai-core/built-in/plugins': resolve(rootDir, 'packages/aiCore/src/core/plugins/built-in'),
      '@cherrystudio/ai-core': resolve(rootDir, 'packages/aiCore/src'),
      '@cherrystudio/extension-table-plus': resolve(rootDir, 'packages/extension-table-plus/src'),
      '@cherrystudio/ai-sdk-provider': resolve(rootDir, 'packages/ai-sdk-provider/src'),
      // Shim the preload imports - point to the extension's shim
      '../preload': resolve(__dirname, 'src/shim.ts')
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

  build: {
    outDir: 'dist',
    target: 'esnext',
    emptyOutDir: false, // Don't empty - content.js is built separately with esbuild
    sourcemap: !isProd,

    rollupOptions: {
      input: {
        // Shim initialization (loaded as regular script, not ES module)
        'shim-init': resolve(__dirname, 'src/shim-init.js'),
        // Shim must be built first as a separate module
        shim: resolve(__dirname, 'src/shim.ts'),
        // Sidepanel entry (chat UI)
        'sidepanel-app': resolve(__dirname, 'src/sidepanel.tsx'),
        // Main UI entry points
        sidepanel: resolve(__dirname, 'src/sidepanel.html'),
        window: resolve(__dirname, 'src/window.html'),
        popup: resolve(__dirname, 'src/popup.html'),
        // Background service worker (module)
        background: resolve(__dirname, 'src/background.ts')
        // Content script is built separately with esbuild (see scripts/build-content.ts)
        // to create a single bundled file without code splitting
      },
      preserveEntrySignatures: 'strict',
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.html')) {
            return '[name][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
        format: 'es'
      },
      onwarn(warning, warn) {
        // Ignore certain warnings
        if (warning.code === 'COMMONJS_VARIABLE_IN_ESM') return
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
        warn(warning)
      }
    }
  },

  esbuild: isProd ? { legalComments: 'none' } : {}
})
