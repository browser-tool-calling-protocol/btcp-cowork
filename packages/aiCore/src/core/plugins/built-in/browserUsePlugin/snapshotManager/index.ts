/**
 * Browser Session Snapshot Manager
 *
 * Hook-based mechanism for capturing page snapshots after browser actions
 * and computing diffs to track changes.
 *
 * Features:
 * - Action-triggered snapshot capture (with debouncing)
 * - Simple diff computation to track content changes
 *
 * Usage:
 * ```typescript
 * import { BrowserSessionSnapshotManager } from './snapshotManager'
 *
 * const manager = new BrowserSessionSnapshotManager({
 *   enabled: true,
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
  DEFAULT_SNAPSHOT_CONFIG,
  type SnapshotDiff,
  type SnapshotManagerConfig,
  type SnapshotManagerState,
  type SnapshotTrigger
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
  const oldLines = new Set(
    oldContent
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  )
  const newLines = new Set(
    newContent
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  )

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
  private config: Required<Omit<SnapshotManagerConfig, 'onSnapshot' | 'onDiff'>> &
    Pick<SnapshotManagerConfig, 'onSnapshot' | 'onDiff'>
  private state: SnapshotManagerState
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
      lastActionTime: null
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
   * Captures an initial snapshot and begins listening for action-triggered snapshots
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
      captureAfterActions: this.config.captureAfterActions
    })

    this.state.isRunning = true

    // Capture initial snapshot with retry - wait for content script to be ready
    await this.captureInitialSnapshotWithRetry()
  }

  /**
   * Capture initial snapshot with retry logic
   * Waits for content script to be ready with exponential backoff
   */
  private async captureInitialSnapshotWithRetry(): Promise<void> {
    const maxAttempts = 10
    const initialDelay = 100 // Start with 100ms
    const maxDelay = 5000 // Max 5 seconds between attempts

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[SnapshotManager] Attempting initial snapshot (attempt ${attempt}/${maxAttempts})`)
        const snapshot = await this.captureSnapshot('initial')

        if (snapshot) {
          console.log('[SnapshotManager] Initial snapshot captured successfully')
          return
        }
      } catch (error) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay)
        console.log(`[SnapshotManager] Initial snapshot attempt ${attempt} failed, retrying in ${delay}ms...`, error)

        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delay))
        } else {
          console.error('[SnapshotManager] Failed to capture initial snapshot after all retry attempts')
        }
      }
    }
  }

  /**
   * Stop the snapshot manager
   */
  stop(): void {
    console.log('[SnapshotManager] Stopping snapshot manager')
    this.state.isRunning = false
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
        client.snapshot({ mode: this.config.snapshotMode, format: 'tree' })
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

      // Get previous snapshot for diff
      const prevSnapshot =
        this.state.snapshots.length >= 2 ? this.state.snapshots[this.state.snapshots.length - 2] : undefined

      // Compute diff with previous snapshot
      let diff: SnapshotDiff | undefined
      if (prevSnapshot) {
        diff = this.computeDiff(prevSnapshot, snapshot)
        this.state.diffs.push(diff)

        // Trim diffs history
        while (this.state.diffs.length > this.config.maxHistorySize) {
          this.state.diffs.shift()
        }

        // Notify diff callback
        this.config.onDiff?.(diff)
      }

      // Notify snapshot callback
      this.config.onSnapshot?.(snapshot)

      return snapshot
    } catch (error) {
      console.error(`[SnapshotManager] Failed to capture snapshot (trigger: ${trigger})`, error)
      throw error
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
    // Update config
    Object.assign(this.config, config)
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.state.snapshots = []
    this.state.diffs = []
    console.log('[SnapshotManager] History cleared')
  }
}

// Re-export types
export * from './types'
