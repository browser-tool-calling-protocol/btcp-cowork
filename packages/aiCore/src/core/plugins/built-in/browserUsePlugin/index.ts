/**
 * Browser Use Plugin
 *
 * Integrates btcp-browser-agent as a reusable plugin for @cherrystudio/ai-core,
 * enabling AI models to control browsers through the Browser Tool Calling Protocol (BTCP).
 *
 * @example
 * ```typescript
 * browserUsePlugin({
 *   browserAgentService
 * })
 * ```
 */

import { tool } from 'ai'
import * as z from 'zod'

import type { AiPlugin, AiRequestContext } from '../../types'
import { BROWSER_SYSTEM_PROMPT, DEFAULT_CONFIG, TOOL_PRESETS } from './constants'
import { BrowserSessionSnapshotManager } from './snapshotManager'
import type { BTCPBrowserPluginConfig, BTCPToolName, ExtensionClient, SnapshotResult } from './types'

const MAX_SNAPSHOT_SIZE = 50000

/**
 * Browser Use Plugin Factory
 *
 * @param config - Plugin configuration
 * @returns An aiCore plugin that provides browser automation tools
 */
export const browserUsePlugin = (config: BTCPBrowserPluginConfig): AiPlugin => {
  const { browserAgentService, toolset = DEFAULT_CONFIG.toolset } = config

  console.log('[browserUsePlugin] Initializing', {
    hasBrowserService: !!browserAgentService,
    toolset
  })

  // Initialize snapshot manager
  const snapshotManager = new BrowserSessionSnapshotManager({
    enabled: true,
    snapshotMode: 'all' // Use 'all' for full page structure
  })
  snapshotManager.setClientGetter(async () => (await browserAgentService.getOrInit()) as ExtensionClient)

  // Store last snapshot for @ref lookups
  let lastSnapshotData: { snapshot: string; refs: Map<string, string> } | null = null

  /**
   * Parse @ref markers from snapshot string
   * Returns a map of @ref:N -> element description
   */
  const parseSnapshotRefs = (snapshotStr: string): Map<string, string> => {
    const refMap = new Map<string, string>()
    // Match patterns like: @ref:1 button role='button' name='Search'
    // or: @ref:2 <button role="button">Search</button>
    const refLines = snapshotStr.split('\n')
    for (const line of refLines) {
      const refMatch = line.match(/@ref:(\d+)\s+(.+)/)
      if (refMatch) {
        const refId = `@ref:${refMatch[1]}`
        const description = refMatch[2].trim()
        refMap.set(refId, description)
      }
    }
    return refMap
  }

  /**
   * Lookup @ref description from last snapshot
   */
  const lookupRef = (selector: string): string | null => {
    if (!selector.startsWith('@ref:') || !lastSnapshotData) {
      return null
    }
    return lastSnapshotData.refs.get(selector) || null
  }

  /**
   * Get the browser client
   */
  const getClient = async (): Promise<ExtensionClient> => {
    console.log('[browserUsePlugin] getClient() called, requesting client from browserAgentService...')
    try {
      const client = await browserAgentService.getOrInit()
      console.log('[browserUsePlugin] getClient() succeeded, client received:', !!client)
      return client as ExtensionClient
    } catch (error) {
      console.error('[browserUsePlugin] getClient() failed:', error)
      throw error
    }
  }

  /**
   * Execute tool with snapshot manager notification
   */
  const execute = async <T>(toolName: string, args: unknown, fn: () => Promise<T>): Promise<T> => {
    // Execute the tool first
    const result = await fn()

    // Start snapshot manager after first successful tool execution
    // This ensures the session is fully initialized before snapshot retries begin
    if (!snapshotManager.isRunning()) {
      console.log('[browserUsePlugin] Starting snapshot manager after first successful tool execution')
      snapshotManager.start().catch(() => {})
    }

    // Notify snapshot manager after successful action (fire and forget)
    if (snapshotManager.isRunning()) {
      snapshotManager.notifyAction(toolName, args).catch((err) => {
        console.error('[browserUsePlugin] Failed to notify snapshot manager:', err)
      })
    }

    return result
  }

  // Create browser tools using the Client API
  // Each tool calls getClient() to get the client from the service
  const createBrowserTools = () => {
    return {
      // === Navigation ===
      browser_navigate: tool({
        description: 'Navigate to a URL. Returns success/failure from the browser.',
        inputSchema: z.object({
          url: z.string().describe('URL to navigate to')
        }),
        execute: async (args) =>
          execute('browser_navigate', args, async () => {
            console.log('[browser_navigate] Starting navigation to:', args.url)
            const c = await getClient()
            console.log('[browser_navigate] Client ready, calling navigate()')
            const response = await c.navigate(args.url)
            console.log('[browser_navigate] Navigate response:', response)
            return response
          })
      }),

      // === Core Inspection (matching BrowserAgent API) ===
      browser_snapshot: tool({
        description:
          'Get page snapshot with element refs (@ref:N). Use selector for structural filtering, grep for text matching. Use @ref:N to interact with elements.',
        inputSchema: z.object({
          grep: z
            .string()
            .optional()
            .describe(
              'Text/content pattern (case-insensitive): matches text, attributes, classes. Supports regex and wildcards (e.g., "submit*", "login|signin")'
            ),
          selector: z
            .string()
            .optional()
            .describe(
              'XPath pattern or role selector for structural filtering (e.g., "button", "//main//button", "//button | //link")'
            ),
          mode: z
            .enum(['head', 'interactive', 'structure', 'outline', 'all'])
            .optional()
            .describe(
              'Mode: "head" (page overview), "interactive" (default - clickable elements), "structure" (high-level layout), "outline" (hierarchical structure), or "all" (all elements)'
            )
        }),
        execute: async (args) =>
          execute('browser_snapshot', args, async () => {
            console.log('[browser_snapshot] Starting snapshot capture', args)

            try {
              const c = await getClient()
              console.log('[browser_snapshot] Client obtained')

              const options: Record<string, unknown> = {
                mode: args.mode || 'interaction',
                format: 'tree'
              }
              if (args.grep) options.grep = args.grep
              if (args.selector) options.selector = args.selector

              console.log('[browser_snapshot] Calling c.snapshot() with options:', options)
              const snapshotStr = await c.snapshot(options as any)
              console.log('[browser_snapshot] Snapshot received, length:', snapshotStr?.length)

              // Verify snapshot is not empty
              if (!snapshotStr || snapshotStr.trim().length === 0) {
                console.error('[browser_snapshot] Snapshot is empty!')
                throw new Error('Snapshot is empty - page may not be loaded')
              }

              // Check if grep filter returned no matches (valid but empty result)
              if (args.grep && snapshotStr.includes('matches=0')) {
                console.log('[browser_snapshot] Grep returned no matches')
                const result: SnapshotResult = {
                  snapshot: snapshotStr,
                  _filtered: true,
                  _message: `No elements matched grep pattern: "${args.grep}"`
                }
                return result
              }

              console.log(
                `[browser_snapshot] Captured ${snapshotStr.length} chars (mode: ${options.mode}, format: ${options.format})${args.grep ? ` (grep: ${args.grep})` : ''}`
              )

              // Parse and store @ref markers for debugging
              const refs = parseSnapshotRefs(snapshotStr)
              lastSnapshotData = { snapshot: snapshotStr, refs }

              // Log available refs for debugging
              if (refs.size > 0) {
                const refList = Array.from(refs.entries())
                  .slice(0, 5)
                  .map(([id, desc]) => `${id}=${desc.substring(0, 80)}${desc.length > 80 ? '...' : ''}`)
                console.log(
                  `[browser_snapshot] Found ${refs.size} refs:`,
                  refList.join('; ') + (refs.size > 5 ? '...' : '')
                )
              } else {
                console.log('[browser_snapshot] No @ref markers found in snapshot')
              }

              if (snapshotStr.length > MAX_SNAPSHOT_SIZE) {
                console.log('[browser_snapshot] Truncating snapshot')
                const result: SnapshotResult = {
                  snapshot: snapshotStr.substring(0, MAX_SNAPSHOT_SIZE),
                  _truncated: true,
                  _message: `Snapshot truncated to ${MAX_SNAPSHOT_SIZE} chars (original: ${snapshotStr.length} chars)`
                }
                return result
              }

              console.log('[browser_snapshot] Returning full snapshot')
              const result: SnapshotResult = { snapshot: snapshotStr }
              return result
            } catch (error) {
              console.error('[browser_snapshot] Error occurred:', error)
              throw error
            }
          })
      }),

      browser_extract: tool({
        description: 'Extract and transform content from a specific element or the whole page to HTML or Markdown.',
        inputSchema: z.object({
          selector: z.string().optional().describe('CSS selector or @ref:N to extract from (default: whole page)'),
          format: z.enum(['html', 'markdown']).optional().describe('Output format: "markdown" (default) or "html"'),
          maxLength: z.number().optional().describe('Maximum content length'),
          includeLinks: z.boolean().optional().describe('Include [text](url) links in markdown (default: true)'),
          includeImages: z.boolean().optional().describe('Include ![alt](src) images (default: false)')
        }),
        execute: async (args) =>
          execute('browser_extract', args, async () => {
            console.log('[browser_extract] Starting content extraction', args)
            const c = await getClient()
            const result = await c.extract(args)
            console.log('[browser_extract] Content extracted, length:', result?.length)
            return result
          })
      }),

      // === Core Interaction (matching BrowserAgent API) ===
      browser_click: tool({
        description: 'Click an element.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or element reference (@ref:N)'),
          button: z.enum(['left', 'right', 'middle']).optional().describe('Mouse button to click (default: left)')
        }),
        execute: async (args) =>
          execute('browser_click', args, async () => {
            // Log @ref lookup for debugging
            const refDesc = lookupRef(args.selector)
            if (refDesc) {
              console.log(`[browser_click] Using ${args.selector} → ${refDesc}`)
            }

            const c = await getClient()
            return c.click(args.selector, args.button ? { button: args.button } : undefined)
          })
      }),

      browser_fill: tool({
        description: 'Fill an input field instantly.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or element reference'),
          value: z.string().describe('Value to fill')
        }),
        execute: async (args) =>
          execute('browser_fill', args, async () => {
            // Log @ref lookup for debugging
            const refDesc = lookupRef(args.selector)
            if (refDesc) {
              console.log(`[browser_fill] Using ${args.selector} → ${refDesc}`)
            }

            const c = await getClient()
            return c.fill(args.selector, args.value)
          })
      }),

      browser_wait: tool({
        description: 'Wait for an element to appear.',
        inputSchema: z.object({
          selector: z.string().optional().describe('CSS selector or element reference to wait for'),
          timeout: z.number().optional().describe('Maximum wait time in milliseconds (default: 30000)')
        }),
        execute: async (args) =>
          execute('browser_wait', args, async () => {
            const c = await getClient()
            const result = await c.wait({ selector: args.selector, timeout: args.timeout })
            return result
          })
      })

      // === Visual ===
      // DISABLED: browser_screenshot tool is disabled to reduce token usage
      // browser_screenshot: tool({
      //   description: 'Take a screenshot of the page.',
      //   inputSchema: z.object({
      //     format: z.enum(['png', 'jpeg']).optional().describe('Image format (default: png)'),
      //     quality: z.number().min(0).max(100).optional().describe('Image quality for JPEG format (0-100, default: 80)')
      //   }),
      //   execute: async (args) =>
      //     executeWithCallbacks('browser_screenshot', args, async () => {
      //       const c = await getClient()
      //       const options = args.format || args.quality ? { format: args.format, quality: args.quality } : undefined
      //       const screenshotData = await c.screenshot(options)

      //       // Verify screenshot data is not empty
      //       if (!screenshotData || screenshotData.length === 0) {
      //         throw new Error('Screenshot data is empty - page may not be loaded')
      //       }

      //       console.log(`[browser_screenshot] Captured screenshot (${screenshotData.length} chars)`)

      //       return { image: screenshotData, format: args.format || 'png', verified: true } as ScreenshotResult
      //     })
      // })
    }
  }

  // Filter tools based on preset
  const filterTools = (allTools: Record<string, unknown>): Record<string, unknown> => {
    if (Array.isArray(toolset)) {
      return Object.fromEntries(Object.entries(allTools).filter(([name]) => toolset.includes(name as BTCPToolName)))
    }
    const preset = TOOL_PRESETS[toolset] || TOOL_PRESETS.standard
    return Object.fromEntries(Object.entries(allTools).filter(([name]) => preset.includes(name as BTCPToolName)))
  }

  return {
    name: 'btcp-browser',
    enforce: 'pre',

    configureContext: (context: AiRequestContext) => {
      context.btcpGetClient = () => browserAgentService.getOrInit()
      context.btcpSnapshotManager = snapshotManager
      // Don't auto-start snapshot manager - let first tool call start it
    },

    transformParams: <T>(params: T): T => {
      const browserTools = createBrowserTools()
      const selectedTools = filterTools(browserTools)

      const p = params as Record<string, unknown>
      const existingTools = (p.tools as Record<string, unknown>) || {}
      p.tools = { ...existingTools, ...selectedTools }

      // Build system prompt with browser instructions
      let systemPrompt = (p.system as string) || ''

      // Inject browser system prompt if not present
      if (!systemPrompt.includes('browser_snapshot')) {
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${BROWSER_SYSTEM_PROMPT}` : BROWSER_SYSTEM_PROMPT
      }

      p.system = systemPrompt
      return params
    },

    onRequestEnd: async () => {}
  }
}

// Default export
export default browserUsePlugin

// Re-export types and helpers
export { BROWSER_SYSTEM_PROMPT, TOOL_PRESETS } from './constants'
export * from './types'

// Export snapshot manager
export type {
  BrowserSnapshot,
  SnapshotDiff,
  SnapshotManagerConfig,
  SnapshotManagerState,
  SnapshotTrigger
} from './snapshotManager'
export { BrowserSessionSnapshotManager } from './snapshotManager'
