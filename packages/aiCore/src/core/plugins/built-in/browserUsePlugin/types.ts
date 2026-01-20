/**
 * BTCP Browser Plugin Types
 *
 * Type definitions for the Browser Tool Calling Protocol plugin configuration.
 * Uses the extension Client for browser automation.
 * The Client self-discovers the agent - we only work with the Client directly.
 */

/**
 * Extension Client interface matching the BrowserAgent public API
 * This defines the full set of methods available for browser automation
 */
export interface ExtensionClient {
  // Low-level command execution
  execute(command: { id?: string; action: string; [key: string]: unknown }): Promise<unknown>

  // Session management
  sessionGetCurrent(): Promise<{ session?: { groupId: number } }>
  groupCreate(): Promise<{ group: { id: number } }>

  // Tab operations
  tabNew(options?: { url?: string; active?: boolean }): Promise<unknown>
  tabSwitch(tabId: number): Promise<unknown>

  // Navigation
  navigate(url: string): Promise<unknown>

  // DOM snapshot - matching BrowserAgent API
  snapshot(options?: { mode?: 'interaction' | 'content' | 'outline'; format?: 'tree' | 'markdown' }): Promise<string>

  // Interaction - matching BrowserAgent API
  click(selector: string, options?: { button?: 'left' | 'right' | 'middle' }): Promise<void>
  type(selector: string, text: string, options?: { delay?: number; clear?: boolean }): Promise<void>
  fill(selector: string, value: string): Promise<void>
  hover(selector: string): Promise<void>
  press(key: string, selector?: string): Promise<void>
  waitFor(selector: string, options?: { timeout?: number; state?: 'visible' | 'hidden' }): Promise<void>
  scroll(options: {
    selector?: string
    direction?: 'up' | 'down' | 'left' | 'right'
    amount?: number
    x?: number
    y?: number
  }): Promise<void>

  // JavaScript evaluation - matching BrowserAgent API
  evaluate<T = unknown>(script: string): Promise<T>

  // Element inspection - matching BrowserAgent API
  getText(selector: string): Promise<string | null>
  getAttribute(selector: string, attribute: string): Promise<string | null>
  isVisible(selector: string): Promise<boolean>

  // Page information - matching BrowserAgent API
  getUrl(): Promise<string>
  getTitle(): Promise<string>

  // Screenshot - matching BrowserAgent API
  screenshot(options?: { format?: 'png' | 'jpeg'; quality?: number }): Promise<string>
}

/**
 * Tool names available in the BTCP Browser Plugin
 * Matches the BrowserAgent public API
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
  // Inspection (matching BrowserAgent API)
  | 'browser_snapshot'
  | 'browser_get_text'
  | 'browser_get_attribute'
  | 'browser_is_visible'
  | 'browser_get_url'
  | 'browser_get_title'
  // Interaction (matching BrowserAgent API)
  | 'browser_click'
  | 'browser_type'
  | 'browser_fill'
  | 'browser_hover'
  | 'browser_press'
  | 'browser_scroll'
  | 'browser_wait'
  | 'browser_evaluate'
  // Visual
  | 'browser_screenshot'

/**
 * Tool preset levels for the BTCP Browser Plugin
 */
export type BTCPToolPreset = 'minimal' | 'standard' | 'full'

/**
 * Browser Agent Service interface
 * The service that manages browser client lifecycle and sessions
 *
 * Note: getOrInit returns a generic client type to allow compatibility with
 * different client implementations (e.g., btcp-browser-agent/extension Client)
 */
export interface BrowserAgentService {
  /**
   * Get or initialize the browser client
   * @returns Promise resolving to the browser client (ExtensionClient compatible)
   */
  getOrInit(): Promise<ExtensionClient | unknown>

  /**
   * Ensure a browser session exists (creates one if needed)
   * @returns Promise resolving to the session group ID
   */
  ensureSession(): Promise<number>
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
   * The plugin will call service.getOrInit() and service.ensureSession() internally
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
