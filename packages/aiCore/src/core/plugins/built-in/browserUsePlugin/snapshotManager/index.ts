/**
 * Browser Session Snapshot Manager
 *
 * Background mechanism for capturing page snapshots at intervals or after actions,
 * computing diffs to track changes, and running indexing/summarization (placeholder).
 *
 * Features:
 * - Interval-based snapshot capture
 * - Action-triggered snapshot capture (with debouncing)
 * - Simple diff computation to track content changes
 * - Placeholder indexing/summarization processor
 *
 * Usage:
 * ```typescript
 * import { BrowserSessionSnapshotManager } from './snapshotManager'
 *
 * const manager = new BrowserSessionSnapshotManager({
 *   enabled: true,
 *   intervalMs: 30000,
 *   captureAfterActions: true,
 *   onSnapshot: (snapshot) => console.log('Snapshot captured:', snapshot.id),
 *   onDiff: (diff) => console.log('Change detected:', diff.contentChangeRatio)
 * })
 *
 * // Provide the client getter
 * manager.setClientGetter(async () => browserAgentService.getOrInit())
 *
 * // Start capturing
 * await manager.start()
 *
 * // Notify of actions (hook into browserUsePlugin callbacks)
 * manager.notifyAction('browser_click', { selector: '@ref:1' })
 *
 * // Stop when done
 * manager.stop()
 * ```
 */

import type { ExtensionClient } from '../types'
import {
  type BrowserSnapshot,
  type SnapshotDiff,
  type SnapshotIndexResult,
  type SnapshotManagerConfig,
  type SnapshotManagerState,
  type SnapshotTrigger,
  DEFAULT_SNAPSHOT_CONFIG
} from './types'

/**
 * Generate a unique snapshot ID
 */
function generateSnapshotId(): string {
  return `snap_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Simple line-based diff computation
 * Returns an approximation of how much content changed between two strings
 */
function computeContentDiff(
  oldContent: string,
  newContent: string
): { changeRatio: number; linesAdded: number; linesRemoved: number } {
  const oldLines = new Set(oldContent.split('\n').map((l) => l.trim()).filter(Boolean))
  const newLines = new Set(newContent.split('\n').map((l) => l.trim()).filter(Boolean))

  let linesAdded = 0
  let linesRemoved = 0

  // Count lines added (in new but not in old)
  for (const line of newLines) {
    if (!oldLines.has(line)) {
      linesAdded++
    }
  }

  // Count lines removed (in old but not in new)
  for (const line of oldLines) {
    if (!newLines.has(line)) {
      linesRemoved++
    }
  }

  // Calculate change ratio based on total unique lines
  const totalLines = Math.max(oldLines.size, newLines.size, 1)
  const changeRatio = (linesAdded + linesRemoved) / (totalLines * 2) // Normalize to 0-1 range

  return {
    changeRatio: Math.min(changeRatio, 1), // Cap at 1
    linesAdded,
    linesRemoved
  }
}

/**
 * Browser Session Snapshot Manager
 *
 * Manages background snapshot capture for browser sessions
 */
export class BrowserSessionSnapshotManager {
  private config: Required<Omit<SnapshotManagerConfig, 'onSnapshot' | 'onDiff' | 'onIndexComplete'>> &
    Pick<SnapshotManagerConfig, 'onSnapshot' | 'onDiff' | 'onIndexComplete'>
  private state: SnapshotManagerState
  private intervalHandle: ReturnType<typeof setInterval> | null = null
  private getClient: (() => Promise<ExtensionClient>) | null = null

  constructor(config: SnapshotManagerConfig = {}) {
    this.config = {
      ...DEFAULT_SNAPSHOT_CONFIG,
      ...config
    }

    this.state = {
      isRunning: false,
      snapshots: [],
      diffs: [],
      lastSnapshotTime: null,
      lastActionTime: null,
      pendingIndexing: []
    }
  }

  /**
   * Set the client getter function
   * This should be called before start() to provide access to the browser client
   */
  setClientGetter(getter: () => Promise<ExtensionClient>): void {
    this.getClient = getter
  }

  /**
   * Start the snapshot manager
   * Begins interval-based capture if configured
   */
  async start(): Promise<void> {
    if (this.state.isRunning) {
      console.log('[SnapshotManager] Already running')
      return
    }

    if (!this.config.enabled) {
      console.log('[SnapshotManager] Not enabled, skipping start')
      return
    }

    if (!this.getClient) {
      console.warn('[SnapshotManager] No client getter set, cannot start')
      return
    }

    console.log('[SnapshotManager] Starting snapshot manager', {
      intervalMs: this.config.intervalMs,
      captureAfterActions: this.config.captureAfterActions
    })

    this.state.isRunning = true

    // Capture initial snapshot
    await this.captureSnapshot('initial')

    // Start interval if configured
    if (this.config.intervalMs > 0) {
      this.intervalHandle = setInterval(async () => {
        if (this.state.isRunning) {
          await this.captureSnapshot('interval')
        }
      }, this.config.intervalMs)
    }
  }

  /**
   * Stop the snapshot manager
   */
  stop(): void {
    console.log('[SnapshotManager] Stopping snapshot manager')

    this.state.isRunning = false

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
  }

  /**
   * Notify the manager of a browser action
   * Triggers a snapshot capture if configured and not debounced
   */
  async notifyAction(actionName: string, _args?: unknown): Promise<void> {
    if (!this.state.isRunning || !this.config.captureAfterActions) {
      return
    }

    // Check if this action type triggers snapshots
    if (!this.config.actionTriggers.includes(actionName)) {
      return
    }

    // Check debounce
    const now = Date.now()
    if (this.state.lastActionTime && now - this.state.lastActionTime < this.config.actionDebounceMs) {
      console.log('[SnapshotManager] Action debounced, skipping snapshot')
      return
    }

    this.state.lastActionTime = now

    // Delay slightly to allow DOM to update
    await new Promise((resolve) => setTimeout(resolve, 100))

    await this.captureSnapshot('action', actionName)
  }

  /**
   * Manually trigger a snapshot capture
   */
  async captureManual(): Promise<BrowserSnapshot | null> {
    return this.captureSnapshot('manual')
  }

  /**
   * Capture a snapshot
   */
  private async captureSnapshot(trigger: SnapshotTrigger, triggerAction?: string): Promise<BrowserSnapshot | null> {
    if (!this.getClient) {
      console.warn('[SnapshotManager] No client getter, cannot capture snapshot')
      return null
    }

    try {
      const client = await this.getClient()

      // Capture snapshot data in parallel where possible
      const [url, title, content] = await Promise.all([
        client.getUrl(),
        client.getTitle(),
        client.snapshot({ mode: this.config.snapshotMode })
      ])

      const snapshot: BrowserSnapshot = {
        id: generateSnapshotId(),
        timestamp: Date.now(),
        url,
        title,
        content,
        mode: this.config.snapshotMode,
        trigger,
        triggerAction
      }

      console.log(`[SnapshotManager] Captured snapshot: ${snapshot.id} (trigger: ${trigger})`, {
        url: snapshot.url,
        contentLength: snapshot.content.length
      })

      // Add to history
      this.state.snapshots.push(snapshot)
      this.state.lastSnapshotTime = snapshot.timestamp

      // Trim history if needed
      while (this.state.snapshots.length > this.config.maxHistorySize) {
        this.state.snapshots.shift()
      }

      // Compute diff with previous snapshot
      if (this.state.snapshots.length >= 2) {
        const prevSnapshot = this.state.snapshots[this.state.snapshots.length - 2]
        const diff = this.computeDiff(prevSnapshot, snapshot)
        this.state.diffs.push(diff)

        // Trim diffs history
        while (this.state.diffs.length > this.config.maxHistorySize) {
          this.state.diffs.shift()
        }

        // Notify callback
        this.config.onDiff?.(diff)

        // Trigger indexing if significant change
        if (this.config.enableIndexing && diff.isSignificant) {
          this.queueIndexing(snapshot)
        }
      }

      // Notify callback
      this.config.onSnapshot?.(snapshot)

      return snapshot
    } catch (error) {
      console.error('[SnapshotManager] Failed to capture snapshot', error)
      return null
    }
  }

  /**
   * Compute diff between two snapshots
   */
  private computeDiff(previous: BrowserSnapshot, current: BrowserSnapshot): SnapshotDiff {
    const urlChanged = previous.url !== current.url
    const titleChanged = previous.title !== current.title
    const contentDiff = computeContentDiff(previous.content, current.content)

    const isSignificant =
      urlChanged || titleChanged || contentDiff.changeRatio >= this.config.significantChangeThreshold

    const diff: SnapshotDiff = {
      previousSnapshotId: previous.id,
      currentSnapshotId: current.id,
      timestamp: Date.now(),
      urlChanged,
      titleChanged,
      contentChangeRatio: contentDiff.changeRatio,
      linesAdded: contentDiff.linesAdded,
      linesRemoved: contentDiff.linesRemoved,
      isSignificant
    }

    console.log(`[SnapshotManager] Computed diff: ${previous.id} -> ${current.id}`, {
      urlChanged,
      titleChanged,
      changeRatio: contentDiff.changeRatio.toFixed(2),
      isSignificant
    })

    return diff
  }

  /**
   * Queue a snapshot for indexing/summarization (placeholder)
   */
  private queueIndexing(snapshot: BrowserSnapshot): void {
    console.log(`[SnapshotManager] Queueing snapshot for indexing: ${snapshot.id}`)
    this.state.pendingIndexing.push(snapshot.id)

    // Process indexing asynchronously
    this.processIndexing(snapshot).catch((error) => {
      console.error('[SnapshotManager] Indexing failed', error)
    })
  }

  /**
   * Process indexing/summarization for a snapshot (placeholder)
   *
   * This is a placeholder for future AI-powered indexing/summarization.
   * Implementation could include:
   * - Extract key entities (forms, buttons, links, content areas)
   * - Generate natural language summary of page state
   * - Build searchable index for conversation context
   * - Detect patterns and state changes
   */
  private async processIndexing(snapshot: BrowserSnapshot): Promise<SnapshotIndexResult> {
    const result: SnapshotIndexResult = {
      snapshotId: snapshot.id,
      timestamp: Date.now(),
      status: 'processing'
    }

    try {
      // PLACEHOLDER: Actual indexing logic would go here
      // For now, extract some basic "entities" from the content
      const entities = this.extractBasicEntities(snapshot.content)

      // PLACEHOLDER: Generate a simple summary
      const summary = this.generatePlaceholderSummary(snapshot)

      result.status = 'completed'
      result.entities = entities
      result.summary = summary

      console.log(`[SnapshotManager] Indexing completed for: ${snapshot.id}`, {
        entityCount: entities.length,
        summary: summary.substring(0, 100)
      })

      // Remove from pending
      this.state.pendingIndexing = this.state.pendingIndexing.filter((id) => id !== snapshot.id)

      // Notify callback
      this.config.onIndexComplete?.(result)

      return result
    } catch (error) {
      result.status = 'failed'
      result.error = error instanceof Error ? error.message : String(error)

      // Remove from pending
      this.state.pendingIndexing = this.state.pendingIndexing.filter((id) => id !== snapshot.id)

      this.config.onIndexComplete?.(result)

      return result
    }
  }

  /**
   * Extract basic entities from snapshot content (placeholder)
   *
   * This is a very basic extraction for demonstration.
   * A real implementation would use more sophisticated NLP/pattern matching.
   */
  private extractBasicEntities(content: string): string[] {
    const entities: string[] = []
    const lines = content.split('\n')

    for (const line of lines) {
      // Extract @ref markers
      const refMatch = line.match(/@ref:\d+/)
      if (refMatch) {
        entities.push(refMatch[0])
      }

      // Extract role types
      const roleMatch = line.match(/role='(\w+)'/)
      if (roleMatch && !entities.includes(roleMatch[1])) {
        entities.push(roleMatch[1])
      }
    }

    // Limit entities
    return entities.slice(0, 50)
  }

  /**
   * Generate a placeholder summary (placeholder for AI summarization)
   */
  private generatePlaceholderSummary(snapshot: BrowserSnapshot): string {
    const lineCount = snapshot.content.split('\n').length
    const refCount = (snapshot.content.match(/@ref:\d+/g) || []).length

    return `Page at ${snapshot.url} with title "${snapshot.title}". ` +
      `Snapshot contains ${lineCount} lines and ${refCount} interactive elements. ` +
      `Captured via ${snapshot.trigger} trigger.`
  }

  // --- Getters for state access ---

  /**
   * Get current state
   */
  getState(): SnapshotManagerState {
    return { ...this.state }
  }

  /**
   * Get snapshot history
   */
  getSnapshots(): BrowserSnapshot[] {
    return [...this.state.snapshots]
  }

  /**
   * Get diff history
   */
  getDiffs(): SnapshotDiff[] {
    return [...this.state.diffs]
  }

  /**
   * Get the most recent snapshot
   */
  getLatestSnapshot(): BrowserSnapshot | null {
    return this.state.snapshots[this.state.snapshots.length - 1] || null
  }

  /**
   * Get the most recent diff
   */
  getLatestDiff(): SnapshotDiff | null {
    return this.state.diffs[this.state.diffs.length - 1] || null
  }

  /**
   * Check if manager is running
   */
  isRunning(): boolean {
    return this.state.isRunning
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SnapshotManagerConfig>): void {
    const wasRunning = this.state.isRunning
    const oldInterval = this.config.intervalMs

    // Update config
    Object.assign(this.config, config)

    // Restart interval if it changed while running
    if (wasRunning && config.intervalMs !== undefined && config.intervalMs !== oldInterval) {
      if (this.intervalHandle) {
        clearInterval(this.intervalHandle)
        this.intervalHandle = null
      }

      if (this.config.intervalMs > 0) {
        this.intervalHandle = setInterval(async () => {
          if (this.state.isRunning) {
            await this.captureSnapshot('interval')
          }
        }, this.config.intervalMs)
      }
    }
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.state.snapshots = []
    this.state.diffs = []
    this.state.pendingIndexing = []
    console.log('[SnapshotManager] History cleared')
  }
}

// Re-export types
export * from './types'
