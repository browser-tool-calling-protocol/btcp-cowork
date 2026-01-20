/**
 * Build Content Script with esbuild
 *
 * Content scripts in Chrome extensions cannot reliably load ES module chunks.
 * This script uses esbuild to create a single bundled file with all dependencies inlined.
 *
 * Based on the official btcp-browser-agent example build process.
 */

// @ts-expect-error - esbuild is a devDependency and types may not be available during typecheck
import * as esbuild from 'esbuild'
import { statSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isProd = process.env.NODE_ENV === 'production'

async function buildContentScript() {
  try {
    console.log('Building content script with esbuild...')

    const result = await esbuild.build({
      entryPoints: [resolve(__dirname, '../extension/content.ts')],
      bundle: true,
      outfile: resolve(__dirname, '../dist-extension/content.js'),
      format: 'esm',
      platform: 'browser',
      target: 'chrome120',
      sourcemap: !isProd,
      minify: isProd,
      // Map internal @btcp/* references to btcp-browser-agent subpaths
      alias: {
        '@btcp/core': 'btcp-browser-agent/core',
        '@btcp/extension': 'btcp-browser-agent/extension'
      },
      logLevel: 'info'
    })

    console.log('✓ Content script built successfully')

    // Log output file size
    const stats = statSync(resolve(__dirname, '../dist-extension/content.js'))
    console.log(`  Output: dist-extension/content.js (${(stats.size / 1024).toFixed(2)} KB)`)

    if (result.errors.length > 0) {
      console.error('Build errors:', result.errors)
      process.exit(1)
    }
  } catch (error) {
    console.error('Failed to build content script:', error)
    process.exit(1)
  }
}

buildContentScript()
