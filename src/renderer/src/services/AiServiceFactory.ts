/**
 * AI Service Factory
 *
 * Creates AiService instances from the existing ApiService infrastructure
 * for use with browserUsePlugin snapshot summarization.
 */

import type { AiService } from '@cherrystudio/ai-core/built-in/plugins'
import type { Model } from '@renderer/types'

import { getDefaultModel, getQuickModel } from './AssistantService'
import { fetchGenerate } from './ApiService'

/**
 * Create an AiService from the existing ApiService infrastructure.
 *
 * @param model - Optional model to use. Defaults to quickModel or defaultModel.
 * @returns AiService compatible with browserUsePlugin
 *
 * @example
 * ```typescript
 * import { createAiServiceFromApiService } from '@renderer/services/AiServiceFactory'
 * import { browserUsePlugin } from '@cherrystudio/ai-core/built-in/plugins'
 *
 * // Use default/quick model
 * const aiService = createAiServiceFromApiService()
 *
 * // Or specify a model
 * const aiService = createAiServiceFromApiService(myModel)
 *
 * browserUsePlugin({
 *   browserAgentService,
 *   aiService
 * })
 * ```
 */
export function createAiServiceFromApiService(model?: Model): AiService {
  return {
    async generateText(prompt: string): Promise<string> {
      // Use provided model, or fall back to quickModel, then defaultModel
      const resolvedModel = model || getQuickModel() || getDefaultModel()

      const result = await fetchGenerate({
        prompt: '', // System prompt (empty, we put everything in content)
        content: prompt,
        model: resolvedModel
      })

      return result
    }
  }
}

/**
 * Create an AiService that always uses the current quick/default model.
 * The model is resolved at call time, not at creation time.
 *
 * @example
 * ```typescript
 * const aiService = createDynamicAiService()
 *
 * // Model is resolved when generateText is called
 * await aiService.generateText('...')
 * ```
 */
export function createDynamicAiService(): AiService {
  return {
    async generateText(prompt: string): Promise<string> {
      // Resolve model at call time
      const model = getQuickModel() || getDefaultModel()

      const result = await fetchGenerate({
        prompt: '',
        content: prompt,
        model
      })

      return result
    }
  }
}
