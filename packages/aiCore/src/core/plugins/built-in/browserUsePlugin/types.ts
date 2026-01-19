/**
 * BTCP Browser Plugin Types
 *
 * Type definitions for the Browser Tool Calling Protocol plugin configuration.
 * Uses the two-layer architecture:
 * - BrowserAgent: Browser-level operations (tabs, navigation, screenshots)
 * - ContentAgent: DOM operations (click, fill, type, snapshot, etc.)
 *
 * Supports two modes:
 * - Standalone: Uses BrowserAgent for direct browser control
 * - Extension: Uses Client from btcp-browser-agent/extension for shared sessions
 */

import type { BrowserAgent, BrowserAgentConfig } from './btcp-browser-agent'

/**
 * Client interface from btcp-browser-agent/extension
 * Used for shared browser sessions between demo UI and AI agent tools
 *
 * Note: This interface matches the actual Client type from btcp-browser-agent/extension.
 * Operations like press and scroll are done via the execute() method.
 */
export interface ExtensionClient {
  popupInitialize(): Promise<void>
  sessionGetCurrent(): Promise<{ session: { groupId: number } | null }>
  groupCreate(): Promise<{ group: { id: number } }>
  groupDelete(groupId: number): Promise<void>
  tabList(): Promise<Array<{ id: number }>>
  tabNew(): Promise<{ id: number }>
  tabSwitch(tabId: number): Promise<void>
  navigate(url: string): Promise<unknown>
  snapshot(options?: { format?: 'tree' }): Promise<{ tree: string }>
  click(selector: string): Promise<void>
  type(selector: string, text: string): Promise<void>
  fill(selector: string, value: string): Promise<void>
  screenshot(): Promise<{ screenshot: string }>
  getText(selector: string): Promise<string | null>
  execute(command: { id: string; action: string; [key: string]: unknown }): Promise<unknown>
}

/**
 * Tool names available in the BTCP Browser Plugin
 * Minimal set of tools matching the btcp-browser-agent core API
 */
export type BTCPToolName =
  // Session/Tab Management (BrowserAgent)
  | 'browser_launch'
  | 'browser_close'
  // Navigation (BrowserAgent)
  | 'browser_navigate'
  | 'browser_back'
  | 'browser_forward'
  | 'browser_reload'
  // Core Inspection (ContentAgent)
  | 'browser_snapshot'
  | 'browser_get_text'
  // Core Interaction (ContentAgent)
  | 'browser_click'
  | 'browser_type'
  | 'browser_fill'
  | 'browser_press'
  | 'browser_scroll'
  // Visual
  | 'browser_screenshot'

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
   * Pre-initialized BrowserAgent instance (standalone mode)
   * If not provided, agent initialization will be deferred until first use
   */
  agent?: BrowserAgent

  /**
   * Extension client instance (extension mode)
   * Used for shared sessions between demo UI and AI agent tools
   * Takes priority over agent if both are provided
   */
  client?: ExtensionClient

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
export type { BrowserAgent, BrowserAgentConfig }
