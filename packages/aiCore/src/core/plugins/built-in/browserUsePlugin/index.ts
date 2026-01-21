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
   * Casts to ExtensionClient to ensure type safety for tool implementations
   */
  const getClient = async (): Promise<ExtensionClient> => {
    if (!service) {
      throw new Error(
        'Browser service not configured. Pass service via browserUsePlugin({ service: browserAgentService })'
      )
    }
    return service.getOrInit() as Promise<ExtensionClient>
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
        description: 'Launch the browser agent to start automation. Initializes the browser client for automation.',
        inputSchema: z.object({}).describe('No parameters required'),
        execute: async () =>
          executeWithCallbacks('browser_launch', {}, async () => {
            console.log('[browser_launch] Initializing browser client...')
            // Get client from service (initializes if needed)
            await getClient()
            console.log('[browser_launch] Client initialized successfully')

            return {
              success: true,
              message: 'Browser client initialized successfully'
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
            return { success: true }
          })
      }),

      // === Navigation ===
      browser_navigate: tool({
        description: 'Navigate to a URL and verify the URL was loaded successfully.',
        inputSchema: z.object({
          url: z.string().describe('URL to navigate to')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_navigate', args, async () => {
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

      // === Core Inspection (matching BrowserAgent API) ===
      browser_snapshot: tool({
        description:
          'Get page snapshot with element refs (@ref:N). Always use grep to filter results. Use @ref:N to interact with elements.',
        inputSchema: z.object({
          grep: z.string().optional().describe('Regex pattern to filter (e.g., "button|input", "login", ".*" for all)'),
          mode: z
            .enum(['interaction', 'content', 'outline'])
            .optional()
            .describe('Mode: "interaction" (default), "content", or "outline"'),
          format: z.enum(['tree', 'markdown']).optional().describe('Format: "tree" (default) or "markdown"')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_snapshot', args, async () => {
            const c = await getClient()

            const options: Record<string, unknown> = {
              mode: args.mode || 'interaction',
              format: args.format || 'tree'
            }
            if (args.grep) options.grep = args.grep

            const snapshotStr = await c.snapshot(options as any)

            // Verify snapshot is not empty
            if (!snapshotStr || snapshotStr.trim().length === 0) {
              throw new Error('Snapshot is empty - page may not be loaded')
            }

            console.log(
              `[browser_snapshot] Captured ${snapshotStr.length} chars (mode: ${options.mode}, format: ${options.format})${args.grep ? ` (grep: ${args.grep})` : ''}`
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

      // === Core Interaction (matching BrowserAgent API) ===
      browser_click: tool({
        description: 'Click an element.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or element reference (@ref:N)'),
          button: z.enum(['left', 'right', 'middle']).optional().describe('Mouse button to click (default: left)')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_click', args, async () => {
            const c = await getClient()
            await c.click(args.selector, args.button ? { button: args.button } : undefined)
            return { success: true, selector: args.selector, message: `Clicked element: ${args.selector}` }
          })
      }),

      browser_type: tool({
        description: 'Type text character by character.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or element reference'),
          text: z.string().describe('Text to type'),
          delay: z.number().optional().describe('Delay between keystrokes in milliseconds'),
          clear: z.boolean().optional().describe('Clear existing text before typing')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_type', args, async () => {
            const c = await getClient()
            const options = args.delay || args.clear ? { delay: args.delay, clear: args.clear } : undefined
            await c.type(args.selector, args.text, options)
            return {
              success: true,
              selector: args.selector,
              text: args.text,
              message: `Typed text into ${args.selector}`
            }
          })
      }),

      browser_fill: tool({
        description: 'Fill an input field instantly.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or element reference'),
          value: z.string().describe('Value to fill')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_fill', args, async () => {
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

      browser_hover: tool({
        description: 'Hover over an element to trigger tooltips, dropdowns, or hover states.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or element reference (@ref:N)')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_hover', args, async () => {
            const c = await getClient()
            await c.hover(args.selector)
            return { success: true, selector: args.selector, message: `Hovered over: ${args.selector}` }
          })
      }),

      browser_press: tool({
        description: 'Press a keyboard key (Enter, Tab, Escape, etc.), optionally on a specific element.',
        inputSchema: z.object({
          key: z.string().describe('Key to press (e.g., Enter, Tab, Escape, ArrowDown)'),
          selector: z.string().optional().describe('Optional selector to focus before pressing key')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_press', args, async () => {
            const c = await getClient()
            await c.press(args.key, args.selector)
            return { success: true, key: args.key, selector: args.selector }
          })
      }),

      browser_scroll: tool({
        description: 'Scroll the page or a specific element.',
        inputSchema: z.object({
          direction: z.enum(['up', 'down', 'left', 'right']).optional().describe('Scroll direction'),
          selector: z.string().optional().describe('Element to scroll (default: page)'),
          amount: z.number().optional().describe('Scroll amount in pixels'),
          x: z.number().optional().describe('Absolute x scroll position'),
          y: z.number().optional().describe('Absolute y scroll position')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_scroll', args, async () => {
            const c = await getClient()
            await c.scroll({
              selector: args.selector,
              direction: args.direction,
              amount: args.amount,
              x: args.x,
              y: args.y
            })
            return { success: true, ...args }
          })
      }),

      browser_wait: tool({
        description: 'Wait for an element to appear or disappear.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or element reference to wait for'),
          timeout: z.number().optional().describe('Maximum wait time in milliseconds (default: 30000)'),
          state: z.enum(['visible', 'hidden']).optional().describe('Wait for element to be visible or hidden')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_wait', args, async () => {
            const c = await getClient()
            const options = args.timeout || args.state ? { timeout: args.timeout, state: args.state } : undefined
            await c.waitFor(args.selector, options)
            return { success: true, selector: args.selector, state: args.state || 'visible' }
          })
      }),

      // === Additional Inspection (matching BrowserAgent API) ===
      browser_get_attribute: tool({
        description: 'Get the value of an attribute from an element.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or element reference (@ref:N)'),
          attribute: z.string().describe('Attribute name to get (e.g., href, src, data-id)')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_get_attribute', args, async () => {
            const c = await getClient()
            const value = await c.getAttribute(args.selector, args.attribute)
            return { selector: args.selector, attribute: args.attribute, value }
          })
      }),

      browser_is_visible: tool({
        description: 'Check if an element is visible on the page.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or element reference (@ref:N)')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_is_visible', args, async () => {
            const c = await getClient()
            const visible = await c.isVisible(args.selector)
            return { selector: args.selector, visible }
          })
      }),

      browser_get_url: tool({
        description: 'Get the current page URL.',
        inputSchema: z.object({}).strict(),
        execute: async () =>
          executeWithCallbacks('browser_get_url', {}, async () => {
            const c = await getClient()
            const url = await c.getUrl()
            return { url }
          })
      }),

      browser_get_title: tool({
        description: 'Get the current page title.',
        inputSchema: z.object({}).strict(),
        execute: async () =>
          executeWithCallbacks('browser_get_title', {}, async () => {
            const c = await getClient()
            const title = await c.getTitle()
            return { title }
          })
      }),

      // === JavaScript Evaluation ===
      browser_evaluate: tool({
        description:
          'Execute JavaScript code in the page context. Use for advanced automation when other tools are insufficient.',
        inputSchema: z.object({
          script: z.string().describe('JavaScript code to execute in the page context')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_evaluate', args, async () => {
            const c = await getClient()
            const result = await c.evaluate(args.script)
            return { result }
          })
      }),

      // === Visual ===
      browser_screenshot: tool({
        description: 'Take a screenshot of the page.',
        inputSchema: z.object({
          format: z.enum(['png', 'jpeg']).optional().describe('Image format (default: png)'),
          quality: z.number().min(0).max(100).optional().describe('Image quality for JPEG format (0-100, default: 80)')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_screenshot', args, async () => {
            const c = await getClient()
            const options = args.format || args.quality ? { format: args.format, quality: args.quality } : undefined
            const screenshotData = await c.screenshot(options)

            // Verify screenshot data is not empty
            if (!screenshotData || screenshotData.length === 0) {
              throw new Error('Screenshot data is empty - page may not be loaded')
            }

            console.log(`[browser_screenshot] Captured screenshot (${screenshotData.length} chars)`)

            return { image: screenshotData, format: args.format || 'png', verified: true } as ScreenshotResult
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

    transformParams: <T>(params: T): T => {
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

    onRequestEnd: async () => {
      // Cleanup tracking if enabled
      if (enableTracking) {
        // Tracking cleanup logic here
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
