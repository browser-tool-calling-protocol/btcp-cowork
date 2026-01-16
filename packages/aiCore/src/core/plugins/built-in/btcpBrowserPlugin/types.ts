/**
 * BTCP Browser Plugin Types
 *
 * Type definitions for the Browser Tool Calling Protocol plugin configuration
 */

import type { BrowserAgent, BrowserAgentConfig, Response } from 'btcp-browser-agent'

/**
 * Tool names available in the BTCP Browser Plugin
 */
export type BTCPToolName =
  // Navigation
  | 'browser_navigate'
  | 'browser_back'
  | 'browser_forward'
  | 'browser_reload'
  | 'browser_url'
  | 'browser_title'
  // Core Interaction
  | 'browser_click'
  | 'browser_type'
  | 'browser_fill'
  | 'browser_press'
  | 'browser_hover'
  | 'browser_scroll'
  | 'browser_clear'
  | 'browser_check'
  | 'browser_uncheck'
  | 'browser_select'
  // Semantic Locators
  | 'browser_get_by_role'
  | 'browser_get_by_text'
  | 'browser_get_by_label'
  | 'browser_get_by_placeholder'
  // Inspection
  | 'browser_snapshot'
  | 'browser_get_text'
  | 'browser_get_attribute'
  | 'browser_is_visible'
  | 'browser_is_enabled'
  | 'browser_count'
  // Waiting
  | 'browser_wait'
  | 'browser_wait_for_url'
  | 'browser_scroll_into_view'
  // Advanced
  | 'browser_screenshot'
  | 'browser_evaluate'
  | 'browser_frame'
  | 'browser_mainframe'
  // Debugging
  | 'browser_highlight'
  | 'browser_console'
  | 'browser_describe'

/**
 * Tool preset levels for the BTCP Browser Plugin
 */
export type BTCPToolPreset = 'minimal' | 'standard' | 'full'

/**
 * Configuration options for the BTCP Browser Plugin
 */
export interface BTCPBrowserPluginConfig {
  /**
   * Enable/disable the plugin
   * @default true
   */
  enabled?: boolean

  /**
   * Pre-initialized BrowserAgent instance
   * If not provided, tools will be created but agent initialization
   * will be deferred until first use
   */
  agent?: BrowserAgent

  /**
   * BrowserAgent constructor options (used if agent not provided)
   */
  agentOptions?: BrowserAgentConfig

  /**
   * Which tool categories to expose
   * @default 'standard'
   */
  toolset?: BTCPToolPreset | BTCPToolName[]

  /**
   * Maximum snapshot size (characters) to prevent token overflow
   * @default 50000
   */
  maxSnapshotSize?: number

  /**
   * Enable screencast for vision models
   * @default false
   */
  enableScreencast?: boolean

  /**
   * Enable request/console tracking
   * @default false
   */
  enableTracking?: boolean

  /**
   * Callback for tool execution events
   */
  onToolCall?: (toolName: string, args: unknown) => void

  /**
   * Callback for tool results
   */
  onToolResult?: (toolName: string, result: unknown) => void

  /**
   * Callback for tool errors
   */
  onError?: (toolName: string, error: Error) => void

  /**
   * Whether to inject browser-aware system prompt hints
   * @default true
   */
  injectSystemPrompt?: boolean
}

/**
 * Extended request context with BTCP agent
 */
export interface BTCPRequestContext {
  btcpAgent?: BrowserAgent
}

/**
 * Tool execution result wrapper
 */
export interface BTCPToolResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Browser snapshot result
 */
export interface SnapshotResult {
  snapshot: string
  refs?: Record<string, { role: string; name?: string }>
  _truncated?: boolean
  _message?: string
}

/**
 * Screenshot result
 */
export interface ScreenshotResult {
  image: string
  format: string
}

// Re-export BrowserAgent types for convenience
export type { BrowserAgent, BrowserAgentConfig, Response }
