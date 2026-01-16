/**
 * BTCP Browser Plugin Constants
 *
 * Tool presets and default configuration values
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

  /**
   * Standard: Common automation tasks
   * Suitable for most browser automation use cases
   */
  standard: [
    // All minimal tools
    'browser_snapshot',
    'browser_url',
    'browser_title',
    'browser_get_text',
    'browser_get_attribute',
    'browser_is_visible',
    'browser_count',
    'browser_describe',
    // Navigation
    'browser_navigate',
    'browser_back',
    'browser_forward',
    'browser_reload',
    // Interaction
    'browser_click',
    'browser_type',
    'browser_fill',
    'browser_press',
    'browser_hover',
    'browser_scroll',
    'browser_clear',
    'browser_check',
    'browser_select',
    // Semantic locators
    'browser_get_by_role',
    'browser_get_by_text',
    'browser_get_by_label',
    // Waiting
    'browser_wait',
    'browser_scroll_into_view',
    // Visual
    'browser_screenshot',
    'browser_highlight'
  ],

  /**
   * Full: All capabilities including JS execution
   * Use with caution - includes powerful operations
   */
  full: [
    // All standard tools
    'browser_snapshot',
    'browser_url',
    'browser_title',
    'browser_get_text',
    'browser_get_attribute',
    'browser_is_visible',
    'browser_count',
    'browser_describe',
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
    'browser_highlight',
    // Additional full-level tools
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
