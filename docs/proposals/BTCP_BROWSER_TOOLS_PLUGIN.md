# Proposal: BTCP Browser Tools Plugin for aiCore

## Summary

Integrate [btcp-browser-agent](https://github.com/browser-tool-calling-protocol/btcp-browser-agent) as a reusable plugin for `@cherrystudio/ai-core`, enabling AI models to control browsers through the Browser Tool Calling Protocol (BTCP).

## Motivation

1. **Browser-Native Execution**: Unlike Playwright/Puppeteer, btcp-browser-agent runs directly in the browser using native DOM APIs
2. **Unified Tool Interface**: Provides consistent API across browser contexts (web page, extension, iframe)
3. **AI-Optimized Design**: Element references (`@e1`, `@e2`) and accessibility snapshots designed for LLM consumption
4. **Self-Describing API**: Built-in `describe()` method for dynamic tool discovery

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        aiCore Runtime                            │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │ RuntimeExecutor │───▶│ btcpBrowserPlugin │───▶│ Other       │ │
│  │                 │    │                  │    │ Plugins     │ │
│  └─────────────────┘    └────────┬─────────┘    └─────────────┘ │
└──────────────────────────────────┼──────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      BrowserAgent          │
                    │   (btcp-browser-agent)     │
                    ├─────────────────────────────┤
                    │ • snapshot()               │
                    │ • click(selector)          │
                    │ • type(selector, text)     │
                    │ • navigate(url)            │
                    │ • screenshot()             │
                    │ • evaluate(script)         │
                    └─────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      Browser DOM            │
                    │   (Native APIs)             │
                    └─────────────────────────────┘
```

## Plugin Interface

### Configuration

```typescript
interface BTCPBrowserPluginConfig {
  /**
   * Enable/disable the plugin
   * @default true
   */
  enabled?: boolean

  /**
   * Pre-initialized BrowserAgent instance
   * If not provided, a new instance will be created
   */
  agent?: BrowserAgent

  /**
   * BrowserAgent constructor options (used if agent not provided)
   */
  agentOptions?: {
    targetWindow?: Window
    targetDocument?: Document
    autoLaunch?: boolean
  }

  /**
   * Which tools to expose to the AI model
   * @default 'all'
   */
  tools?: 'all' | 'safe' | BTCPToolName[]

  /**
   * Maximum snapshot size (characters) to prevent token overflow
   * @default 50000
   */
  maxSnapshotSize?: number

  /**
   * Include screenshots in snapshots
   * @default false
   */
  includeScreenshots?: boolean

  /**
   * Callback for tool execution events
   */
  onToolCall?: (toolName: string, args: unknown) => void
  onToolResult?: (toolName: string, result: unknown) => void
}

type BTCPToolName =
  | 'browser_snapshot'
  | 'browser_navigate'
  | 'browser_click'
  | 'browser_type'
  | 'browser_fill'
  | 'browser_scroll'
  | 'browser_hover'
  | 'browser_press'
  | 'browser_screenshot'
  | 'browser_get_text'
  | 'browser_get_attribute'
  | 'browser_is_visible'
  | 'browser_wait_for'
  | 'browser_evaluate'
  | 'browser_back'
  | 'browser_forward'
  | 'browser_reload'
```

### Tool Definitions

```typescript
// Core navigation tools
const navigationTools = {
  browser_navigate: {
    description: 'Navigate to a URL in the browser',
    parameters: z.object({
      url: z.string().url().describe('The URL to navigate to'),
      waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional()
    })
  },
  browser_back: {
    description: 'Go back in browser history',
    parameters: z.object({})
  },
  browser_forward: {
    description: 'Go forward in browser history',
    parameters: z.object({})
  },
  browser_reload: {
    description: 'Reload the current page',
    parameters: z.object({})
  }
}

// State inspection tools
const inspectionTools = {
  browser_snapshot: {
    description: 'Get an accessibility snapshot of the current page with element references (@e1, @e2, etc.) for targeting',
    parameters: z.object({
      selector: z.string().optional().describe('CSS selector to scope snapshot'),
      maxDepth: z.number().optional().describe('Maximum DOM tree depth')
    })
  },
  browser_get_text: {
    description: 'Extract text content from an element',
    parameters: z.object({
      selector: z.string().describe('CSS selector or element reference (@e1)')
    })
  },
  browser_get_attribute: {
    description: 'Get an attribute value from an element',
    parameters: z.object({
      selector: z.string().describe('CSS selector or element reference'),
      attribute: z.string().describe('Attribute name to retrieve')
    })
  },
  browser_is_visible: {
    description: 'Check if an element is visible on the page',
    parameters: z.object({
      selector: z.string().describe('CSS selector or element reference')
    })
  }
}

// Interaction tools
const interactionTools = {
  browser_click: {
    description: 'Click an element on the page',
    parameters: z.object({
      selector: z.string().describe('CSS selector or element reference (@e1)'),
      button: z.enum(['left', 'right', 'middle']).optional(),
      clickCount: z.number().optional()
    })
  },
  browser_type: {
    description: 'Type text character by character (simulates real typing)',
    parameters: z.object({
      selector: z.string().describe('CSS selector or element reference'),
      text: z.string().describe('Text to type'),
      delay: z.number().optional().describe('Delay between keystrokes in ms')
    })
  },
  browser_fill: {
    description: 'Fill an input field instantly (faster than type)',
    parameters: z.object({
      selector: z.string().describe('CSS selector or element reference'),
      value: z.string().describe('Value to fill')
    })
  },
  browser_hover: {
    description: 'Hover over an element',
    parameters: z.object({
      selector: z.string().describe('CSS selector or element reference')
    })
  },
  browser_press: {
    description: 'Press a keyboard key',
    parameters: z.object({
      key: z.string().describe('Key to press (e.g., Enter, Tab, Escape)'),
      selector: z.string().optional().describe('Element to focus before pressing')
    })
  },
  browser_scroll: {
    description: 'Scroll the page or an element',
    parameters: z.object({
      direction: z.enum(['up', 'down', 'left', 'right']).optional(),
      selector: z.string().optional().describe('Element to scroll within'),
      amount: z.number().optional().describe('Pixels to scroll')
    })
  }
}

// Advanced tools
const advancedTools = {
  browser_screenshot: {
    description: 'Take a screenshot of the current page',
    parameters: z.object({
      selector: z.string().optional().describe('Element to screenshot'),
      fullPage: z.boolean().optional()
    })
  },
  browser_wait_for: {
    description: 'Wait for an element to appear or become visible',
    parameters: z.object({
      selector: z.string().describe('CSS selector to wait for'),
      state: z.enum(['attached', 'visible', 'hidden']).optional(),
      timeout: z.number().optional().describe('Max wait time in ms')
    })
  },
  browser_evaluate: {
    description: 'Execute JavaScript code in the browser context',
    parameters: z.object({
      script: z.string().describe('JavaScript code to execute')
    })
  }
}
```

## Implementation

### Plugin Factory

```typescript
// packages/aiCore/src/core/plugins/built-in/btcpBrowserPlugin/index.ts

import { BrowserAgent } from 'btcp-browser-agent'
import { tool } from 'ai'
import { z } from 'zod'
import { definePlugin } from '../../'
import type { AiRequestContext } from '../../types'
import type { BTCPBrowserPluginConfig } from './types'

export const btcpBrowserPlugin = (config: BTCPBrowserPluginConfig = {}) => {
  const {
    enabled = true,
    agent: providedAgent,
    agentOptions = {},
    tools: toolSelection = 'all',
    maxSnapshotSize = 50000,
    includeScreenshots = false,
    onToolCall,
    onToolResult
  } = config

  // Lazy initialization of BrowserAgent
  let agent: BrowserAgent | null = providedAgent ?? null

  const getAgent = async (): Promise<BrowserAgent> => {
    if (!agent) {
      agent = new BrowserAgent(agentOptions)
      await agent.launch()
    }
    return agent
  }

  // Tool execution wrapper with callbacks
  const executeWithCallbacks = async <T>(
    toolName: string,
    args: unknown,
    executor: () => Promise<T>
  ): Promise<T> => {
    onToolCall?.(toolName, args)
    const result = await executor()
    onToolResult?.(toolName, result)
    return result
  }

  // Create tool definitions
  const createBrowserTools = () => ({
    browser_snapshot: tool({
      description: 'Get accessibility snapshot with element references (@e1, @e2) for targeting. Always call this first to understand the page structure.',
      parameters: z.object({
        selector: z.string().optional(),
        maxDepth: z.number().optional()
      }),
      execute: async (args) => executeWithCallbacks('browser_snapshot', args, async () => {
        const browserAgent = await getAgent()
        const snapshot = await browserAgent.snapshot(args)

        // Truncate if too large
        const snapshotStr = JSON.stringify(snapshot)
        if (snapshotStr.length > maxSnapshotSize) {
          return {
            ...snapshot,
            truncated: true,
            message: `Snapshot truncated from ${snapshotStr.length} to ${maxSnapshotSize} chars`
          }
        }
        return snapshot
      })
    }),

    browser_navigate: tool({
      description: 'Navigate to a URL',
      parameters: z.object({
        url: z.string().describe('URL to navigate to'),
        waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional()
      }),
      execute: async (args) => executeWithCallbacks('browser_navigate', args, async () => {
        const browserAgent = await getAgent()
        await browserAgent.navigate(args.url)
        return { success: true, url: args.url }
      })
    }),

    browser_click: tool({
      description: 'Click an element using CSS selector or element reference (@e1)',
      parameters: z.object({
        selector: z.string().describe('CSS selector or element reference')
      }),
      execute: async (args) => executeWithCallbacks('browser_click', args, async () => {
        const browserAgent = await getAgent()
        await browserAgent.click(args.selector)
        return { success: true, selector: args.selector }
      })
    }),

    browser_type: tool({
      description: 'Type text character by character into an element',
      parameters: z.object({
        selector: z.string(),
        text: z.string(),
        delay: z.number().optional()
      }),
      execute: async (args) => executeWithCallbacks('browser_type', args, async () => {
        const browserAgent = await getAgent()
        await browserAgent.type(args.selector, args.text)
        return { success: true }
      })
    }),

    browser_fill: tool({
      description: 'Fill an input field instantly',
      parameters: z.object({
        selector: z.string(),
        value: z.string()
      }),
      execute: async (args) => executeWithCallbacks('browser_fill', args, async () => {
        const browserAgent = await getAgent()
        await browserAgent.fill(args.selector, args.value)
        return { success: true }
      })
    }),

    browser_scroll: tool({
      description: 'Scroll the page or element',
      parameters: z.object({
        direction: z.enum(['up', 'down', 'left', 'right']).optional(),
        selector: z.string().optional(),
        amount: z.number().optional()
      }),
      execute: async (args) => executeWithCallbacks('browser_scroll', args, async () => {
        const browserAgent = await getAgent()
        await browserAgent.scroll(args)
        return { success: true }
      })
    }),

    browser_hover: tool({
      description: 'Hover over an element',
      parameters: z.object({
        selector: z.string()
      }),
      execute: async (args) => executeWithCallbacks('browser_hover', args, async () => {
        const browserAgent = await getAgent()
        await browserAgent.hover(args.selector)
        return { success: true }
      })
    }),

    browser_press: tool({
      description: 'Press a keyboard key',
      parameters: z.object({
        key: z.string(),
        selector: z.string().optional()
      }),
      execute: async (args) => executeWithCallbacks('browser_press', args, async () => {
        const browserAgent = await getAgent()
        await browserAgent.press(args.key, args.selector)
        return { success: true }
      })
    }),

    browser_get_text: tool({
      description: 'Get text content from an element',
      parameters: z.object({
        selector: z.string()
      }),
      execute: async (args) => executeWithCallbacks('browser_get_text', args, async () => {
        const browserAgent = await getAgent()
        const text = await browserAgent.getText(args.selector)
        return { text }
      })
    }),

    browser_get_attribute: tool({
      description: 'Get attribute value from an element',
      parameters: z.object({
        selector: z.string(),
        attribute: z.string()
      }),
      execute: async (args) => executeWithCallbacks('browser_get_attribute', args, async () => {
        const browserAgent = await getAgent()
        const value = await browserAgent.getAttribute(args.selector, args.attribute)
        return { value }
      })
    }),

    browser_is_visible: tool({
      description: 'Check if element is visible',
      parameters: z.object({
        selector: z.string()
      }),
      execute: async (args) => executeWithCallbacks('browser_is_visible', args, async () => {
        const browserAgent = await getAgent()
        const visible = await browserAgent.isVisible(args.selector)
        return { visible }
      })
    }),

    browser_wait_for: tool({
      description: 'Wait for an element to appear',
      parameters: z.object({
        selector: z.string(),
        timeout: z.number().optional()
      }),
      execute: async (args) => executeWithCallbacks('browser_wait_for', args, async () => {
        const browserAgent = await getAgent()
        await browserAgent.waitFor(args.selector, { timeout: args.timeout })
        return { success: true }
      })
    }),

    browser_screenshot: tool({
      description: 'Take a screenshot',
      parameters: z.object({
        selector: z.string().optional(),
        fullPage: z.boolean().optional()
      }),
      execute: async (args) => executeWithCallbacks('browser_screenshot', args, async () => {
        const browserAgent = await getAgent()
        const screenshot = await browserAgent.screenshot(args)
        return { image: screenshot }
      })
    }),

    browser_evaluate: tool({
      description: 'Execute JavaScript in the browser',
      parameters: z.object({
        script: z.string()
      }),
      execute: async (args) => executeWithCallbacks('browser_evaluate', args, async () => {
        const browserAgent = await getAgent()
        const result = await browserAgent.evaluate(args.script)
        return { result }
      })
    }),

    browser_back: tool({
      description: 'Go back in browser history',
      parameters: z.object({}),
      execute: async () => executeWithCallbacks('browser_back', {}, async () => {
        const browserAgent = await getAgent()
        await browserAgent.back()
        return { success: true }
      })
    }),

    browser_forward: tool({
      description: 'Go forward in browser history',
      parameters: z.object({}),
      execute: async () => executeWithCallbacks('browser_forward', {}, async () => {
        const browserAgent = await getAgent()
        await browserAgent.forward()
        return { success: true }
      })
    }),

    browser_reload: tool({
      description: 'Reload the current page',
      parameters: z.object({}),
      execute: async () => executeWithCallbacks('browser_reload', {}, async () => {
        const browserAgent = await getAgent()
        await browserAgent.reload()
        return { success: true }
      })
    })
  })

  // Tool presets
  const SAFE_TOOLS = [
    'browser_snapshot',
    'browser_navigate',
    'browser_click',
    'browser_type',
    'browser_fill',
    'browser_scroll',
    'browser_hover',
    'browser_get_text',
    'browser_is_visible',
    'browser_wait_for',
    'browser_back',
    'browser_forward'
  ]

  const filterTools = (allTools: Record<string, any>) => {
    if (toolSelection === 'all') return allTools
    if (toolSelection === 'safe') {
      return Object.fromEntries(
        Object.entries(allTools).filter(([name]) => SAFE_TOOLS.includes(name))
      )
    }
    return Object.fromEntries(
      Object.entries(allTools).filter(([name]) => toolSelection.includes(name as any))
    )
  }

  return definePlugin({
    name: 'btcp-browser',
    enforce: 'pre',

    configureContext: (context: AiRequestContext) => {
      // Store agent reference in context for cleanup
      context.btcpAgent = agent
    },

    transformParams: (params: any, context: AiRequestContext) => {
      if (!enabled) return params

      const browserTools = createBrowserTools()
      const selectedTools = filterTools(browserTools)

      // Merge with existing tools
      params.tools = {
        ...params.tools,
        ...selectedTools
      }

      // Add browser-specific system prompt hint
      if (!params.system?.includes('browser_snapshot')) {
        const browserHint = `
You have access to browser automation tools. When interacting with web pages:
1. Always call browser_snapshot first to get element references (@e1, @e2, etc.)
2. Use element references for reliable element targeting
3. After actions that change the page, call browser_snapshot again to get updated state
`
        params.system = params.system
          ? `${params.system}\n\n${browserHint}`
          : browserHint
      }

      return params
    },

    onRequestEnd: async (context: AiRequestContext) => {
      // Cleanup if agent was created by this plugin
      if (agent && !providedAgent) {
        // Don't close - keep agent alive for session reuse
        // await agent.close()
      }
    }
  })
}

export default btcpBrowserPlugin
export * from './types'
```

## Usage Examples

### Basic Usage

```typescript
import { createExecutor, btcpBrowserPlugin } from '@cherrystudio/ai-core'

const executor = createExecutor('anthropic', { apiKey: '...' }, [
  btcpBrowserPlugin()
])

const result = await executor.streamText({
  model: 'claude-sonnet-4-20250514',
  messages: [{
    role: 'user',
    content: 'Go to https://news.ycombinator.com and find the top 3 stories'
  }]
})
```

### With Pre-initialized Agent

```typescript
import { BrowserAgent } from 'btcp-browser-agent'
import { createExecutor, btcpBrowserPlugin } from '@cherrystudio/ai-core'

// Create and configure agent
const agent = new BrowserAgent({
  targetWindow: window,
  autoLaunch: true
})
await agent.launch()

const executor = createExecutor('openai', { apiKey: '...' }, [
  btcpBrowserPlugin({ agent })
])
```

### Safe Mode (No Evaluate/Screenshot)

```typescript
const executor = createExecutor('openai', { apiKey: '...' }, [
  btcpBrowserPlugin({
    tools: 'safe'  // Excludes browser_evaluate, browser_screenshot
  })
])
```

### With Callbacks for Logging

```typescript
const executor = createExecutor('anthropic', { apiKey: '...' }, [
  btcpBrowserPlugin({
    onToolCall: (name, args) => {
      console.log(`[BTCP] Calling ${name}`, args)
    },
    onToolResult: (name, result) => {
      console.log(`[BTCP] Result from ${name}`, result)
    }
  })
])
```

### In Chrome Extension Context

```typescript
// content-script.ts or extension page
import { BrowserAgent } from 'btcp-browser-agent'
import { createExecutor, btcpBrowserPlugin } from '@cherrystudio/ai-core'

const agent = new BrowserAgent({
  targetDocument: document,
  targetWindow: window
})

const executor = createExecutor('anthropic', { apiKey: '...' }, [
  btcpBrowserPlugin({ agent })
])

// Now AI can control the page
chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type === 'AI_COMMAND') {
    const result = await executor.generateText({
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: message.command }]
    })
    return result.text
  }
})
```

### Combined with Web Search

```typescript
import {
  createExecutor,
  btcpBrowserPlugin,
  webSearchPlugin
} from '@cherrystudio/ai-core'

const executor = createExecutor('anthropic', { apiKey: '...' }, [
  webSearchPlugin({ anthropic: { maxUses: 3 } }),
  btcpBrowserPlugin()
])

// AI can search for information AND interact with pages
await executor.streamText({
  model: 'claude-sonnet-4-20250514',
  messages: [{
    role: 'user',
    content: 'Search for the best pizza places in NYC, then go to the first result and find their menu'
  }]
})
```

## AI Agent Workflow

The recommended workflow for AI agents using this plugin:

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Agent Loop                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. SNAPSHOT                                                 │
│     └─▶ browser_snapshot()                                   │
│         Returns: { refs: { '@e1': {...}, '@e2': {...} } }   │
│                                                              │
│  2. ANALYZE                                                  │
│     └─▶ AI analyzes snapshot, identifies target elements     │
│         "I see a search input at @e3 and submit button @e4" │
│                                                              │
│  3. ACT                                                      │
│     └─▶ browser_fill('@e3', 'search query')                 │
│     └─▶ browser_click('@e4')                                │
│                                                              │
│  4. VERIFY                                                   │
│     └─▶ browser_snapshot() // Re-snapshot after action      │
│     └─▶ Check if action succeeded                           │
│                                                              │
│  5. REPEAT or COMPLETE                                       │
│     └─▶ Continue loop or return results                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
packages/aiCore/src/core/plugins/built-in/btcpBrowserPlugin/
├── index.ts          # Plugin factory and exports
├── types.ts          # TypeScript interfaces
├── tools.ts          # Tool definitions (optional split)
├── constants.ts      # Tool presets and defaults
└── __tests__/
    └── btcpBrowserPlugin.test.ts
```

## Dependencies

```json
{
  "dependencies": {
    "btcp-browser-agent": "^1.0.0"
  },
  "peerDependencies": {
    "ai": ">=3.0.0",
    "zod": ">=3.0.0"
  }
}
```

## Security Considerations

| Risk | Mitigation |
|------|------------|
| Arbitrary JS execution | `browser_evaluate` excluded from 'safe' preset |
| Cross-origin access | Respect browser security model; extension mode requires permissions |
| Credential exposure | Don't include credentials in tool parameters; use secure storage |
| Infinite loops | Implement max iteration limits in agent orchestration layer |
| Resource exhaustion | `maxSnapshotSize` config to prevent token overflow |

## Testing Strategy

1. **Unit Tests**: Mock BrowserAgent, test tool creation and parameter transformation
2. **Integration Tests**: Test with real browser in headless mode
3. **E2E Tests**: Full workflow tests with actual AI model calls

## Future Enhancements

1. **Vision Integration**: Combine screenshots with multimodal models
2. **Session Persistence**: Save/restore browser state across conversations
3. **Action Recording**: Record user actions for replay/automation
4. **Parallel Execution**: Support multiple browser tabs/windows
5. **MCP Server Mode**: Expose as MCP server for broader ecosystem compatibility

## References

- [btcp-browser-agent](https://github.com/browser-tool-calling-protocol/btcp-browser-agent)
- [Browser Tool Calling Protocol Spec](https://github.com/browser-tool-calling-protocol/spec)
- [Vercel AI SDK Tool Documentation](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling)
- [aiCore Plugin System](../AGENT_FRAMEWORK_COMPARISON.md)
