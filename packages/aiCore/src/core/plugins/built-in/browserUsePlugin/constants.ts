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

## Understanding the page

Start with \`browser_snapshot()\` to see the page structure:

- **format: "interactive"** (default) — returns clickable elements with refs: \`@ref:1 [button] Submit\`, \`@ref:2 [input] Email\`
- **format: "outline"** — returns content structure for understanding page layout
- **grep: "pattern"** — filters output to matching lines

## Interacting with elements

Use refs from snapshot to interact:

- \`browser_click({ selector: "@ref:1" })\` — click an element
- \`browser_fill({ selector: "@ref:1", value: "..." })\` — fill an input field
- \`browser_navigate({ url: "..." })\` — go to a page

## Extracting content

Use markdown format with grep to extract specific content:

\`browser_snapshot({ format: "markdown", grep: "price" })\`

## Verifying interactions

Always snapshot again after interactions to verify the result and get fresh refs:

\`\`\`
browser_snapshot()
// @ref:1 [input] Email  @ref:2 [button] Submit

browser_fill({ selector: "@ref:1", value: "user@example.com" })
browser_click({ selector: "@ref:2" })

browser_snapshot()  // verify: page changed? get new refs
\`\`\`

Refs become stale after page updates — always use refs from the most recent snapshot.
`.trim()
