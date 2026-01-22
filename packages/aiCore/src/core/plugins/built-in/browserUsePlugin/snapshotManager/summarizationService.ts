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
export const SUMMARIZATION_SYSTEM_PROMPT = `You are a browser page analyzer. Given a DOM snapshot, create a concise summary for use as context in future prompts.

Include:
1. **Page Identity**: Type of page (e.g., "GitHub repo", "E-commerce listing", "Login form")
2. **Current State**: Relevant state (logged in, search results, form errors)
3. **Key Sections**: Main areas and their purpose
4. **Important Elements**: Key interactive elements with @ref references (forms, buttons, inputs)
5. **Possible Actions**: 2-3 main tasks available

Keep summary under 400 words. Be concise.`

/**
 * Document length thresholds for summarization strategy
 */
const LENGTH_THRESHOLDS = {
  SHORT: 8000,    // Direct summarize
  MEDIUM: 30000,  // Truncate with section markers
  LARGE: 60000    // Chunk summarization
}

/**
 * Prepare content for summarization based on document length
 */
export function prepareContentForSummarization(content: string): {
  processedContent: string
  strategy: 'short' | 'medium' | 'large'
  originalLength: number
} {
  const originalLength = content.length

  // Short document - use as is
  if (originalLength <= LENGTH_THRESHOLDS.SHORT) {
    return { processedContent: content, strategy: 'short', originalLength }
  }

  // Medium document - smart truncate with structure preservation
  if (originalLength <= LENGTH_THRESHOLDS.MEDIUM) {
    const truncated = smartTruncate(content, LENGTH_THRESHOLDS.SHORT)
    return { processedContent: truncated, strategy: 'medium', originalLength }
  }

  // Large document - extract key sections
  const extracted = extractKeySections(content, LENGTH_THRESHOLDS.MEDIUM)
  return { processedContent: extracted, strategy: 'large', originalLength }
}

/**
 * Smart truncate that preserves structure (keeps beginning, end, and important refs)
 */
function smartTruncate(content: string, maxLength: number): string {
  const lines = content.split('\n')
  const result: string[] = []
  let currentLength = 0

  // Always include first 20% of lines (header, nav usually)
  const headerLines = Math.ceil(lines.length * 0.2)
  for (let i = 0; i < headerLines && currentLength < maxLength * 0.3; i++) {
    result.push(lines[i])
    currentLength += lines[i].length + 1
  }

  // Include lines with important refs (buttons, inputs, forms)
  const importantPatterns = [/role='button'/, /role='textbox'/, /role='form'/, /role='link'.*@ref:/]
  for (let i = headerLines; i < lines.length && currentLength < maxLength * 0.8; i++) {
    if (importantPatterns.some((p) => p.test(lines[i]))) {
      result.push(lines[i])
      currentLength += lines[i].length + 1
    }
  }

  // Add last 10% for footer/end content
  const tailStart = Math.max(headerLines, Math.floor(lines.length * 0.9))
  for (let i = tailStart; i < lines.length && currentLength < maxLength; i++) {
    result.push(lines[i])
    currentLength += lines[i].length + 1
  }

  return result.join('\n')
}

/**
 * Extract key sections from large documents
 */
function extractKeySections(content: string, maxLength: number): string {
  const lines = content.split('\n')
  const sections: string[] = []

  // Extract header (first 15%)
  const headerEnd = Math.ceil(lines.length * 0.15)
  sections.push('--- HEADER ---')
  sections.push(...lines.slice(0, headerEnd))

  // Find and extract main content area
  let mainStart = -1
  let mainEnd = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("role='main'") || lines[i].includes('<main')) {
      mainStart = i
    }
    if (mainStart >= 0 && (lines[i].includes("role='contentinfo'") || lines[i].includes('<footer'))) {
      mainEnd = i
      break
    }
  }

  if (mainStart >= 0) {
    sections.push('\n--- MAIN CONTENT ---')
    const mainLines = lines.slice(mainStart, mainEnd > 0 ? mainEnd : mainStart + 100)
    // Keep first 50 and last 20 lines of main
    if (mainLines.length > 70) {
      sections.push(...mainLines.slice(0, 50))
      sections.push('... [content truncated] ...')
      sections.push(...mainLines.slice(-20))
    } else {
      sections.push(...mainLines)
    }
  }

  // Extract all interactive elements with refs
  sections.push('\n--- KEY ELEMENTS ---')
  const refLines = lines.filter((l) => l.includes('@ref:') && (l.includes("role='button'") || l.includes("role='textbox'") || l.includes("role='link'")))
  sections.push(...refLines.slice(0, 30))

  const result = sections.join('\n')
  return result.length > maxLength ? result.substring(0, maxLength) : result
}

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

      // Prepare content based on document length
      const { processedContent } = prepareContentForSummarization(snapshot.content)

      // Build the prompt
      let prompt = `${SUMMARIZATION_SYSTEM_PROMPT}\n\n`
      prompt += `URL: ${snapshot.url}\nTitle: ${snapshot.title}\n\n`
      prompt += `DOM Snapshot:\n${processedContent}`

      if (diff && previousSnapshot) {
        prompt += `\n\n---\nChanges from previous state:`
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
