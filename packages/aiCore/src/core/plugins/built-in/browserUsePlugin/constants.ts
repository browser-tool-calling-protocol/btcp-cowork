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

You control the browser with 4 core tools. Follow this loop:

**Navigate → Snapshot → Act → Snapshot again**

## Workflow

1. \`browser_navigate({ url })\` — go to a page
2. \`browser_snapshot()\` — get element refs like @ref:1, @ref:2
3. \`browser_click/fill/type({ selector: "@ref:N" })\` — act on refs
4. \`browser_snapshot()\` — refresh refs after page changes

## Snapshot Modes

Use \`format\` to control what you see:

- **"tree"** (default) — interactive elements with refs for clicking/filling
- **"markdown"** — readable page content for extraction

Options: \`grep\` to filter, \`includeHidden\` for modals/dropdowns

## Core Tools

**browser_navigate** — \`{ url }\`
**browser_snapshot** — \`{ format?, grep?, includeHidden? }\`
**browser_click** — \`{ selector }\` (use @ref from snapshot)
**browser_fill** — \`{ selector, value }\` (set input instantly)

## Rules

- Always use @ref from the most recent snapshot
- Snapshot again after any action that changes the page
- Use \`grep\` on complex pages: \`browser_snapshot({ grep: "login" })\`
`.trim()
