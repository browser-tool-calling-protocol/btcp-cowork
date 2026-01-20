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
# Browser Automation Tools (BTCP)

## Quick Start
\`\`\`
browser_navigate("https://example.com")     # Go to page
browser_snapshot({grep: "button"})          # Get buttons with @ref markers
browser_click("@ref:3")                     # Click element by ref
browser_fill("@ref:5", "hello")             # Fill input by ref
browser_screenshot()                        # Capture page
\`\`\`

## Core Workflow

**IMPORTANT: Always use grep to filter snapshots, and @ref:N to interact**

1. Navigate: \`browser_navigate(url)\`
2. Snapshot with filter: \`browser_snapshot({grep: "login"})\` → returns @ref:1, @ref:2...
3. Interact using refs: \`browser_click("@ref:1")\` or \`browser_fill("@ref:2", "text")\`
4. Re-snapshot after actions that change the page

## Tools

### Navigation
- \`browser_navigate(url)\` - Go to URL
- \`browser_back()\` / \`browser_forward()\` - History navigation
- \`browser_reload()\` - Refresh page

### Snapshot
\`browser_snapshot({grep?, mode?, format?})\`
- **grep**: Filter pattern - ALWAYS USE THIS
  - \`"*"\` - Match all elements
  - \`"button"\`, \`"input"\`, \`"nav"\` - Match by keyword
- **mode**: "interaction" (default) | "content" | "outline"
- **format**: "tree" (default) | "markdown"

### Interaction (use @ref:N from snapshot)
- \`browser_click(selector)\` - Click element
- \`browser_fill(selector, value)\` - Fill input instantly
- \`browser_type(selector, text)\` - Type character-by-character
- \`browser_hover(selector)\` - Hover over element
- \`browser_press(key)\` - Press keyboard key (Enter, Tab, Escape)
- \`browser_scroll({direction})\` - Scroll up/down/left/right

### Wait
- \`browser_wait(selector)\` - Wait for element to appear

### Inspection
- \`browser_get_text(selector)\` - Get element text
- \`browser_get_attribute(selector, attr)\` - Get attribute value
- \`browser_is_visible(selector)\` - Check visibility
- \`browser_get_url()\` / \`browser_get_title()\` - Page info

### Visual
- \`browser_screenshot()\` - Capture page image

### Advanced
- \`browser_evaluate(script)\` - Run JavaScript
`.trim()
