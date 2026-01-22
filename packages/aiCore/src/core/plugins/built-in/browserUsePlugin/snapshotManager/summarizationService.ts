/**
 * Snapshot Summarization Service
 *
 * Provides AI-powered summarization of browser snapshots.
 * Returns plain text summaries designed to be used directly in prompts.
 */

import type { BrowserSnapshot, SnapshotSummarizationService, SnapshotSummary, SummarizationRequest } from './types'

/**
 * System prompt for AI-powered snapshot summarization
 * Focus on page structure with xpath patterns for grep filtering
 */
export const SUMMARIZATION_SYSTEM_PROMPT = `Analyze this DOM snapshot and output a structural summary.

Output format:
- **Page**: [type] - [brief description]
- **Key contents**:
  + [content area 1] xpath: [pattern]
  + [content area 2] xpath: [pattern]
- **Key interactions**:
  + [interaction 1] xpath: [pattern]
  + [interaction 2] xpath: [pattern]

The xpath patterns should be usable with grep to filter snapshots.
Be concise. No @ref needed.`

/**
 * Document length thresholds for summarization strategy
 */
const LENGTH_THRESHOLDS = {
  SHORT: 6000,     // Direct summarize (~1.5K tokens)
  CHUNK_SIZE: 8000 // Size per chunk for large docs
}

/**
 * Prepare content for summarization - returns chunks for large documents
 */
export function prepareContentForSummarization(content: string): {
  chunks: string[]
  strategy: 'direct' | 'chunked'
  originalLength: number
} {
  const originalLength = content.length

  // Short document - use as is
  if (originalLength <= LENGTH_THRESHOLDS.SHORT) {
    return { chunks: [content], strategy: 'direct', originalLength }
  }

  // Large document - split into chunks
  const chunks = splitIntoChunks(content, LENGTH_THRESHOLDS.CHUNK_SIZE)
  return { chunks, strategy: 'chunked', originalLength }
}

/**
 * Split content into logical chunks preserving structure
 */
function splitIntoChunks(content: string, chunkSize: number): string[] {
  const lines = content.split('\n')
  const chunks: string[] = []
  let currentChunk: string[] = []
  let currentLength = 0

  for (const line of lines) {
    if (currentLength + line.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'))
      currentChunk = []
      currentLength = 0
    }
    currentChunk.push(line)
    currentLength += line.length + 1
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'))
  }

  return chunks
}

/**
 * Prompt for summarizing a single chunk
 */
const CHUNK_SUMMARY_PROMPT = `Extract key structure from this DOM section:
- Contents: [area] xpath: [pattern]
- Interactions: [element] xpath: [pattern]
Be very concise. Only list important items.`

/**
 * Prompt for merging chunk summaries
 */
const MERGE_SUMMARY_PROMPT = `Merge these page section summaries into one structural summary.

Output format:
- **Page**: [type] - [brief description]
- **Key contents**:
  + [content area] xpath: [pattern]
- **Key interactions**:
  + [interaction] xpath: [pattern]

Deduplicate and keep only the most important items. Be concise.`

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
 * Create a custom summarization service with chunked processing for large documents
 */
export function createAISummarizationService(
  aiCall: (prompt: string) => Promise<string | null>
): SnapshotSummarizationService {
  return {
    isAvailable: () => true,

    async summarize(request: SummarizationRequest): Promise<SnapshotSummary> {
      const { snapshot } = request

      // Split content into chunks
      const { chunks, strategy } = prepareContentForSummarization(snapshot.content)

      try {
        if (strategy === 'direct') {
          // Small document - direct summarization
          const prompt = `${SUMMARIZATION_SYSTEM_PROMPT}\n\nURL: ${snapshot.url}\nTitle: ${snapshot.title}\n\nDOM Snapshot:\n${chunks[0]}`
          const response = await aiCall(prompt)
          if (!response) throw new Error('AI returned empty response')
          return response
        }

        // Large document - chunked summarization
        console.log(`[SummarizationService] Processing ${chunks.length} chunks`)

        // Step 1: Summarize each chunk
        const chunkSummaries: string[] = []
        for (let i = 0; i < chunks.length; i++) {
          const chunkPrompt = `${CHUNK_SUMMARY_PROMPT}\n\nSection ${i + 1}/${chunks.length}:\n${chunks[i]}`
          const chunkSummary = await aiCall(chunkPrompt)
          if (chunkSummary) {
            chunkSummaries.push(`[Section ${i + 1}]\n${chunkSummary}`)
          }
        }

        // Step 2: Merge chunk summaries
        const mergePrompt = `${MERGE_SUMMARY_PROMPT}\n\nURL: ${snapshot.url}\nTitle: ${snapshot.title}\n\nSection summaries:\n${chunkSummaries.join('\n\n')}`
        const finalSummary = await aiCall(mergePrompt)

        if (!finalSummary) throw new Error('AI returned empty response')
        return finalSummary

      } catch (error) {
        console.warn('[SummarizationService] AI call failed, using fallback:', error)
        const fallback = new DefaultSummarizationService()
        return fallback.summarize(request)
      }
    }
  }
}
