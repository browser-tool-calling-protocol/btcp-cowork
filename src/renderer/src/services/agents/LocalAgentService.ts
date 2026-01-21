/**
 * Local Agent Service
 *
 * Implements IAgentService using local Redux store and AgentExecutor abstraction.
 * Designed for Chrome extension environment where no backend server is available.
 *
 * Features:
 * - Agent/Session CRUD via Redux store
 * - Message streaming via AgentExecutor abstraction
 * - Supports multiple agent types with appropriate executors
 */
import { loggerService } from '@logger'
import store from '@renderer/store'
import {
  addAgent,
  addSession,
  createAgentEntity,
  createSessionEntity,
  deleteAgent as deleteAgentAction,
  deleteSession as deleteSessionAction,
  selectAgentById,
  selectAllAgents,
  selectSessionById,
  selectSessionsByAgentId,
  updateAgent as updateAgentAction,
  updateSession as updateSessionAction
} from '@renderer/store/agents'
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

import type { IAgentExecutor } from './AgentExecutor'
import { canRunInBrowser } from './AgentToolProvider'
import { createLocalAgentExecutor, getAgentExecutorRegistry } from './executors'
import type { AgentMessageStreamConfig, ServiceResult } from './IAgentService'
import { BaseAgentService } from './IAgentService'

const logger = loggerService.withContext('LocalAgentService')

/**
 * Local Agent Service
 *
 * Provides agent functionality without requiring a backend server.
 * Uses Redux for persistence and AgentExecutors for LLM calls.
 */
export class LocalAgentService extends BaseAgentService {
  readonly mode = 'local' as const

  private localExecutor: IAgentExecutor

  constructor() {
    super()

    // Initialize the local executor
    this.localExecutor = createLocalAgentExecutor()

    // Register with the global executor registry
    const registry = getAgentExecutorRegistry()
    registry.register(this.localExecutor)

    logger.info('LocalAgentService initialized')
  }

  // ============ Service Availability ============

  async isAvailable(): Promise<boolean> {
    // Local service is always available
    return true
  }

  // ============ Agent CRUD ============

  async listAgents(options?: ListOptions): Promise<ListAgentsResponse> {
    const state = store.getState()
    let agents = selectAllAgents(state)

    // Apply sorting
    if (options?.sortBy) {
      agents = [...agents].sort((a, b) => {
        const aValue = a[options.sortBy as keyof AgentEntity]
        const bValue = b[options.sortBy as keyof AgentEntity]
        if (aValue === undefined || bValue === undefined) return 0
        if (aValue < bValue) return options.orderBy === 'asc' ? -1 : 1
        if (aValue > bValue) return options.orderBy === 'asc' ? 1 : -1
        return 0
      })
    }

    // Apply pagination
    const offset = options?.offset ?? 0
    const limit = options?.limit ?? agents.length
    const paginatedAgents = agents.slice(offset, offset + limit)

    // Map to response format
    const data: GetAgentResponse[] = paginatedAgents.map((agent) => ({
      ...agent
    }))

    return {
      data,
      total: agents.length,
      limit,
      offset
    }
  }

  async createAgent(form: AddAgentForm): Promise<ServiceResult<CreateAgentResponse>> {
    try {
      // Validate agent type is browser compatible
      if (!canRunInBrowser(form.type)) {
        return {
          success: false,
          error: new Error(
            `Agent type '${form.type}' is not supported in browser mode. ` +
              `Only browser-compatible agent types (skill-creator) can be created locally.`
          )
        }
      }

      const agent = createAgentEntity({
        type: form.type,
        name: form.name,
        description: form.description,
        instructions: form.instructions,
        model: form.model,
        accessible_paths: form.accessible_paths ?? [],
        allowed_tools: form.allowed_tools,
        mcps: form.mcps,
        configuration: form.configuration
      })

      store.dispatch(addAgent(agent))

      // Create initial session
      const session = createSessionEntity(agent.id, agent.type, {
        name: 'New Session',
        model: agent.model,
        plan_model: agent.plan_model,
        small_model: agent.small_model,
        accessible_paths: agent.accessible_paths,
        allowed_tools: agent.allowed_tools,
        mcps: agent.mcps,
        configuration: agent.configuration,
        instructions: agent.instructions
      })

      store.dispatch(addSession(session))

      logger.info('Agent created locally', { id: agent.id, name: agent.name, type: agent.type })

      return {
        success: true,
        data: agent
      }
    } catch (error) {
      logger.error('Failed to create agent', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      }
    }
  }

  async getAgent(id: string): Promise<GetAgentResponse> {
    const state = store.getState()
    const agent = selectAgentById(state, id)

    if (!agent) {
      throw new Error(`Agent not found: ${id}`)
    }

    return agent
  }

  async updateAgent(form: UpdateAgentForm): Promise<ServiceResult<UpdateAgentResponse>> {
    try {
      const state = store.getState()
      const existing = selectAgentById(state, form.id)

      if (!existing) {
        return {
          success: false,
          error: new Error(`Agent not found: ${form.id}`)
        }
      }

      const updated: AgentEntity = {
        ...existing,
        ...form,
        updated_at: new Date().toISOString()
      }

      store.dispatch(updateAgentAction(updated))

      logger.info('Agent updated locally', { id: form.id })

      return {
        success: true,
        data: updated
      }
    } catch (error) {
      logger.error('Failed to update agent', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      }
    }
  }

  async deleteAgent(id: string): Promise<void> {
    store.dispatch(deleteAgentAction(id))
    logger.info('Agent deleted locally', { id })
  }

  // ============ Session CRUD ============

  async listSessions(agentId: string): Promise<ListAgentSessionsResponse> {
    const state = store.getState()
    const sessions = selectSessionsByAgentId(state, agentId)

    // Sort by created_at descending (newest first)
    const sortedSessions = [...sessions].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return {
      data: sortedSessions,
      total: sortedSessions.length,
      limit: sortedSessions.length,
      offset: 0
    }
  }

  async createSession(agentId: string, form: CreateSessionForm): Promise<ServiceResult<CreateAgentSessionResponse>> {
    try {
      const state = store.getState()
      const agent = selectAgentById(state, agentId)

      if (!agent) {
        return {
          success: false,
          error: new Error(`Agent not found: ${agentId}`)
        }
      }

      const session = createSessionEntity(agentId, agent.type, {
        name: form.name,
        description: form.description,
        instructions: form.instructions ?? agent.instructions,
        model: form.model ?? agent.model,
        plan_model: form.plan_model ?? agent.plan_model,
        small_model: form.small_model ?? agent.small_model,
        accessible_paths: form.accessible_paths ?? agent.accessible_paths,
        allowed_tools: form.allowed_tools ?? agent.allowed_tools,
        mcps: form.mcps ?? agent.mcps,
        configuration: form.configuration ?? agent.configuration
      })

      store.dispatch(addSession(session))

      logger.info('Session created locally', { id: session.id, agentId })

      return {
        success: true,
        data: session
      }
    } catch (error) {
      logger.error('Failed to create session', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      }
    }
  }

  async getSession(agentId: string, sessionId: string): Promise<GetAgentSessionResponse> {
    const state = store.getState()
    const session = selectSessionById(state, sessionId)

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    if (session.agent_id !== agentId) {
      throw new Error(`Session ${sessionId} does not belong to agent ${agentId}`)
    }

    return session
  }

  async updateSession(agentId: string, form: UpdateSessionForm): Promise<ServiceResult<GetAgentSessionResponse>> {
    try {
      const state = store.getState()
      const existing = selectSessionById(state, form.id)

      if (!existing) {
        return {
          success: false,
          error: new Error(`Session not found: ${form.id}`)
        }
      }

      if (existing.agent_id !== agentId) {
        return {
          success: false,
          error: new Error(`Session ${form.id} does not belong to agent ${agentId}`)
        }
      }

      const updated: AgentSessionEntity = {
        ...existing,
        ...form,
        updated_at: new Date().toISOString()
      }

      store.dispatch(updateSessionAction(updated))

      logger.info('Session updated locally', { id: form.id, agentId })

      return {
        success: true,
        data: updated
      }
    } catch (error) {
      logger.error('Failed to update session', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      }
    }
  }

  async deleteSession(agentId: string, sessionId: string): Promise<void> {
    const state = store.getState()
    const session = selectSessionById(state, sessionId)

    if (session && session.agent_id !== agentId) {
      throw new Error(`Session ${sessionId} does not belong to agent ${agentId}`)
    }

    store.dispatch(deleteSessionAction(sessionId))
    logger.info('Session deleted locally', { sessionId, agentId })
  }

  // ============ Message Operations ============

  async deleteSessionMessage(_agentId: string, _sessionId: string, _messageId: number): Promise<void> {
    // Messages are stored in IndexedDB, not in session
    // This is a no-op for local service as message deletion is handled elsewhere
    logger.debug('deleteSessionMessage called on local service (no-op)')
  }

  async createMessageStream(
    config: AgentMessageStreamConfig
  ): Promise<ReadableStream<TextStreamPart<Record<string, any>>>> {
    const { agentId, sessionId, content, signal } = config

    logger.info('Creating local message stream', { agentId, sessionId, contentLength: content.length })

    // Get session to retrieve configuration
    const state = store.getState()
    const session = selectSessionById(state, sessionId)

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    // Validate agent type can run locally
    if (!canRunInBrowser(session.agent_type)) {
      throw new Error(
        `Agent type '${session.agent_type}' cannot run in browser mode. ` +
          `Only browser-compatible agent types are supported locally.`
      )
    }

    // Find appropriate executor
    const registry = getAgentExecutorRegistry()
    const executor = registry.findExecutor(session.agent_type)

    if (!executor) {
      throw new Error(`No executor found for agent type: ${session.agent_type}`)
    }

    // Check executor availability
    const isAvailable = await executor.isAvailable()
    if (!isAvailable) {
      throw new Error(`Executor for agent type '${session.agent_type}' is not available`)
    }

    // Execute using the executor
    const result = await executor.execute({
      session,
      content,
      signal
    })

    return result.stream
  }

  // ============ Model Operations ============

  async getModels(_filter?: ApiModelsFilter): Promise<ApiModelsResponse> {
    // For local service, return models from the provider registry
    // This is a simplified implementation - would need to query actual configured providers
    logger.debug('getModels called on local service')

    return {
      object: 'list',
      data: []
    }
  }

  // ============ Executor Access ============

  /**
   * Get the local executor instance
   */
  getExecutor(): IAgentExecutor {
    return this.localExecutor
  }
}

/**
 * Create a LocalAgentService instance
 */
export function createLocalAgentService(): LocalAgentService {
  return new LocalAgentService()
}
