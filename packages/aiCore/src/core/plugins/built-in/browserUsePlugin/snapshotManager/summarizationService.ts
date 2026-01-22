/**
 * Snapshot Summarization Service
 *
 * Provides AI-powered summarization of browser snapshots.
 * This file includes:
 * - Default placeholder implementation for basic extraction
 * - System prompt template for AI summarization
 * - Helper to create custom AI-backed services
 */

import type {
  BrowserSnapshot,
  KeyInteraction,
  KeySection,
  SnapshotDiff,
  SnapshotSummarizationService,
  SnapshotSummary,
  SummarizationRequest
} from './types'

/**
 * System prompt for AI-powered snapshot summarization
 * Use this when implementing a custom summarization service with an LLM
 */
export const SUMMARIZATION_SYSTEM_PROMPT = `You are a browser page analyzer. Given a DOM snapshot in accessibility tree format, extract key information about the page structure and interactions.

Analyze the snapshot and provide a structured summary with:

1. **Page Description**: A one-line summary of what this page is (e.g., "GitHub repository page", "E-commerce checkout form")

2. **Page State**: Current state/context (e.g., "logged in", "search results for 'react'", "step 2 of checkout")

3. **Key Structure**: Main sections of the page. For each section identify:
   - name: Section identifier
   - type: header, navigation, main, sidebar, form, list, modal, footer, etc.
   - description: What content/purpose this section has
   - refs: Element references (@ref:N) in this section

4. **Key Interactions**: Important interactive elements for common workflows. For each:
   - ref: The @ref:N reference
   - type: button, link, input, select, checkbox, etc.
   - label: Human-readable text/label
   - purpose: What action this element performs
   - priority: 1-5 (1 = most important for main workflows)

5. **Possible Workflows**: List 2-4 main user tasks possible on this page

Focus on elements that are important for automation and user workflows. Prioritize:
- Navigation elements
- Form inputs and submit buttons
- Action buttons (add to cart, submit, save, etc.)
- Important links
- Search functionality

Output your analysis as JSON matching this structure:
{
  "pageDescription": "string",
  "pageState": "string",
  "keyStructure": [...],
  "keyInteractions": [...],
  "possibleWorkflows": [...]
}`

/**
 * Default placeholder summarization service
 * Performs basic extraction without AI - useful for testing or fallback
 */
export class DefaultSummarizationService implements SnapshotSummarizationService {
  isAvailable(): boolean {
    return true
  }

  async summarize(request: SummarizationRequest): Promise<SnapshotSummary> {
    const { snapshot, diff } = request

    // Basic extraction from snapshot content
    const keyInteractions = this.extractInteractions(snapshot.content)
    const keyStructure = this.extractStructure(snapshot.content)

    const summary: SnapshotSummary = {
      snapshotId: snapshot.id,
      timestamp: Date.now(),
      pageDescription: `Page at ${new URL(snapshot.url).hostname}: ${snapshot.title}`,
      pageState: this.inferPageState(snapshot),
      keyStructure,
      keyInteractions,
      possibleWorkflows: this.inferWorkflows(keyInteractions),
      changesFromPrevious: diff?.isSignificant
        ? `${diff.urlChanged ? 'URL changed. ' : ''}${Math.round(diff.contentChangeRatio * 100)}% content change`
        : undefined,
      rawSummary: `Basic extraction from ${snapshot.content.split('\n').length} lines`
    }

    return summary
  }

  /**
   * Extract interactive elements from snapshot content
   */
  private extractInteractions(content: string): KeyInteraction[] {
    const interactions: KeyInteraction[] = []
    const lines = content.split('\n')
    let priority = 1

    for (const line of lines) {
      const refMatch = line.match(/@ref:(\d+)/)
      if (!refMatch) continue

      const ref = `@ref:${refMatch[1]}`

      // Detect element type from role or tag
      let type = 'unknown'
      let label = ''
      let purpose: string | undefined

      if (line.includes("role='button'") || line.includes('<button')) {
        type = 'button'
        const nameMatch = line.match(/name='([^']*)'/) || line.match(/>([^<]+)</)
        label = nameMatch?.[1] || 'Button'
        purpose = 'Click to perform action'
      } else if (line.includes("role='link'") || line.includes('<a ')) {
        type = 'link'
        const nameMatch = line.match(/name='([^']*)'/) || line.match(/>([^<]+)</)
        label = nameMatch?.[1] || 'Link'
        purpose = 'Navigate to page'
      } else if (line.includes("role='textbox'") || line.includes('<input') || line.includes('<textarea')) {
        type = 'input'
        const nameMatch = line.match(/name='([^']*)'/) || line.match(/placeholder='([^']*)'/)
        label = nameMatch?.[1] || 'Text input'
        purpose = 'Enter text'
      } else if (line.includes("role='checkbox'") || line.includes("type='checkbox'")) {
        type = 'checkbox'
        const nameMatch = line.match(/name='([^']*)'/)
        label = nameMatch?.[1] || 'Checkbox'
        purpose = 'Toggle option'
      } else if (line.includes("role='combobox'") || line.includes('<select')) {
        type = 'select'
        const nameMatch = line.match(/name='([^']*)'/)
        label = nameMatch?.[1] || 'Dropdown'
        purpose = 'Select option'
      } else {
        continue // Skip non-interactive elements
      }

      interactions.push({
        ref,
        type,
        label: label.substring(0, 50), // Truncate long labels
        purpose,
        priority: Math.min(priority++, 5)
      })

      // Limit to top 20 interactions
      if (interactions.length >= 20) break
    }

    return interactions
  }

  /**
   * Extract structural sections from snapshot content
   */
  private extractStructure(content: string): KeySection[] {
    const sections: KeySection[] = []
    const lines = content.split('\n')

    // Look for landmark roles
    const landmarks = [
      { role: 'banner', type: 'header', name: 'Header' },
      { role: 'navigation', type: 'navigation', name: 'Navigation' },
      { role: 'main', type: 'main', name: 'Main Content' },
      { role: 'complementary', type: 'sidebar', name: 'Sidebar' },
      { role: 'contentinfo', type: 'footer', name: 'Footer' },
      { role: 'form', type: 'form', name: 'Form' },
      { role: 'search', type: 'search', name: 'Search' },
      { role: 'dialog', type: 'modal', name: 'Dialog' }
    ]

    for (const landmark of landmarks) {
      const pattern = new RegExp(`role='${landmark.role}'`, 'i')
      const refs: string[] = []

      for (const line of lines) {
        if (pattern.test(line)) {
          const refMatch = line.match(/@ref:(\d+)/)
          if (refMatch) {
            refs.push(`@ref:${refMatch[1]}`)
          }
        }
      }

      if (refs.length > 0) {
        sections.push({
          name: landmark.name,
          type: landmark.type,
          description: `${landmark.name} section`,
          elementCount: refs.length,
          refs: refs.slice(0, 5) // Limit refs per section
        })
      }
    }

    // If no landmarks found, create a basic "Page" section
    if (sections.length === 0) {
      sections.push({
        name: 'Page Content',
        type: 'main',
        description: 'Main page content',
        elementCount: lines.length
      })
    }

    return sections
  }

  /**
   * Infer page state from snapshot
   */
  private inferPageState(snapshot: BrowserSnapshot): string {
    const url = new URL(snapshot.url)
    const path = url.pathname
    const search = url.search

    // Common patterns
    if (path.includes('/login') || path.includes('/signin')) return 'Login page'
    if (path.includes('/signup') || path.includes('/register')) return 'Registration page'
    if (path.includes('/checkout')) return 'Checkout flow'
    if (path.includes('/cart')) return 'Shopping cart'
    if (path.includes('/search') || search.includes('q=')) return 'Search results'
    if (path.includes('/settings')) return 'Settings page'
    if (path.includes('/profile')) return 'Profile page'

    return 'Browsing'
  }

  /**
   * Infer possible workflows from interactions
   */
  private inferWorkflows(interactions: KeyInteraction[]): string[] {
    const workflows: string[] = []

    const hasSearch = interactions.some((i) => i.type === 'input' && i.label.toLowerCase().includes('search'))
    const hasLogin = interactions.some(
      (i) => i.type === 'button' && (i.label.toLowerCase().includes('login') || i.label.toLowerCase().includes('sign'))
    )
    const hasForm = interactions.some((i) => i.type === 'input')
    const hasNav = interactions.some((i) => i.type === 'link')

    if (hasSearch) workflows.push('Search for content')
    if (hasLogin) workflows.push('Sign in or create account')
    if (hasForm) workflows.push('Fill out and submit form')
    if (hasNav) workflows.push('Navigate to other pages')

    if (workflows.length === 0) {
      workflows.push('Browse page content')
    }

    return workflows.slice(0, 4)
  }
}

/**
 * Create a custom summarization service with an AI provider
 *
 * @example
 * ```typescript
 * const summarizationService = createAISummarizationService(async (prompt) => {
 *   const response = await openai.chat.completions.create({
 *     model: 'gpt-4',
 *     messages: [
 *       { role: 'system', content: SUMMARIZATION_SYSTEM_PROMPT },
 *       { role: 'user', content: prompt }
 *     ],
 *     response_format: { type: 'json_object' }
 *   })
 *   return response.choices[0].message.content
 * })
 * ```
 */
export function createAISummarizationService(
  aiCall: (prompt: string) => Promise<string | null>
): SnapshotSummarizationService {
  return {
    isAvailable: () => true,

    async summarize(request: SummarizationRequest): Promise<SnapshotSummary> {
      const { snapshot, previousSnapshot, diff } = request

      // Build the prompt
      let prompt = `Analyze this browser snapshot:\n\nURL: ${snapshot.url}\nTitle: ${snapshot.title}\n\nDOM Snapshot:\n${snapshot.content.substring(0, 50000)}`

      if (diff && previousSnapshot) {
        prompt += `\n\nThis page changed from the previous snapshot:`
        prompt += `\n- URL changed: ${diff.urlChanged}`
        prompt += `\n- Content change: ${Math.round(diff.contentChangeRatio * 100)}%`
        prompt += `\n- Previous URL: ${previousSnapshot.url}`
      }

      try {
        const response = await aiCall(prompt)

        if (!response) {
          throw new Error('AI returned empty response')
        }

        // Parse the JSON response
        const parsed = JSON.parse(response)

        return {
          snapshotId: snapshot.id,
          timestamp: Date.now(),
          pageDescription: parsed.pageDescription || `Page: ${snapshot.title}`,
          pageState: parsed.pageState,
          keyStructure: parsed.keyStructure || [],
          keyInteractions: parsed.keyInteractions || [],
          possibleWorkflows: parsed.possibleWorkflows,
          changesFromPrevious: diff?.isSignificant ? parsed.changesFromPrevious : undefined,
          rawSummary: response
        }
      } catch (error) {
        // Fallback to default service on error
        console.warn('[SummarizationService] AI call failed, using fallback:', error)
        const fallback = new DefaultSummarizationService()
        return fallback.summarize(request)
      }
    }
  }
}
