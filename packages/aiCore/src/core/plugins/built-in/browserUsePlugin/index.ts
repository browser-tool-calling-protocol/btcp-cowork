/**
 * Browser Use Plugin
 *
 * Integrates btcp-browser-agent as a reusable plugin for @cherrystudio/ai-core,
 * enabling AI models to control browsers through the Browser Tool Calling Protocol (BTCP).
 *
 * @example
 * ```typescript
 * browserUsePlugin({
 *   browserAgentService,
 *   aiService  // optional - enables background snapshot summarization
 * })
 * ```
 */

import { tool } from 'ai'
import * as z from 'zod'

import type { AiPlugin, AiRequestContext } from '../../types'
import { BROWSER_SYSTEM_PROMPT, DEFAULT_CONFIG, TOOL_PRESETS } from './constants'
import { BrowserSessionSnapshotManager, SUMMARIZATION_SYSTEM_PROMPT } from './snapshotManager'
import type { AiService, BTCPBrowserPluginConfig, BTCPToolName, ExtensionClient, ScreenshotResult, SnapshotResult } from './types'

const MAX_SNAPSHOT_SIZE = 50000

/**
 * Browser Use Plugin Factory
 *
 * @param config - Plugin configuration
 * @returns An aiCore plugin that provides browser automation tools
 *
 * @example
 * ```typescript
 * import { browserUsePlugin } from '@cherrystudio/ai-core/built-in/plugins'
 *
 * const plugin = browserUsePlugin({
 *   browserAgentService,
 *   aiService  // optional
 * })
 * ```
 */
export const browserUsePlugin = (config: BTCPBrowserPluginConfig): AiPlugin => {
  const { browserAgentService, aiService, toolset = DEFAULT_CONFIG.toolset, onSnapshotSummary } = config

  console.log('[browserUsePlugin] Initializing', {
    hasBrowserService: !!browserAgentService,
    hasAiService: !!aiService,
    toolset
  })

  // Initialize snapshot manager if aiService is provided
  let snapshotManager: BrowserSessionSnapshotManager | null = null
  if (aiService) {
    // Create summarization service from aiService
    const summarizationService = {
      isAvailable: () => true,
      summarize: async (request: { snapshot: { url: string; title: string; content: string }; diff?: { urlChanged: boolean; contentChangeRatio: number } }) => {
        const { snapshot, diff } = request
        let prompt = `${SUMMARIZATION_SYSTEM_PROMPT}\n\nURL: ${snapshot.url}\nTitle: ${snapshot.title}\n\nDOM Snapshot:\n${snapshot.content.substring(0, 50000)}`
        if (diff) {
          prompt += `\n\n---\nChanges: URL changed: ${diff.urlChanged}, Content change: ${Math.round(diff.contentChangeRatio * 100)}%`
        }
        return aiService.generateText(prompt)
      }
    }

    snapshotManager = new BrowserSessionSnapshotManager({
      enabled: true,
      summarizationService,
      summarizeOn: 'significant',
      onSummary: (_snapshot, summary) => {
        onSnapshotSummary?.(summary)
      }
    })
    snapshotManager.setClientGetter(async () => (await browserAgentService.getOrInit()) as ExtensionClient)
  }

  /**
   * Get the browser client
   */
  const getClient = async (): Promise<ExtensionClient> => {
    const client = await browserAgentService.getOrInit()
    return client as ExtensionClient
  }

  /**
   * Execute tool with snapshot notification
   */
  const execute = async <T>(toolName: string, args: unknown, fn: () => Promise<T>): Promise<T> => {
    const result = await fn()

    // Notify snapshot manager of action
    if (snapshotManager) {
      setTimeout(() => {
        snapshotManager?.notifyAction(toolName, args).catch(() => {})
      }, 0)
    }

    return result
  }

  // Create browser tools
  const createBrowserTools = () => ({
    browser_launch: tool({
      description: 'Launch the browser agent',
      inputSchema: z.object({}),
      execute: async () => execute('browser_launch', {}, async () => {
        await getClient()
        return { success: true }
      })
    }),

    browser_close: tool({
      description: 'Close the browser session',
      inputSchema: z.object({}),
      execute: async () => execute('browser_close', {}, async () => ({ success: true }))
    }),

    browser_navigate: tool({
      description: 'Navigate to a URL',
      inputSchema: z.object({ url: z.string() }),
      execute: async (args) => execute('browser_navigate', args, async () => {
        const c = await getClient()
        return c.navigate(args.url)
      })
    }),

    browser_back: tool({
      description: 'Go back in browser history',
      inputSchema: z.object({}),
      execute: async () => execute('browser_back', {}, async () => {
        const c = await getClient()
        return c.back()
      })
    }),

    browser_forward: tool({
      description: 'Go forward in browser history',
      inputSchema: z.object({}),
      execute: async () => execute('browser_forward', {}, async () => {
        const c = await getClient()
        return c.forward()
      })
    }),

    browser_reload: tool({
      description: 'Reload the current page',
      inputSchema: z.object({}),
      execute: async () => execute('browser_reload', {}, async () => {
        const c = await getClient()
        return c.reload()
      })
    }),

    browser_snapshot: tool({
      description: 'Get page snapshot with element refs (@ref:N). Use grep to filter results.',
      inputSchema: z.object({
        grep: z.string().optional().describe('Regex pattern to filter'),
        mode: z.enum(['interaction', 'content', 'outline']).optional(),
        format: z.enum(['tree', 'markdown']).optional()
      }),
      execute: async (args) => execute('browser_snapshot', args, async () => {
        const c = await getClient()
        const snapshotStr = await c.snapshot({
          grep: args.grep,
          mode: args.mode || 'interaction',
          format: args.format || 'tree'
        })
        if (!snapshotStr?.trim()) throw new Error('Snapshot is empty')
        if (snapshotStr.length > MAX_SNAPSHOT_SIZE) {
          return { snapshot: snapshotStr.substring(0, MAX_SNAPSHOT_SIZE), _truncated: true } as SnapshotResult
        }
        return { snapshot: snapshotStr } as SnapshotResult
      })
    }),

    browser_get_text: tool({
      description: 'Get text content from an element',
      inputSchema: z.object({ selector: z.string() }),
      execute: async (args) => execute('browser_get_text', args, async () => {
        const c = await getClient()
        return { text: await c.getText(args.selector) }
      })
    }),

    browser_click: tool({
      description: 'Click an element',
      inputSchema: z.object({
        selector: z.string(),
        button: z.enum(['left', 'right', 'middle']).optional()
      }),
      execute: async (args) => execute('browser_click', args, async () => {
        const c = await getClient()
        return c.click(args.selector, args.button ? { button: args.button } : undefined)
      })
    }),

    browser_type: tool({
      description: 'Type text character by character',
      inputSchema: z.object({
        selector: z.string(),
        text: z.string(),
        delay: z.number().optional(),
        clear: z.boolean().optional()
      }),
      execute: async (args) => execute('browser_type', args, async () => {
        const c = await getClient()
        return c.type(args.selector, args.text, { delay: args.delay, clear: args.clear })
      })
    }),

    browser_fill: tool({
      description: 'Fill an input field instantly',
      inputSchema: z.object({ selector: z.string(), value: z.string() }),
      execute: async (args) => execute('browser_fill', args, async () => {
        const c = await getClient()
        return c.fill(args.selector, args.value)
      })
    }),

    browser_hover: tool({
      description: 'Hover over an element',
      inputSchema: z.object({ selector: z.string() }),
      execute: async (args) => execute('browser_hover', args, async () => {
        const c = await getClient()
        return c.hover(args.selector)
      })
    }),

    browser_press: tool({
      description: 'Press a keyboard key',
      inputSchema: z.object({
        key: z.string(),
        selector: z.string().optional()
      }),
      execute: async (args) => execute('browser_press', args, async () => {
        const c = await getClient()
        return c.press(args.key, args.selector)
      })
    }),

    browser_scroll: tool({
      description: 'Scroll the page or element',
      inputSchema: z.object({
        direction: z.enum(['up', 'down', 'left', 'right']).optional(),
        selector: z.string().optional(),
        amount: z.number().optional(),
        x: z.number().optional(),
        y: z.number().optional()
      }),
      execute: async (args) => execute('browser_scroll', args, async () => {
        const c = await getClient()
        return c.scroll(args)
      })
    }),

    browser_wait: tool({
      description: 'Wait for an element or timeout',
      inputSchema: z.object({
        selector: z.string().optional(),
        timeout: z.number().optional()
      }),
      execute: async (args) => execute('browser_wait', args, async () => {
        const c = await getClient()
        return c.wait(args)
      })
    }),

    browser_get_attribute: tool({
      description: 'Get an attribute value from an element',
      inputSchema: z.object({ selector: z.string(), attribute: z.string() }),
      execute: async (args) => execute('browser_get_attribute', args, async () => {
        const c = await getClient()
        return { value: await c.getAttribute(args.selector, args.attribute) }
      })
    }),

    browser_is_visible: tool({
      description: 'Check if an element is visible',
      inputSchema: z.object({ selector: z.string() }),
      execute: async (args) => execute('browser_is_visible', args, async () => {
        const c = await getClient()
        return { visible: await c.isVisible(args.selector) }
      })
    }),

    browser_get_url: tool({
      description: 'Get the current page URL',
      inputSchema: z.object({}),
      execute: async () => execute('browser_get_url', {}, async () => {
        const c = await getClient()
        return { url: await c.getUrl() }
      })
    }),

    browser_get_title: tool({
      description: 'Get the current page title',
      inputSchema: z.object({}),
      execute: async () => execute('browser_get_title', {}, async () => {
        const c = await getClient()
        return { title: await c.getTitle() }
      })
    }),

    browser_evaluate: tool({
      description: 'Execute JavaScript in the page context',
      inputSchema: z.object({ script: z.string() }),
      execute: async (args) => execute('browser_evaluate', args, async () => {
        const c = await getClient()
        return { result: await c.evaluate(args.script) }
      })
    }),

    browser_screenshot: tool({
      description: 'Take a screenshot of the page',
      inputSchema: z.object({
        format: z.enum(['png', 'jpeg']).optional(),
        quality: z.number().optional()
      }),
      execute: async (args) => execute('browser_screenshot', args, async () => {
        const c = await getClient()
        const image = await c.screenshot(args)
        return { image, format: args.format || 'png' } as ScreenshotResult
      })
    })
  })

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
      if (snapshotManager) {
        context.btcpSnapshotManager = snapshotManager
        if (!snapshotManager.isRunning()) {
          snapshotManager.start().catch(() => {})
        }
      }
    },

    transformParams: <T>(params: T): T => {
      const browserTools = createBrowserTools()
      const selectedTools = filterTools(browserTools)

      const p = params as Record<string, unknown>
      const existingTools = (p.tools as Record<string, unknown>) || {}
      p.tools = { ...existingTools, ...selectedTools }

      // Inject browser system prompt if not present
      const currentSystem = p.system as string | undefined
      if (!currentSystem?.includes('browser_snapshot')) {
        p.system = currentSystem ? `${currentSystem}\n\n${BROWSER_SYSTEM_PROMPT}` : BROWSER_SYSTEM_PROMPT
      }

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
export { createAiService } from './types'

// Export snapshot manager
export { BrowserSessionSnapshotManager, SUMMARIZATION_SYSTEM_PROMPT } from './snapshotManager'
export type { BrowserSnapshot, SnapshotDiff, SnapshotManagerConfig, SnapshotManagerState, SnapshotTrigger, SnapshotSummary, SummarizationRequest } from './snapshotManager'
