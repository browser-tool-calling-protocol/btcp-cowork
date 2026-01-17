/**
 * Browser Demo Hook
 *
 * Demonstrates the BTCP browser tools by actually controlling the browser
 * extension through the btcp-browser-agent client API.
 *
 * Uses the createClient() API which sends commands via chrome.runtime.sendMessage:
 * - BackgroundAgent: Session management, navigation, screenshots
 * - ContentAgent: DOM operations (click, fill, type, snapshot, etc.)
 */

import { createClient } from 'btcp-browser-agent/extension'
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
    description: 'Starting browser session and waiting for page load',
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
    description: 'Waiting for search box to appear, then filling it',
    action: 'browser_fill',
    agent: 'content',
    args: { selector: '@ref:5', value: 'btcp browser tools' }
  },
  {
    id: 'press-enter',
    name: 'Submit Search',
    description: 'Pressing Enter key and waiting for navigation',
    action: 'browser_press',
    agent: 'content',
    args: { key: 'Enter' }
  },
  {
    id: 'navigate-github',
    name: 'Navigate to GitHub',
    description: 'Going to the repository page and waiting for load',
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
    description: 'Waiting for element, then reading repository name',
    action: 'browser_get_text',
    agent: 'content',
    args: { selector: '@ref:10' }
  },
  {
    id: 'click-star',
    name: 'Click Star Button',
    description: 'Waiting for button, then starring the repository',
    action: 'browser_click',
    agent: 'content',
    args: { selector: '@ref:12' }
  },
  {
    id: 'screenshot',
    name: 'Take Screenshot',
    description: 'Waiting for animations, then capturing page state',
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

  const executeStep = useCallback(async (step: DemoStep): Promise<unknown> => {
    const client = createClient()

    // Execute actual browser commands through the extension
    switch (step.action) {
      case 'browser_launch':
        // Wait for page to fully load before proceeding
        return await client.navigate(step.args.url as string, { waitUntil: 'load' })

      case 'browser_navigate':
        // Wait for page to fully load before proceeding
        return await client.navigate(step.args.url as string, { waitUntil: 'load' })

      case 'browser_snapshot':
        return await client.snapshot()

      case 'browser_fill':
        // Wait for element to be visible before filling
        await client.execute({
          id: crypto.randomUUID(),
          action: 'wait',
          selector: step.args.selector as string,
          state: 'visible',
          timeout: 5000
        })
        return await client.fill(step.args.selector as string, step.args.value as string)

      case 'browser_press':
        // Use execute for press key action
        await client.execute({
          id: crypto.randomUUID(),
          action: 'press',
          key: step.args.key as string
        })
        // Wait for page transition after Enter key (e.g., form submission)
        await client.execute({
          id: crypto.randomUUID(),
          action: 'wait',
          timeout: 2000
        })
        return { success: true }

      case 'browser_click':
        // Wait for element to be visible before clicking
        await client.execute({
          id: crypto.randomUUID(),
          action: 'wait',
          selector: step.args.selector as string,
          state: 'visible',
          timeout: 5000
        })
        return await client.click(step.args.selector as string)

      case 'browser_get_text':
        // Wait for element to be visible before reading text
        await client.execute({
          id: crypto.randomUUID(),
          action: 'wait',
          selector: step.args.selector as string,
          state: 'visible',
          timeout: 5000
        })
        const text = await client.getText(step.args.selector as string)
        return { text }

      case 'browser_screenshot':
        // Wait for animations to complete before taking screenshot
        await client.execute({
          id: crypto.randomUUID(),
          action: 'wait',
          timeout: 500
        })
        const screenshot = await client.screenshot()
        return { screenshot }

      case 'browser_close':
        return await client.tabClose()

      case 'browser_back':
        return await client.back()

      case 'browser_forward':
        return await client.forward()

      case 'browser_reload':
        return await client.reload()

      case 'browser_type':
        // Use execute for type action
        return await client.execute({
          id: crypto.randomUUID(),
          action: 'type',
          text: step.args.text as string
        })

      case 'browser_scroll':
        // Use execute for scroll action
        return await client.execute({
          id: crypto.randomUUID(),
          action: 'scroll',
          x: step.args.x as number | undefined,
          y: step.args.y as number | undefined
        })

      default:
        throw new Error(`Unknown action: ${step.action}`)
    }
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
