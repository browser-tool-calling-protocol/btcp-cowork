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
 * Matches the BrowserAgent public API
 */
export const TOOL_PRESETS: Record<BTCPToolPreset, BTCPToolName[]> = {
  /**
   * Minimal: Safe read-only operations
   * Best for information extraction and page analysis
   */
  minimal: ['browser_snapshot', 'browser_get_text', 'browser_get_url', 'browser_get_title', 'browser_is_visible'],

  /**
   * Standard: Common automation tasks
   * Suitable for most browser automation use cases
   * Note: browser_launch/browser_close excluded - browser auto-launches on first use
   */
  standard: [
    // Navigation
    'browser_navigate',
    // Inspection (matching BrowserAgent API)
    'browser_snapshot',
    'browser_get_text',
    'browser_get_attribute',
    'browser_is_visible',
    'browser_get_url',
    'browser_get_title',
    // Interaction (matching BrowserAgent API)
    'browser_click',
    'browser_type',
    'browser_fill',
    'browser_hover',
    'browser_press',
    'browser_scroll',
    'browser_wait',
    // Visual
    'browser_screenshot'
  ],

  /**
   * Full: All capabilities including JavaScript evaluation
   * Note: browser_launch/browser_close excluded - browser auto-launches on first use
   */
  full: [
    // Navigation
    'browser_navigate',
    'browser_back',
    'browser_forward',
    'browser_reload',
    // Inspection (matching BrowserAgent API)
    'browser_snapshot',
    'browser_get_text',
    'browser_get_attribute',
    'browser_is_visible',
    'browser_get_url',
    'browser_get_title',
    // Interaction (matching BrowserAgent API)
    'browser_click',
    'browser_type',
    'browser_fill',
    'browser_hover',
    'browser_press',
    'browser_scroll',
    'browser_wait',
    'browser_evaluate',
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
 * Matches the BrowserAgent public API
 */
export const BROWSER_SYSTEM_PROMPT = `
You have access to browser automation tools using the Browser Tool Calling Protocol (BTCP).

## Workflow
1. Call browser_snapshot FIRST to get the page structure with element references (@ref:N)
2. Use @ref:N references for reliable element targeting (more stable than CSS selectors)
3. After actions that change the page, call browser_snapshot again
4. Use browser_wait to wait for elements to appear after navigation or interaction

## Element References
Snapshots return refs like @ref:5, @ref:12 that remain stable across actions.
Use these refs instead of CSS selectors when possible.

## Snapshot Options
browser_snapshot({mode?, format?, selector?, maxDepth?, includeHidden?, grep?})

**Mode** (what to capture):
- "interaction" (default) - Captures clickable/interactive elements (buttons, links, inputs)
- "content" - Captures text content for reading/extraction
- "outline" - Captures page structure and layout

**Format** (how to output):
- "tree" (default) - Tree structure with @ref markers for element targeting
- "markdown" - Readable text format for content extraction

**Other options**:
- selector: CSS selector to snapshot specific element
- maxDepth: Limit DOM tree depth
- includeHidden: Include hidden elements like modals/dropdowns
- grep: Filter to lines matching text pattern (e.g., "button", "login")

## Interaction Tools
- browser_click(selector, {button?}) - Click with optional button (left/right/middle)
- browser_type(selector, text, {delay?, clear?}) - Type character-by-character with optional delay
- browser_fill(selector, value) - Fill input instantly (faster than type)
- browser_hover(selector) - Hover over element to trigger tooltips/menus
- browser_press(key, selector?) - Press keyboard key, optionally on specific element
- browser_scroll({selector?, direction, amount?, x?, y?}) - Scroll page or element
- browser_wait(selector, {timeout?, state?}) - Wait for element (visible/hidden)

## Inspection Tools
- browser_get_text(selector) - Get text content of element
- browser_get_attribute(selector, attribute) - Get element attribute value
- browser_is_visible(selector) - Check if element is visible
- browser_get_url() - Get current page URL
- browser_get_title() - Get page title

## Advanced
- browser_evaluate(script) - Execute JavaScript in page context (full preset only)
- browser_screenshot({format?, quality?}) - Take screenshot with format options
`.trim()
