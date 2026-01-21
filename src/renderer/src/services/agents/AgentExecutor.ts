/**
 * Agent Executor Interface
 *
 * Unified abstraction for agent execution across different agent types.
 * Provides a consistent interface for both browser-compatible (skill-creator)
 * and server-based (claude-code) agent execution.
 */
import type { AgentSessionEntity, AgentType } from '@renderer/types'
import type { TextStreamPart, ToolSet } from 'ai'

/**
 * Configuration for agent execution
 */
export interface AgentExecutionConfig {
  /** The session containing agent configuration */
  session: AgentSessionEntity
  /** User message content */
  content: string
  /** Optional abort signal */
  signal?: AbortSignal
  /** Conversation history (optional, for context) */
  history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
}

/**
 * Result of agent execution
 */
export interface AgentExecutionResult {
  /** Readable stream of text stream parts */
  stream: ReadableStream<TextStreamPart<Record<string, any>>>
}

/**
 * Agent Executor Interface
 *
 * Handles the actual execution of agent tasks.
 * Different implementations can be used for different agent types:
 * - LocalAgentExecutor: For browser-compatible agents (skill-creator)
 * - ServerAgentExecutor: For server-based agents (claude-code)
 */
export interface IAgentExecutor {
  /**
   * Agent type this executor handles
   */
  readonly agentType: AgentType

  /**
   * Check if this executor can handle the given agent type
   */
  canExecute(agentType: AgentType): boolean

  /**
   * Check if the executor is available in the current environment
   */
  isAvailable(): Promise<boolean>

  /**
   * Execute an agent task and return a stream of results
   */
  execute(config: AgentExecutionConfig): Promise<AgentExecutionResult>

  /**
   * Get available tools for this executor
   */
  getAvailableTools(): Promise<ToolSet>
}

/**
 * Agent Tool Definition
 *
 * Represents a tool that can be used by agents.
 * This is a simplified version that works with both MCP tools and built-in tools.
 */
export interface AgentToolDefinition {
  /** Unique tool identifier */
  id: string
  /** Display name */
  name: string
  /** Tool description for the AI */
  description: string
  /** JSON schema for input parameters */
  inputSchema: Record<string, unknown>
  /** Whether this tool requires user permission */
  requiresPermission?: boolean
  /** Whether this tool is browser-compatible */
  browserCompatible?: boolean
  /** The agent types this tool is available for */
  agentTypes?: AgentType[]
}

/**
 * Agent Tool Provider Interface
 *
 * Provides tools based on agent type and configuration.
 */
export interface IAgentToolProvider {
  /**
   * Get tools available for a specific agent type
   */
  getToolsForAgentType(agentType: AgentType): AgentToolDefinition[]

  /**
   * Get tools filtered by allowed tools list
   */
  getFilteredTools(agentType: AgentType, allowedTools?: string[]): AgentToolDefinition[]

  /**
   * Register a new tool
   */
  registerTool(tool: AgentToolDefinition): void

  /**
   * Check if a tool is available for a given agent type
   */
  isToolAvailable(toolId: string, agentType: AgentType): boolean
}

/**
 * Execution mode for agent services
 */
export type ExecutionMode = 'local' | 'server' | 'hybrid'

/**
 * Agent Executor Registry
 *
 * Manages executors for different agent types.
 * Allows selecting the appropriate executor based on agent type and environment.
 */
export interface IAgentExecutorRegistry {
  /**
   * Register an executor for a specific agent type
   */
  register(executor: IAgentExecutor): void

  /**
   * Get executor for an agent type
   */
  getExecutor(agentType: AgentType): IAgentExecutor | undefined

  /**
   * Get all registered executors
   */
  getAllExecutors(): IAgentExecutor[]

  /**
   * Check if an executor is available for the given agent type
   */
  hasExecutor(agentType: AgentType): boolean
}
