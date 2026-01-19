/**
 * Browser Use Plugin
 *
 * Integrates btcp-browser-agent as a reusable plugin for @cherrystudio/ai-core,
 * enabling AI models to control browsers through the Browser Tool Calling Protocol (BTCP).
 *
 * Uses the extension Client for browser automation:
 * - snapshot, click, type, fill for interaction
 * - getText for inspection
 * - screenshot for visual capture
 *
 * The Client self-discovers the agent - we only work with the Client directly.
 */

import { tool } from 'ai'
import * as z from 'zod'

import type { AiPlugin, AiRequestContext } from '../../types'
import { BROWSER_SYSTEM_PROMPT, DEFAULT_CONFIG, TOOL_PRESETS } from './constants'
import type { BTCPBrowserPluginConfig, BTCPToolName, ExtensionClient, ScreenshotResult, SnapshotResult } from './types'

/**
 * Generate a unique command ID for execute calls
 */
function generateUniqueId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Browser Use Plugin Factory
 *
 * @param config - Plugin configuration options
 * @returns An aiCore plugin that provides browser automation tools
 *
 * @example
 * ```typescript
 * import { createExecutor, browserUsePlugin } from '@cherrystudio/ai-core'
 * import { browserAgentService } from './services/BrowserAgentService'
 *
 * const executor = createExecutor('anthropic', { apiKey: '...' }, [
 *   browserUsePlugin({ service: browserAgentService })
 * ])
 *
 * const result = await executor.streamText({
 *   model: 'claude-sonnet-4-20250514',
 *   messages: [{
 *     role: 'user',
 *     content: 'Go to https://news.ycombinator.com and find the top 3 stories'
 *   }]
 * })
 * ```
 */
export const browserUsePlugin = (config: BTCPBrowserPluginConfig = {}): AiPlugin => {
  const {
    enabled = DEFAULT_CONFIG.enabled,
    service,
    toolset = DEFAULT_CONFIG.toolset,
    maxSnapshotSize = DEFAULT_CONFIG.maxSnapshotSize,
    enableTracking = DEFAULT_CONFIG.enableTracking,
    onToolCall,
    onToolResult,
    onError,
    injectSystemPrompt = DEFAULT_CONFIG.injectSystemPrompt
  } = config

  /**
   * Get the client from the service (throws if not configured)
   */
  const getClient = async (): Promise<ExtensionClient> => {
    if (!service) {
      throw new Error(
        'Browser service not configured. Pass service via browserUsePlugin({ service: browserAgentService })'
      )
    }
    return service.getOrInit()
  }

  /**
   * Ensure a browser session exists (creates one if needed)
   * This is critical for browser operations to work - without a session,
   * operations like navigate, click, etc. will fail silently
   */
  const ensureSession = async (): Promise<number> => {
    if (!service) {
      throw new Error('Browser service not configured. Cannot ensure session without service.')
    }
    return service.ensureSession()
  }

  // Execution wrapper with callbacks
  const executeWithCallbacks = async <T>(toolName: string, args: unknown, executor: () => Promise<T>): Promise<T> => {
    onToolCall?.(toolName, args)
    try {
      const result = await executor()
      onToolResult?.(toolName, result)
      return result
    } catch (error) {
      onError?.(toolName, error as Error)
      throw error
    }
  }

  // Create browser tools using the Client API
  // Each tool calls getClient() to get the client from the service
  const createBrowserTools = () => {
    return {
      // === Session Management ===
      browser_launch: tool({
        description:
          'Launch the browser agent to start automation. Creates a new browser session with tabs ready for automation.',
        inputSchema: z.object({}).describe('No parameters required'),
        execute: async () =>
          executeWithCallbacks('browser_launch', {}, async () => {
            console.log('[browser_launch] Initializing browser client...')
            // Get client from service (initializes if needed)
            await getClient()
            console.log('[browser_launch] Client initialized, creating session...')

            // CRITICAL: Ensure session exists - this creates the actual browser tab group
            const sessionId = await ensureSession()
            console.log('[browser_launch] Session created successfully:', { sessionId })

            // Verify session was created
            const client = await getClient()
            const { session } = await client.sessionGetCurrent()

            if (!session || session.groupId !== sessionId) {
              throw new Error(
                `Session verification failed. Expected session ${sessionId} but got ${session?.groupId || 'none'}`
              )
            }

            return {
              success: true,
              sessionId,
              message: `Browser session ${sessionId} created and verified successfully`
            }
          })
      }),

      browser_close: tool({
        description: 'Close the browser session',
        inputSchema: z.object({
          _: z.string().optional().describe('Unused parameter (tool requires no parameters)')
        }),
        execute: async () =>
          executeWithCallbacks('browser_close', {}, async () => {
            // Session cleanup is handled by BrowserAgentService
            return { success: true }
          })
      }),

      // === Navigation ===
      browser_navigate: tool({
        description:
          'Navigate to a URL. Ensures a browser session exists before navigation and verifies the URL was loaded successfully.',
        inputSchema: z.object({
          url: z.string().describe('URL to navigate to')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_navigate', args, async () => {
            console.log('[browser_navigate] Ensuring session exists...')
            // CRITICAL: Ensure session exists before navigation
            const sessionId = await ensureSession()
            console.log('[browser_navigate] Session verified:', { sessionId })

            console.log('[browser_navigate] Navigating to:', args.url)
            const c = await getClient()
            await c.navigate(args.url)

            // Verify navigation succeeded by checking current URL
            console.log('[browser_navigate] Verifying navigation...')
            const actualUrl = await c.getUrl()
            console.log('[browser_navigate] Current URL:', actualUrl)

            // Check if navigation was successful (URL should match or be a redirect)
            const navigatedSuccessfully =
              actualUrl &&
              (actualUrl === args.url ||
                actualUrl.startsWith(args.url) ||
                new URL(actualUrl).hostname === new URL(args.url).hostname)

            if (!navigatedSuccessfully) {
              console.warn('[browser_navigate] URL mismatch - navigation may have failed', {
                requested: args.url,
                actual: actualUrl
              })
            }

            return {
              success: true,
              requestedUrl: args.url,
              actualUrl,
              sessionId,
              verified: navigatedSuccessfully,
              message: navigatedSuccessfully
                ? `Successfully navigated to ${actualUrl}`
                : `Navigation completed but URL differs: requested ${args.url}, got ${actualUrl}`
            }
          })
      }),

      browser_back: tool({
        description: 'Go back in browser history',
        inputSchema: z.object({}).strict(),
        execute: async () =>
          executeWithCallbacks('browser_back', {}, async () => {
            const c = await getClient()
            await c.execute({ id: generateUniqueId(), action: 'back' })
            return { success: true }
          })
      }),

      browser_forward: tool({
        description: 'Go forward in browser history',
        inputSchema: z.object({}).strict(),
        execute: async () =>
          executeWithCallbacks('browser_forward', {}, async () => {
            const c = await getClient()
            await c.execute({ id: generateUniqueId(), action: 'forward' })
            return { success: true }
          })
      }),

      browser_reload: tool({
        description: 'Reload the current page',
        inputSchema: z.object({}).strict(),
        execute: async () =>
          executeWithCallbacks('browser_reload', {}, async () => {
            const c = await getClient()
            await c.execute({ id: generateUniqueId(), action: 'reload' })
            return { success: true }
          })
      }),

      // === Core Inspection ===
      browser_snapshot: tool({
        description:
          'Get a snapshot of the page. Use format "tree" (default) for interactive elements with @ref markers, or "markdown" for readable page content extraction.',
        inputSchema: z
          .object({
            format: z
              .enum(['tree', 'markdown'])
              .optional()
              .describe('Output format: "tree" for interaction (default), "markdown" for content extraction'),
            includeHidden: z
              .boolean()
              .optional()
              .describe('Include hidden elements like modals and dropdowns (default: false)'),
            grep: z
              .string()
              .optional()
              .describe('Filter snapshot to lines matching this text pattern (e.g., "button", "login")')
          })
          .strict(),
        execute: async (args) =>
          executeWithCallbacks('browser_snapshot', args, async () => {
            // Ensure session exists
            await ensureSession()
            const c = await getClient()

            // Build snapshot options - keep it simple with smart defaults
            const options: any = {
              format: args.format || 'tree', // Default to tree for interaction
              compact: true // Always use compact mode for token efficiency
            }

            if (args.includeHidden) {
              options.includeHidden = true
            }

            if (args.grep) {
              options.grep = args.grep
            }

            const snapshotStr = await c.snapshot(options)

            // Verify snapshot is not empty
            if (!snapshotStr || snapshotStr.trim().length === 0) {
              throw new Error('Snapshot is empty - page may not be loaded or session may be invalid')
            }

            console.log(
              `[browser_snapshot] Captured ${snapshotStr.length} chars (format: ${options.format})${args.grep ? ` (filtered by: ${args.grep})` : ''}`
            )

            if (snapshotStr.length > maxSnapshotSize) {
              return {
                snapshot: snapshotStr.substring(0, maxSnapshotSize),
                _truncated: true,
                _message: `Snapshot truncated to ${maxSnapshotSize} chars (original: ${snapshotStr.length} chars)`
              } as SnapshotResult
            }
            return { snapshot: snapshotStr } as SnapshotResult
          })
      }),

      browser_get_text: tool({
        description: 'Get text content from an element',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or element reference (@ref:N)')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_get_text', args, async () => {
            const c = await getClient()
            const text = await c.getText(args.selector)
            return { text }
          })
      }),

      // === Core Interaction ===
      browser_click: tool({
        description: 'Click an element. Verifies session exists before clicking.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or element reference (@ref:N)')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_click', args, async () => {
            // Ensure session exists
            await ensureSession()
            const c = await getClient()
            await c.click(args.selector)
            return { success: true, selector: args.selector, message: `Clicked element: ${args.selector}` }
          })
      }),

      browser_type: tool({
        description: 'Type text character by character. Verifies session exists before typing.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or element reference'),
          text: z.string().describe('Text to type')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_type', args, async () => {
            // Ensure session exists
            await ensureSession()
            const c = await getClient()
            await c.type(args.selector, args.text)
            return {
              success: true,
              selector: args.selector,
              text: args.text,
              message: `Typed text into ${args.selector}`
            }
          })
      }),

      browser_fill: tool({
        description: 'Fill an input field instantly. Verifies session exists before filling.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or element reference'),
          value: z.string().describe('Value to fill')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_fill', args, async () => {
            // Ensure session exists
            await ensureSession()
            const c = await getClient()
            await c.fill(args.selector, args.value)
            return {
              success: true,
              selector: args.selector,
              value: args.value,
              message: `Filled ${args.selector} with value`
            }
          })
      }),

      browser_press: tool({
        description: 'Press a keyboard key (Enter, Tab, Escape, etc.)',
        inputSchema: z.object({
          key: z.string().describe('Key to press')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_press', args, async () => {
            const c = await getClient()
            await c.execute({ id: generateUniqueId(), action: 'press', key: args.key })
            return { success: true }
          })
      }),

      browser_scroll: tool({
        description: 'Scroll the page',
        inputSchema: z.object({
          direction: z.enum(['up', 'down']).describe('Scroll direction')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_scroll', args, async () => {
            const c = await getClient()
            await c.execute({ id: generateUniqueId(), action: 'scroll', direction: args.direction })
            return { success: true }
          })
      }),

      // === Visual ===
      browser_screenshot: tool({
        description: 'Take a screenshot of the page. Verifies session exists before taking screenshot.',
        inputSchema: z.object({}).strict(),
        execute: async () =>
          executeWithCallbacks('browser_screenshot', {}, async () => {
            // Ensure session exists
            await ensureSession()
            const c = await getClient()
            const screenshotData = await c.screenshot()

            // Verify screenshot data is not empty
            if (!screenshotData || screenshotData.length === 0) {
              throw new Error('Screenshot data is empty - page may not be loaded or session may be invalid')
            }

            console.log(`[browser_screenshot] Captured screenshot (${screenshotData.length} chars)`)

            return { image: screenshotData, format: 'png', verified: true } as ScreenshotResult
          })
      })
    }
  }

  // Filter tools based on preset or custom list
  const filterTools = (allTools: Record<string, unknown>): Record<string, unknown> => {
    if (Array.isArray(toolset)) {
      return Object.fromEntries(Object.entries(allTools).filter(([name]) => toolset.includes(name as BTCPToolName)))
    }
    const preset = TOOL_PRESETS[toolset] || TOOL_PRESETS.standard
    return Object.fromEntries(Object.entries(allTools).filter(([name]) => preset.includes(name as BTCPToolName)))
  }

  const plugin: AiPlugin = {
    name: 'btcp-browser',
    enforce: 'pre',

    configureContext: (context: AiRequestContext) => {
      // Store service in context for potential use by other plugins
      if (service) {
        context.btcpGetClient = () => service.getOrInit()
      }
    },

    transformParams: <T>(params: T, _context: AiRequestContext): T => {
      console.log('🔧 [browserUsePlugin] transformParams called', {
        enabled,
        hasService: !!service,
        toolset,
        maxSnapshotSize,
        enableTracking,
        injectSystemPrompt
      })

      if (!enabled) {
        console.warn('⚠️ [browserUsePlugin] Plugin not enabled, skipping')
        return params
      }

      if (!service) {
        console.warn('⚠️ [browserUsePlugin] No service provided, skipping')
        return params
      }

      const browserTools = createBrowserTools()
      const selectedTools = filterTools(browserTools)

      console.log('🛠️ [browserUsePlugin] Adding browser tools', {
        toolCount: Object.keys(selectedTools).length,
        tools: Object.keys(selectedTools),
        toolset
      })

      // Merge browser tools with existing tools
      const p = params as Record<string, unknown>
      const existingTools = (p.tools as Record<string, unknown>) || {}
      const mergedTools = { ...existingTools, ...selectedTools }
      p.tools = mergedTools

      console.log('📦 [browserUsePlugin] Final tools', {
        totalCount: Object.keys(mergedTools).length,
        allTools: Object.keys(mergedTools),
        hasBrowserTools: Object.keys(mergedTools).some((t) => t.startsWith('browser_'))
      })

      // Add browser-aware system prompt if enabled and not already present
      if (injectSystemPrompt) {
        const currentSystem = p.system as string | undefined
        if (!currentSystem?.includes('browser_snapshot')) {
          p.system = currentSystem ? `${currentSystem}\n\n${BROWSER_SYSTEM_PROMPT}` : BROWSER_SYSTEM_PROMPT
          console.log('📝 [browserUsePlugin] System prompt injected')
        }
      }

      return params
    },

    onRequestEnd: async (_context: AiRequestContext, _result: unknown) => {
      // Cleanup tracking if enabled
      if (enableTracking) {
        // Session cleanup is handled by BrowserAgentService
      }
    }
  }

  return plugin
}

// Default export
export default browserUsePlugin

// Legacy export for backwards compatibility
export const btcpBrowserPlugin = browserUsePlugin

// Re-export types
export { BROWSER_SYSTEM_PROMPT, TOOL_PRESETS } from './constants'
export * from './types'
