import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { CodeInspectorPlugin } from 'code-inspector-plugin'
import { defineConfig } from 'electron-vite'
import { createRequire } from 'module'
import { dirname, resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import { fileURLToPath } from 'url'

// createRequire allows importing JSON in ESM
const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const visualizerPlugin = (type: 'renderer' | 'main') => {
  return process.env[`VISUALIZER_${type.toUpperCase()}`] ? [visualizer({ open: true })] : []
}

const isDev = process.env.NODE_ENV === 'development'
const isProd = process.env.NODE_ENV === 'production'

// Root directory (project root)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = __dirname

export default defineConfig({
  main: {
    plugins: [...visualizerPlugin('main')],
    resolve: {
      alias: {
        '@main': resolve(rootDir, 'electron/main'),
        '@types': resolve(rootDir, 'src/renderer/src/types'),
        '@shared': resolve(rootDir, 'packages/shared'),
        '@logger': resolve(rootDir, 'electron/main/services/LoggerService'),
        '@mcp-trace/trace-core': resolve(rootDir, 'packages/mcp-trace/trace-core'),
        '@mcp-trace/trace-node': resolve(rootDir, 'packages/mcp-trace/trace-node')
      }
    },
    build: {
      lib: {
        entry: resolve(rootDir, 'electron/main/index.ts')
      },
      rollupOptions: {
        external: [
          'bufferutil',
          'utf-8-validate',
          'electron',
          // Native modules with binary dependencies
          'font-list',
          'jsdom',
          // Native bindings for libsql
          '@libsql/darwin-arm64',
          '@libsql/darwin-x64',
          '@libsql/linux-arm64-gnu',
          '@libsql/linux-arm64-musl',
          '@libsql/linux-x64-gnu',
          '@libsql/linux-x64-musl',
          '@libsql/win32-x64-msvc',
          '@strongtz/win32-arm64-msvc',
          ...Object.keys(pkg.dependencies || {})
        ],
        output: {
          inlineDynamicImports: true
        },
        onwarn(warning, warn) {
          if (warning.code === 'COMMONJS_VARIABLE_IN_ESM') return
          warn(warning)
        }
      },
      sourcemap: isDev
    },
    esbuild: isProd ? { legalComments: 'none' } : {},
    optimizeDeps: {
      noDiscovery: isDev
    }
  },
  preload: {
    plugins: [
      react({
        tsDecorators: true
      })
    ],
    resolve: {
      alias: {
        '@shared': resolve(rootDir, 'packages/shared'),
        '@mcp-trace/trace-core': resolve(rootDir, 'packages/mcp-trace/trace-core')
      }
    },
    build: {
      lib: {
        entry: resolve(rootDir, 'electron/preload/index.ts')
      },
      sourcemap: isDev
    }
  },
  renderer: {
    plugins: [
      tailwindcss(),
      react({
        tsDecorators: true
      }),
      ...(isDev ? [CodeInspectorPlugin({ bundler: 'vite' })] : []),
      ...visualizerPlugin('renderer')
    ],
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
        '@cherrystudio/ai-sdk-provider': resolve(rootDir, 'packages/ai-sdk-provider/src')
      }
    },
    optimizeDeps: {
      exclude: ['pyodide'],
      esbuildOptions: {
        target: 'esnext'
      }
    },
    build: {
      target: 'esnext',
      rollupOptions: {
        input: {
          index: resolve(rootDir, 'src/renderer/index.html'),
          miniWindow: resolve(rootDir, 'src/renderer/miniWindow.html'),
          selectionToolbar: resolve(rootDir, 'src/renderer/selectionToolbar.html'),
          selectionAction: resolve(rootDir, 'src/renderer/selectionAction.html'),
          traceWindow: resolve(rootDir, 'src/renderer/traceWindow.html')
        },
        onwarn(warning, warn) {
          if (warning.code === 'COMMONJS_VARIABLE_IN_ESM') return
          warn(warning)
        }
      }
    },
    esbuild: isProd ? { legalComments: 'none' } : {}
  }
})
