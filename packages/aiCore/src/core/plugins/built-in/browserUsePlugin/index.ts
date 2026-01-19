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
 *
 * const executor = createExecutor('anthropic', { apiKey: '...' }, [
 *   browserUsePlugin({ client: myBrowserClient })
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
    getClient: getClientFn,
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
    if (!getClientFn) {
      throw new Error('Browser client not configured. Pass getClient via browserUsePlugin({ getClient: ... })')
    }
    return getClientFn()
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
        description: 'Launch the browser agent to start automation',
        inputSchema: z.object({}).describe('No parameters required'),
        execute: async () =>
          executeWithCallbacks('browser_launch', {}, async () => {
            // Get client from service (initializes if needed)
            await getClient()
            return { success: true }
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
        description: 'Navigate to a URL',
        inputSchema: z.object({
          url: z.string().describe('URL to navigate to')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_navigate', args, async () => {
            const c = await getClient()
            await c.navigate(args.url)
            return { success: true, url: args.url }
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
          'Get an accessibility snapshot of the page with element references (@ref:N). Call this first to understand page structure.',
        inputSchema: z.object({}).strict(),
        execute: async () =>
          executeWithCallbacks('browser_snapshot', {}, async () => {
            const c = await getClient()
            const result = await c.snapshot({ format: 'tree' })
            const snapshotStr = result.tree
            if (snapshotStr.length > maxSnapshotSize) {
              return {
                snapshot: snapshotStr.substring(0, maxSnapshotSize),
                _truncated: true,
                _message: `Snapshot truncated to ${maxSnapshotSize} chars`
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
        description: 'Click an element',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or element reference (@ref:N)')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_click', args, async () => {
            const c = await getClient()
            await c.click(args.selector)
            return { success: true, selector: args.selector }
          })
      }),

      browser_type: tool({
        description: 'Type text character by character',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or element reference'),
          text: z.string().describe('Text to type')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_type', args, async () => {
            const c = await getClient()
            await c.type(args.selector, args.text)
            return { success: true }
          })
      }),

      browser_fill: tool({
        description: 'Fill an input field instantly',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or element reference'),
          value: z.string().describe('Value to fill')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_fill', args, async () => {
            const c = await getClient()
            await c.fill(args.selector, args.value)
            return { success: true }
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
        description: 'Take a screenshot of the page',
        inputSchema: z.object({}).strict(),
        execute: async () =>
          executeWithCallbacks('browser_screenshot', {}, async () => {
            const c = await getClient()
            const result = await c.screenshot()
            return { image: result.screenshot, format: 'png' } as ScreenshotResult
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
      // Store getClient function in context for potential use by other plugins
      context.btcpGetClient = getClientFn
    },

    transformParams: <T>(params: T, _context: AiRequestContext): T => {
      console.log('🔧 [browserUsePlugin] transformParams called', {
        enabled,
        hasGetClient: !!getClientFn,
        toolset,
        maxSnapshotSize,
        enableTracking,
        injectSystemPrompt
      })

      if (!enabled) {
        console.warn('⚠️ [browserUsePlugin] Plugin not enabled, skipping')
        return params
      }

      if (!getClientFn) {
        console.warn('⚠️ [browserUsePlugin] No getClient function provided, skipping')
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
