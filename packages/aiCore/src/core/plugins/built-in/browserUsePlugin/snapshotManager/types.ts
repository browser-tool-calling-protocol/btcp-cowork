/**
 * Browser Session Snapshot Manager Types
 *
 * Type definitions for the background snapshot tracking mechanism that captures
 * page state at intervals or after actions and computes diffs.
 */

// ============================================================================
// Snapshot Core Types
// ============================================================================

/**
 * Snapshot data captured from the browser
 */
export interface BrowserSnapshot {
  /** Unique identifier for this snapshot */
  id: string
  /** Timestamp when snapshot was captured */
  timestamp: number
  /** Current page URL */
  url: string
  /** Page title */
  title: string
  /** DOM snapshot content (accessibility tree format) */
  content: string
  /** Snapshot mode used */
  mode: 'interaction' | 'content' | 'outline' | 'all'
  /** What triggered this snapshot */
  trigger: SnapshotTrigger
  /** Optional action that triggered the snapshot */
  triggerAction?: string
  /** Optional metadata */
  metadata?: Record<string, unknown>
}

/**
 * What triggered the snapshot capture
 */
export type SnapshotTrigger =
  | 'interval' // Periodic interval capture
  | 'action' // After a browser action (click, type, navigate, etc.)
  | 'manual' // Manually triggered
  | 'initial' // First snapshot after session start

/**
 * Snapshot diff result comparing two snapshots
 */
export interface SnapshotDiff {
  /** ID of the previous snapshot */
  previousSnapshotId: string
  /** ID of the current snapshot */
  currentSnapshotId: string
  /** Timestamp of diff computation */
  timestamp: number
  /** Whether URL changed */
  urlChanged: boolean
  /** Whether title changed */
  titleChanged: boolean
  /** Approximate change ratio (0-1) for content */
  contentChangeRatio: number
  /** Number of lines added */
  linesAdded: number
  /** Number of lines removed */
  linesRemoved: number
  /** Whether the change is significant (above threshold) */
  isSignificant: boolean
  /** Summary of changes */
  changeSummary?: string
}

/**
 * Configuration for the snapshot manager
 */
export interface SnapshotManagerConfig {
  /**
   * Enable/disable the snapshot manager
   * @default false
   */
  enabled?: boolean

  /**
   * Whether to capture snapshots after browser actions
   * @default true
   */
  captureAfterActions?: boolean

  /**
   * Actions that trigger snapshot capture when captureAfterActions is true
   * @default ['browser_navigate', 'browser_click', 'browser_fill', 'browser_type', 'browser_press']
   */
  actionTriggers?: string[]

  /**
   * Minimum time between action-triggered snapshots (debounce)
   * @default 1000 (1 second)
   */
  actionDebounceMs?: number

  /**
   * Maximum number of snapshots to retain in history
   * @default 50
   */
  maxHistorySize?: number

  /**
   * Content change ratio threshold to consider a diff "significant"
   * @default 0.1 (10% change)
   */
  significantChangeThreshold?: number

  /**
   * Snapshot mode to use for captures
   * @default 'all'
   */
  snapshotMode?: 'interaction' | 'content' | 'outline' | 'all'

  /**
   * Callback when a snapshot is captured
   */
  onSnapshot?: (snapshot: BrowserSnapshot) => void

  /**
   * Callback when a diff is computed
   */
  onDiff?: (diff: SnapshotDiff) => void
}

/**
 * Snapshot manager state
 */
export interface SnapshotManagerState {
  /** Whether the manager is currently running */
  isRunning: boolean
  /** Current snapshot history */
  snapshots: BrowserSnapshot[]
  /** Computed diffs */
  diffs: SnapshotDiff[]
  /** Last snapshot timestamp */
  lastSnapshotTime: number | null
  /** Last action timestamp (for debouncing) */
  lastActionTime: number | null
}

/**
 * Default configuration values
 */
export const DEFAULT_SNAPSHOT_CONFIG: Required<Omit<SnapshotManagerConfig, 'onSnapshot' | 'onDiff'>> = {
  enabled: false,
  captureAfterActions: true,
  actionTriggers: ['browser_navigate', 'browser_click', 'browser_fill', 'browser_type', 'browser_press'],
  actionDebounceMs: 1000,
  maxHistorySize: 50,
  significantChangeThreshold: 0.1,
  snapshotMode: 'all' // Use 'all' for full page structure
}
