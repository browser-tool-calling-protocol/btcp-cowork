/**
 * BTCP Browser Plugin Constants
 *
 * Tool presets and default configuration values.
 * Uses the two-layer architecture from btcp-browser-agent:
 * - BackgroundAgent: Browser-level operations (tabs, navigation, screenshots)
 * - ContentAgent: DOM operations (click, fill, type, snapshot, etc.)
 */

import type { BTCPToolName, BTCPToolPreset } from './types'

/**
 * Tool presets organized by capability level
 */
export const TOOL_PRESETS: Record<BTCPToolPreset, BTCPToolName[]> = {
  /**
   * Minimal: Safe read-only operations
   * Best for information extraction and page analysis
   */
  minimal: ['browser_snapshot', 'browser_get_text'],

  /**
   * Standard: Common automation tasks
   * Suitable for most browser automation use cases
   * Note: browser_launch/browser_close excluded - browser auto-launches on first use
   */
  standard: [
    // Navigation
    'browser_navigate',
    // Inspection
    'browser_snapshot',
    'browser_get_text',
    // Interaction
    'browser_click',
    'browser_type',
    'browser_fill',
    'browser_press',
    'browser_scroll',
    // Visual
    'browser_screenshot'
  ],

  /**
   * Full: All capabilities
   * Note: browser_launch/browser_close excluded - browser auto-launches on first use
   */
  full: [
    // Navigation
    'browser_navigate',
    'browser_back',
    'browser_forward',
    'browser_reload',
    // Inspection
    'browser_snapshot',
    'browser_get_text',
    // Interaction
    'browser_click',
    'browser_type',
    'browser_fill',
    'browser_press',
    'browser_scroll',
    // Visual
    'browser_screenshot'
  ]
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  enabled: true,
  toolset: 'standard' as BTCPToolPreset,
  maxSnapshotSize: 50000,
  enableScreencast: false,
  enableTracking: false,
  injectSystemPrompt: true
}

/**
 * Browser-aware system prompt hints for AI models
 */
export const BROWSER_SYSTEM_PROMPT = `
You can control a browser to extract information or interact with web pages.

## Tools

- \`browser_navigate({ url })\` — load a page
- \`browser_snapshot({ format?, grep? })\` — capture page state
- \`browser_click({ selector })\` — click an element
- \`browser_fill({ selector, value })\` — fill an input field

## Snapshot

\`browser_snapshot\` is your primary tool:

- **format**: \`"tree"\` (default) returns interactive elements with refs (@ref:1, @ref:2). \`"markdown"\` returns readable text content.
- **grep**: filter output to lines matching a pattern

## Example: Extract Information

\`\`\`
browser_navigate({ url: "https://example.com/article" })
browser_snapshot({ format: "markdown" })
// Read the content and summarize
\`\`\`

## Example: Interact with Page

\`\`\`
browser_snapshot()
// Output: @ref:1 [input] Email  @ref:2 [input] Password  @ref:3 [button] Sign In

browser_fill({ selector: "@ref:1", value: "user@example.com" })
browser_fill({ selector: "@ref:2", value: "password123" })
browser_click({ selector: "@ref:3" })

browser_snapshot()  // Get fresh refs after page changes
\`\`\`

## Key Points

- Use @ref from the most recent snapshot — refs change when the page updates
- Re-snapshot after clicks or form submissions to see the new state
`.trim()
