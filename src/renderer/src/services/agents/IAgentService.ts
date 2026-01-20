/**
 * Agent Service Interface
 *
 * Defines the contract for agent execution services.
 * Enables abstraction between server-based and local execution modes.
 */
import type {
  AddAgentForm,
  AgentEntity,
  AgentSessionEntity,
  ApiModelsFilter,
  ApiModelsResponse,
  CreateAgentResponse,
  CreateAgentSessionResponse,
  CreateSessionForm,
  GetAgentResponse,
  GetAgentSessionResponse,
  ListAgentSessionsResponse,
  ListAgentsResponse,
  ListOptions,
  UpdateAgentForm,
  UpdateAgentResponse,
  UpdateSessionForm
} from '@renderer/types'
import type { TextStreamPart } from 'ai'

/**
 * Result type for operations that can fail
 */
export type ServiceResult<T> = { success: true; data: T } | { success: false; error: Error }

/**
 * Agent message stream configuration
 */
export interface AgentMessageStreamConfig {
  agentId: string
  sessionId: string
  content: string
  signal?: AbortSignal
}

/**
 * Agent service mode
 */
export type AgentServiceMode = 'server' | 'local'

/**
 * Agent service configuration
 */
export interface AgentServiceConfig {
  mode: AgentServiceMode
  // Server mode config
  host?: string
  port?: number
  apiKey?: string
  // Local mode config (for future use)
  defaultModel?: string
}

/**
 * Agent Service Interface
 *
 * Provides a unified API for agent operations that can be implemented
 * by different backends (server API, local storage, etc.)
 */
export interface IAgentService {
  /**
   * Get the current service mode
   */
  readonly mode: AgentServiceMode

  /**
   * Check if the service is available/ready
   */
  isAvailable(): Promise<boolean>

  // ============ Agent CRUD ============

  /**
   * List all agents with optional pagination
   */
  listAgents(options?: ListOptions): Promise<ListAgentsResponse>

  /**
   * Create a new agent
   */
  createAgent(form: AddAgentForm): Promise<ServiceResult<CreateAgentResponse>>

  /**
   * Get an agent by ID
   */
  getAgent(id: string): Promise<GetAgentResponse>

  /**
   * Update an existing agent
   */
  updateAgent(form: UpdateAgentForm): Promise<ServiceResult<UpdateAgentResponse>>

  /**
   * Delete an agent by ID
   */
  deleteAgent(id: string): Promise<void>

  // ============ Session CRUD ============

  /**
   * List sessions for an agent
   */
  listSessions(agentId: string): Promise<ListAgentSessionsResponse>

  /**
   * Create a new session for an agent
   */
  createSession(agentId: string, form: CreateSessionForm): Promise<ServiceResult<CreateAgentSessionResponse>>

  /**
   * Get a session by ID
   */
  getSession(agentId: string, sessionId: string): Promise<GetAgentSessionResponse>

  /**
   * Update an existing session
   */
  updateSession(agentId: string, form: UpdateSessionForm): Promise<ServiceResult<GetAgentSessionResponse>>

  /**
   * Delete a session
   */
  deleteSession(agentId: string, sessionId: string): Promise<void>

  // ============ Message Operations ============

  /**
   * Delete a message from a session
   */
  deleteSessionMessage(agentId: string, sessionId: string, messageId: number): Promise<void>

  /**
   * Create a message stream for agent execution
   * Returns a ReadableStream of AI SDK TextStreamPart events
   */
  createMessageStream(config: AgentMessageStreamConfig): Promise<ReadableStream<TextStreamPart<Record<string, any>>>>

  // ============ Model Operations ============

  /**
   * Get available models
   */
  getModels(filter?: ApiModelsFilter): Promise<ApiModelsResponse>
}

/**
 * Base class providing common functionality for agent services
 */
export abstract class BaseAgentService implements IAgentService {
  abstract readonly mode: AgentServiceMode

  abstract isAvailable(): Promise<boolean>

  abstract listAgents(options?: ListOptions): Promise<ListAgentsResponse>
  abstract createAgent(form: AddAgentForm): Promise<ServiceResult<CreateAgentResponse>>
  abstract getAgent(id: string): Promise<GetAgentResponse>
  abstract updateAgent(form: UpdateAgentForm): Promise<ServiceResult<UpdateAgentResponse>>
  abstract deleteAgent(id: string): Promise<void>

  abstract listSessions(agentId: string): Promise<ListAgentSessionsResponse>
  abstract createSession(agentId: string, form: CreateSessionForm): Promise<ServiceResult<CreateAgentSessionResponse>>
  abstract getSession(agentId: string, sessionId: string): Promise<GetAgentSessionResponse>
  abstract updateSession(agentId: string, form: UpdateSessionForm): Promise<ServiceResult<GetAgentSessionResponse>>
  abstract deleteSession(agentId: string, sessionId: string): Promise<void>

  abstract deleteSessionMessage(agentId: string, sessionId: string, messageId: number): Promise<void>
  abstract createMessageStream(
    config: AgentMessageStreamConfig
  ): Promise<ReadableStream<TextStreamPart<Record<string, any>>>>

  abstract getModels(filter?: ApiModelsFilter): Promise<ApiModelsResponse>

  /**
   * Helper to wrap async operations in ServiceResult
   */
  protected async wrapResult<T>(operation: () => Promise<T>): Promise<ServiceResult<T>> {
    try {
      const data = await operation()
      return { success: true, data }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      }
    }
  }
}

/**
 * Type guard for AgentEntity
 */
export function isAgentEntity(value: unknown): value is AgentEntity {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'type' in value &&
    'model' in value &&
    'accessible_paths' in value
  )
}

/**
 * Type guard for AgentSessionEntity
 */
export function isAgentSessionEntity(value: unknown): value is AgentSessionEntity {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'agent_id' in value &&
    'agent_type' in value &&
    'model' in value
  )
}
