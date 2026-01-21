/**
 * Agent Tool Provider
 *
 * Manages tools available for different agent types.
 * Provides a unified way to register and retrieve tools.
 */
import { loggerService } from '@logger'
import type { AgentType } from '@renderer/types'

import type { AgentToolDefinition, IAgentToolProvider } from './AgentExecutor'

const logger = loggerService.withContext('AgentToolProvider')

/**
 * Built-in tool definitions for different agent types
 */
const BUILT_IN_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  // Tools for skill-creator agent (browser-compatible)
  {
    id: 'addSkill',
    name: 'addSkill',
    description:
      'Create and save a new skill to the skill library. Skills are configurations that instruct AI agents how to interact with websites or perform specific tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the skill' },
        description: { type: 'string', description: 'Brief description of what the skill does' },
        prompt: {
          type: 'string',
          description: 'The main instruction prompt that tells the AI how to perform this skill'
        },
        domainPattern: {
          type: 'string',
          description: 'Optional regex pattern to match URLs where this skill should be active'
        },
        contentScript: { type: 'string', description: 'Optional JavaScript code to run in the page context' },
        pageScript: { type: 'string', description: 'Optional JavaScript code to run in an isolated context' },
        toolSchema: { type: 'string', description: 'Optional JSON string defining custom AI tool capabilities' },
        enabled: { type: 'boolean', description: 'Whether the skill should be enabled immediately (default: true)' }
      },
      required: ['name', 'prompt']
    },
    requiresPermission: false,
    browserCompatible: true,
    agentTypes: ['skill-creator']
  },
  {
    id: 'think',
    name: 'think',
    description:
      'Use the tool to think about something. It will not obtain new information or make any changes, but just log the thought.',
    inputSchema: {
      type: 'object',
      properties: {
        thought: { type: 'string', description: 'Your thoughts.' }
      },
      required: ['thought']
    },
    requiresPermission: false,
    browserCompatible: true,
    agentTypes: ['skill-creator', 'claude-code']
  },
  // Tools for claude-code agent (server-only)
  {
    id: 'Bash',
    name: 'Bash',
    description: 'Execute shell commands in the terminal',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command to execute' },
        timeout: { type: 'number', description: 'Optional timeout in milliseconds' }
      },
      required: ['command']
    },
    requiresPermission: true,
    browserCompatible: false,
    agentTypes: ['claude-code']
  },
  {
    id: 'Read',
    name: 'Read',
    description: 'Read the contents of a file',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'The absolute path to the file to read' },
        offset: { type: 'number', description: 'Optional line offset to start reading from' },
        limit: { type: 'number', description: 'Optional number of lines to read' }
      },
      required: ['file_path']
    },
    requiresPermission: false,
    browserCompatible: false,
    agentTypes: ['claude-code']
  },
  {
    id: 'Write',
    name: 'Write',
    description: 'Write content to a file',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'The absolute path to the file to write' },
        content: { type: 'string', description: 'The content to write to the file' }
      },
      required: ['file_path', 'content']
    },
    requiresPermission: true,
    browserCompatible: false,
    agentTypes: ['claude-code']
  },
  {
    id: 'Edit',
    name: 'Edit',
    description: 'Edit a file by replacing text',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'The absolute path to the file to modify' },
        old_string: { type: 'string', description: 'The text to replace' },
        new_string: { type: 'string', description: 'The replacement text' }
      },
      required: ['file_path', 'old_string', 'new_string']
    },
    requiresPermission: true,
    browserCompatible: false,
    agentTypes: ['claude-code']
  },
  {
    id: 'Glob',
    name: 'Glob',
    description: 'Find files matching a glob pattern',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'The glob pattern to match files against' },
        path: { type: 'string', description: 'Optional directory to search in' }
      },
      required: ['pattern']
    },
    requiresPermission: false,
    browserCompatible: false,
    agentTypes: ['claude-code']
  },
  {
    id: 'Grep',
    name: 'Grep',
    description: 'Search for text patterns in files',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'The regex pattern to search for' },
        path: { type: 'string', description: 'File or directory to search in' }
      },
      required: ['pattern']
    },
    requiresPermission: false,
    browserCompatible: false,
    agentTypes: ['claude-code']
  },
  {
    id: 'Task',
    name: 'Task',
    description: 'Launch a sub-agent to handle complex tasks',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'A short description of the task' },
        prompt: { type: 'string', description: 'The task for the agent to perform' }
      },
      required: ['description', 'prompt']
    },
    requiresPermission: false,
    browserCompatible: false,
    agentTypes: ['claude-code']
  },
  {
    id: 'TodoWrite',
    name: 'TodoWrite',
    description: 'Manage a structured task list',
    inputSchema: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          description: 'The updated todo list',
          items: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
              activeForm: { type: 'string' }
            },
            required: ['content', 'status', 'activeForm']
          }
        }
      },
      required: ['todos']
    },
    requiresPermission: false,
    browserCompatible: false,
    agentTypes: ['claude-code']
  },
  {
    id: 'WebFetch',
    name: 'WebFetch',
    description: 'Fetch content from a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to fetch content from' },
        prompt: { type: 'string', description: 'The prompt to run on the fetched content' }
      },
      required: ['url', 'prompt']
    },
    requiresPermission: true,
    browserCompatible: true,
    agentTypes: ['claude-code', 'skill-creator']
  },
  {
    id: 'WebSearch',
    name: 'WebSearch',
    description: 'Search the web for information',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' }
      },
      required: ['query']
    },
    requiresPermission: true,
    browserCompatible: true,
    agentTypes: ['claude-code', 'skill-creator']
  }
]

/**
 * Agent Tool Provider Implementation
 */
export class AgentToolProvider implements IAgentToolProvider {
  private tools: Map<string, AgentToolDefinition> = new Map()

  constructor() {
    // Register built-in tools
    for (const tool of BUILT_IN_TOOL_DEFINITIONS) {
      this.registerTool(tool)
    }
    logger.info('AgentToolProvider initialized', { toolCount: this.tools.size })
  }

  /**
   * Get tools available for a specific agent type
   */
  getToolsForAgentType(agentType: AgentType): AgentToolDefinition[] {
    return Array.from(this.tools.values()).filter((tool) => !tool.agentTypes || tool.agentTypes.includes(agentType))
  }

  /**
   * Get tools filtered by allowed tools list
   */
  getFilteredTools(agentType: AgentType, allowedTools?: string[]): AgentToolDefinition[] {
    const availableTools = this.getToolsForAgentType(agentType)

    if (!allowedTools || allowedTools.length === 0) {
      return availableTools
    }

    return availableTools.filter((tool) => allowedTools.includes(tool.id) || allowedTools.includes(tool.name))
  }

  /**
   * Get browser-compatible tools for a given agent type
   */
  getBrowserCompatibleTools(agentType: AgentType): AgentToolDefinition[] {
    return this.getToolsForAgentType(agentType).filter((tool) => tool.browserCompatible)
  }

  /**
   * Register a new tool
   */
  registerTool(tool: AgentToolDefinition): void {
    this.tools.set(tool.id, tool)
    logger.debug('Tool registered', { id: tool.id, name: tool.name })
  }

  /**
   * Unregister a tool
   */
  unregisterTool(toolId: string): void {
    this.tools.delete(toolId)
    logger.debug('Tool unregistered', { id: toolId })
  }

  /**
   * Check if a tool is available for a given agent type
   */
  isToolAvailable(toolId: string, agentType: AgentType): boolean {
    const tool = this.tools.get(toolId)
    if (!tool) return false
    return !tool.agentTypes || tool.agentTypes.includes(agentType)
  }

  /**
   * Get a tool by ID
   */
  getTool(toolId: string): AgentToolDefinition | undefined {
    return this.tools.get(toolId)
  }

  /**
   * Get all registered tools
   */
  getAllTools(): AgentToolDefinition[] {
    return Array.from(this.tools.values())
  }
}

// Singleton instance
let toolProviderInstance: AgentToolProvider | null = null

/**
 * Get the singleton tool provider instance
 */
export function getAgentToolProvider(): AgentToolProvider {
  if (!toolProviderInstance) {
    toolProviderInstance = new AgentToolProvider()
  }
  return toolProviderInstance
}

/**
 * Helper to check if an agent type can run in browser
 */
export function canRunInBrowser(agentType: AgentType): boolean {
  return agentType === 'skill-creator'
}

/**
 * Helper to get default tools for an agent type
 */
export function getDefaultToolsForAgentType(agentType: AgentType): string[] {
  const provider = getAgentToolProvider()
  return provider.getToolsForAgentType(agentType).map((tool) => tool.id)
}
