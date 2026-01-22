/**
 * Snapshot Summarization Service
 *
 * Provides AI-powered summarization of browser snapshots.
 * Returns plain text summaries designed to be used directly in prompts.
 */

import type { BrowserSnapshot, SnapshotSummarizationService, SnapshotSummary, SummarizationRequest } from './types'

/**
 * System prompt for AI-powered snapshot summarization
 * Use this when implementing a custom summarization service with an LLM
 */
export const SUMMARIZATION_SYSTEM_PROMPT = `You are a browser page analyzer. Given a DOM snapshot in accessibility tree format, create a concise summary of the page that can be used as context in future prompts.

Your summary should include:

1. **Page Identity**: What type of page this is (e.g., "GitHub repository page", "E-commerce product listing", "Login form")

2. **Current State**: Any relevant state information (e.g., "user is logged in", "showing search results for 'react'", "cart has 3 items")

3. **Key Sections**: Main areas of the page and their purpose (e.g., "Header with navigation and search", "Main content showing product grid", "Sidebar with filters")

4. **Important Elements**: Key interactive elements with their @ref references that are relevant for automation:
   - Forms and input fields
   - Primary action buttons (submit, save, add to cart, etc.)
   - Navigation links
   - Any error messages or notifications

5. **Possible Actions**: 2-3 main tasks a user could perform on this page

Format as a readable paragraph or short bullet points. Keep it under 500 words.
The summary should be self-contained and useful as context without needing the full snapshot.`

/**
 * Default summarization service
 * Performs basic extraction without AI - useful for testing or fallback
 */
export class DefaultSummarizationService implements SnapshotSummarizationService {
  isAvailable(): boolean {
    return true
  }

  async summarize(request: SummarizationRequest): Promise<SnapshotSummary> {
    const { snapshot, diff } = request
    return this.generateBasicSummary(snapshot, diff)
  }

  /**
   * Generate a basic summary without AI
   */
  private generateBasicSummary(snapshot: BrowserSnapshot, diff?: { isSignificant: boolean; urlChanged: boolean; contentChangeRatio: number }): string {
    const lines = snapshot.content.split('\n')
    const refCount = (snapshot.content.match(/@ref:\d+/g) || []).length

    // Extract some basic info
    const hasForm = snapshot.content.includes("role='form'") || snapshot.content.includes('<form')
    const hasNav = snapshot.content.includes("role='navigation'")
    const hasMain = snapshot.content.includes("role='main'")
    const hasSearch = snapshot.content.includes("role='search'") || snapshot.content.toLowerCase().includes('search')
    const hasLogin = snapshot.content.toLowerCase().includes('login') || snapshot.content.toLowerCase().includes('sign in')

    // Build summary parts
    const parts: string[] = []

    // Page identity
    let pageType = 'Web page'
    if (hasLogin) pageType = 'Login/authentication page'
    else if (hasForm) pageType = 'Form page'
    else if (hasSearch) pageType = 'Search page'

    parts.push(`**Page**: ${snapshot.title} (${pageType})`)
    parts.push(`**URL**: ${snapshot.url}`)

    // Structure
    const structure: string[] = []
    if (hasNav) structure.push('navigation')
    if (hasMain) structure.push('main content')
    if (hasForm) structure.push('form')
    if (hasSearch) structure.push('search')
    if (structure.length > 0) {
      parts.push(`**Structure**: Contains ${structure.join(', ')}`)
    }

    // Interactive elements
    parts.push(`**Interactive elements**: ${refCount} elements with @ref markers`)

    // Extract some key refs
    const keyRefs = this.extractKeyRefs(snapshot.content)
    if (keyRefs.length > 0) {
      parts.push(`**Key elements**: ${keyRefs.join(', ')}`)
    }

    // Changes from previous
    if (diff?.isSignificant) {
      const changeInfo = diff.urlChanged
        ? 'navigated to new page'
        : `${Math.round(diff.contentChangeRatio * 100)}% content change`
      parts.push(`**Change**: ${changeInfo}`)
    }

    return parts.join('\n')
  }

  /**
   * Extract key interactive element refs
   */
  private extractKeyRefs(content: string): string[] {
    const refs: string[] = []
    const lines = content.split('\n')

    for (const line of lines) {
      const refMatch = line.match(/@ref:(\d+)/)
      if (!refMatch) continue

      const ref = `@ref:${refMatch[1]}`

      // Look for buttons
      if (line.includes("role='button'") || line.includes('<button')) {
        const nameMatch = line.match(/name='([^']*)'/)
        if (nameMatch) {
          refs.push(`${ref} (button: ${nameMatch[1].substring(0, 20)})`)
        }
      }
      // Look for inputs
      else if (line.includes("role='textbox'") || line.includes('<input')) {
        const nameMatch = line.match(/name='([^']*)'/) || line.match(/placeholder='([^']*)'/)
        if (nameMatch) {
          refs.push(`${ref} (input: ${nameMatch[1].substring(0, 20)})`)
        }
      }
      // Look for links
      else if (line.includes("role='link'") && refs.length < 5) {
        const nameMatch = line.match(/name='([^']*)'/)
        if (nameMatch && nameMatch[1].length > 2) {
          refs.push(`${ref} (link: ${nameMatch[1].substring(0, 20)})`)
        }
      }

      if (refs.length >= 10) break
    }

    return refs
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
 *     ]
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
      let prompt = `Summarize this browser page snapshot:\n\nURL: ${snapshot.url}\nTitle: ${snapshot.title}\n\nDOM Snapshot:\n${snapshot.content.substring(0, 50000)}`

      if (diff && previousSnapshot) {
        prompt += `\n\n---\nThis page changed from the previous state:`
        prompt += `\n- URL changed: ${diff.urlChanged}`
        prompt += `\n- Content change: ${Math.round(diff.contentChangeRatio * 100)}%`
        if (diff.urlChanged) {
          prompt += `\n- Previous URL: ${previousSnapshot.url}`
        }
      }

      try {
        const response = await aiCall(prompt)

        if (!response) {
          throw new Error('AI returned empty response')
        }

        return response
      } catch (error) {
        // Fallback to default service on error
        console.warn('[SummarizationService] AI call failed, using fallback:', error)
        const fallback = new DefaultSummarizationService()
        return fallback.summarize(request)
      }
    }
  }
}
