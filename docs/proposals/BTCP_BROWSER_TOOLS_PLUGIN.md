# Proposal: BTCP Browser Tools Plugin for aiCore

## Summary

Integrate [btcp-browser-agent](https://github.com/browser-tool-calling-protocol/btcp-browser-agent) as a reusable plugin for `@cherrystudio/ai-core`, enabling AI models to control browsers through the Browser Tool Calling Protocol (BTCP).

## Motivation

1. **Browser-Native Execution**: Unlike Playwright/Puppeteer, btcp-browser-agent runs directly in the browser using native DOM APIs
2. **Unified Tool Interface**: Provides consistent API across browser contexts (web page, extension, iframe)
3. **AI-Optimized Design**: Element references (`@ref:N`) and accessibility snapshots designed for LLM consumption
4. **Self-Describing API**: Built-in `describe()` method for dynamic tool discovery with help mode
5. **Extensible Architecture**: Three-layer design (BackgroundAgent, ContentAgent, BrowserManager) for different contexts

## Architecture Overview

### btcp-browser-agent Internal Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    btcp-browser-agent                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐                                            │
│  │  BrowserAgent   │  ◄── High-level convenience API            │
│  │  (Standalone)   │                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│  ┌────────▼────────┐    ┌─────────────────┐                     │
│  │ BrowserManager  │    │ BackgroundAgent │  ◄── Extension      │
│  │ (DOM operations)│    │ (Tab management)│      service worker │
│  └────────┬────────┘    └────────┬────────┘                     │
│           │                      │                               │
│  ┌────────▼──────────────────────▼────────┐                     │
│  │           ContentAgent                  │  ◄── Per-tab       │
│  │  (DOM snapshots, element interactions)  │      content script│
│  └─────────────────────────────────────────┘                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Plugin Integration with aiCore

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
                    │ • getByRole/Text/Label()   │
                    │ • screenshot()             │
                    │ • evaluate(script)         │
                    │ • describe(action?)        │
                    └─────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      Browser DOM            │
                    │   (Native APIs)             │
                    └─────────────────────────────┘
```

## Complete Action Reference

### Navigation Actions
| Action | Description | Parameters |
|--------|-------------|------------|
| `navigate` | Load URL | `url`, `waitUntil?` |
| `back` | Browser history back | - |
| `forward` | Browser history forward | - |
| `reload` | Refresh page | - |
| `url` | Get current URL | - |
| `title` | Get page title | - |

### Element Interaction
| Action | Description | Parameters |
|--------|-------------|------------|
| `click` | Click element | `selector`, `button?`, `clickCount?` |
| `dblclick` | Double-click | `selector` |
| `type` | Type character-by-character | `selector`, `text`, `delay?`, `clear?` |
| `fill` | Set input value instantly | `selector`, `value` |
| `clear` | Empty input/textarea | `selector` |
| `check` | Check checkbox/radio | `selector` |
| `uncheck` | Uncheck checkbox | `selector` |
| `select` | Select dropdown option | `selector`, `value` |
| `multiselect` | Select multiple options | `selector`, `values[]` |
| `hover` | Hover over element | `selector` |
| `focus` | Focus element | `selector` |
| `press` | Press keyboard key | `key`, `selector?` |
| `keydown` | Key down event | `key` |
| `keyup` | Key up event | `key` |
| `inserttext` | Insert text at cursor | `text` |
| `selectall` | Select all in input | `selector` |
| `drag` | Drag and drop | `source`, `target` |

### Semantic Locators (AI-Friendly)
| Action | Description | Parameters |
|--------|-------------|------------|
| `getbyrole` | Find by ARIA role | `role`, `name?`, `subaction?` |
| `getbytext` | Find by text content | `text`, `exact?`, `subaction?` |
| `getbylabel` | Find input by label | `label`, `subaction?` |
| `getbyplaceholder` | Find by placeholder | `placeholder`, `subaction?` |
| `getbyalttext` | Find by alt text | `alt`, `subaction?` |
| `getbytitle` | Find by title attr | `title`, `subaction?` |
| `getbytestid` | Find by data-testid | `testId`, `subaction?` |
| `nth` | Get nth match | `selector`, `index` |

### Information Retrieval
| Action | Description | Parameters |
|--------|-------------|------------|
| `snapshot` | DOM tree with refs | `selector?`, `maxDepth?` |
| `getattribute` | Get attribute value | `selector`, `attribute` |
| `gettext` | Get textContent | `selector` |
| `innertext` | Get innerText | `selector` |
| `innerhtml` | Get innerHTML | `selector` |
| `inputvalue` | Get input value | `selector` |
| `isvisible` | Check visibility | `selector` |
| `isenabled` | Check enabled state | `selector` |
| `ischecked` | Check checked state | `selector` |
| `count` | Count matches | `selector` |
| `boundingbox` | Get element rect | `selector` |
| `content` | Get page HTML | `selector?` |

### Waiting & Synchronization
| Action | Description | Parameters |
|--------|-------------|------------|
| `wait` | Delay or await state | `timeout?`, `selector?`, `state?` |
| `waitforurl` | Wait for URL match | `url`, `timeout?` |
| `waitforloadstate` | Wait for load state | `state`, `timeout?` |
| `waitforfunction` | Wait for JS condition | `expression`, `timeout?` |
| `scrollintoview` | Scroll element visible | `selector` |
| `scroll` | Scroll page/element | `direction?`, `x?`, `y?`, `selector?` |

### Visual Capture
| Action | Description | Parameters |
|--------|-------------|------------|
| `screenshot` | Capture image | `selector?`, `fullPage?`, `format?`, `quality?` |
| `screencast_start` | Begin frame capture | `format?`, `quality?`, `interval?` |
| `screencast_stop` | End frame capture | - |
| `highlight` | Visual debugging | `selector` |

### Storage & State
| Action | Description | Parameters |
|--------|-------------|------------|
| `storage_get` | Read storage | `key`, `type` (local/session) |
| `storage_set` | Write storage | `key`, `value`, `type` |
| `storage_clear` | Clear storage | `type` |
| `dialog` | Handle alert/confirm | `action`, `promptText?` |

### Frame Management
| Action | Description | Parameters |
|--------|-------------|------------|
| `frame` | Switch to iframe | `selector?`, `name?`, `url?` |
| `mainframe` | Return to main frame | - |

### JavaScript Execution
| Action | Description | Parameters |
|--------|-------------|------------|
| `evaluate` | Execute JS code | `script` |
| `addscript` | Inject script tag | `content?`, `src?` |
| `addstyle` | Add CSS | `content?`, `href?` |
| `setcontent` | Replace page HTML | `html` |
| `dispatch` | Dispatch custom event | `selector`, `event`, `detail?` |

### Debugging & Introspection
| Action | Description | Parameters |
|--------|-------------|------------|
| `console` | Get console messages | `clear?` |
| `errors` | Get page errors | `clear?` |
| `describe` | Get action help | `action?` |

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
  }

  /**
   * Which tool categories to expose
   * @default 'standard'
   */
  toolset?: 'minimal' | 'standard' | 'full' | BTCPToolName[]

  /**
   * Maximum snapshot size (characters) to prevent token overflow
   * @default 50000
   */
  maxSnapshotSize?: number

  /**
   * Enable screencast for vision models
   * @default false
   */
  enableScreencast?: boolean

  /**
   * Enable request/console tracking
   * @default false
   */
  enableTracking?: boolean

  /**
   * Callback for tool execution events
   */
  onToolCall?: (toolName: string, args: unknown) => void
  onToolResult?: (toolName: string, result: unknown) => void
  onError?: (toolName: string, error: Error) => void
}

type BTCPToolName =
  // Navigation
  | 'browser_navigate'
  | 'browser_back'
  | 'browser_forward'
  | 'browser_reload'
  | 'browser_url'
  | 'browser_title'
  // Core Interaction
  | 'browser_click'
  | 'browser_type'
  | 'browser_fill'
  | 'browser_press'
  | 'browser_hover'
  | 'browser_scroll'
  | 'browser_clear'
  | 'browser_check'
  | 'browser_uncheck'
  | 'browser_select'
  // Semantic Locators
  | 'browser_get_by_role'
  | 'browser_get_by_text'
  | 'browser_get_by_label'
  | 'browser_get_by_placeholder'
  // Inspection
  | 'browser_snapshot'
  | 'browser_get_text'
  | 'browser_get_attribute'
  | 'browser_is_visible'
  | 'browser_is_enabled'
  | 'browser_count'
  // Waiting
  | 'browser_wait'
  | 'browser_wait_for_url'
  | 'browser_scroll_into_view'
  // Advanced
  | 'browser_screenshot'
  | 'browser_evaluate'
  | 'browser_frame'
  | 'browser_mainframe'
  // Debugging
  | 'browser_highlight'
  | 'browser_console'
  | 'browser_describe'
```

### Tool Presets

```typescript
const TOOL_PRESETS = {
  // Minimal: Safe read-only operations
  minimal: [
    'browser_snapshot',
    'browser_url',
    'browser_title',
    'browser_get_text',
    'browser_get_attribute',
    'browser_is_visible',
    'browser_count',
    'browser_describe'
  ],

  // Standard: Common automation tasks
  standard: [
    // All minimal tools plus:
    'browser_navigate',
    'browser_back',
    'browser_forward',
    'browser_reload',
    'browser_click',
    'browser_type',
    'browser_fill',
    'browser_press',
    'browser_hover',
    'browser_scroll',
    'browser_clear',
    'browser_check',
    'browser_select',
    'browser_get_by_role',
    'browser_get_by_text',
    'browser_get_by_label',
    'browser_wait',
    'browser_scroll_into_view',
    'browser_screenshot',
    'browser_highlight'
  ],

  // Full: All capabilities including JS execution
  full: [
    // All standard tools plus:
    'browser_evaluate',
    'browser_frame',
    'browser_mainframe',
    'browser_uncheck',
    'browser_get_by_placeholder',
    'browser_is_enabled',
    'browser_wait_for_url',
    'browser_console'
  ]
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
import { TOOL_PRESETS } from './constants'

export const btcpBrowserPlugin = (config: BTCPBrowserPluginConfig = {}) => {
  const {
    enabled = true,
    agent: providedAgent,
    agentOptions = {},
    toolset = 'standard',
    maxSnapshotSize = 50000,
    enableScreencast = false,
    enableTracking = false,
    onToolCall,
    onToolResult,
    onError
  } = config

  // Lazy initialization
  let agent: BrowserAgent | null = providedAgent ?? null

  const getAgent = async (): Promise<BrowserAgent> => {
    if (!agent) {
      agent = new BrowserAgent(agentOptions.targetWindow, agentOptions.targetDocument)
      await agent.launch({})
    }
    return agent
  }

  // Execution wrapper with error handling
  const executeWithCallbacks = async <T>(
    toolName: string,
    args: unknown,
    executor: () => Promise<T>
  ): Promise<T> => {
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

  // Tool definitions organized by category
  const createBrowserTools = () => {
    const browserManager = agent?.getBrowserManager()

    return {
      // === Navigation ===
      browser_navigate: tool({
        description: 'Navigate to a URL. Waits for page load by default.',
        parameters: z.object({
          url: z.string().describe('URL to navigate to'),
          waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional()
        }),
        execute: async (args) => executeWithCallbacks('browser_navigate', args, async () => {
          const browserAgent = await getAgent()
          await browserAgent.execute({ action: 'navigate', url: args.url, waitUntil: args.waitUntil })
          return { success: true, url: args.url }
        })
      }),

      browser_back: tool({
        description: 'Go back in browser history',
        parameters: z.object({}),
        execute: async () => executeWithCallbacks('browser_back', {}, async () => {
          const browserAgent = await getAgent()
          await browserAgent.execute({ action: 'back' })
          return { success: true }
        })
      }),

      browser_forward: tool({
        description: 'Go forward in browser history',
        parameters: z.object({}),
        execute: async () => executeWithCallbacks('browser_forward', {}, async () => {
          const browserAgent = await getAgent()
          await browserAgent.execute({ action: 'forward' })
          return { success: true }
        })
      }),

      browser_reload: tool({
        description: 'Reload the current page',
        parameters: z.object({}),
        execute: async () => executeWithCallbacks('browser_reload', {}, async () => {
          const browserAgent = await getAgent()
          await browserAgent.execute({ action: 'reload' })
          return { success: true }
        })
      }),

      browser_url: tool({
        description: 'Get the current page URL',
        parameters: z.object({}),
        execute: async () => executeWithCallbacks('browser_url', {}, async () => {
          const browserAgent = await getAgent()
          const url = await browserAgent.getUrl()
          return { url }
        })
      }),

      browser_title: tool({
        description: 'Get the current page title',
        parameters: z.object({}),
        execute: async () => executeWithCallbacks('browser_title', {}, async () => {
          const browserAgent = await getAgent()
          const title = await browserAgent.getTitle()
          return { title }
        })
      }),

      // === Snapshot & Inspection ===
      browser_snapshot: tool({
        description: 'Get an accessibility snapshot of the page with element references (@ref:N). Always call this first to understand page structure and get stable element refs for targeting.',
        parameters: z.object({
          selector: z.string().optional().describe('CSS selector to scope snapshot'),
          maxDepth: z.number().optional().describe('Max DOM tree depth')
        }),
        execute: async (args) => executeWithCallbacks('browser_snapshot', args, async () => {
          const browserAgent = await getAgent()
          const snapshot = await browserAgent.snapshot(args)

          const snapshotStr = JSON.stringify(snapshot)
          if (snapshotStr.length > maxSnapshotSize) {
            return {
              ...snapshot,
              _truncated: true,
              _message: `Snapshot truncated to ${maxSnapshotSize} chars`
            }
          }
          return snapshot
        })
      }),

      browser_get_text: tool({
        description: 'Get text content from an element',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference (@ref:N)')
        }),
        execute: async (args) => executeWithCallbacks('browser_get_text', args, async () => {
          const browserAgent = await getAgent()
          const text = await browserAgent.getText(args.selector)
          return { text }
        })
      }),

      browser_get_attribute: tool({
        description: 'Get an attribute value from an element',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference'),
          attribute: z.string().describe('Attribute name')
        }),
        execute: async (args) => executeWithCallbacks('browser_get_attribute', args, async () => {
          const browserAgent = await getAgent()
          const value = await browserAgent.getAttribute(args.selector, args.attribute)
          return { value }
        })
      }),

      browser_is_visible: tool({
        description: 'Check if an element is visible',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference')
        }),
        execute: async (args) => executeWithCallbacks('browser_is_visible', args, async () => {
          const browserAgent = await getAgent()
          const visible = await browserAgent.isVisible(args.selector)
          return { visible }
        })
      }),

      browser_is_enabled: tool({
        description: 'Check if an element is enabled (not disabled)',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference')
        }),
        execute: async (args) => executeWithCallbacks('browser_is_enabled', args, async () => {
          const browserAgent = await getAgent()
          const response = await browserAgent.execute({ action: 'isenabled', selector: args.selector })
          return { enabled: response.data }
        })
      }),

      browser_count: tool({
        description: 'Count elements matching a selector',
        parameters: z.object({
          selector: z.string().describe('CSS selector')
        }),
        execute: async (args) => executeWithCallbacks('browser_count', args, async () => {
          const browserAgent = await getAgent()
          const response = await browserAgent.execute({ action: 'count', selector: args.selector })
          return { count: response.data }
        })
      }),

      // === Semantic Locators ===
      browser_get_by_role: tool({
        description: 'Find element by ARIA role (button, link, textbox, etc.). More reliable than CSS selectors.',
        parameters: z.object({
          role: z.string().describe('ARIA role (button, link, textbox, checkbox, etc.)'),
          name: z.string().optional().describe('Accessible name to filter by'),
          action: z.enum(['click', 'fill', 'check', 'hover']).optional().describe('Action to perform')
        }),
        execute: async (args) => executeWithCallbacks('browser_get_by_role', args, async () => {
          const browserAgent = await getAgent()
          const response = await browserAgent.execute({
            action: 'getbyrole',
            role: args.role,
            name: args.name,
            subaction: args.action
          })
          return response.data
        })
      }),

      browser_get_by_text: tool({
        description: 'Find element by its text content',
        parameters: z.object({
          text: z.string().describe('Text to search for'),
          exact: z.boolean().optional().describe('Exact match (default: false)'),
          action: z.enum(['click', 'hover']).optional()
        }),
        execute: async (args) => executeWithCallbacks('browser_get_by_text', args, async () => {
          const browserAgent = await getAgent()
          const response = await browserAgent.execute({
            action: 'getbytext',
            text: args.text,
            exact: args.exact,
            subaction: args.action
          })
          return response.data
        })
      }),

      browser_get_by_label: tool({
        description: 'Find input element by its associated label text',
        parameters: z.object({
          label: z.string().describe('Label text'),
          action: z.enum(['click', 'fill', 'check']).optional()
        }),
        execute: async (args) => executeWithCallbacks('browser_get_by_label', args, async () => {
          const browserAgent = await getAgent()
          const response = await browserAgent.execute({
            action: 'getbylabel',
            text: args.label,
            subaction: args.action
          })
          return response.data
        })
      }),

      browser_get_by_placeholder: tool({
        description: 'Find input by placeholder text',
        parameters: z.object({
          placeholder: z.string().describe('Placeholder text'),
          action: z.enum(['click', 'fill']).optional()
        }),
        execute: async (args) => executeWithCallbacks('browser_get_by_placeholder', args, async () => {
          const browserAgent = await getAgent()
          const response = await browserAgent.execute({
            action: 'getbyplaceholder',
            text: args.placeholder,
            subaction: args.action
          })
          return response.data
        })
      }),

      // === Interaction ===
      browser_click: tool({
        description: 'Click an element',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference (@ref:N)'),
          button: z.enum(['left', 'right', 'middle']).optional(),
          clickCount: z.number().optional().describe('Number of clicks (2 for double-click)')
        }),
        execute: async (args) => executeWithCallbacks('browser_click', args, async () => {
          const browserAgent = await getAgent()
          await browserAgent.click(args.selector, args)
          return { success: true, selector: args.selector }
        })
      }),

      browser_type: tool({
        description: 'Type text character by character (simulates real typing with events)',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference'),
          text: z.string().describe('Text to type'),
          delay: z.number().optional().describe('Delay between keystrokes in ms'),
          clear: z.boolean().optional().describe('Clear existing text first')
        }),
        execute: async (args) => executeWithCallbacks('browser_type', args, async () => {
          const browserAgent = await getAgent()
          await browserAgent.type(args.selector, args.text, args)
          return { success: true }
        })
      }),

      browser_fill: tool({
        description: 'Fill an input field instantly (faster than type, sets value directly)',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference'),
          value: z.string().describe('Value to fill')
        }),
        execute: async (args) => executeWithCallbacks('browser_fill', args, async () => {
          const browserAgent = await getAgent()
          await browserAgent.fill(args.selector, args.value)
          return { success: true }
        })
      }),

      browser_clear: tool({
        description: 'Clear an input field',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference')
        }),
        execute: async (args) => executeWithCallbacks('browser_clear', args, async () => {
          const browserAgent = await getAgent()
          await browserAgent.execute({ action: 'clear', selector: args.selector })
          return { success: true }
        })
      }),

      browser_press: tool({
        description: 'Press a keyboard key (Enter, Tab, Escape, ArrowDown, etc.)',
        parameters: z.object({
          key: z.string().describe('Key to press'),
          selector: z.string().optional().describe('Element to focus before pressing')
        }),
        execute: async (args) => executeWithCallbacks('browser_press', args, async () => {
          const browserAgent = await getAgent()
          await browserAgent.press(args.key, args.selector)
          return { success: true }
        })
      }),

      browser_hover: tool({
        description: 'Hover over an element (triggers mouseenter/mouseover)',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference')
        }),
        execute: async (args) => executeWithCallbacks('browser_hover', args, async () => {
          const browserAgent = await getAgent()
          await browserAgent.hover(args.selector)
          return { success: true }
        })
      }),

      browser_check: tool({
        description: 'Check a checkbox or radio button',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference')
        }),
        execute: async (args) => executeWithCallbacks('browser_check', args, async () => {
          const browserAgent = await getAgent()
          await browserAgent.execute({ action: 'check', selector: args.selector })
          return { success: true }
        })
      }),

      browser_uncheck: tool({
        description: 'Uncheck a checkbox',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference')
        }),
        execute: async (args) => executeWithCallbacks('browser_uncheck', args, async () => {
          const browserAgent = await getAgent()
          await browserAgent.execute({ action: 'uncheck', selector: args.selector })
          return { success: true }
        })
      }),

      browser_select: tool({
        description: 'Select an option in a dropdown',
        parameters: z.object({
          selector: z.string().describe('CSS selector of the <select> element'),
          value: z.string().describe('Option value to select')
        }),
        execute: async (args) => executeWithCallbacks('browser_select', args, async () => {
          const browserAgent = await getAgent()
          await browserAgent.execute({ action: 'select', selector: args.selector, value: args.value })
          return { success: true }
        })
      }),

      browser_scroll: tool({
        description: 'Scroll the page or a specific element',
        parameters: z.object({
          direction: z.enum(['up', 'down', 'left', 'right']).optional(),
          selector: z.string().optional().describe('Element to scroll within'),
          x: z.number().optional().describe('Horizontal scroll amount'),
          y: z.number().optional().describe('Vertical scroll amount')
        }),
        execute: async (args) => executeWithCallbacks('browser_scroll', args, async () => {
          const browserAgent = await getAgent()
          await browserAgent.scroll(args)
          return { success: true }
        })
      }),

      browser_scroll_into_view: tool({
        description: 'Scroll element into view (centered)',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference')
        }),
        execute: async (args) => executeWithCallbacks('browser_scroll_into_view', args, async () => {
          const browserAgent = await getAgent()
          await browserAgent.execute({ action: 'scrollintoview', selector: args.selector })
          return { success: true }
        })
      }),

      // === Waiting ===
      browser_wait: tool({
        description: 'Wait for time or element state',
        parameters: z.object({
          timeout: z.number().optional().describe('Time to wait in ms'),
          selector: z.string().optional().describe('Element to wait for'),
          state: z.enum(['attached', 'visible', 'hidden']).optional()
        }),
        execute: async (args) => executeWithCallbacks('browser_wait', args, async () => {
          const browserAgent = await getAgent()
          if (args.selector) {
            await browserAgent.waitFor(args.selector, { timeout: args.timeout })
          } else if (args.timeout) {
            await new Promise(resolve => setTimeout(resolve, args.timeout))
          }
          return { success: true }
        })
      }),

      browser_wait_for_url: tool({
        description: 'Wait for URL to contain a string',
        parameters: z.object({
          url: z.string().describe('URL substring to wait for'),
          timeout: z.number().optional()
        }),
        execute: async (args) => executeWithCallbacks('browser_wait_for_url', args, async () => {
          const browserAgent = await getAgent()
          await browserAgent.execute({ action: 'waitforurl', url: args.url, timeout: args.timeout })
          return { success: true }
        })
      }),

      // === Visual ===
      browser_screenshot: tool({
        description: 'Take a screenshot of the page or element',
        parameters: z.object({
          selector: z.string().optional().describe('Element to capture'),
          fullPage: z.boolean().optional().describe('Capture full page'),
          format: z.enum(['png', 'jpeg', 'webp']).optional(),
          quality: z.number().optional().describe('JPEG/WebP quality 0-100')
        }),
        execute: async (args) => executeWithCallbacks('browser_screenshot', args, async () => {
          const browserAgent = await getAgent()
          const screenshot = await browserAgent.screenshot(args)
          return { image: screenshot, format: args.format || 'png' }
        })
      }),

      browser_highlight: tool({
        description: 'Highlight an element for visual debugging (adds colored border)',
        parameters: z.object({
          selector: z.string().describe('CSS selector or element reference')
        }),
        execute: async (args) => executeWithCallbacks('browser_highlight', args, async () => {
          const browserAgent = await getAgent()
          const manager = browserAgent.getBrowserManager()
          manager.highlightElement(args.selector)
          return { success: true }
        })
      }),

      // === Frame Management ===
      browser_frame: tool({
        description: 'Switch to an iframe by selector, name, or URL',
        parameters: z.object({
          selector: z.string().optional().describe('CSS selector of iframe'),
          name: z.string().optional().describe('Frame name attribute'),
          url: z.string().optional().describe('Frame URL (partial match)')
        }),
        execute: async (args) => executeWithCallbacks('browser_frame', args, async () => {
          const browserAgent = await getAgent()
          const manager = browserAgent.getBrowserManager()
          await manager.switchToFrame(args)
          return { success: true }
        })
      }),

      browser_mainframe: tool({
        description: 'Return to the main frame from an iframe',
        parameters: z.object({}),
        execute: async () => executeWithCallbacks('browser_mainframe', {}, async () => {
          const browserAgent = await getAgent()
          const manager = browserAgent.getBrowserManager()
          manager.switchToMainFrame()
          return { success: true }
        })
      }),

      // === JavaScript ===
      browser_evaluate: tool({
        description: 'Execute JavaScript code in the browser context and return result',
        parameters: z.object({
          script: z.string().describe('JavaScript code to execute')
        }),
        execute: async (args) => executeWithCallbacks('browser_evaluate', args, async () => {
          const browserAgent = await getAgent()
          const result = await browserAgent.evaluate(args.script)
          return { result }
        })
      }),

      // === Debugging ===
      browser_console: tool({
        description: 'Get console messages from the page',
        parameters: z.object({
          clear: z.boolean().optional().describe('Clear messages after retrieving')
        }),
        execute: async (args) => executeWithCallbacks('browser_console', args, async () => {
          const browserAgent = await getAgent()
          const manager = browserAgent.getBrowserManager()
          const messages = manager.getConsoleMessages()
          if (args.clear) {
            // Note: Would need clearConsoleMessages method
          }
          return { messages }
        })
      }),

      browser_describe: tool({
        description: 'Get help/documentation for browser actions. Call with no action to list all, or specify an action name.',
        parameters: z.object({
          action: z.string().optional().describe('Action name to get help for')
        }),
        execute: async (args) => executeWithCallbacks('browser_describe', args, async () => {
          const description = BrowserAgent.describe(args.action)
          return description
        })
      })
    }
  }

  // Filter tools based on preset or custom list
  const filterTools = (allTools: Record<string, any>) => {
    if (Array.isArray(toolset)) {
      return Object.fromEntries(
        Object.entries(allTools).filter(([name]) => toolset.includes(name as any))
      )
    }
    const preset = TOOL_PRESETS[toolset] || TOOL_PRESETS.standard
    return Object.fromEntries(
      Object.entries(allTools).filter(([name]) => preset.includes(name))
    )
  }

  return definePlugin({
    name: 'btcp-browser',
    enforce: 'pre',

    configureContext: (context: AiRequestContext) => {
      context.btcpAgent = agent
    },

    transformParams: (params: any, context: AiRequestContext) => {
      if (!enabled) return params

      const browserTools = createBrowserTools()
      const selectedTools = filterTools(browserTools)

      params.tools = { ...params.tools, ...selectedTools }

      // Add browser-aware system prompt
      if (!params.system?.includes('browser_snapshot')) {
        const browserHint = `
You have access to browser automation tools using the Browser Tool Calling Protocol (BTCP).

## Workflow
1. Call browser_snapshot FIRST to get the page structure with element references (@ref:N)
2. Use @ref:N references for reliable element targeting (more stable than CSS selectors)
3. For forms, prefer semantic locators: browser_get_by_role, browser_get_by_label, browser_get_by_text
4. After actions that change the page, call browser_snapshot again
5. Use browser_describe to get help on any action

## Element References
Snapshots return refs like @ref:5, @ref:12 that remain stable across actions.
Use these refs instead of CSS selectors when possible.

## Tips
- Use browser_fill for instant input, browser_type for character-by-character
- Use browser_wait if page needs time to load after action
- Use browser_highlight for visual debugging
`
        params.system = params.system ? `${params.system}\n\n${browserHint}` : browserHint
      }

      return params
    },

    onRequestEnd: async (context: AiRequestContext) => {
      // Cleanup tracking if enabled
      if (enableTracking && agent) {
        const manager = agent.getBrowserManager()
        manager.clearRequests()
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

### Minimal Toolset (Read-Only)

```typescript
const executor = createExecutor('openai', { apiKey: '...' }, [
  btcpBrowserPlugin({
    toolset: 'minimal'  // Only snapshot, getText, isVisible, etc.
  })
])
```

### Full Toolset with Tracking

```typescript
const executor = createExecutor('anthropic', { apiKey: '...' }, [
  btcpBrowserPlugin({
    toolset: 'full',
    enableTracking: true,
    onToolCall: (name, args) => console.log(`[BTCP] ${name}`, args),
    onError: (name, err) => console.error(`[BTCP ERROR] ${name}:`, err)
  })
])
```

### Custom Tool Selection

```typescript
const executor = createExecutor('openai', { apiKey: '...' }, [
  btcpBrowserPlugin({
    toolset: [
      'browser_snapshot',
      'browser_navigate',
      'browser_click',
      'browser_fill',
      'browser_get_by_role',
      'browser_screenshot'
    ]
  })
])
```

### In Chrome Extension

```typescript
// content-script.ts
import { BrowserAgent } from 'btcp-browser-agent'
import { createExecutor, btcpBrowserPlugin } from '@cherrystudio/ai-core'

const agent = new BrowserAgent(window, document)
await agent.launch({})

const executor = createExecutor('anthropic', { apiKey: '...' }, [
  btcpBrowserPlugin({ agent })
])

// Handle messages from popup/background
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'AI_TASK') {
    const result = await executor.generateText({
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: message.task }]
    })
    sendResponse({ result: result.text })
  }
  return true
})
```

### Combined with Web Search

```typescript
import { createExecutor, btcpBrowserPlugin, webSearchPlugin } from '@cherrystudio/ai-core'

const executor = createExecutor('anthropic', { apiKey: '...' }, [
  webSearchPlugin({ anthropic: { maxUses: 3 } }),
  btcpBrowserPlugin()
])

await executor.streamText({
  model: 'claude-sonnet-4-20250514',
  messages: [{
    role: 'user',
    content: 'Search for the best rated coffee shops in Seattle, visit the top result, and extract their hours'
  }]
})
```

## AI Agent Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    BTCP Agent Loop                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. SNAPSHOT                                                     │
│     └─▶ browser_snapshot()                                       │
│         Returns: { tree: {...}, refs: { '@ref:1': {...} } }     │
│                                                                  │
│  2. LOCATE (using semantic locators or refs)                     │
│     └─▶ browser_get_by_role('button', { name: 'Submit' })       │
│     └─▶ Or use @ref:5 from snapshot                             │
│                                                                  │
│  3. INTERACT                                                     │
│     └─▶ browser_fill('@ref:3', 'search query')                  │
│     └─▶ browser_click('@ref:5')                                 │
│                                                                  │
│  4. WAIT (if needed)                                             │
│     └─▶ browser_wait({ selector: '.results' })                  │
│     └─▶ browser_wait_for_url('search?q=')                       │
│                                                                  │
│  5. VERIFY                                                       │
│     └─▶ browser_snapshot() // Re-snapshot                       │
│     └─▶ browser_is_visible('.success-message')                  │
│                                                                  │
│  6. EXTRACT or CONTINUE                                          │
│     └─▶ browser_get_text('.result-item')                        │
│     └─▶ Loop back to step 1 if more actions needed              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Self-Describing API

The `browser_describe` tool allows AI to learn about available actions:

```typescript
// Get all actions
await browser_describe({})
// Returns: { actions: [...], workflow: {...}, quickRef: {...} }

// Get specific action help
await browser_describe({ action: 'click' })
// Returns: { name: 'click', parameters: [...], examples: [...] }

// Handles typos
await browser_describe({ action: 'clck' })
// Returns: { suggestions: ['click'] }
```

## File Structure

```
packages/aiCore/src/core/plugins/built-in/btcpBrowserPlugin/
├── index.ts          # Plugin factory and main exports
├── types.ts          # TypeScript interfaces
├── tools/
│   ├── navigation.ts # Navigation tools
│   ├── interaction.ts # Click, type, fill, etc.
│   ├── inspection.ts # Snapshot, getText, etc.
│   ├── locators.ts   # Semantic locators
│   ├── waiting.ts    # Wait operations
│   └── advanced.ts   # Screenshot, evaluate, frames
├── constants.ts      # Tool presets
└── __tests__/
    ├── plugin.test.ts
    └── tools.test.ts
```

## Security Considerations

| Risk | Mitigation |
|------|------------|
| Arbitrary JS execution | `browser_evaluate` only in 'full' preset |
| Cross-origin access | Follows browser security model |
| Credential exposure | Never include credentials in parameters |
| Infinite loops | Implement max iterations at orchestration layer |
| Token overflow | `maxSnapshotSize` config (default 50K chars) |
| DOM manipulation | `setcontent`, `addscript` only in 'full' preset |

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

## References

- [btcp-browser-agent](https://github.com/browser-tool-calling-protocol/btcp-browser-agent)
- [Browser Tool Calling Protocol](https://github.com/browser-tool-calling-protocol)
- [Vercel AI SDK Tools](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling)
- [aiCore Plugin System](../AGENT_FRAMEWORK_COMPARISON.md)
