/**
 * Type declarations for btcp-browser-agent
 *
 * These declarations provide the minimal types needed for the BTCP Browser Plugin.
 */

/**
 * Configuration options for BrowserAgent
 */
export interface BrowserAgentConfig {
  targetWindow?: Window
  targetDocument?: Document
  onScreencastFrame?: (frame: unknown) => void
  onResponse?: (response: Response) => void
  autoLaunch?: boolean
  forceContext?: 'browser' | 'extension'
  useExtensionApis?: boolean
}

/**
 * Command structure for browser operations
 */
export interface Command {
  id: string
  action: string
  [key: string]: unknown
}

/**
 * Response from browser operations
 */
export interface Response {
  id: string
  success: boolean
  data?: unknown
  error?: string
}

/**
 * Main BrowserAgent class for browser automation
 */
export declare class BrowserAgent {
  constructor(config?: BrowserAgentConfig)

  /** Launch the browser agent */
  launch(): Promise<void>

  /** Close the browser agent */
  close(): Promise<void>

  /** Execute a command */
  execute(command: Command): Promise<Response>

  /** Get DOM snapshot */
  snapshot(options?: {
    interactive?: boolean
    maxDepth?: number
    compact?: boolean
    selector?: string
  }): Promise<{ snapshot: string; refs?: Record<string, { role: string; name?: string }> }>

  /** Click an element */
  click(selector: string, options?: { button?: 'left' | 'right' | 'middle' }): Promise<void>

  /** Type text into an element */
  type(selector: string, text: string, options?: { delay?: number; clear?: boolean }): Promise<void>

  /** Fill an input element */
  fill(selector: string, value: string): Promise<void>

  /** Hover over an element */
  hover(selector: string): Promise<void>

  /** Press a key */
  press(key: string, selector?: string): Promise<void>

  /** Wait for an element */
  waitFor(selector: string, options?: { timeout?: number; state?: 'visible' | 'hidden' }): Promise<void>

  /** Scroll the page or an element */
  scroll(options: {
    selector?: string
    direction?: 'up' | 'down' | 'left' | 'right'
    amount?: number
    x?: number
    y?: number
  }): Promise<void>

  /** Evaluate JavaScript */
  evaluate<T = unknown>(script: string): Promise<T>

  /** Get element text */
  getText(selector: string): Promise<string | null>

  /** Get element attribute */
  getAttribute(selector: string, attribute: string): Promise<string | null>

  /** Check if element is visible */
  isVisible(selector: string): Promise<boolean>

  /** Get current URL */
  getUrl(): Promise<string>

  /** Get page title */
  getTitle(): Promise<string>

  /** Take a screenshot */
  screenshot(options?: { format?: 'png' | 'jpeg'; quality?: number }): Promise<{ screenshot: string; format: string }>
}

/**
 * Generate a unique command ID
 */
export declare function generateCommandId(): string

/**
 * Get description/documentation for actions
 */
export declare function describe(action?: string): {
  actions?: string[]
  methods?: Array<{ name: string; signature: string }>
  quickRef?: string
  action?: { name: string; parameters: unknown[] }
}
