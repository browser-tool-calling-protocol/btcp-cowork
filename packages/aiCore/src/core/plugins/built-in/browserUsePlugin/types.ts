/**
 * BTCP Browser Plugin Types
 *
 * Type definitions for the Browser Tool Calling Protocol plugin configuration.
 * Uses the extension Client for browser automation.
 * The Client self-discovers the agent - we only work with the Client directly.
 */

import type { Client } from 'btcp-browser-agent/extension'

/**
 * Re-export the Client type from btcp-browser-agent/extension
 * This is the actual Client interface used for browser automation
 */
export type ExtensionClient = Client

/**
 * Tool names available in the BTCP Browser Plugin
 */
export type BTCPToolName =
  // Session Management
  | 'browser_launch'
  | 'browser_close'
  // Navigation
  | 'browser_navigate'
  | 'browser_back'
  | 'browser_forward'
  | 'browser_reload'
  // Core Inspection
  | 'browser_snapshot'
  | 'browser_get_text'
  // Core Interaction
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
 * Browser Agent Service interface
 * The service that manages browser client lifecycle
 */
export interface BrowserAgentService {
  /**
   * Get or initialize the browser client
   * @returns Promise resolving to the browser client
   */
  getOrInit(): Promise<ExtensionClient>
}

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
   * Browser agent service instance
   * The plugin will call service.getOrInit() internally
   * Example: browserAgentService
   */
  service?: BrowserAgentService

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
 * Extended request context with BTCP getClient function
 */
export interface BTCPRequestContext {
  btcpGetClient?: () => Promise<ExtensionClient>
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
