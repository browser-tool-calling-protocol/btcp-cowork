/**
 * Browser Session Snapshot Manager
 *
 * Background mechanism for capturing page snapshots at intervals or after actions,
 * computing diffs to track changes, and running AI-powered summarization.
 *
 * Features:
 * - Interval-based snapshot capture
 * - Action-triggered snapshot capture (with debouncing)
 * - Simple diff computation to track content changes
 * - AI-powered summarization via pluggable service
 *
 * Usage:
 * ```typescript
 * import { BrowserSessionSnapshotManager, DefaultSummarizationService } from './snapshotManager'
 *
 * const manager = new BrowserSessionSnapshotManager({
 *   enabled: true,
 *   intervalMs: 30000,
 *   captureAfterActions: true,
 *   summarizationService: new DefaultSummarizationService(),
 *   summarizeOn: 'significant',
 *   onSnapshot: (snapshot) => console.log('Snapshot captured:', snapshot.id),
 *   onDiff: (diff) => console.log('Change detected:', diff.contentChangeRatio),
 *   onSummary: (snapshot, summary) => console.log('Summary:', summary.pageDescription)
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
import { DefaultSummarizationService } from './summarizationService'
import {
  type BrowserSnapshot,
  type SnapshotDiff,
  type SnapshotManagerConfig,
  type SnapshotManagerState,
  type SnapshotSummary,
  type SnapshotSummarizationService,
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
  private config: Required<Omit<SnapshotManagerConfig, 'summarizationService' | 'onSnapshot' | 'onDiff' | 'onSummary'>> &
    Pick<SnapshotManagerConfig, 'summarizationService' | 'onSnapshot' | 'onDiff' | 'onSummary'>
  private state: SnapshotManagerState
  private intervalHandle: ReturnType<typeof setInterval> | null = null
  private getClient: (() => Promise<ExtensionClient>) | null = null
  private summarizationService: SnapshotSummarizationService

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
      pendingSummarization: []
    }

    // Use provided service or default
    this.summarizationService = config.summarizationService || new DefaultSummarizationService()
  }

  /**
   * Set the client getter function
   * This should be called before start() to provide access to the browser client
   */
  setClientGetter(getter: () => Promise<ExtensionClient>): void {
    this.getClient = getter
  }

  /**
   * Set or update the summarization service
   */
  setSummarizationService(service: SnapshotSummarizationService): void {
    this.summarizationService = service
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
      captureAfterActions: this.config.captureAfterActions,
      summarizeOn: this.config.summarizeOn,
      hasSummarizationService: this.summarizationService.isAvailable()
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
   * Manually trigger summarization for a specific snapshot
   */
  async summarizeSnapshot(snapshotId: string): Promise<SnapshotSummary | null> {
    const snapshot = this.state.snapshots.find((s) => s.id === snapshotId)
    if (!snapshot) {
      console.warn(`[SnapshotManager] Snapshot not found: ${snapshotId}`)
      return null
    }

    const index = this.state.snapshots.indexOf(snapshot)
    const previousSnapshot = index > 0 ? this.state.snapshots[index - 1] : undefined
    const diff = this.state.diffs.find((d) => d.currentSnapshotId === snapshotId)

    return this.processSummarization(snapshot, previousSnapshot, diff)
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

      // Trigger summarization based on config
      if (this.shouldSummarize(trigger, diff)) {
        this.queueSummarization(snapshot, prevSnapshot, diff)
      }

      return snapshot
    } catch (error) {
      console.error('[SnapshotManager] Failed to capture snapshot', error)
      return null
    }
  }

  /**
   * Determine if we should summarize this snapshot
   */
  private shouldSummarize(trigger: SnapshotTrigger, diff?: SnapshotDiff): boolean {
    if (!this.summarizationService.isAvailable()) {
      return false
    }

    switch (this.config.summarizeOn) {
      case 'all':
        return true
      case 'significant':
        // Always summarize initial/manual, or if diff is significant
        return trigger === 'initial' || trigger === 'manual' || (diff?.isSignificant ?? false)
      case 'manual':
        return false // Only via explicit summarizeSnapshot() call
      default:
        return false
    }
  }

  /**
   * Queue a snapshot for summarization
   */
  private queueSummarization(
    snapshot: BrowserSnapshot,
    previousSnapshot?: BrowserSnapshot,
    diff?: SnapshotDiff
  ): void {
    console.log(`[SnapshotManager] Queueing snapshot for summarization: ${snapshot.id}`)
    this.state.pendingSummarization.push(snapshot.id)

    // Process summarization asynchronously
    this.processSummarization(snapshot, previousSnapshot, diff).catch((error) => {
      console.error('[SnapshotManager] Summarization failed', error)
    })
  }

  /**
   * Process summarization for a snapshot
   */
  private async processSummarization(
    snapshot: BrowserSnapshot,
    previousSnapshot?: BrowserSnapshot,
    diff?: SnapshotDiff
  ): Promise<SnapshotSummary | null> {
    try {
      console.log(`[SnapshotManager] Summarizing snapshot: ${snapshot.id}`)

      const summary = await this.summarizationService.summarize({
        snapshot,
        previousSnapshot,
        diff
      })

      // Attach summary to snapshot
      snapshot.summary = summary

      console.log(`[SnapshotManager] Summarization completed for: ${snapshot.id}`, {
        summaryLength: summary.length,
        preview: summary.substring(0, 100) + (summary.length > 100 ? '...' : '')
      })

      // Remove from pending
      this.state.pendingSummarization = this.state.pendingSummarization.filter((id) => id !== snapshot.id)

      // Notify callback
      this.config.onSummary?.(snapshot, summary)

      return summary
    } catch (error) {
      console.error(`[SnapshotManager] Summarization failed for: ${snapshot.id}`, error)

      // Remove from pending
      this.state.pendingSummarization = this.state.pendingSummarization.filter((id) => id !== snapshot.id)

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
   * Get snapshots with summaries only
   */
  getSummarizedSnapshots(): BrowserSnapshot[] {
    return this.state.snapshots.filter((s) => s.summary !== undefined)
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
   * Get the most recent summarized snapshot
   */
  getLatestSummarizedSnapshot(): BrowserSnapshot | null {
    for (let i = this.state.snapshots.length - 1; i >= 0; i--) {
      if (this.state.snapshots[i].summary) {
        return this.state.snapshots[i]
      }
    }
    return null
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

    // Update summarization service if provided
    if (config.summarizationService) {
      this.summarizationService = config.summarizationService
    }

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
    this.state.pendingSummarization = []
    console.log('[SnapshotManager] History cleared')
  }
}

// Re-export types and services
export * from './types'
export { DefaultSummarizationService, createAISummarizationService, prepareContentForSummarization, SUMMARIZATION_SYSTEM_PROMPT } from './summarizationService'
