/**
 * Local Agent Executor
 *
 * Executes browser-compatible agents (skill-creator) using the AI SDK directly.
 * Runs entirely in the browser without requiring a backend server.
 */
import { createExecutor } from '@cherrystudio/ai-core'
import { loggerService } from '@logger'
import { createAiSdkProvider } from '@renderer/aiCore/provider/factory'
import { providerToAiSdkConfig } from '@renderer/aiCore/provider/providerConfig'
import { getModel } from '@renderer/hooks/useModel'
import { getProviderByModel } from '@renderer/services/AssistantService'
import store from '@renderer/store'
import { addSkill as addSkillAction } from '@renderer/store/skill'
import { validateSkillInput } from '@renderer/tools'
import type { AgentType, Model, Provider } from '@renderer/types'
import type { Skill } from '@renderer/types/skill'
import { type TextStreamPart, tool, type ToolSet } from 'ai'
import { v4 as uuid } from 'uuid'
import * as z from 'zod'

import type { AgentExecutionConfig, AgentExecutionResult, IAgentExecutor } from '../AgentExecutor'
import { getAgentToolProvider } from '../AgentToolProvider'

const logger = loggerService.withContext('LocalAgentExecutor')

/**
 * Local Agent Executor Implementation
 *
 * Executes skill-creator agents in the browser using AI SDK.
 */
export class LocalAgentExecutor implements IAgentExecutor {
  readonly agentType: AgentType = 'skill-creator'

  /**
   * Check if this executor can handle the given agent type
   */
  canExecute(agentType: AgentType): boolean {
    return agentType === 'skill-creator'
  }

  /**
   * Check if the executor is available in the current environment
   */
  async isAvailable(): Promise<boolean> {
    // Local executor is always available in browser environment
    return true
  }

  /**
   * Execute an agent task and return a stream of results
   */
  async execute(config: AgentExecutionConfig): Promise<AgentExecutionResult> {
    const { session, content, signal } = config

    logger.info('Executing local agent', {
      sessionId: session.id,
      agentType: session.agent_type,
      contentLength: content.length
    })

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
    const stream = this.createExecutionStream(session, content, model, provider, config.history, signal)

    return { stream }
  }

  /**
   * Get available tools for this executor
   */
  async getAvailableTools(): Promise<ToolSet> {
    return this.buildTools()
  }

  /**
   * Build AI SDK tools for local execution
   */
  private buildTools(allowedTools?: string[]): ToolSet {
    const tools: ToolSet = {}
    const toolProvider = getAgentToolProvider()
    const availableToolDefs = toolProvider.getBrowserCompatibleTools(this.agentType)

    // Filter by allowed tools if specified
    const filteredDefs =
      allowedTools && allowedTools.length > 0
        ? availableToolDefs.filter((t) => allowedTools.includes(t.id) || allowedTools.includes(t.name))
        : availableToolDefs

    for (const toolDef of filteredDefs) {
      if (toolDef.id === 'addSkill') {
        tools.addSkill = tool({
          description: toolDef.description,
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
      } else if (toolDef.id === 'think') {
        tools.think = tool({
          description: toolDef.description,
          inputSchema: z.object({
            thought: z.string().describe('Your thoughts.')
          }),
          execute: async (params) => {
            logger.debug('Agent thinking', { thought: params.thought })
            return { thought: params.thought }
          }
        })
      }
      // Additional browser-compatible tools can be added here
    }

    return tools
  }

  /**
   * Create the execution stream
   */
  private createExecutionStream(
    session: AgentExecutionConfig['session'],
    content: string,
    model: Model,
    provider: Provider,
    history?: AgentExecutionConfig['history'],
    signal?: AbortSignal
  ): ReadableStream<TextStreamPart<Record<string, any>>> {
    // Build tools before creating the stream (capture in closure)
    const tools = this.buildTools(session.allowed_tools)

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

          // Add conversation history
          if (history && history.length > 0) {
            messages.push(...history)
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
            hasInstructions: !!session.instructions,
            historyLength: history?.length ?? 0
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
        logger.debug('Local agent stream cancelled')
      }
    })
  }
}

/**
 * Create a LocalAgentExecutor instance
 */
export function createLocalAgentExecutor(): LocalAgentExecutor {
  return new LocalAgentExecutor()
}
