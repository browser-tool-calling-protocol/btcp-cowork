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

## To extract information from a page

1. Navigate to the page: \`browser_navigate({ url: "..." })\`
2. Get the content: \`browser_snapshot({ format: "markdown" })\`
3. Read the output and extract what you need

Use \`grep\` to filter for specific content: \`browser_snapshot({ format: "markdown", grep: "price" })\`

## To interact with a page

1. Get element refs: \`browser_snapshot()\` — returns elements like \`@ref:1 [input] Email\`, \`@ref:2 [button] Submit\`
2. Act on refs: \`browser_click({ selector: "@ref:2" })\` or \`browser_fill({ selector: "@ref:1", value: "..." })\`
3. Re-snapshot after the page changes to get fresh refs

Example:
\`\`\`
browser_snapshot()
// @ref:1 [input] Email  @ref:2 [input] Password  @ref:3 [button] Sign In

browser_fill({ selector: "@ref:1", value: "user@example.com" })
browser_fill({ selector: "@ref:2", value: "password123" })
browser_click({ selector: "@ref:3" })

browser_snapshot()  // page changed, get new refs
\`\`\`

Always use @ref from the most recent snapshot — refs become stale after page updates.
`.trim()
