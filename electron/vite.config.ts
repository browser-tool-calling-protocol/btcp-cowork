import react from '@vitejs/plugin-react-swc'
import { CodeInspectorPlugin } from 'code-inspector-plugin'
import { defineConfig } from 'electron-vite'
import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

// assert not supported by biome
// import pkg from './package.json' assert { type: 'json' }
import pkg from '../package.json'

const visualizerPlugin = (type: 'renderer' | 'main') => {
  return process.env[`VISUALIZER_${type.toUpperCase()}`] ? [visualizer({ open: true })] : []
}

const isDev = process.env.NODE_ENV === 'development'
const isProd = process.env.NODE_ENV === 'production'

// Root directory (parent of electron/)
const rootDir = resolve(__dirname, '..')

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
      rollupOptions: {
        external: ['bufferutil', 'utf-8-validate', 'electron', ...Object.keys(pkg.dependencies)],
        output: {
          manualChunks: undefined, // 彻底禁用代码分割 - 返回 null 强制单文件打包
          inlineDynamicImports: true // 内联所有动态导入，这是关键配置
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
      sourcemap: isDev
    }
  },
  renderer: {
    plugins: [
      (async () => (await import('@tailwindcss/vite')).default())(),
      react({
        tsDecorators: true
      }),
      ...(isDev ? [CodeInspectorPlugin({ bundler: 'vite' })] : []), // 只在开发环境下启用 CodeInspectorPlugin
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
        target: 'esnext' // for dev
      }
    },
    worker: {
      format: 'es'
    },
    build: {
      target: 'esnext', // for build
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
