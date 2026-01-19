import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

const resolveAlias = {
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
  '../preload': resolve(__dirname, 'src/extension/shim.ts')
}

export default defineConfig({
  test: {
    projects: [
      // Renderer unit tests
      {
        extends: true,
        resolve: {
          alias: resolveAlias
        },
        test: {
          name: 'renderer',
          environment: 'jsdom',
          setupFiles: ['@vitest/web-worker', 'tests/renderer.setup.ts'],
          include: ['src/renderer/**/*.{test,spec}.{ts,tsx}', 'src/renderer/**/__tests__/**/*.{test,spec}.{ts,tsx}']
        }
      },
      // Scripts unit tests
      {
        extends: true,
        test: {
          name: 'scripts',
          environment: 'node',
          include: ['scripts/**/*.{test,spec}.{ts,tsx}', 'scripts/**/__tests__/**/*.{test,spec}.{ts,tsx}']
        }
      },
      // aiCore package unit tests
      {
        extends: 'packages/aiCore/vitest.config.ts',
        test: {
          name: 'aiCore',
          environment: 'node',
          include: [
            'packages/aiCore/**/*.{test,spec}.{ts,tsx}',
            'packages/aiCore/**/__tests__/**/*.{test,spec}.{ts,tsx}'
          ]
        }
      },
      // shared package unit tests
      {
        extends: true,
        test: {
          name: 'shared',
          environment: 'node',
          include: [
            'packages/shared/**/*.{test,spec}.{ts,tsx}',
            'packages/shared/**/__tests__/**/*.{test,spec}.{ts,tsx}'
          ]
        }
      }
    ],
    // Global shared configuration
    globals: true,
    setupFiles: [],
    exclude: ['**/node_modules/**', '**/dist/**', '**/out/**', '**/build/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'text-summary'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/out/**',
        '**/build/**',
        '**/coverage/**',
        '**/tests/**',
        '**/.yarn/**',
        '**/.cursor/**',
        '**/.vscode/**',
        '**/.github/**',
        '**/.husky/**',
        '**/*.d.ts',
        '**/types/**',
        '**/__tests__/**',
        '**/*.{test,spec}.{ts,tsx}',
        '**/*.config.{js,ts}'
      ]
    },
    testTimeout: 20000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false
      }
    }
  }
})
