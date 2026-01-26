/**
 * Browser Agent Service
 *
 * Singleton service that manages a shared browser client using the
 * btcp-browser-agent/extension API. This allows both the demo UI (useBrowserDemo)
 * and AI agent tools (browserUsePlugin) to share the same browser session.
 *
 * The client self-discovers the agent - we only work with the Client directly.
 *
 * Usage:
 * - getOrInit() - Get the singleton client, initializing if needed (primary method)
 */

import { loggerService } from '@logger'
import { type Client, createClient } from 'btcp-browser-agent/extension'

const logger = loggerService.withContext('BrowserAgentService')

class BrowserAgentService {
  private static instance: BrowserAgentService | null = null
  private client: Client | null = null
  private initialized = false
  private initPromise: Promise<Client> | null = null

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
   * Get the client, initializing if needed.
   * This is the primary method to access the browser client.
   */
  public async getOrInit(): Promise<Client> {
    console.log('[BrowserAgentService] getOrInit() called', {
      initialized: this.initialized,
      hasClient: !!this.client,
      hasInitPromise: !!this.initPromise
    })

    // Return existing client if initialized
    if (this.initialized && this.client) {
      console.log('[BrowserAgentService] Returning existing client')
      return this.client
    }

    // Return existing promise if initialization is in progress
    if (this.initPromise) {
      console.log('[BrowserAgentService] Initialization in progress, waiting...')
      return this.initPromise
    }

    // Initialize the client
    console.log('[BrowserAgentService] Starting new initialization...')
    this.initPromise = this._doInitialize()
    try {
      const client = await this.initPromise
      console.log('[BrowserAgentService] Initialization completed successfully')
      return client
    } finally {
      this.initPromise = null
    }
  }

  private async _doInitialize(): Promise<Client> {
    try {
      console.log('[BrowserAgentService] _doInitialize() starting, calling createClient()...')
      console.trace('[BrowserAgentService] Stack trace for createClient() call:')
      logger.info('Initializing browser client')
      // createClient() handles session reconnection internally via popupInitialize
      this.client = createClient()
      console.log('[BrowserAgentService] createClient() returned:', !!this.client)
      this.initialized = true
      logger.info('Browser client initialized successfully')
      return this.client
    } catch (error) {
      console.error('[BrowserAgentService] _doInitialize() failed:', error)
      logger.error('Failed to initialize browser client', error as Error)
      this.client = null
      this.initialized = false
      throw error
    }
  }

  /**
   * Get the client if already initialized (sync access)
   * Returns null if not initialized - use getOrInit() for guaranteed access
   */
  public getClient(): Client | null {
    return this.client
  }

  /**
   * Check if service is initialized
   */
  public isInitialized(): boolean {
    return this.initialized && this.client !== null
  }

  /**
   * Reset the service (for testing or cleanup)
   */
  public reset(): void {
    this.client = null
    this.initialized = false
    this.initPromise = null
    logger.debug('BrowserAgentService reset')
  }
}

// Export singleton instance
export const browserAgentService = BrowserAgentService.getInstance()

// Re-export types for convenience
export type { Client } from 'btcp-browser-agent/extension'
