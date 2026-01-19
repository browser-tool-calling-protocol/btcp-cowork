/**
 * Skill Type Definition
 *
 * Skills are configurations that instruct AI agents how to manage websites.
 * They can include domain patterns for matching, prompts for instructions,
 * scripts for page manipulation, and tool schemas for AI capabilities.
 */

/**
 * Tool parameter definition for JSON schema
 */
export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description?: string
  required?: boolean
  enum?: string[]
  items?: ToolParameter // For array types
  properties?: Record<string, ToolParameter> // For object types
}

/**
 * Tool definition for skills
 */
export interface SkillTool {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, ToolParameter>
    required?: string[]
  }
}

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
   * Tool schema defining AI capabilities for this skill
   * Array of tool definitions following JSON schema format
   */
  toolSchema?: SkillTool[]

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

/**
 * Validates tool schema JSON
 */
export function isValidToolSchema(schema: unknown): schema is SkillTool[] {
  if (!Array.isArray(schema)) return false
  return schema.every(
    (tool) =>
      typeof tool === 'object' &&
      tool !== null &&
      typeof tool.name === 'string' &&
      typeof tool.description === 'string' &&
      typeof tool.parameters === 'object'
  )
}
