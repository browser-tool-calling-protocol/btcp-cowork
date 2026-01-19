/**
 * Browser Demo Hook
 *
 * Demonstrates the BTCP browser tools by controlling the browser through
 * the btcp-browser-agent extension API with session management.
 *
 * Uses the BrowserAgentService singleton for shared sessions between
 * demo UI and AI agent tools.
 *
 * Session Lifecycle:
 * 1. BrowserAgentService.initialize() on mount - set up shared client
 * 2. ensureSession() before demo - create/get session group
 * 3. Execute browser operations within session context
 * 4. closeSession() on cleanup - clean up session and all tabs
 */

import { browserAgentService } from '@renderer/services/BrowserAgentService'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface DemoStep {
  id: string
  name: string
  description: string
  action: string
  agent: 'background' | 'content'
  args: Record<string, unknown>
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped'
  result?: unknown
  error?: string
}

const DEMO_STEPS: Omit<DemoStep, 'status'>[] = [
  {
    id: 'programmatic-demo',
    name: 'Browser Automation Demo',
    description: 'Running programmatic browser automation with BTCP',
    action: 'browser_programmatic_demo',
    agent: 'background',
    args: {}
  }
]

export interface UseBrowserDemoReturn {
  steps: DemoStep[]
  isRunning: boolean
  currentStepIndex: number
  runDemo: () => Promise<void>
  stopDemo: () => void
  resetDemo: () => void
  error: string | null
}

export function useBrowserDemo(): UseBrowserDemoReturn {
  const [steps, setSteps] = useState<DemoStep[]>(() =>
    DEMO_STEPS.map((step) => ({ ...step, status: 'pending' as const }))
  )
  const [isRunning, setIsRunning] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(-1)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef(false)

  // Initialize BrowserAgentService on mount
  useEffect(() => {
    const initializeService = async () => {
      try {
        await browserAgentService.initialize()
        console.log('[Demo] BrowserAgentService initialized')
      } catch (err) {
        console.error('Failed to initialize BrowserAgentService:', err)
      }
    }

    initializeService()
  }, [])

  const updateStep = useCallback((index: number, updates: Partial<DemoStep>) => {
    setSteps((prev) => prev.map((step, i) => (i === index ? { ...step, ...updates } : step)))
  }, [])

  const runProgrammaticDemo = useCallback(async (): Promise<unknown> => {
    // Get the shared client from the singleton service
    const client = browserAgentService.getClient()

    // Utility for delays (from example)
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    // Helper to find element in snapshot tree (EXACT COPY from example)
    function findElement(
      tree: string,
      criteria: {
        role?: string
        name?: string
        nameContains?: string
        type?: string
      }
    ): string | null {
      const lines = tree.split('\n')

      for (const line of lines) {
        // Parse line format: "@ref:N role='...' name='...' ..."
        const refMatch = line.match(/@ref:(\d+)/)
        if (!refMatch) continue

        const ref = `@ref:${refMatch[1]}`

        // Check all criteria
        let matches = true

        if (criteria.role) {
          const roleMatch = line.match(/role='([^']+)'/)
          if (!roleMatch || roleMatch[1] !== criteria.role) matches = false
        }

        if (criteria.name) {
          const nameMatch = line.match(/name='([^']+)'/)
          if (!nameMatch || nameMatch[1] !== criteria.name) matches = false
        }

        if (criteria.nameContains) {
          const nameMatch = line.match(/name='([^']+)'/)
          if (!nameMatch || !nameMatch[1].toLowerCase().includes(criteria.nameContains.toLowerCase())) {
            matches = false
          }
        }

        if (criteria.type) {
          const typeMatch = line.match(/type='([^']+)'/)
          if (!typeMatch || typeMatch[1] !== criteria.type) matches = false
        }

        if (matches) {
          console.log('[Demo] Found:', `${ref} - ${line.trim()}`)
          return ref
        }
      }

      return null
    }

    // Use BrowserAgentService for session management
    console.log('[Demo] Ensuring session via BrowserAgentService...')
    const groupId = await browserAgentService.ensureSession()
    console.log('[Demo] Session ready:', groupId)

    // Navigate to Google
    console.log('[Demo] Navigating to Google...')
    try {
      const navResult = await client.navigate('https://www.google.com')
      console.log('[Demo] Navigate result:', navResult)
    } catch (navError) {
      console.error('[Demo] Navigate failed:', navError)
      throw new Error(`Navigation failed: ${navError instanceof Error ? navError.message : String(navError)}`)
    }
    console.log('[Demo] Navigated to Google - waiting for page and content script to load...')

    // Wait for page to fully load and content script to be ready
    // Retry snapshot until successful (content script is responding)
    let snapshotReady = false
    let retries = 0
    while (!snapshotReady && retries < 10) {
      await sleep(1000)
      try {
        const testSnapshot = (await client.snapshot({ format: 'tree' })) as unknown as { tree: string }
        if (testSnapshot && testSnapshot.tree) {
          snapshotReady = true
          console.log('[Demo] Content script ready and responding')
        }
      } catch (err) {
        retries++
        console.log(`[Demo] Waiting for content script... (attempt ${retries}/10)`)
      }
    }

    if (!snapshotReady) {
      throw new Error('Content script failed to respond after 10 seconds')
    }

    // Step 2: Take FRESH snapshot to understand page structure (EXACT COPY from example - line 161)
    console.log('[Demo] Take snapshot to analyze page structure')
    let snapshot1: string
    try {
      const snapshotResult = (await client.snapshot({ format: 'tree' })) as unknown as { tree: string }
      snapshot1 = snapshotResult.tree
      console.log('[Demo] Snapshot captured:', snapshot1.split('\n').length, 'elements found')
      await sleep(500)
    } catch (snapshotError) {
      console.error('[Demo] Snapshot failed:', snapshotError)
      throw new Error(
        `Failed to capture page snapshot: ${snapshotError instanceof Error ? snapshotError.message : String(snapshotError)}`
      )
    }

    // Step 3: Find search input (EXACT COPY from example - line 170)
    console.log('[Demo] Locate search input field')
    let searchInput = findElement(snapshot1, { role: 'combobox' })
    if (!searchInput) {
      searchInput = findElement(snapshot1, { role: 'searchbox' })
    }
    if (!searchInput) {
      console.log('[Demo] Trying alternative: looking for textbox with search-related name')
      searchInput = findElement(snapshot1, { role: 'textbox', nameContains: 'search' })
    }
    if (!searchInput) {
      throw new Error('Unable to locate search input field')
    }
    await sleep(500)

    // Step 4: Type search query (EXACT COPY from example - line 190)
    console.log('[Demo] Type search query into input')
    await client.type(searchInput, 'btcp-cowork')
    console.log('[Demo] Query typed successfully')
    await sleep(500)

    // Step 5: Submit search (EXACT COPY from example - line 201)
    console.log('[Demo] Locate and click search button')
    const searchButton = findElement(snapshot1, { role: 'button', nameContains: 'search' })

    if (!searchButton) {
      console.log('[Demo] Search button not found, trying Enter key instead')
      await client.execute({
        id: crypto.randomUUID(),
        action: 'press',
        key: 'Enter'
      })
    } else {
      console.log('[Demo] Clicking search button', searchButton)
      await client.click(searchButton)
    }
    console.log('[Demo] Search submitted')
    await sleep(2000) // Wait for search results to load

    // Step 6: Take final screenshot (from example pattern)
    console.log('[Demo] Taking screenshot...')
    await sleep(500)
    const screenshot = await client.screenshot()
    console.log('[Demo] Screenshot captured')

    return {
      screenshot,
      status: 'completed'
    }
  }, [])

  const executeStep = useCallback(
    async (step: DemoStep): Promise<unknown> => {
      if (step.action === 'browser_programmatic_demo') {
        return await runProgrammaticDemo()
      }
      throw new Error(`Unknown action: ${step.action}`)
    },
    [runProgrammaticDemo]
  )

  const runDemo = useCallback(async () => {
    setIsRunning(true)
    setError(null)
    abortRef.current = false

    // Reset all steps to pending
    setSteps(DEMO_STEPS.map((step) => ({ ...step, status: 'pending' as const })))

    try {
      // Execute each step (including session creation as first step)
      for (let i = 0; i < DEMO_STEPS.length; i++) {
        if (abortRef.current) {
          // Mark remaining steps as skipped
          for (let j = i; j < DEMO_STEPS.length; j++) {
            updateStep(j, { status: 'skipped' })
          }
          break
        }

        setCurrentStepIndex(i)
        updateStep(i, { status: 'running' })

        try {
          const result = await executeStep({ ...DEMO_STEPS[i], status: 'running' })
          updateStep(i, { status: 'success', result })

          // Small delay between steps for visual feedback
          await new Promise((resolve) => setTimeout(resolve, 200))
        } catch (stepError) {
          const errorMessage = stepError instanceof Error ? stepError.message : String(stepError)
          updateStep(i, { status: 'error', error: errorMessage })
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
    } finally {
      setIsRunning(false)
      setCurrentStepIndex(-1)
    }
  }, [executeStep, updateStep])

  const stopDemo = useCallback(async () => {
    abortRef.current = true
    // Clean up session via BrowserAgentService
    const groupId = browserAgentService.getSessionGroupId()
    if (groupId) {
      try {
        console.log('[Demo] Closing session via BrowserAgentService:', groupId)
        await browserAgentService.closeSession()
        console.log('[Demo] Session closed')
      } catch (err) {
        console.error('[Demo] Failed to close session:', err)
      }
    }
  }, [])

  const resetDemo = useCallback(() => {
    stopDemo()
    setSteps(DEMO_STEPS.map((step) => ({ ...step, status: 'pending' as const })))
    setCurrentStepIndex(-1)
    setError(null)
  }, [stopDemo])

  return {
    steps,
    isRunning,
    currentStepIndex,
    runDemo,
    stopDemo,
    resetDemo,
    error
  }
}
