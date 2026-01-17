/**
 * Browser Demo Hook
 *
 * Demonstrates the BTCP browser tools by showing a simulated flow
 * of browser automation commands. This runs as a visualization to
 * help users understand what the tools do.
 *
 * Uses the new btcp-browser-agent API with BackgroundAgent and ContentAgent:
 * - BackgroundAgent: Session management, navigation, screenshots
 * - ContentAgent: DOM operations (click, fill, type, snapshot, etc.)
 *
 * Note: Actual browser control happens through the btcpBrowserPlugin
 * during AI chat interactions in the main process.
 */

import { useCallback, useRef, useState } from 'react'

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
    id: 'launch',
    name: 'Launch Browser',
    description: 'Starting browser session',
    action: 'browser_launch',
    agent: 'background',
    args: { url: 'https://www.google.com' }
  },
  {
    id: 'snapshot-page',
    name: 'Take Page Snapshot',
    description: 'Getting accessibility tree with element refs',
    action: 'browser_snapshot',
    agent: 'content',
    args: {}
  },
  {
    id: 'fill-search',
    name: 'Fill Search Box',
    description: 'Filling search input using ref selector',
    action: 'browser_fill',
    agent: 'content',
    args: { selector: '@ref:5', value: 'btcp browser tools' }
  },
  {
    id: 'press-enter',
    name: 'Submit Search',
    description: 'Pressing Enter key',
    action: 'browser_press',
    agent: 'content',
    args: { key: 'Enter' }
  },
  {
    id: 'navigate-github',
    name: 'Navigate to GitHub',
    description: 'Going to the repository page',
    action: 'browser_navigate',
    agent: 'background',
    args: { url: 'https://github.com/browser-tool-calling-protocol/btcp-browser-agent' }
  },
  {
    id: 'snapshot-github',
    name: 'Snapshot GitHub Page',
    description: 'Getting page structure with refs',
    action: 'browser_snapshot',
    agent: 'content',
    args: {}
  },
  {
    id: 'get-text',
    name: 'Get Repo Title',
    description: 'Reading repository name',
    action: 'browser_get_text',
    agent: 'content',
    args: { selector: '@ref:10' }
  },
  {
    id: 'click-star',
    name: 'Click Star Button',
    description: 'Starring the repository',
    action: 'browser_click',
    agent: 'content',
    args: { selector: '@ref:12' }
  },
  {
    id: 'screenshot',
    name: 'Take Screenshot',
    description: 'Capturing final page state',
    action: 'browser_screenshot',
    agent: 'background',
    args: {}
  },
  {
    id: 'close',
    name: 'Close Browser',
    description: 'Ending browser session',
    action: 'browser_close',
    agent: 'background',
    args: {}
  }
]

// Simulated results for each action type
const SIMULATED_RESULTS: Record<string, unknown> = {
  // BackgroundAgent actions
  browser_launch: { success: true, tabId: 123 },
  browser_navigate: { success: true, url: 'https://example.com' },
  browser_back: { success: true },
  browser_forward: { success: true },
  browser_reload: { success: true },
  browser_close: { success: true },
  browser_screenshot: { image: 'data:image/png;base64,...', format: 'png' },
  // ContentAgent actions
  browser_snapshot: {
    tree: 'document [ref=0]\n  button "Submit" [ref=5]\n  input "Search" [ref=6]',
    refs: { 5: { role: 'button', name: 'Submit' }, 6: { role: 'textbox', name: 'Search' } }
  },
  browser_get_text: { text: 'btcp-browser-agent' },
  browser_click: { success: true },
  browser_type: { success: true },
  browser_fill: { success: true },
  browser_press: { success: true },
  browser_scroll: { success: true }
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
    // BackgroundAgent actions may take slightly longer due to browser-level operations
    const baseDelay = step.agent === 'background' ? 400 : 300
    const delay = baseDelay + Math.random() * 500
    await new Promise((resolve) => setTimeout(resolve, delay))

    // Return simulated result based on action type
    return SIMULATED_RESULTS[step.action] ?? { success: true }
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
