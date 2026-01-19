/**
 * Browser Agent Service
 *
 * Singleton service that manages a shared browser agent client using the
 * btcp-browser-agent/extension API. This allows both the demo UI (useBrowserDemo)
 * and AI agent tools (browserUsePlugin) to share the same browser session.
 *
 * Session Lifecycle:
 * 1. initialize() - Call once on app start to set up the client
 * 2. getClient() - Get the shared client instance for browser operations
 * 3. ensureSession() - Create or get the active session group
 * 4. closeSession() - Clean up the session when done
 */

import { loggerService } from '@logger'
import { type Client, createClient } from 'btcp-browser-agent/extension'

const logger = loggerService.withContext('BrowserAgentService')

class BrowserAgentService {
  private static instance: BrowserAgentService | null = null
  private client: Client | null = null
  private initialized = false
  private sessionGroupId: number | null = null
  private initPromise: Promise<void> | null = null

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of BrowserAgentService
   */
  public static getInstance(): BrowserAgentService {
    if (!BrowserAgentService.instance) {
      BrowserAgentService.instance = new BrowserAgentService()
    }
    return BrowserAgentService.instance
  }

  /**
   * Initialize the browser agent client
   * Safe to call multiple times - will only initialize once
   */
  public async initialize(): Promise<void> {
    // Return existing promise if initialization is in progress
    if (this.initPromise) {
      return this.initPromise
    }

    // Already initialized
    if (this.initialized && this.client) {
      return
    }

    this.initPromise = this._doInitialize()
    try {
      await this.initPromise
    } finally {
      this.initPromise = null
    }
  }

  private async _doInitialize(): Promise<void> {
    try {
      logger.info('Initializing browser agent client')
      this.client = createClient()
      await this.client.popupInitialize()
      this.initialized = true
      logger.info('Browser agent client initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize browser agent client', error as Error)
      this.client = null
      this.initialized = false
      throw error
    }
  }

  /**
   * Get the shared browser client instance
   * @throws Error if service is not initialized
   */
  public getClient(): Client {
    if (!this.client) {
      throw new Error('BrowserAgentService not initialized. Call initialize() first.')
    }
    return this.client
  }

  /**
   * Check if service is initialized
   */
  public isInitialized(): boolean {
    return this.initialized && this.client !== null
  }

  /**
   * Ensure a session exists, creating one if needed
   * @returns The session group ID
   */
  public async ensureSession(): Promise<number> {
    const client = this.getClient()

    // Check for existing session
    const { session: existingSession } = await client.sessionGetCurrent()
    if (existingSession) {
      this.sessionGroupId = existingSession.groupId
      logger.info('Using existing session', { groupId: this.sessionGroupId })
      return this.sessionGroupId
    }

    // Create new session
    logger.info('Creating new browser session')
    const { group } = await client.groupCreate()
    this.sessionGroupId = group.id
    logger.info('Browser session created', { groupId: this.sessionGroupId })

    // Get tabs in the session and switch to the first one
    const tabs = await client.tabList()
    if (tabs.length > 0) {
      await client.tabSwitch(tabs[0].id)
      logger.debug('Switched to session tab', { tabId: tabs[0].id })
    }

    return this.sessionGroupId
  }

  /**
   * Get the current session group ID (if any)
   */
  public getSessionGroupId(): number | null {
    return this.sessionGroupId
  }

  /**
   * Close the current session
   */
  public async closeSession(): Promise<void> {
    if (!this.sessionGroupId || !this.client) {
      return
    }

    try {
      logger.info('Closing browser session', { groupId: this.sessionGroupId })
      await this.client.groupDelete(this.sessionGroupId)
      this.sessionGroupId = null
      logger.info('Browser session closed')
    } catch (error) {
      logger.error('Failed to close browser session', error as Error)
      // Reset session ID even on error to avoid stale state
      this.sessionGroupId = null
      throw error
    }
  }

  /**
   * Reset the service (for testing or cleanup)
   */
  public reset(): void {
    this.client = null
    this.initialized = false
    this.sessionGroupId = null
    this.initPromise = null
    logger.debug('BrowserAgentService reset')
  }
}

// Export singleton instance
export const browserAgentService = BrowserAgentService.getInstance()

// Re-export types for convenience
export type { Client } from 'btcp-browser-agent/extension'
