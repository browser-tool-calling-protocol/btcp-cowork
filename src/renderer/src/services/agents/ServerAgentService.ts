/**
 * Server Agent Service
 *
 * Implements IAgentService using the backend API server.
 * This is the default implementation for Electron desktop app.
 */
import { loggerService } from '@logger'
import { AgentApiClient } from '@renderer/api/agent'
import type {
  AddAgentForm,
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

import {
  type AgentMessageStreamConfig,
  type AgentServiceConfig,
  BaseAgentService,
  type ServiceResult
} from './IAgentService'

const logger = loggerService.withContext('ServerAgentService')

/**
 * Server Agent Service Configuration
 */
export interface ServerAgentServiceConfig {
  host: string
  port: number
  apiKey: string
}

/**
 * Server Agent Service
 *
 * Delegates all operations to the backend API server via HTTP.
 * Supports full agent execution with all tools (Bash, Read, Edit, etc.)
 */
export class ServerAgentService extends BaseAgentService {
  readonly mode = 'server' as const

  private client: AgentApiClient
  private config: ServerAgentServiceConfig

  constructor(config: ServerAgentServiceConfig) {
    super()
    this.config = config
    this.client = this.createClient(config)
  }

  /**
   * Create a new AgentApiClient instance
   */
  private createClient(config: ServerAgentServiceConfig): AgentApiClient {
    const baseURL = this.buildBaseURL(config)
    return new AgentApiClient({
      baseURL,
      headers: {
        Authorization: `Bearer ${config.apiKey}`
      }
    })
  }

  /**
   * Build the base URL from config
   */
  private buildBaseURL(config: ServerAgentServiceConfig): string {
    const hasProtocol = config.host.startsWith('http://') || config.host.startsWith('https://')
    const baseHost = hasProtocol ? config.host : `http://${config.host}`
    const portSegment = config.port ? `:${config.port}` : ''
    return `${baseHost}${portSegment}`
  }

  /**
   * Update service configuration
   */
  updateConfig(config: Partial<ServerAgentServiceConfig>): void {
    this.config = { ...this.config, ...config }
    this.client = this.createClient(this.config)
    logger.info('ServerAgentService config updated', { host: this.config.host, port: this.config.port })
  }

  /**
   * Get current configuration (without apiKey for security)
   */
  getConfig(): Omit<ServerAgentServiceConfig, 'apiKey'> {
    return {
      host: this.config.host,
      port: this.config.port
    }
  }

  // ============ Service Availability ============

  async isAvailable(): Promise<boolean> {
    try {
      // Try to list agents as a health check
      await this.client.listAgents({ limit: 1 })
      return true
    } catch (error) {
      logger.debug('Server agent service not available', error as Error)
      return false
    }
  }

  // ============ Agent CRUD ============

  async listAgents(options?: ListOptions): Promise<ListAgentsResponse> {
    logger.debug('Listing agents', { options })
    return this.client.listAgents(options)
  }

  async createAgent(form: AddAgentForm): Promise<ServiceResult<CreateAgentResponse>> {
    logger.info('Creating agent', { name: form.name, type: form.type })
    return this.wrapResult(() => this.client.createAgent(form))
  }

  async getAgent(id: string): Promise<GetAgentResponse> {
    logger.debug('Getting agent', { id })
    return this.client.getAgent(id)
  }

  async updateAgent(form: UpdateAgentForm): Promise<ServiceResult<UpdateAgentResponse>> {
    logger.info('Updating agent', { id: form.id })
    return this.wrapResult(() => this.client.updateAgent(form))
  }

  async deleteAgent(id: string): Promise<void> {
    logger.info('Deleting agent', { id })
    await this.client.deleteAgent(id)
  }

  // ============ Session CRUD ============

  async listSessions(agentId: string): Promise<ListAgentSessionsResponse> {
    logger.debug('Listing sessions', { agentId })
    return this.client.listSessions(agentId)
  }

  async createSession(agentId: string, form: CreateSessionForm): Promise<ServiceResult<CreateAgentSessionResponse>> {
    logger.info('Creating session', { agentId })
    return this.wrapResult(() => this.client.createSession(agentId, form))
  }

  async getSession(agentId: string, sessionId: string): Promise<GetAgentSessionResponse> {
    logger.debug('Getting session', { agentId, sessionId })
    return this.client.getSession(agentId, sessionId)
  }

  async updateSession(agentId: string, form: UpdateSessionForm): Promise<ServiceResult<GetAgentSessionResponse>> {
    logger.info('Updating session', { agentId, sessionId: form.id })
    return this.wrapResult(() => this.client.updateSession(agentId, form))
  }

  async deleteSession(agentId: string, sessionId: string): Promise<void> {
    logger.info('Deleting session', { agentId, sessionId })
    await this.client.deleteSession(agentId, sessionId)
  }

  // ============ Message Operations ============

  async deleteSessionMessage(agentId: string, sessionId: string, messageId: number): Promise<void> {
    logger.info('Deleting session message', { agentId, sessionId, messageId })
    await this.client.deleteSessionMessage(agentId, sessionId, messageId)
  }

  async createMessageStream(
    config: AgentMessageStreamConfig
  ): Promise<ReadableStream<TextStreamPart<Record<string, any>>>> {
    const { agentId, sessionId, content, signal } = config

    logger.info('Creating message stream', { agentId, sessionId, contentLength: content.length })

    const baseURL = this.buildBaseURL(this.config)
    const url = `${baseURL}/v1/agents/${agentId}/sessions/${sessionId}/messages`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({ content }),
      signal
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(errorText || `Failed to stream agent message: ${response.status}`)
    }

    if (!response.body) {
      throw new Error('Agent message stream has no body')
    }

    return this.createSSEReadableStream(response.body, signal)
  }

  /**
   * Create a ReadableStream that parses SSE events into TextStreamPart objects
   */
  private createSSEReadableStream(
    source: ReadableStream<Uint8Array>,
    signal?: AbortSignal
  ): ReadableStream<TextStreamPart<Record<string, any>>> {
    return new ReadableStream<TextStreamPart<Record<string, any>>>({
      start(controller) {
        const reader = source.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        const cancelReader = (reason?: unknown) => reader.cancel(reason).catch(() => {})

        const abortHandler = () => {
          cancelReader(signal?.reason ?? 'aborted')
          controller.error(new DOMException('Aborted', 'AbortError'))
        }

        if (signal?.aborted) {
          abortHandler()
          return
        }

        signal?.addEventListener('abort', abortHandler, { once: true })

        const emitEvent = (eventString: string): boolean => {
          const lines = eventString.split(/\r?\n/)
          let dataPayload = ''
          for (const line of lines) {
            if (line.startsWith('data:')) {
              dataPayload += line.slice(5).trimStart()
            }
          }

          if (!dataPayload) {
            return false
          }

          if (dataPayload === '[DONE]') {
            signal?.removeEventListener('abort', abortHandler)
            cancelReader()
            controller.close()
            return true
          }

          try {
            const parsed = JSON.parse(dataPayload) as TextStreamPart<Record<string, any>>
            controller.enqueue(parsed)
          } catch (error) {
            logger.warn('Failed to parse agent SSE chunk', { dataPayload })
          }
          return false
        }

        const pump = async () => {
          try {
            while (true) {
              const { value, done } = await reader.read()
              if (done) break
              buffer += decoder.decode(value, { stream: true })

              let separatorIndex = buffer.indexOf('\n\n')
              while (separatorIndex !== -1) {
                const rawEvent = buffer.slice(0, separatorIndex).trim()
                buffer = buffer.slice(separatorIndex + 2)
                if (rawEvent) {
                  const shouldStop = emitEvent(rawEvent)
                  if (shouldStop) {
                    return
                  }
                }
                separatorIndex = buffer.indexOf('\n\n')
              }
            }

            buffer += decoder.decode()
            if (buffer.trim()) {
              emitEvent(buffer.trim())
            }
            signal?.removeEventListener('abort', abortHandler)
            controller.close()
          } catch (error) {
            signal?.removeEventListener('abort', abortHandler)
            controller.error(error)
          }
        }

        pump().catch((error) => {
          signal?.removeEventListener('abort', abortHandler)
          controller.error(error)
        })
      },
      cancel(reason) {
        return source.cancel(reason).catch(() => {})
      }
    })
  }

  // ============ Model Operations ============

  async getModels(filter?: ApiModelsFilter): Promise<ApiModelsResponse> {
    logger.debug('Getting models', { filter })
    return this.client.getModels(filter)
  }
}

/**
 * Create a ServerAgentService instance from app settings
 */
export function createServerAgentService(config: AgentServiceConfig): ServerAgentService {
  if (!config.host || !config.apiKey) {
    throw new Error('Server agent service requires host and apiKey configuration')
  }

  return new ServerAgentService({
    host: config.host,
    port: config.port ?? 39123,
    apiKey: config.apiKey
  })
}
