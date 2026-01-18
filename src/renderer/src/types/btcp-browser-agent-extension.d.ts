/**
 * Type declarations for btcp-browser-agent/extension
 *
 * These declarations provide types for the BTCP browser agent client API
 * used in Chrome extension contexts.
 */

declare module 'btcp-browser-agent/extension' {
  /**
   * Tab information
   */
  export interface TabInfo {
    id: number
    url?: string
    title?: string
    active?: boolean
  }

  /**
   * Tab group information
   */
  export interface TabGroup {
    id: number
    title?: string
    color?: string
    collapsed?: boolean
  }

  /**
   * Session information
   */
  export interface Session {
    groupId: number
    tabIds: number[]
  }

  /**
   * Snapshot options
   */
  export interface SnapshotOptions {
    format?: 'tree' | 'json'
    interactive?: boolean
    maxDepth?: number
  }

  /**
   * Snapshot result
   */
  export interface SnapshotResult {
    tree: string
    refs?: Record<string, { role: string; name?: string }>
  }

  /**
   * Screenshot result
   */
  export interface ScreenshotResult {
    screenshot: string
    format: string
  }

  /**
   * Command structure
   */
  export interface Command {
    id: string
    action: string
    [key: string]: unknown
  }

  /**
   * BTCP Browser Agent Client
   *
   * Provides a high-level API for browser automation through Chrome extension messaging.
   */
  export interface BTCPClient {
    // === Popup/Extension Lifecycle ===
    /** Initialize the popup connection */
    popupInitialize(): Promise<void>

    // === Session Management ===
    /** Get current session */
    sessionGetCurrent(): Promise<{ session: Session | null }>

    // === Tab Group Management ===
    /** Create a new tab group */
    groupCreate(): Promise<{ group: TabGroup }>

    /** Delete a tab group */
    groupDelete(groupId: number): Promise<void>

    // === Tab Management ===
    /** List tabs in current session */
    tabList(): Promise<TabInfo[]>

    /** Create a new tab */
    tabNew(url?: string): Promise<TabInfo>

    /** Switch to a tab */
    tabSwitch(tabId: number): Promise<void>

    /** Close a tab */
    tabClose(tabId: number): Promise<void>

    // === Navigation ===
    /** Navigate to a URL */
    navigate(url: string): Promise<{ success: boolean; url: string }>

    /** Go back in history */
    back(): Promise<void>

    /** Go forward in history */
    forward(): Promise<void>

    /** Reload the page */
    reload(): Promise<void>

    // === DOM Operations ===
    /** Get page snapshot */
    snapshot(options?: SnapshotOptions): Promise<SnapshotResult>

    /** Click an element */
    click(selector: string): Promise<void>

    /** Type text into an element */
    type(selector: string, text: string): Promise<void>

    /** Fill an input field */
    fill(selector: string, value: string): Promise<void>

    /** Press a key */
    press(key: string): Promise<void>

    /** Scroll the page */
    scroll(options: { direction: 'up' | 'down'; amount?: number }): Promise<void>

    /** Get text from an element */
    getText(selector: string): Promise<string>

    // === Visual ===
    /** Take a screenshot */
    screenshot(): Promise<ScreenshotResult>

    // === Low-level Command Execution ===
    /** Execute a raw command */
    execute(command: Command): Promise<unknown>
  }

  /**
   * Create a BTCP client for browser automation
   */
  export function createClient(): BTCPClient
}
