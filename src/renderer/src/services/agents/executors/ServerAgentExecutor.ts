/**
 * Server Agent Executor
 *
 * Executes server-based agents (claude-code) by delegating to the backend API.
 * Requires a running backend server with the Claude Code SDK.
 */
import { loggerService } from '@logger'
import type { AgentType } from '@renderer/types'
import type { TextStreamPart, ToolSet } from 'ai'

import type { AgentExecutionConfig, AgentExecutionResult, IAgentExecutor } from '../AgentExecutor'
import { getAgentToolProvider } from '../AgentToolProvider'

const logger = loggerService.withContext('ServerAgentExecutor')

/**
 * Server configuration for the executor
 */
export interface ServerAgentExecutorConfig {
  host: string
  port: number
  apiKey: string
}

/**
 * Server Agent Executor Implementation
 *
 * Executes claude-code agents via the backend API server.
 */
export class ServerAgentExecutor implements IAgentExecutor {
  readonly agentType: AgentType = 'claude-code'

  private config: ServerAgentExecutorConfig

  constructor(config: ServerAgentExecutorConfig) {
    this.config = config
  }

  /**
   * Check if this executor can handle the given agent type
   */
  canExecute(agentType: AgentType): boolean {
    return agentType === 'claude-code'
  }

  /**
   * Check if the executor is available in the current environment
   */
  async isAvailable(): Promise<boolean> {
    try {
      const baseURL = this.buildBaseURL()
      const response = await fetch(`${baseURL}/v1/agents`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`
        }
      })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Update the executor configuration
   */
  updateConfig(config: Partial<ServerAgentExecutorConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Execute an agent task and return a stream of results
   */
  async execute(config: AgentExecutionConfig): Promise<AgentExecutionResult> {
    const { session, content, signal } = config

    logger.info('Executing server agent', {
      sessionId: session.id,
      agentId: session.agent_id,
      agentType: session.agent_type,
      contentLength: content.length
    })

    const baseURL = this.buildBaseURL()
    const url = `${baseURL}/v1/agents/${session.agent_id}/sessions/${session.id}/messages`

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

    const stream = this.createSSEReadableStream(response.body, signal)

    return { stream }
  }

  /**
   * Get available tools for this executor
   */
  async getAvailableTools(): Promise<ToolSet> {
    // For server executor, tools are managed on the server side
    // Return empty toolset as tools are not executed locally
    return {}
  }

  /**
   * Get tool definitions (for UI display)
   */
  getToolDefinitions() {
    const toolProvider = getAgentToolProvider()
    return toolProvider.getToolsForAgentType(this.agentType)
  }

  /**
   * Build the base URL from config
   */
  private buildBaseURL(): string {
    const hasProtocol = this.config.host.startsWith('http://') || this.config.host.startsWith('https://')
    const baseHost = hasProtocol ? this.config.host : `http://${this.config.host}`
    const portSegment = this.config.port ? `:${this.config.port}` : ''
    return `${baseHost}${portSegment}`
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
          } catch {
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
}

/**
 * Create a ServerAgentExecutor instance
 */
export function createServerAgentExecutor(config: ServerAgentExecutorConfig): ServerAgentExecutor {
  return new ServerAgentExecutor(config)
}
