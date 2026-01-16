/**
 * Browser Demo Hook
 *
 * Demonstrates the BTCP browser tools by showing a simulated flow
 * of browser automation commands. This runs as a visualization to
 * help users understand what the tools do.
 *
 * Note: Actual browser control happens through the btcpBrowserPlugin
 * during AI chat interactions in the main process.
 */

import { useCallback, useRef, useState } from 'react'

export interface DemoStep {
  id: string
  name: string
  description: string
  tool: string
  args: Record<string, unknown>
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped'
  result?: unknown
  error?: string
}

const DEMO_STEPS: Omit<DemoStep, 'status'>[] = [
  {
    id: 'navigate-google',
    name: 'Navigate to Google',
    description: 'Opening Google.com',
    tool: 'browser_navigate',
    args: { url: 'https://www.google.com' }
  },
  {
    id: 'get-title',
    name: 'Get Page Title',
    description: 'Verifying page loaded',
    tool: 'browser_title',
    args: {}
  },
  {
    id: 'search-input',
    name: 'Take Page Snapshot',
    description: 'Getting page structure',
    tool: 'browser_snapshot',
    args: {}
  },
  {
    id: 'type-search',
    name: 'Type Search Query',
    description: 'Filling search box',
    tool: 'browser_fill',
    args: { selector: 'textarea[name="q"]', value: 'btcp browser tools' }
  },
  {
    id: 'press-enter',
    name: 'Submit Search',
    description: 'Pressing Enter key',
    tool: 'browser_press',
    args: { key: 'Enter' }
  },
  {
    id: 'wait-results',
    name: 'Wait for Results',
    description: 'Waiting for page load',
    tool: 'browser_wait',
    args: { timeout: 2000 }
  },
  {
    id: 'navigate-github',
    name: 'Go to GitHub',
    description: 'Navigating to repository',
    tool: 'browser_navigate',
    args: { url: 'https://github.com/browser-tool-calling-protocol/btcp-cowork' }
  },
  {
    id: 'get-github-title',
    name: 'Verify GitHub Page',
    description: 'Confirming navigation',
    tool: 'browser_title',
    args: {}
  },
  {
    id: 'click-star',
    name: 'Click Star Button',
    description: 'Starring the repository',
    tool: 'browser_click',
    args: { selector: 'button[data-ga-click*="star"]' }
  }
]

// Simulated results for each tool type
const SIMULATED_RESULTS: Record<string, unknown> = {
  browser_navigate: { success: true },
  browser_title: { title: 'Page Title' },
  browser_snapshot: { elements: 42, refs: ['@ref:1', '@ref:2', '@ref:3'] },
  browser_fill: { success: true },
  browser_press: { success: true },
  browser_wait: { success: true },
  browser_click: { success: true }
}

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

  const updateStep = useCallback((index: number, updates: Partial<DemoStep>) => {
    setSteps((prev) => prev.map((step, i) => (i === index ? { ...step, ...updates } : step)))
  }, [])

  const simulateStep = useCallback(async (step: DemoStep): Promise<unknown> => {
    // Simulate network/processing delay (300-800ms)
    const delay = 300 + Math.random() * 500
    await new Promise((resolve) => setTimeout(resolve, delay))

    // Return simulated result
    return SIMULATED_RESULTS[step.tool] ?? { success: true }
  }, [])

  const runDemo = useCallback(async () => {
    setIsRunning(true)
    setError(null)
    abortRef.current = false

    // Reset all steps to pending
    setSteps(DEMO_STEPS.map((step) => ({ ...step, status: 'pending' as const })))

    try {
      // Execute each step with simulation
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
          const result = await simulateStep({ ...DEMO_STEPS[i], status: 'running' })
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
  }, [simulateStep, updateStep])

  const stopDemo = useCallback(() => {
    abortRef.current = true
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
