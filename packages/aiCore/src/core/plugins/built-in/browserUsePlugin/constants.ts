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
   */
  standard: [
    // Session management
    'browser_launch',
    'browser_close',
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
  ],

  /**
   * Full: All capabilities
   * Same as standard in minimal API
   */
  full: [
    // Session management
    'browser_launch',
    'browser_close',
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
`.trim()
