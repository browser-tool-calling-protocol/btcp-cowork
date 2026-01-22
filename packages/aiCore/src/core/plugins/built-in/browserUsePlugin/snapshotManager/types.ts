/**
 * Browser Session Snapshot Manager Types
 *
 * Type definitions for the background snapshot tracking mechanism that captures
 * page state at intervals or after actions, computes diffs, and runs indexing/summarization.
 */

// ============================================================================
// Snapshot Summary Types
// ============================================================================

/**
 * Key interactive element identified in the page
 */
export interface KeyInteraction {
  /** Element reference (e.g., @ref:1) */
  ref: string
  /** Element type (button, link, input, etc.) */
  type: string
  /** Human-readable label or text */
  label: string
  /** Brief description of what this element does */
  purpose?: string
  /** Priority level for this interaction (1 = highest) */
  priority?: number
}

/**
 * Key structural section identified in the page
 */
export interface KeySection {
  /** Section name/identifier */
  name: string
  /** Section type (header, navigation, main, sidebar, form, list, etc.) */
  type: string
  /** Brief description of section content */
  description: string
  /** Child elements or sections count */
  elementCount?: number
  /** Associated element refs in this section */
  refs?: string[]
}

/**
 * Structured snapshot summary with key sections
 * This is the output format from AI summarization
 */
export interface SnapshotSummary {
  /** Unique ID linking to the source snapshot */
  snapshotId: string
  /** Timestamp when summary was generated */
  timestamp: number
  /** One-line page description */
  pageDescription: string
  /** Current page state/context (e.g., "logged in", "search results", "checkout step 2") */
  pageState?: string
  /** Key structural sections on the page */
  keyStructure: KeySection[]
  /** Key interactive elements for main workflows */
  keyInteractions: KeyInteraction[]
  /** Detected user workflows or tasks possible on this page */
  possibleWorkflows?: string[]
  /** Any notable changes from previous snapshot */
  changesFromPrevious?: string
  /** Raw summary text (for debugging or fallback) */
  rawSummary?: string
}

/**
 * Summarization request passed to the AI service
 */
export interface SummarizationRequest {
  /** The snapshot to summarize */
  snapshot: BrowserSnapshot
  /** Previous snapshot for context (if available) */
  previousSnapshot?: BrowserSnapshot
  /** Diff information (if available) */
  diff?: SnapshotDiff
  /** Additional context or instructions */
  context?: string
}

/**
 * Service interface for AI-powered snapshot summarization
 * Implement this interface to provide custom AI summarization
 */
export interface SnapshotSummarizationService {
  /**
   * Summarize a browser snapshot using AI
   * @param request - The summarization request with snapshot and context
   * @returns Promise resolving to structured summary
   */
  summarize(request: SummarizationRequest): Promise<SnapshotSummary>

  /**
   * Check if the service is available/configured
   */
  isAvailable(): boolean
}

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
  mode: 'interaction' | 'content' | 'outline'
  /** What triggered this snapshot */
  trigger: SnapshotTrigger
  /** Optional action that triggered the snapshot */
  triggerAction?: string
  /** AI-generated summary (populated after summarization) */
  summary?: SnapshotSummary
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
  /** Summary of changes (placeholder for AI summarization) */
  changeSummary?: string
}

/**
 * Snapshot indexing/processing result
 */
export interface SnapshotIndexResult {
  /** Snapshot ID that was indexed */
  snapshotId: string
  /** Timestamp when indexing completed */
  timestamp: number
  /** Status of the indexing operation */
  status: 'pending' | 'processing' | 'completed' | 'failed'
  /** Structured summary from AI */
  summary?: SnapshotSummary
  /** Error message if failed */
  error?: string
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
   * Interval between automatic snapshots in milliseconds
   * Set to 0 to disable interval snapshots
   * @default 30000 (30 seconds)
   */
  intervalMs?: number

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
   * @default 'interaction'
   */
  snapshotMode?: 'interaction' | 'content' | 'outline'

  /**
   * AI summarization service for generating structured summaries
   * When provided, snapshots will be automatically summarized
   */
  summarizationService?: SnapshotSummarizationService

  /**
   * Whether to summarize all snapshots or only significant changes
   * @default 'significant' - only summarize when diff.isSignificant is true
   */
  summarizeOn?: 'all' | 'significant' | 'manual'

  /**
   * Callback when a snapshot is captured
   */
  onSnapshot?: (snapshot: BrowserSnapshot) => void

  /**
   * Callback when a diff is computed
   */
  onDiff?: (diff: SnapshotDiff) => void

  /**
   * Callback when summarization completes
   */
  onSummary?: (snapshot: BrowserSnapshot, summary: SnapshotSummary) => void
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
  /** Pending summarization operations (snapshot IDs) */
  pendingSummarization: string[]
}

/**
 * Default configuration values
 */
export const DEFAULT_SNAPSHOT_CONFIG: Required<
  Omit<SnapshotManagerConfig, 'summarizationService' | 'onSnapshot' | 'onDiff' | 'onSummary'>
> = {
  enabled: false,
  intervalMs: 30000,
  captureAfterActions: true,
  actionTriggers: ['browser_navigate', 'browser_click', 'browser_fill', 'browser_type', 'browser_press'],
  actionDebounceMs: 1000,
  maxHistorySize: 50,
  significantChangeThreshold: 0.1,
  snapshotMode: 'interaction',
  summarizeOn: 'significant'
}
