/**
 * Browser Use Plugin
 *
 * Integrates btcp-browser-agent as a reusable plugin for @cherrystudio/ai-core,
 * enabling AI models to control browsers through the Browser Tool Calling Protocol (BTCP).
 *
 * The BrowserAgent provides DOM automation tools including:
 * - snapshot, click, type, fill, press, scroll for interaction
 * - getText, isVisible, getUrl, getTitle for inspection
 * - screenshot for visual capture
 */

import type { BrowserAgent, BrowserAgentConfig } from './btcp-browser-agent'
import type { ExtensionClient } from './types'

// Lazy-load btcp-browser-agent to avoid build-time dependency
// This will be loaded at runtime when the plugin is actually used
let btcpBrowserAgent: {
  BrowserAgent: typeof BrowserAgent
  generateCommandId: () => string
} | null = null

function getBtcpBrowserAgent() {
  if (!btcpBrowserAgent) {
    btcpBrowserAgent = require('btcp-browser-agent') as {
      BrowserAgent: typeof BrowserAgent
      generateCommandId: () => string
    }
  }
  return btcpBrowserAgent
}

/**
 * Generate a unique command ID for extension client execute calls
 */
function generateUniqueId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}
import { tool } from 'ai'
import * as z from 'zod'

import type { AiPlugin, AiRequestContext } from '../../types'
import { BROWSER_SYSTEM_PROMPT, DEFAULT_CONFIG, TOOL_PRESETS } from './constants'
import type { BTCPBrowserPluginConfig, BTCPToolName, ScreenshotResult, SnapshotResult } from './types'

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
 *   browserUsePlugin()
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
    agent: providedAgent,
    client: providedClient,
    agentOptions = {},
    toolset = DEFAULT_CONFIG.toolset,
    maxSnapshotSize = DEFAULT_CONFIG.maxSnapshotSize,
    enableTracking = DEFAULT_CONFIG.enableTracking,
    onToolCall,
    onToolResult,
    onError,
    injectSystemPrompt = DEFAULT_CONFIG.injectSystemPrompt
  } = config

  // Extension client mode (shared sessions between demo UI and AI tools)
  const extensionClient: ExtensionClient | null = providedClient ?? null

  // Lazy initialization of BrowserAgent (standalone mode, fallback if no client)
  let agent: BrowserAgent | null = providedAgent ?? null
  let agentLaunched = false

  /**
   * Check if we're using extension client mode
   */
  const isExtensionMode = (): boolean => extensionClient !== null

  /**
   * Get BrowserAgent for standalone mode
   */
  const getAgent = async (): Promise<BrowserAgent> => {
    if (!agent) {
      agent = new (getBtcpBrowserAgent().BrowserAgent)(agentOptions as BrowserAgentConfig)
    }
    if (!agentLaunched) {
      await agent.launch()
      agentLaunched = true
    }
    return agent
  }

  /**
   * Get the extension client (throws if not in extension mode)
   */
  const getExtensionClient = (): ExtensionClient => {
    if (!extensionClient) {
      throw new Error('Extension client not provided')
    }
    return extensionClient
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

  // Create minimal browser tools using the btcp-browser-agent API
  // Supports both extension client mode and standalone BrowserAgent mode
  const createBrowserTools = () => {
    return {
      // === Session Management ===
      browser_launch: tool({
        description: 'Launch the browser agent to start automation',
        inputSchema: z.object({}).describe('No parameters required'),
        execute: async () =>
          executeWithCallbacks('browser_launch', {}, async () => {
            if (isExtensionMode()) {
              // Extension mode: client is already initialized by BrowserAgentService
              return { success: true, mode: 'extension' }
            }
            await getAgent()
            return { success: true, mode: 'standalone' }
          })
      }),

      browser_close: tool({
        description: 'Close the browser session',
        inputSchema: z.object({
          _: z.string().optional().describe('Unused parameter (tool requires no parameters)')
        }),
        execute: async () =>
          executeWithCallbacks('browser_close', {}, async () => {
            if (isExtensionMode()) {
              // Extension mode: session cleanup is handled by BrowserAgentService
              return { success: true, mode: 'extension' }
            }
            if (agent) {
              await agent.close()
              agentLaunched = false
            }
            return { success: true, mode: 'standalone' }
          })
      }),

      // === Navigation (via execute command) ===
      browser_navigate: tool({
        description: 'Navigate to a URL',
        inputSchema: z.object({
          url: z.string().describe('URL to navigate to')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_navigate', args, async () => {
            if (isExtensionMode()) {
              const client = getExtensionClient()
              await client.navigate(args.url)
              return { success: true, url: args.url, mode: 'extension' }
            }
            const browserAgent = await getAgent()
            await browserAgent.execute({
              id: getBtcpBrowserAgent().generateCommandId(),
              action: 'navigate',
              url: args.url
            })
            return { success: true, url: args.url, mode: 'standalone' }
          })
      }),

      browser_back: tool({
        description: 'Go back in browser history',
        inputSchema: z.object({}).strict(),
        execute: async () =>
          executeWithCallbacks('browser_back', {}, async () => {
            if (isExtensionMode()) {
              const client = getExtensionClient()
              await client.execute({ id: generateUniqueId(), action: 'back' })
              return { success: true, mode: 'extension' }
            }
            const browserAgent = await getAgent()
            await browserAgent.execute({
              id: getBtcpBrowserAgent().generateCommandId(),
              action: 'back'
            })
            return { success: true, mode: 'standalone' }
          })
      }),

      browser_forward: tool({
        description: 'Go forward in browser history',
        inputSchema: z.object({}).strict(),
        execute: async () =>
          executeWithCallbacks('browser_forward', {}, async () => {
            if (isExtensionMode()) {
              const client = getExtensionClient()
              await client.execute({ id: generateUniqueId(), action: 'forward' })
              return { success: true, mode: 'extension' }
            }
            const browserAgent = await getAgent()
            await browserAgent.execute({
              id: getBtcpBrowserAgent().generateCommandId(),
              action: 'forward'
            })
            return { success: true, mode: 'standalone' }
          })
      }),

      browser_reload: tool({
        description: 'Reload the current page',
        inputSchema: z.object({}).strict(),
        execute: async () =>
          executeWithCallbacks('browser_reload', {}, async () => {
            if (isExtensionMode()) {
              const client = getExtensionClient()
              await client.execute({ id: generateUniqueId(), action: 'reload' })
              return { success: true, mode: 'extension' }
            }
            const browserAgent = await getAgent()
            await browserAgent.execute({
              id: getBtcpBrowserAgent().generateCommandId(),
              action: 'reload'
            })
            return { success: true, mode: 'standalone' }
          })
      }),

      // === Core Inspection ===
      browser_snapshot: tool({
        description:
          'Get an accessibility snapshot of the page with element references (@ref:N). Call this first to understand page structure.',
        inputSchema: z.object({}).strict(),
        execute: async () =>
          executeWithCallbacks('browser_snapshot', {}, async () => {
            if (isExtensionMode()) {
              const client = getExtensionClient()
              const result = await client.snapshot({ format: 'tree' })
              const snapshotStr = result.tree
              if (snapshotStr.length > maxSnapshotSize) {
                return {
                  snapshot: snapshotStr.substring(0, maxSnapshotSize),
                  _truncated: true,
                  _message: `Snapshot truncated to ${maxSnapshotSize} chars`
                } as SnapshotResult
              }
              return { snapshot: snapshotStr } as SnapshotResult
            }
            const browserAgent = await getAgent()
            const snapshot = await browserAgent.snapshot()

            const snapshotStr = JSON.stringify(snapshot)
            if (snapshotStr.length > maxSnapshotSize) {
              return {
                ...snapshot,
                _truncated: true,
                _message: `Snapshot truncated to ${maxSnapshotSize} chars`
              } as SnapshotResult
            }
            return snapshot as SnapshotResult
          })
      }),

      browser_get_text: tool({
        description: 'Get text content from an element',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or element reference (@ref:N)')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_get_text', args, async () => {
            if (isExtensionMode()) {
              const client = getExtensionClient()
              const text = await client.getText(args.selector)
              return { text }
            }
            const browserAgent = await getAgent()
            const text = await browserAgent.getText(args.selector)
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
            if (isExtensionMode()) {
              const client = getExtensionClient()
              await client.click(args.selector)
              return { success: true, selector: args.selector }
            }
            const browserAgent = await getAgent()
            await browserAgent.click(args.selector)
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
            if (isExtensionMode()) {
              const client = getExtensionClient()
              await client.type(args.selector, args.text)
              return { success: true }
            }
            const browserAgent = await getAgent()
            await browserAgent.type(args.selector, args.text)
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
            if (isExtensionMode()) {
              const client = getExtensionClient()
              await client.fill(args.selector, args.value)
              return { success: true }
            }
            const browserAgent = await getAgent()
            await browserAgent.fill(args.selector, args.value)
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
            if (isExtensionMode()) {
              const client = getExtensionClient()
              // Use execute for key press in extension mode
              await client.execute({ id: generateUniqueId(), action: 'press', key: args.key })
              return { success: true }
            }
            const browserAgent = await getAgent()
            await browserAgent.press(args.key)
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
            if (isExtensionMode()) {
              const client = getExtensionClient()
              // Use execute for scroll in extension mode
              await client.execute({ id: generateUniqueId(), action: 'scroll', direction: args.direction })
              return { success: true }
            }
            const browserAgent = await getAgent()
            await browserAgent.scroll({ direction: args.direction })
            return { success: true }
          })
      }),

      // === Visual ===
      browser_screenshot: tool({
        description: 'Take a screenshot of the page',
        inputSchema: z.object({}).strict(),
        execute: async () =>
          executeWithCallbacks('browser_screenshot', {}, async () => {
            if (isExtensionMode()) {
              const client = getExtensionClient()
              const result = await client.screenshot()
              return { image: result.screenshot, format: 'png' } as ScreenshotResult
            }
            const browserAgent = await getAgent()
            const result = await browserAgent.screenshot({ format: 'png' })
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
      // Store agent reference in context for potential use by other plugins
      context.btcpAgent = agent
    },

    transformParams: <T>(params: T, _context: AiRequestContext): T => {
      console.log('🔧 [browserUsePlugin] transformParams called', {
        enabled,
        toolset,
        maxSnapshotSize,
        enableTracking,
        injectSystemPrompt
      })

      if (!enabled) {
        console.warn('⚠️ [browserUsePlugin] Plugin not enabled, skipping')
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
      if (enableTracking && agent) {
        // The BrowserAgent API handles cleanup internally
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
