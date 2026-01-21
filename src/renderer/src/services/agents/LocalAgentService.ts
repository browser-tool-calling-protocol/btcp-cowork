/**
 * Local Agent Service
 *
 * Implements IAgentService using local Redux store and direct AI SDK calls.
 * Designed for Chrome extension environment where no backend server is available.
 *
 * Features:
 * - Agent/Session CRUD via Redux store
 * - Message streaming via AI SDK (browser-compatible)
 * - Limited tool support (addSkill, think built-in tools)
 */
import { createExecutor } from '@cherrystudio/ai-core'
import { loggerService } from '@logger'
import { createAiSdkProvider } from '@renderer/aiCore/provider/factory'
import { providerToAiSdkConfig } from '@renderer/aiCore/provider/providerConfig'
import { getModel } from '@renderer/hooks/useModel'
import { getProviderByModel } from '@renderer/services/AssistantService'
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
import { addSkill as addSkillAction } from '@renderer/store/skill'
import { BUILT_IN_TOOLS, validateSkillInput } from '@renderer/tools'
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
import type { Skill } from '@renderer/types/skill'
import { type TextStreamPart, tool, type ToolSet } from 'ai'
import { v4 as uuid } from 'uuid'
import * as z from 'zod'

import type { AgentMessageStreamConfig, ServiceResult } from './IAgentService'
import { BaseAgentService } from './IAgentService'

const logger = loggerService.withContext('LocalAgentService')

/**
 * Local Agent Service
 *
 * Provides agent functionality without requiring a backend server.
 * Uses Redux for persistence and AI SDK for LLM calls.
 */
export class LocalAgentService extends BaseAgentService {
  readonly mode = 'local' as const

  constructor() {
    super()
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

      logger.info('Agent created locally', { id: agent.id, name: agent.name })

      // Return just the agent (CreateAgentResponse = AgentEntity)
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

    // Get session to retrieve model configuration
    const state = store.getState()
    const session = selectSessionById(state, sessionId)

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const modelString = session.model

    if (!modelString) {
      throw new Error('Session has no model configured')
    }

    // Parse model string (format: "provider:modelId")
    const [providerId, modelId] = modelString.split(':')
    if (!providerId || !modelId) {
      throw new Error(`Invalid model format: ${modelString}. Expected "provider:modelId"`)
    }

    // Get the model from the store
    const model = getModel(modelId, providerId)
    if (!model) {
      throw new Error(`Model not found: ${modelId} from provider ${providerId}`)
    }

    // Get the provider configuration
    const provider = getProviderByModel(model)
    if (!provider) {
      throw new Error(`Provider not found for model: ${modelId}`)
    }

    if (!provider.apiKey) {
      throw new Error(`API key not configured for provider: ${provider.name}`)
    }

    // Create the stream
    return this.createLocalStream(session, content, model, provider, signal)
  }

  /**
   * Build AI SDK tools from built-in tools and allowed tools list
   */
  private buildLocalTools(allowedTools?: string[]): ToolSet {
    const tools: ToolSet = {}

    // Get allowed tools from the session configuration
    const allowedToolNames = allowedTools ?? []

    // addSkill tool
    if (allowedToolNames.length === 0 || allowedToolNames.includes('addSkill')) {
      const addSkillBuiltIn = BUILT_IN_TOOLS.find((t) => t.name === 'addSkill')
      tools.addSkill = tool({
        description:
          addSkillBuiltIn?.description ||
          'Create and save a new skill to the skill library. Skills are configurations that instruct AI agents how to interact with websites or perform specific tasks.',
        inputSchema: z.object({
          name: z.string().describe('Name of the skill'),
          description: z.string().optional().describe('Brief description of what the skill does'),
          prompt: z.string().describe('The main instruction prompt that tells the AI how to perform this skill'),
          domainPattern: z
            .string()
            .optional()
            .describe('Optional regex pattern to match URLs where this skill should be active'),
          contentScript: z.string().optional().describe('Optional JavaScript code to run in the page context'),
          pageScript: z.string().optional().describe('Optional JavaScript code to run in an isolated context'),
          toolSchema: z.string().optional().describe('Optional JSON string defining custom AI tool capabilities'),
          enabled: z.boolean().optional().describe('Whether the skill should be enabled immediately (default: true)')
        }),
        execute: async (params) => {
          // Validate input
          const validation = validateSkillInput(params)
          if (!validation.valid) {
            return { success: false, error: validation.error }
          }

          // Create the skill
          const skill: Skill = {
            id: uuid(),
            name: params.name.trim(),
            description: params.description?.trim(),
            prompt: params.prompt.trim(),
            domainPattern: params.domainPattern?.trim(),
            contentScript: params.contentScript?.trim(),
            pageScript: params.pageScript?.trim(),
            toolSchema: params.toolSchema?.trim(),
            enabled: params.enabled ?? true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }

          // Save to store
          store.dispatch(addSkillAction(skill))

          logger.info('Skill created via agent tool', { id: skill.id, name: skill.name })

          return {
            success: true,
            skill: {
              id: skill.id,
              name: skill.name,
              description: skill.description,
              enabled: skill.enabled
            }
          }
        }
      })
    }

    // think tool
    if (allowedToolNames.length === 0 || allowedToolNames.includes('think')) {
      const thinkBuiltIn = BUILT_IN_TOOLS.find((t) => t.name === 'think')
      tools.think = tool({
        description:
          thinkBuiltIn?.description ||
          'Use the tool to think about something. It will not obtain new information or make any changes, but just log the thought.',
        inputSchema: z.object({
          thought: z.string().describe('Your thoughts.')
        }),
        execute: async (params) => {
          // The think tool just logs the thought and returns it
          logger.debug('Agent thinking', { thought: params.thought })
          return { thought: params.thought }
        }
      })
    }

    return tools
  }

  /**
   * Create a local stream using AI SDK
   * Implements browser-compatible agent execution
   */
  private createLocalStream(
    session: AgentSessionEntity,
    content: string,
    model: any,
    provider: any,
    signal?: AbortSignal
  ): ReadableStream<TextStreamPart<Record<string, any>>> {
    // Build tools before creating the stream (capture in closure)
    const tools = this.buildLocalTools(session.allowed_tools)

    return new ReadableStream<TextStreamPart<Record<string, any>>>({
      start: async (controller) => {
        try {
          // Build AI SDK configuration
          const aiSdkConfig = providerToAiSdkConfig(provider, model)

          // Create AI SDK provider (async)
          const aiSdkProvider = await createAiSdkProvider(aiSdkConfig)

          if (!aiSdkProvider) {
            throw new Error(`Failed to create AI SDK provider for: ${aiSdkConfig.providerId}`)
          }

          // Get the language model
          const languageModel = aiSdkProvider.languageModel(model.id)

          // Create executor
          const executor = createExecutor(aiSdkConfig.providerId, aiSdkConfig.options, [])

          // Build messages
          const messages: any[] = []

          // Add system message if instructions are present
          if (session.instructions) {
            messages.push({
              role: 'system',
              content: session.instructions
            })
          }

          // Add user message
          messages.push({
            role: 'user',
            content
          })

          logger.info('Starting local agent stream', {
            modelId: model.id,
            providerId: provider.id,
            toolCount: Object.keys(tools).length,
            hasInstructions: !!session.instructions
          })

          // Stream the response
          const streamResult = await executor.streamText({
            model: languageModel,
            messages,
            tools: Object.keys(tools).length > 0 ? tools : undefined,
            abortSignal: signal
          })

          // Process the stream
          const reader = streamResult.fullStream.getReader()

          while (true) {
            const { done, value } = await reader.read()

            if (done) {
              break
            }

            // Forward the chunk to the controller
            controller.enqueue(value as TextStreamPart<Record<string, any>>)
          }

          controller.close()
        } catch (error) {
          logger.error('Local agent stream error', error as Error)

          // Emit error event
          controller.enqueue({
            type: 'error',
            error: error instanceof Error ? error : new Error(String(error))
          } as TextStreamPart<Record<string, any>>)

          controller.close()
        }
      },
      cancel: () => {
        // Signal is already handled by the executor
        logger.debug('Local agent stream cancelled')
      }
    })
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
}

/**
 * Create a LocalAgentService instance
 */
export function createLocalAgentService(): LocalAgentService {
  return new LocalAgentService()
}
