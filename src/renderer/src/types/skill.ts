/**
 * Skill Type Definition
 *
 * Skills are configurations that instruct AI agents how to manage websites.
 * They can include domain patterns for matching, prompts for instructions,
 * scripts for page manipulation, and tool schemas for AI capabilities.
 */

/**
 * Complete Skill definition
 */
export interface Skill {
  id: string
  name: string
  description?: string

  /**
   * Domain pattern (regex) for matching websites
   * Example: "^https?://(www\.)?github\.com"
   */
  domainPattern?: string

  /**
   * Main instruction prompt for the AI agent
   */
  prompt: string

  /**
   * Content script (JavaScript) that runs in the page context
   * Used for DOM manipulation, data extraction, etc.
   */
  contentScript?: string

  /**
   * Page script (JavaScript) for additional page behavior
   * Runs in an isolated context
   */
  pageScript?: string

  /**
   * Tool schema JSON string defining AI capabilities for this skill
   * Should be valid JSON following the tool schema format
   */
  toolSchema?: string

  enabled: boolean
  createdAt: number
  updatedAt: number
}

export type SkillCreateInput = Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>

/**
 * Validates a domain pattern regex
 */
export function isValidDomainPattern(pattern: string): boolean {
  if (!pattern) return true // Empty is valid (matches all)
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}

/**
 * Tests if a URL matches a skill's domain pattern
 */
export function matchesDomainPattern(url: string, pattern?: string): boolean {
  if (!pattern) return true // No pattern matches all
  try {
    const regex = new RegExp(pattern, 'i')
    return regex.test(url)
  } catch {
    return false
  }
}
