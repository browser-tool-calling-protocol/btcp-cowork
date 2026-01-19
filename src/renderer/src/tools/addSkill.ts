/**
 * AddSkill Tool
 *
 * Built-in tool that allows AI agents to create and save skills.
 * Works entirely in the browser using Redux store - no backend required.
 */
import type { MCPTool } from '@renderer/types'

export const addSkillTool: MCPTool = {
  id: 'builtin-add-skill',
  serverId: 'builtin-tools',
  serverName: 'Built-in Tools',
  name: 'addSkill',
  description: `Create and save a new skill to the skill library. Skills are configurations that instruct AI agents how to interact with websites or perform specific tasks.

Use this tool when the user wants to:
- Create a skill for automating tasks on a specific website
- Save a prompt template for reuse
- Configure browser automation behaviors

The skill will be saved locally and can be enabled/disabled later.`,
  isBuiltIn: true,
  type: 'mcp',
  inputSchema: {
    type: 'object',
    title: 'Add Skill Input',
    description: 'Input for creating a new skill',
    required: ['name', 'prompt'],
    properties: {
      name: {
        type: 'string',
        description: 'Name of the skill (e.g., "GitHub PR Reviewer", "Twitter Auto-reply")'
      },
      description: {
        type: 'string',
        description: 'Brief description of what the skill does'
      },
      prompt: {
        type: 'string',
        description: 'The main instruction prompt that tells the AI how to perform this skill'
      },
      domainPattern: {
        type: 'string',
        description:
          'Optional regex pattern to match URLs where this skill should be active (e.g., "^https?://(www\\.)?github\\.com" for GitHub)'
      },
      contentScript: {
        type: 'string',
        description: 'Optional JavaScript code to run in the page context for DOM manipulation'
      },
      pageScript: {
        type: 'string',
        description: 'Optional JavaScript code to run in an isolated context'
      },
      toolSchema: {
        type: 'string',
        description: 'Optional JSON string defining custom AI tool capabilities for this skill'
      },
      enabled: {
        type: 'boolean',
        description: 'Whether the skill should be enabled immediately (default: true)'
      }
    }
  }
}

/**
 * Schema for skill creation input (used by the tool executor)
 */
export interface AddSkillInput {
  name: string
  description?: string
  prompt: string
  domainPattern?: string
  contentScript?: string
  pageScript?: string
  toolSchema?: string
  enabled?: boolean
}

/**
 * Validate skill input before saving
 */
export function validateSkillInput(input: AddSkillInput): { valid: boolean; error?: string } {
  if (!input.name || input.name.trim().length === 0) {
    return { valid: false, error: 'Skill name is required' }
  }

  if (!input.prompt || input.prompt.trim().length === 0) {
    return { valid: false, error: 'Skill prompt is required' }
  }

  if (input.domainPattern) {
    try {
      new RegExp(input.domainPattern)
    } catch {
      return { valid: false, error: `Invalid domain pattern regex: ${input.domainPattern}` }
    }
  }

  if (input.toolSchema) {
    try {
      JSON.parse(input.toolSchema)
    } catch {
      return { valid: false, error: 'Invalid tool schema JSON' }
    }
  }

  return { valid: true }
}
