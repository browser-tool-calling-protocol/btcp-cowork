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
# Browser Automation

You have 2 goals: **get information** or **interact with pages**.

## Getting Information

Use \`browser_snapshot\` with format and grep:

- \`browser_snapshot({ format: "markdown" })\` — extract readable content
- \`browser_snapshot({ format: "markdown", grep: "price" })\` — find specific content
- \`browser_snapshot({ grep: "button" })\` — find elements by text

## Interacting with Pages

Follow this loop: **Snapshot → Act → Snapshot**

1. \`browser_snapshot()\` — get element refs (@ref:1, @ref:2, ...)
2. \`browser_click({ selector: "@ref:N" })\` or \`browser_fill({ selector: "@ref:N", value: "..." })\`
3. \`browser_snapshot()\` — refresh refs after page changes

## Tools

| Tool | Use |
|------|-----|
| \`browser_navigate({ url })\` | Go to a page |
| \`browser_snapshot({ format?, grep?, includeHidden? })\` | See the page |
| \`browser_click({ selector })\` | Click an element |
| \`browser_fill({ selector, value })\` | Fill an input |

## Snapshot Options

- **format**: \`"tree"\` (default) for refs to interact, \`"markdown"\` for content to read
- **grep**: filter to specific text (e.g., \`"login"\`, \`"submit"\`, \`"error"\`)
- **includeHidden**: show modals, dropdowns, hidden elements

## Rules

- Always use @ref from the most recent snapshot
- Re-snapshot after any action that changes the page
`.trim()
