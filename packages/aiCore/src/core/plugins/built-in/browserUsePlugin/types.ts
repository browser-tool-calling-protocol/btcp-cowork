/**
 * BTCP Browser Plugin Types
 *
 * Type definitions for the Browser Tool Calling Protocol plugin configuration.
 * Uses the extension Client for browser automation.
 * The Client self-discovers the agent - we only work with the Client directly.
 */

import type { SnapshotManagerConfig } from './snapshotManager/types'

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
  back(): Promise<unknown>
  forward(): Promise<unknown>
  reload(): Promise<unknown>

  // DOM snapshot - matching BrowserAgent API
  snapshot(options?: {
    grep?: string
    mode?: 'interaction' | 'content' | 'outline'
    format?: 'tree' | 'markdown'
  }): Promise<string>

  // Interaction - matching BrowserAgent API
  click(selector: string, options?: { button?: 'left' | 'right' | 'middle' }): Promise<void>
  type(selector: string, text: string, options?: { delay?: number; clear?: boolean }): Promise<void>
  fill(selector: string, value: string): Promise<void>
  hover(selector: string): Promise<void>
  press(key: string, selector?: string): Promise<void>
  waitFor(selector: string, options?: { timeout?: number; state?: 'visible' | 'hidden' }): Promise<void>
  wait(options?: { selector?: string; timeout?: number }): Promise<unknown>
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
 */
export type BTCPToolName =
  | 'browser_launch'
  | 'browser_close'
  | 'browser_navigate'
  | 'browser_back'
  | 'browser_forward'
  | 'browser_reload'
  | 'browser_snapshot'
  | 'browser_get_text'
  | 'browser_get_attribute'
  | 'browser_is_visible'
  | 'browser_get_url'
  | 'browser_get_title'
  | 'browser_click'
  | 'browser_type'
  | 'browser_fill'
  | 'browser_hover'
  | 'browser_press'
  | 'browser_scroll'
  | 'browser_wait'
  | 'browser_evaluate'
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
   */
  getOrInit(): Promise<ExtensionClient>
}

/**
 * AI Service interface for snapshot summarization
 * Simple function that takes a prompt and returns a response string
 */
export interface AiService {
  /**
   * Generate text from a prompt
   * @param prompt - The prompt to send to the AI
   * @returns Promise resolving to the AI response string
   */
  generateText(prompt: string): Promise<string>
}

/**
 * Simplified configuration for the BTCP Browser Plugin
 *
 * @example
 * ```typescript
 * browserUsePlugin({
 *   browserAgentService,
 *   aiService
 * })
 * ```
 */
export interface BTCPBrowserPluginConfig {
  /**
   * Browser agent service instance (required)
   * Provides browser automation capabilities
   */
  browserAgentService: BrowserAgentService

  /**
   * AI service for snapshot summarization (optional)
   * When provided, enables background snapshot tracking with AI summaries
   */
  aiService?: AiService

  /**
   * Which tool categories to expose
   * @default 'standard'
   */
  toolset?: BTCPToolPreset | BTCPToolName[]

  /**
   * Callback when a snapshot summary is generated
   */
  onSnapshotSummary?: (summary: string) => void
}

/**
 * Forward declaration for snapshot manager type
 */
export interface BrowserSessionSnapshotManagerInterface {
  start(): Promise<void>
  stop(): void
  isRunning(): boolean
  notifyAction(actionName: string, args?: unknown): Promise<void>
  captureManual(): Promise<unknown>
  summarizeSnapshot(snapshotId: string): Promise<unknown>
  getSnapshots(): unknown[]
  getSummarizedSnapshots(): unknown[]
  getDiffs(): unknown[]
  getLatestSnapshot(): unknown
  getLatestSummarizedSnapshot(): unknown
  getLatestDiff(): unknown
  getState(): unknown
  updateConfig(config: Partial<SnapshotManagerConfig>): void
  clearHistory(): void
}

/**
 * Extended request context with BTCP getClient function
 */
export interface BTCPRequestContext {
  btcpGetClient?: () => Promise<ExtensionClient>
  btcpSnapshotManager?: BrowserSessionSnapshotManagerInterface
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
