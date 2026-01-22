import type { AiPlugin } from '@cherrystudio/ai-core'
import { browserUsePlugin, createPromptToolUsePlugin, webSearchPlugin } from '@cherrystudio/ai-core/built-in/plugins'
import { loggerService } from '@logger'
import { getEnableDeveloperMode } from '@renderer/hooks/useSettings'
import { fetchGenerate } from '@renderer/services/ApiService'
import { getDefaultModel, getQuickModel } from '@renderer/services/AssistantService'
import { browserAgentService } from '@renderer/services/BrowserAgentService'
import type { Assistant } from '@renderer/types'

import type { AiSdkMiddlewareConfig } from '../middleware/AiSdkMiddlewareBuilder'
import { searchOrchestrationPlugin } from './searchOrchestrationPlugin'
import { createTelemetryPlugin } from './telemetryPlugin'

const logger = loggerService.withContext('PluginBuilder')

/**
 * Create an AI call function for browser snapshot summarization
 * Uses the current assistant's model for consistent API access
 */
function createBrowserAiCall(assistant: Assistant): (prompt: string) => Promise<string> {
  return async (prompt: string) => {
    // Use the current assistant's model (same as chat) to ensure valid API credentials
    const model = assistant.model || getQuickModel() || getDefaultModel()
    logger.debug('Browser AI call for snapshot summarization', {
      modelId: model?.id,
      modelName: model?.name,
      assistantId: assistant.id
    })
    return fetchGenerate({
      prompt: 'You are a helpful assistant that summarizes browser page content concisely.',
      content: prompt,
      model
    })
  }
}
/**
 * 根据条件构建插件数组
 */
export function buildPlugins(
  middlewareConfig: AiSdkMiddlewareConfig & { assistant: Assistant; topicId?: string }
): AiPlugin[] {
  const plugins: AiPlugin[] = []

  if (middlewareConfig.topicId && getEnableDeveloperMode()) {
    // 0. 添加 telemetry 插件
    plugins.push(
      createTelemetryPlugin({
        enabled: true,
        topicId: middlewareConfig.topicId,
        assistant: middlewareConfig.assistant
      })
    )
  }

  // 1. 浏览器使用插件
  if (middlewareConfig.enableBrowserUse && middlewareConfig.browserUseConfig) {
    logger.info('🌐 Browser Use Plugin enabled', {
      maxSnapshotSize: middlewareConfig.browserUseConfig.maxSnapshotSize,
      enableTracking: middlewareConfig.browserUseConfig.enableTracking,
      injectSystemPrompt: middlewareConfig.browserUseConfig.injectSystemPrompt
    })
    plugins.push(
      browserUsePlugin({
        browserAgentService: browserAgentService,
        toolset: 'standard',
        // Always provide aiCall for hooks to generate summaries (snapshot → summary → inject)
        // Use the current assistant's model for consistent API access
        aiCall: createBrowserAiCall(middlewareConfig.assistant),
        onSnapshotSummary: middlewareConfig.browserUseConfig.enableTracking
          ? (summary: string) => {
              logger.info('🖼️ Browser snapshot summary generated', { summaryLength: summary.length })
            }
          : undefined
      })
    )
  }

  // 2. 模型内置搜索
  if (middlewareConfig.enableWebSearch && middlewareConfig.webSearchPluginConfig) {
    plugins.push(webSearchPlugin(middlewareConfig.webSearchPluginConfig))
  }
  // 3. 支持工具调用时添加搜索插件
  if (middlewareConfig.isSupportedToolUse || middlewareConfig.isPromptToolUse) {
    plugins.push(searchOrchestrationPlugin(middlewareConfig.assistant, middlewareConfig.topicId || ''))
  }

  // 4. 推理模型时添加推理插件
  // if (middlewareConfig.enableReasoning) {
  //   plugins.push(reasoningTimePlugin)
  // }

  // 5. 启用Prompt工具调用时添加工具插件
  if (middlewareConfig.isPromptToolUse) {
    plugins.push(
      createPromptToolUsePlugin({
        enabled: true,
        mcpMode: middlewareConfig.mcpMode,
        createSystemMessage: (systemPrompt, params, context) => {
          const modelId = typeof context.model === 'string' ? context.model : context.model.modelId
          if (modelId.includes('o1-mini') || modelId.includes('o1-preview')) {
            if (context.isRecursiveCall) {
              return null
            }
            params.messages = [
              {
                role: 'assistant',
                content: systemPrompt
              },
              ...params.messages
            ]
            return null
          }
          return systemPrompt
        }
      })
    )
  }

  // if (middlewareConfig.enableUrlContext && middlewareConfig.) {
  //   plugins.push(googleToolsPlugin({ urlContext: true }))
  // }

  logger.info('📦 Active plugins:', {
    count: plugins.length,
    plugins: plugins.map((p) => p.name),
    enableBrowserUse: middlewareConfig.enableBrowserUse,
    enableWebSearch: middlewareConfig.enableWebSearch,
    isSupportedToolUse: middlewareConfig.isSupportedToolUse,
    isPromptToolUse: middlewareConfig.isPromptToolUse
  })

  return plugins
}
