/**
 * BTCP Browser Plugin Types
 *
 * Type definitions for the Browser Tool Calling Protocol plugin configuration.
 * Uses the extension Client for browser automation.
 * The Client self-discovers the agent - we only work with the Client directly.
 */

/**
 * Client interface from btcp-browser-agent/extension
 * Used for browser automation via the singleton BrowserAgentService
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
 * Configuration options for the BTCP Browser Plugin
 */
export interface BTCPBrowserPluginConfig {
  /**
   * Enable/disable the plugin
   * @default true
   */
  enabled?: boolean

  /**
   * Function to get the browser client from BrowserAgentService
   * Called by tools when they need the client
   * Example: () => browserAgentService.getOrInit()
   */
  getClient?: () => Promise<ExtensionClient>

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
