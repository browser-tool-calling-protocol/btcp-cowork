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
 *   aiCall: (prompt) => fetchGenerate({ prompt: '', content: prompt, model })
 * })
 * ```
 */

import { tool } from 'ai'
import * as z from 'zod'

import type { AiPlugin, AiRequestContext } from '../../types'
import { ABOUT_BLANK_MESSAGE, BROWSER_SYSTEM_PROMPT, DEFAULT_CONFIG, TOOL_PRESETS } from './constants'
import { BrowserSessionSnapshotManager, createAISummarizationService } from './snapshotManager'
import type { BTCPBrowserPluginConfig, BTCPToolName, ExtensionClient, SnapshotResult } from './types'

const MAX_SNAPSHOT_SIZE = 50000

/**
 * Browser Use Plugin Factory
 *
 * @param config - Plugin configuration
 * @returns An aiCore plugin that provides browser automation tools
 */
export const browserUsePlugin = (config: BTCPBrowserPluginConfig): AiPlugin => {
  const { browserAgentService, aiCall, toolset = DEFAULT_CONFIG.toolset, onSnapshotSummary } = config

  console.log('[browserUsePlugin] Initializing', {
    hasBrowserService: !!browserAgentService,
    hasAiCall: !!aiCall,
    toolset
  })

  // Store latest summary for injection into system prompt (unified: snapshot → summary → inject)
  let latestSummary: string | null = null

  // Store previous snapshot for diff comparison
  let previousSnapshot: { url: string; content: string; timestamp: number } | null = null

  // Threshold for significant change (0.1 = 10% change required to regenerate summary)
  const DIFF_THRESHOLD = 0.1

  /**
   * Calculate content change ratio between two snapshots
   */
  const calculateDiff = (oldContent: string, newContent: string): number => {
    const oldLines = new Set(
      oldContent
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    )
    const newLines = new Set(
      newContent
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    )

    let changed = 0
    for (const line of newLines) {
      if (!oldLines.has(line)) changed++
    }
    for (const line of oldLines) {
      if (!newLines.has(line)) changed++
    }

    const total = Math.max(oldLines.size, newLines.size, 1)
    return changed / total
  }

  // Create summarization service for on-demand summarization
  const summarizationService = aiCall ? createAISummarizationService(aiCall) : null
  console.log('[browserUsePlugin] Summarization service:', {
    hasAiCall: !!aiCall,
    hasSummarizationService: !!summarizationService
  })

  // Initialize snapshot manager if aiCall is provided
  let snapshotManager: BrowserSessionSnapshotManager | null = null
  if (aiCall && summarizationService) {
    snapshotManager = new BrowserSessionSnapshotManager({
      enabled: true,
      snapshotMode: 'all', // Use 'all' for full page structure
      summarizationService,
      summarizeOn: 'significant',
      onSummary: (_snapshot, summary) => {
        latestSummary = summary
        onSnapshotSummary?.(summary)
      }
    })
    snapshotManager.setClientGetter(async () => (await browserAgentService.getOrInit()) as ExtensionClient)
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
   * Capture snapshot and generate summary (unified flow: snapshot → summary)
   * Used by both beforeToolCall and afterToolCall hooks
   */
  const captureAndSummarize = async (trigger: 'before' | 'after', toolName?: string): Promise<void> => {
    try {
      const client = await getClient()
      const url = await client.getUrl()

      if (!url || url === 'about:blank') {
        latestSummary = ABOUT_BLANK_MESSAGE
        console.log(`[browserUsePlugin] [${trigger}ToolCall] Page is about:blank`)
        return
      }

      // Capture snapshot with all page content
      const snapshotContent = await client.snapshot({ mode: 'all', format: 'tree' })
      const title = await client.getTitle()
      const now = Date.now()

      console.log(`[browserUsePlugin] [${trigger}ToolCall] Captured snapshot:`, {
        toolName,
        url,
        contentLength: snapshotContent.length
      })

      // Check if we need to regenerate summary (diff detection)
      const urlChanged = !previousSnapshot || previousSnapshot.url !== url
      const diffRatio = previousSnapshot && !urlChanged ? calculateDiff(previousSnapshot.content, snapshotContent) : 1.0 // Force regeneration if no previous or URL changed

      console.log(`[browserUsePlugin] [${trigger}ToolCall] Diff check:`, {
        urlChanged,
        diffRatio: (diffRatio * 100).toFixed(1) + '%',
        threshold: (DIFF_THRESHOLD * 100).toFixed(1) + '%',
        willRegenerate: diffRatio >= DIFF_THRESHOLD
      })

      // Skip summary regeneration if diff is below threshold and we have a summary
      if (diffRatio < DIFF_THRESHOLD && latestSummary) {
        console.log(`[browserUsePlugin] [${trigger}ToolCall] Skipping summary regeneration (diff below threshold)`)
        // Update snapshot for next comparison
        previousSnapshot = { url, content: snapshotContent, timestamp: now }
        return
      }

      // Debug: log first 500 chars of snapshot
      console.log(`[browserUsePlugin] [${trigger}ToolCall] Snapshot preview:`, snapshotContent.substring(0, 500))

      // Generate summary if summarization service is available
      if (summarizationService) {
        const summary = await summarizationService.summarize({
          snapshot: {
            id: `snap_${now}`,
            timestamp: now,
            url,
            title: title || '',
            content: snapshotContent,
            trigger: 'action'
          }
        })
        latestSummary = typeof summary === 'string' ? summary : JSON.stringify(summary)
        console.log(`[browserUsePlugin] [${trigger}ToolCall] Generated summary:`, {
          summaryLength: latestSummary.length
        })
        // Debug: log full summary
        console.log(`[browserUsePlugin] [${trigger}ToolCall] Summary content:`, latestSummary)
      } else {
        // Fallback: truncate raw snapshot if no summarization service
        console.log(`[browserUsePlugin] [${trigger}ToolCall] No summarization service, using fallback`)
        const truncated =
          snapshotContent.length > 5000 ? snapshotContent.substring(0, 5000) + '\n...[truncated]' : snapshotContent
        latestSummary = `**Page**: ${title}\n**URL**: ${url}\n\n${truncated}`
        console.log(`[browserUsePlugin] [${trigger}ToolCall] Fallback summary length:`, latestSummary.length)
      }

      // Update previous snapshot for next comparison
      previousSnapshot = { url, content: snapshotContent, timestamp: now }

      // Notify callback
      if (latestSummary) {
        onSnapshotSummary?.(latestSummary)
      }
    } catch (e) {
      console.warn(`[browserUsePlugin] [${trigger}ToolCall] Failed to capture/summarize:`, e)
      latestSummary = '[Page Context: Unable to capture - browser may not be connected]'
    }
  }

  /**
   * Hook: Before tool call - capture current page state
   */
  const beforeToolCall = async (toolName: string): Promise<void> => {
    await captureAndSummarize('before', toolName)
  }

  /**
   * Hook: After tool call - capture new page state (if page changed)
   */
  const afterToolCall = async (toolName: string, _args: unknown): Promise<void> => {
    // Only run afterToolCall summary for actions that likely change the page
    const pageChangingTools = [
      'browser_navigate',
      'browser_click',
      'browser_fill',
      'browser_type',
      'browser_press',
      'browser_back',
      'browser_forward',
      'browser_reload'
    ]

    if (pageChangingTools.includes(toolName)) {
      // Small delay to let page settle after action
      await new Promise((resolve) => setTimeout(resolve, 100))
      await captureAndSummarize('after', toolName)
    }
  }

  /**
   * Execute tool with beforeToolCall and afterToolCall hooks
   */
  const execute = async <T>(toolName: string, args: unknown, fn: () => Promise<T>): Promise<T> => {
    // Hook: before tool call
    await beforeToolCall(toolName)

    // Execute the tool
    const result = await fn()

    // Hook: after tool call
    await afterToolCall(toolName, args)

    return result
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
          execute('browser_launch', {}, async () => {
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
          execute('browser_close', {}, async () => {
            return { success: true }
          })
      }),

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

      browser_back: tool({
        description: 'Go back in browser history',
        inputSchema: z.object({}).strict(),
        execute: async () =>
          execute('browser_back', {}, async () => {
            const c = await getClient()
            return c.back()
          })
      }),

      browser_forward: tool({
        description: 'Go forward in browser history',
        inputSchema: z.object({}).strict(),
        execute: async () =>
          execute('browser_forward', {}, async () => {
            const c = await getClient()
            return c.forward()
          })
      }),

      browser_reload: tool({
        description: 'Reload the current page',
        inputSchema: z.object({}).strict(),
        execute: async () =>
          execute('browser_reload', {}, async () => {
            const c = await getClient()
            return c.reload()
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
          execute('browser_snapshot', args, async () => {
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

            if (snapshotStr.length > MAX_SNAPSHOT_SIZE) {
              return {
                snapshot: snapshotStr.substring(0, MAX_SNAPSHOT_SIZE),
                _truncated: true,
                _message: `Snapshot truncated to ${MAX_SNAPSHOT_SIZE} chars (original: ${snapshotStr.length} chars)`
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
          execute('browser_get_text', args, async () => {
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
          execute('browser_click', args, async () => {
            const c = await getClient()
            return c.click(args.selector, args.button ? { button: args.button } : undefined)
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
          execute('browser_type', args, async () => {
            const c = await getClient()
            const options = args.delay || args.clear ? { delay: args.delay, clear: args.clear } : undefined
            return c.type(args.selector, args.text, options)
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
            const c = await getClient()
            return c.fill(args.selector, args.value)
          })
      }),

      browser_hover: tool({
        description: 'Hover over an element to trigger tooltips, dropdowns, or hover states.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or element reference (@ref:N)')
        }),
        execute: async (args) =>
          execute('browser_hover', args, async () => {
            const c = await getClient()
            const result = await c.hover(args.selector)
            // If void return, create success response
            return result !== undefined ? result : { success: true, selector: args.selector }
          })
      }),

      browser_press: tool({
        description: 'Press a keyboard key (Enter, Tab, Escape, etc.), optionally on a specific element.',
        inputSchema: z.object({
          key: z.string().describe('Key to press (e.g., Enter, Tab, Escape, ArrowDown)'),
          selector: z.string().optional().describe('Optional selector to focus before pressing key')
        }),
        execute: async (args) =>
          execute('browser_press', args, async () => {
            const c = await getClient()
            const result = await c.press(args.key, args.selector)
            return result !== undefined ? result : { success: true, key: args.key }
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
          execute('browser_scroll', args, async () => {
            const c = await getClient()
            const result = await c.scroll({
              selector: args.selector,
              direction: args.direction,
              amount: args.amount,
              x: args.x,
              y: args.y
            })
            return result !== undefined ? result : { success: true }
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
      }),

      // === Additional Inspection (matching BrowserAgent API) ===
      browser_get_attribute: tool({
        description: 'Get the value of an attribute from an element.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or element reference (@ref:N)'),
          attribute: z.string().describe('Attribute name to get (e.g., href, src, data-id)')
        }),
        execute: async (args) =>
          execute('browser_get_attribute', args, async () => {
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
          execute('browser_is_visible', args, async () => {
            const c = await getClient()
            const visible = await c.isVisible(args.selector)
            return { selector: args.selector, visible }
          })
      }),

      browser_get_url: tool({
        description: 'Get the current page URL.',
        inputSchema: z.object({}).strict(),
        execute: async () =>
          execute('browser_get_url', {}, async () => {
            const c = await getClient()
            const url = await c.getUrl()
            return { url }
          })
      }),

      browser_get_title: tool({
        description: 'Get the current page title.',
        inputSchema: z.object({}).strict(),
        execute: async () =>
          execute('browser_get_title', {}, async () => {
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
          execute('browser_evaluate', args, async () => {
            const c = await getClient()
            const result = await c.evaluate(args.script)
            return { result }
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

      // Build system prompt with browser instructions and page context
      let systemPrompt = (p.system as string) || ''

      // Inject browser system prompt if not present
      if (!systemPrompt.includes('browser_snapshot')) {
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${BROWSER_SYSTEM_PROMPT}` : BROWSER_SYSTEM_PROMPT
      }

      // Inject latest page summary if available (unified: snapshot → summary → inject)
      if (latestSummary && !systemPrompt.includes(latestSummary)) {
        systemPrompt = `${systemPrompt}\n\n## Current Page Context\n${latestSummary}`
        // Debug: log injected summary
        console.log('[browserUsePlugin] [transformParams] Injected page context:', {
          summaryLength: latestSummary.length,
          summary: latestSummary
        })
      }

      // Debug: log final system prompt length
      console.log('[browserUsePlugin] [transformParams] System prompt ready:', {
        totalLength: systemPrompt.length,
        hasPageContext: systemPrompt.includes('## Current Page Context')
      })

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
  SnapshotSummary,
  SnapshotTrigger,
  SummarizationRequest
} from './snapshotManager'
export { BrowserSessionSnapshotManager, SUMMARIZATION_SYSTEM_PROMPT } from './snapshotManager'
