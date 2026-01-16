/**
 * BTCP Browser Plugin
 *
 * Integrates btcp-browser-agent as a reusable plugin for @cherrystudio/ai-core,
 * enabling AI models to control browsers through the Browser Tool Calling Protocol (BTCP).
 */

import { BrowserAgent, describe as btcpDescribe, generateCommandId } from 'btcp-browser-agent'
import * as z from 'zod'

import { definePlugin } from '../../'
import type { AiRequestContext } from '../../types'
import { BROWSER_SYSTEM_PROMPT, DEFAULT_CONFIG, TOOL_PRESETS } from './constants'
import type { BTCPBrowserPluginConfig, BTCPToolName, ScreenshotResult, SnapshotResult } from './types'

/**
 * Creates a browser tool definition compatible with Vercel AI SDK
 */
function createTool<TParams extends z.ZodType, TResult>(config: {
  description: string
  parameters: TParams
  execute: (args: z.infer<TParams>) => Promise<TResult>
}) {
  return {
    description: config.description,
    parameters: config.parameters,
    execute: config.execute
  }
}

/**
 * BTCP Browser Plugin Factory
 *
 * @param config - Plugin configuration options
 * @returns An aiCore plugin that provides browser automation tools
 *
 * @example
 * ```typescript
 * import { createExecutor, btcpBrowserPlugin } from '@cherrystudio/ai-core'
 *
 * const executor = createExecutor('anthropic', { apiKey: '...' }, [
 *   btcpBrowserPlugin()
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
export const btcpBrowserPlugin = (config: BTCPBrowserPluginConfig = {}) => {
  const {
    enabled = DEFAULT_CONFIG.enabled,
    agent: providedAgent,
    agentOptions = {},
    toolset = DEFAULT_CONFIG.toolset,
    maxSnapshotSize = DEFAULT_CONFIG.maxSnapshotSize,
     
    _enableScreencast = DEFAULT_CONFIG.enableScreencast,
    enableTracking = DEFAULT_CONFIG.enableTracking,
    onToolCall,
    onToolResult,
    onError,
    injectSystemPrompt = DEFAULT_CONFIG.injectSystemPrompt
  } = config

  // Lazy initialization of agent
  let agent: BrowserAgent | null = providedAgent ?? null
  let agentLaunched = false

  const getAgent = async (): Promise<BrowserAgent> => {
    if (!agent) {
      agent = new BrowserAgent(agentOptions)
    }
    if (!agentLaunched) {
      await agent.launch()
      agentLaunched = true
    }
    return agent
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

  // Create all browser tools
  const createBrowserTools = () => {
    return {
      // === Navigation ===
      browser_navigate: createTool({
        description: 'Navigate to a URL. Waits for page load by default.',
        parameters: z.object({
          url: z.string().describe('URL to navigate to'),
          waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional()
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_navigate', args, async () => {
            const browserAgent = await getAgent()
            await browserAgent.execute({
              id: generateCommandId(),
              action: 'navigate',
              url: args.url,
              waitUntil: args.waitUntil
            })
            return { success: true, url: args.url }
          })
      }),

      browser_back: createTool({
        description: 'Go back in browser history',
        parameters: z.object({}),
        execute: async () =>
          executeWithCallbacks('browser_back', {}, async () => {
            const browserAgent = await getAgent()
            await browserAgent.execute({ id: generateCommandId(), action: 'back' })
            return { success: true }
          })
      }),

      browser_forward: createTool({
        description: 'Go forward in browser history',
        parameters: z.object({}),
        execute: async () =>
          executeWithCallbacks('browser_forward', {}, async () => {
            const browserAgent = await getAgent()
            await browserAgent.execute({ id: generateCommandId(), action: 'forward' })
            return { success: true }
          })
      }),

      browser_reload: createTool({
        description: 'Reload the current page',
        parameters: z.object({}),
        execute: async () =>
          executeWithCallbacks('browser_reload', {}, async () => {
            const browserAgent = await getAgent()
            await browserAgent.execute({ id: generateCommandId(), action: 'reload' })
            return { success: true }
          })
      }),

      browser_url: createTool({
        description: 'Get the current page URL',
        parameters: z.object({}),
        execute: async () =>
          executeWithCallbacks('browser_url', {}, async () => {
            const browserAgent = await getAgent()
            const url = await browserAgent.getUrl()
            return { url }
          })
      }),

      browser_title: createTool({
        description: 'Get the current page title',
        parameters: z.object({}),
        execute: async () =>
          executeWithCallbacks('browser_title', {}, async () => {
            const browserAgent = await getAgent()
            const title = await browserAgent.getTitle()
            return { title }
          })
      }),

      // === Snapshot & Inspection ===
      browser_snapshot: createTool({
        description:
          'Get an accessibility snapshot of the page with element references (@ref:N). Always call this first to understand page structure and get stable element refs for targeting.',
        parameters: z.object({
          selector: z.string().optional().describe('CSS selector to scope snapshot'),
          maxDepth: z.number().optional().describe('Max DOM tree depth')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_snapshot', args, async () => {
            const browserAgent = await getAgent()
            const snapshot = await browserAgent.snapshot(args)

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

      browser_get_text: createTool({
        description: 'Get text content from an element',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference (@ref:N)')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_get_text', args, async () => {
            const browserAgent = await getAgent()
            const text = await browserAgent.getText(args.selector)
            return { text }
          })
      }),

      browser_get_attribute: createTool({
        description: 'Get an attribute value from an element',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference'),
          attribute: z.string().describe('Attribute name')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_get_attribute', args, async () => {
            const browserAgent = await getAgent()
            const value = await browserAgent.getAttribute(args.selector, args.attribute)
            return { value }
          })
      }),

      browser_is_visible: createTool({
        description: 'Check if an element is visible',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_is_visible', args, async () => {
            const browserAgent = await getAgent()
            const visible = await browserAgent.isVisible(args.selector)
            return { visible }
          })
      }),

      browser_is_enabled: createTool({
        description: 'Check if an element is enabled (not disabled)',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_is_enabled', args, async () => {
            const browserAgent = await getAgent()
            const response = await browserAgent.execute({
              id: generateCommandId(),
              action: 'isenabled',
              selector: args.selector
            })
            return { enabled: response.success ? response.data : false }
          })
      }),

      browser_count: createTool({
        description: 'Count elements matching a selector',
        parameters: z.object({
          selector: z.string().describe('CSS selector')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_count', args, async () => {
            const browserAgent = await getAgent()
            const response = await browserAgent.execute({
              id: generateCommandId(),
              action: 'count',
              selector: args.selector
            })
            return { count: response.success ? response.data : 0 }
          })
      }),

      // === Semantic Locators ===
      browser_get_by_role: createTool({
        description: 'Find element by ARIA role (button, link, textbox, etc.). More reliable than CSS selectors.',
        parameters: z.object({
          role: z.string().describe('ARIA role (button, link, textbox, checkbox, etc.)'),
          name: z.string().optional().describe('Accessible name to filter by'),
          action: z.enum(['click', 'fill', 'check', 'hover']).optional().describe('Action to perform')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_get_by_role', args, async () => {
            const browserAgent = await getAgent()
            const response = await browserAgent.execute({
              id: generateCommandId(),
              action: 'getbyrole',
              role: args.role,
              name: args.name,
              subaction: args.action as 'click' | 'fill' | 'check' | 'hover'
            })
            return response.success ? response.data : { error: response.error }
          })
      }),

      browser_get_by_text: createTool({
        description: 'Find element by its text content',
        parameters: z.object({
          text: z.string().describe('Text to search for'),
          exact: z.boolean().optional().describe('Exact match (default: false)'),
          action: z.enum(['click', 'hover']).optional()
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_get_by_text', args, async () => {
            const browserAgent = await getAgent()
            const response = await browserAgent.execute({
              id: generateCommandId(),
              action: 'getbytext',
              text: args.text,
              exact: args.exact,
              subaction: args.action as 'click' | 'hover'
            })
            return response.success ? response.data : { error: response.error }
          })
      }),

      browser_get_by_label: createTool({
        description: 'Find input element by its associated label text',
        parameters: z.object({
          label: z.string().describe('Label text'),
          action: z.enum(['click', 'fill', 'check']).optional()
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_get_by_label', args, async () => {
            const browserAgent = await getAgent()
            const response = await browserAgent.execute({
              id: generateCommandId(),
              action: 'getbylabel',
              label: args.label,
              subaction: args.action as 'click' | 'fill' | 'check'
            })
            return response.success ? response.data : { error: response.error }
          })
      }),

      browser_get_by_placeholder: createTool({
        description: 'Find input by placeholder text',
        parameters: z.object({
          placeholder: z.string().describe('Placeholder text'),
          action: z.enum(['click', 'fill']).optional()
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_get_by_placeholder', args, async () => {
            const browserAgent = await getAgent()
            const response = await browserAgent.execute({
              id: generateCommandId(),
              action: 'getbyplaceholder',
              placeholder: args.placeholder,
              subaction: args.action as 'click' | 'fill'
            })
            return response.success ? response.data : { error: response.error }
          })
      }),

      // === Interaction ===
      browser_click: createTool({
        description: 'Click an element',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference (@ref:N)'),
          button: z.enum(['left', 'right', 'middle']).optional(),
          clickCount: z.number().optional().describe('Number of clicks (2 for double-click)')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_click', args, async () => {
            const browserAgent = await getAgent()
            await browserAgent.click(args.selector, args)
            return { success: true, selector: args.selector }
          })
      }),

      browser_type: createTool({
        description: 'Type text character by character (simulates real typing with events)',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference'),
          text: z.string().describe('Text to type'),
          delay: z.number().optional().describe('Delay between keystrokes in ms'),
          clear: z.boolean().optional().describe('Clear existing text first')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_type', args, async () => {
            const browserAgent = await getAgent()
            await browserAgent.type(args.selector, args.text, args)
            return { success: true }
          })
      }),

      browser_fill: createTool({
        description: 'Fill an input field instantly (faster than type, sets value directly)',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference'),
          value: z.string().describe('Value to fill')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_fill', args, async () => {
            const browserAgent = await getAgent()
            await browserAgent.fill(args.selector, args.value)
            return { success: true }
          })
      }),

      browser_clear: createTool({
        description: 'Clear an input field',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_clear', args, async () => {
            const browserAgent = await getAgent()
            await browserAgent.execute({
              id: generateCommandId(),
              action: 'clear',
              selector: args.selector
            })
            return { success: true }
          })
      }),

      browser_press: createTool({
        description: 'Press a keyboard key (Enter, Tab, Escape, ArrowDown, etc.)',
        parameters: z.object({
          key: z.string().describe('Key to press'),
          selector: z.string().optional().describe('Element to focus before pressing')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_press', args, async () => {
            const browserAgent = await getAgent()
            await browserAgent.press(args.key, args.selector)
            return { success: true }
          })
      }),

      browser_hover: createTool({
        description: 'Hover over an element (triggers mouseenter/mouseover)',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_hover', args, async () => {
            const browserAgent = await getAgent()
            await browserAgent.hover(args.selector)
            return { success: true }
          })
      }),

      browser_check: createTool({
        description: 'Check a checkbox or radio button',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_check', args, async () => {
            const browserAgent = await getAgent()
            await browserAgent.execute({
              id: generateCommandId(),
              action: 'check',
              selector: args.selector
            })
            return { success: true }
          })
      }),

      browser_uncheck: createTool({
        description: 'Uncheck a checkbox',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_uncheck', args, async () => {
            const browserAgent = await getAgent()
            await browserAgent.execute({
              id: generateCommandId(),
              action: 'uncheck',
              selector: args.selector
            })
            return { success: true }
          })
      }),

      browser_select: createTool({
        description: 'Select an option in a dropdown',
        parameters: z.object({
          selector: z.string().describe('CSS selector of the <select> element'),
          value: z.string().describe('Option value to select')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_select', args, async () => {
            const browserAgent = await getAgent()
            await browserAgent.execute({
              id: generateCommandId(),
              action: 'select',
              selector: args.selector,
              values: args.value
            })
            return { success: true }
          })
      }),

      browser_scroll: createTool({
        description: 'Scroll the page or a specific element',
        parameters: z.object({
          direction: z.enum(['up', 'down', 'left', 'right']).optional(),
          selector: z.string().optional().describe('Element to scroll within'),
          x: z.number().optional().describe('Horizontal scroll amount'),
          y: z.number().optional().describe('Vertical scroll amount')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_scroll', args, async () => {
            const browserAgent = await getAgent()
            await browserAgent.scroll(args)
            return { success: true }
          })
      }),

      browser_scroll_into_view: createTool({
        description: 'Scroll element into view (centered)',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_scroll_into_view', args, async () => {
            const browserAgent = await getAgent()
            await browserAgent.execute({
              id: generateCommandId(),
              action: 'scrollintoview',
              selector: args.selector
            })
            return { success: true }
          })
      }),

      // === Waiting ===
      browser_wait: createTool({
        description: 'Wait for time or element state',
        parameters: z.object({
          timeout: z.number().optional().describe('Time to wait in ms'),
          selector: z.string().optional().describe('Element to wait for'),
          state: z.enum(['attached', 'visible', 'hidden']).optional()
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_wait', args, async () => {
            const browserAgent = await getAgent()
            if (args.selector) {
              await browserAgent.waitFor(args.selector, { timeout: args.timeout })
            } else if (args.timeout) {
              await new Promise((resolve) => setTimeout(resolve, args.timeout))
            }
            return { success: true }
          })
      }),

      browser_wait_for_url: createTool({
        description: 'Wait for URL to contain a string',
        parameters: z.object({
          url: z.string().describe('URL substring to wait for'),
          timeout: z.number().optional()
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_wait_for_url', args, async () => {
            const browserAgent = await getAgent()
            await browserAgent.execute({
              id: generateCommandId(),
              action: 'waitforurl',
              url: args.url,
              timeout: args.timeout
            })
            return { success: true }
          })
      }),

      // === Visual ===
      browser_screenshot: createTool({
        description: 'Take a screenshot of the page or element',
        parameters: z.object({
          selector: z.string().optional().describe('Element to capture'),
          fullPage: z.boolean().optional().describe('Capture full page'),
          format: z.enum(['png', 'jpeg']).optional(),
          quality: z.number().optional().describe('JPEG quality 0-100')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_screenshot', args, async () => {
            const browserAgent = await getAgent()
            const screenshot = await browserAgent.screenshot(args)
            return { image: screenshot.screenshot, format: args.format || 'png' } as ScreenshotResult
          })
      }),

      browser_highlight: createTool({
        description: 'Highlight an element for visual debugging (adds colored border)',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_highlight', args, async () => {
            const browserAgent = await getAgent()
            await browserAgent.execute({
              id: generateCommandId(),
              action: 'highlight',
              selector: args.selector
            })
            return { success: true }
          })
      }),

      // === Frame Management ===
      browser_frame: createTool({
        description: 'Switch to an iframe by selector, name, or URL',
        parameters: z.object({
          selector: z.string().optional().describe('CSS selector of iframe'),
          name: z.string().optional().describe('Frame name attribute'),
          url: z.string().optional().describe('Frame URL (partial match)')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_frame', args, async () => {
            const browserAgent = await getAgent()
            await browserAgent.execute({
              id: generateCommandId(),
              action: 'frame',
              ...args
            })
            return { success: true }
          })
      }),

      browser_mainframe: createTool({
        description: 'Return to the main frame from an iframe',
        parameters: z.object({}),
        execute: async () =>
          executeWithCallbacks('browser_mainframe', {}, async () => {
            const browserAgent = await getAgent()
            await browserAgent.execute({
              id: generateCommandId(),
              action: 'mainframe'
            })
            return { success: true }
          })
      }),

      // === JavaScript ===
      browser_evaluate: createTool({
        description: 'Execute JavaScript code in the browser context and return result',
        parameters: z.object({
          script: z.string().describe('JavaScript code to execute')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_evaluate', args, async () => {
            const browserAgent = await getAgent()
            const result = await browserAgent.evaluate(args.script)
            return { result }
          })
      }),

      // === Debugging ===
      browser_console: createTool({
        description: 'Get console messages from the page',
        parameters: z.object({
          clear: z.boolean().optional().describe('Clear messages after retrieving')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_console', args, async () => {
            const browserAgent = await getAgent()
            const response = await browserAgent.execute({
              id: generateCommandId(),
              action: 'console',
              clear: args.clear
            })
            return response.success ? { messages: response.data } : { messages: [], error: response.error }
          })
      }),

      browser_describe: createTool({
        description:
          'Get help/documentation for browser actions. Call with no action to list all, or specify an action name.',
        parameters: z.object({
          action: z.string().optional().describe('Action name to get help for')
        }),
        execute: async (args) =>
          executeWithCallbacks('browser_describe', args, async () => {
            const description = btcpDescribe(args.action)
            return description
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

  return definePlugin({
    name: 'btcp-browser',
    enforce: 'pre',

    configureContext: (context: AiRequestContext) => {
      // Store agent reference in context for potential use by other plugins
      context.btcpAgent = agent
    },

    transformParams: (params: Record<string, unknown>, _context: AiRequestContext) => {
      if (!enabled) return params

      const browserTools = createBrowserTools()
      const selectedTools = filterTools(browserTools)

      // Merge browser tools with existing tools
      const existingTools = (params.tools as Record<string, unknown>) || {}
      params.tools = { ...existingTools, ...selectedTools }

      // Add browser-aware system prompt if enabled and not already present
      if (injectSystemPrompt) {
        const currentSystem = params.system as string | undefined
        if (!currentSystem?.includes('browser_snapshot')) {
          params.system = currentSystem ? `${currentSystem}\n\n${BROWSER_SYSTEM_PROMPT}` : BROWSER_SYSTEM_PROMPT
        }
      }

      return params
    },

    onRequestEnd: async (_context: AiRequestContext) => {
      // Cleanup tracking if enabled
      if (enableTracking && agent) {
        const manager = agent.getBrowserManager()
        // Clear tracked requests if the manager supports it
        if ('clearRequests' in manager) {
          ;(manager as { clearRequests: () => void }).clearRequests()
        }
      }
    }
  })
}

// Default export
export default btcpBrowserPlugin

// Re-export types
export { BROWSER_SYSTEM_PROMPT, TOOL_PRESETS } from './constants'
export * from './types'
