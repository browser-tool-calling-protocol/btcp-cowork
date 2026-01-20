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
# Browser Tools (BTCP)

You can control the browser using these tools. Follow this workflow for reliable automation.

## Core Workflow
1. **Navigate**: \`browser_navigate({ url })\` to load a page
2. **Observe**: \`browser_snapshot()\` to see page structure with element refs (@ref:N)
3. **Act**: Use refs for interactions: \`browser_click({ selector: "@ref:5" })\`
4. **Re-observe**: Call \`browser_snapshot()\` again after any action that changes the page

## Element Targeting (Priority Order)
1. **@ref:N** - Most reliable. Use refs from snapshot (e.g., "@ref:12")
2. **CSS selectors** - Fallback when refs unavailable (e.g., "#submit-btn", ".login-form input")

## Tools Reference

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| \`browser_navigate\` | Go to URL | \`url\`: target URL |
| \`browser_snapshot\` | Get page structure | \`format\`: "tree" (interactive) or "markdown" (content); \`grep\`: filter pattern; \`includeHidden\`: show modals/dropdowns |
| \`browser_click\` | Click element | \`selector\`: @ref or CSS |
| \`browser_fill\` | Set input value (instant) | \`selector\`, \`value\` |
| \`browser_type\` | Type text (char-by-char) | \`selector\`, \`text\` |
| \`browser_press\` | Press key | \`key\`: "Enter", "Tab", "Escape", etc. |
| \`browser_scroll\` | Scroll page | \`direction\`: "up" or "down" |
| \`browser_get_text\` | Extract element text | \`selector\`: @ref or CSS |
| \`browser_screenshot\` | Capture visual | (no params) |

## Decision Guide

**To interact with elements**: snapshot → find ref → click/fill/type
**To read page content**: \`browser_snapshot({ format: "markdown" })\`
**To find specific elements**: \`browser_snapshot({ grep: "button" })\` or \`browser_snapshot({ grep: "login" })\`
**To see hidden elements** (modals, dropdowns): \`browser_snapshot({ includeHidden: true })\`
**For form submission**: \`browser_fill\` for each field → \`browser_click\` submit OR \`browser_press({ key: "Enter" })\`
**For character-sensitive input** (search autocomplete): use \`browser_type\` instead of \`browser_fill\`

## Common Patterns

### Fill and Submit Form
\`\`\`
browser_snapshot() → find input refs
browser_fill({ selector: "@ref:3", value: "user@example.com" })
browser_fill({ selector: "@ref:5", value: "password123" })
browser_click({ selector: "@ref:7" })  // submit button
browser_snapshot()  // verify result
\`\`\`

### Navigate and Extract Data
\`\`\`
browser_navigate({ url: "https://example.com" })
browser_snapshot({ format: "markdown" })  // get readable content
\`\`\`

### Handle Dynamic Content
\`\`\`
browser_click({ selector: "@ref:10" })  // open dropdown/modal
browser_snapshot({ includeHidden: true })  // see newly visible elements
browser_click({ selector: "@ref:15" })  // select option
\`\`\`

## Important Notes
- Always snapshot after navigation or actions that modify the page
- Refs are stable within a page state but change after page updates
- Use \`grep\` parameter to reduce snapshot size on complex pages
- If an action fails, re-snapshot to get fresh refs
`.trim()
