import { loggerService } from '@logger'
import type { ApiClient } from '@types'

const logger = loggerService.withContext('Embeddings')

export interface EmbeddingsConfig {
  embedApiClient: ApiClient
  dimensions?: number
}

/**
 * Simple embeddings class for generating text embeddings using various providers.
 * Supports OpenAI, Azure, and other OpenAI-compatible APIs.
 */
export default class Embeddings {
  private config: EmbeddingsConfig
  private initialized: boolean = false

  constructor(config: EmbeddingsConfig) {
    this.config = config
  }

  /**
   * Initialize the embeddings client
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return
    }

    if (!this.config.embedApiClient) {
      throw new Error('Embedding API client configuration is required')
    }

    this.initialized = true
    logger.debug('Embeddings initialized', {
      provider: this.config.embedApiClient.provider,
      model: this.config.embedApiClient.model,
      dimensions: this.config.dimensions
    })
  }

  /**
   * Generate embeddings for a query text
   * @param text - The text to embed
   * @returns Array of embedding values
   */
  async embedQuery(text: string): Promise<number[]> {
    if (!this.initialized) {
      await this.init()
    }

    const { model, provider, apiKey, baseURL, apiVersion } = this.config.embedApiClient

    if (!apiKey) {
      throw new Error('API key is required for embeddings')
    }

    try {
      // Build the request URL
      let url: string
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      // Handle different providers
      if (provider === 'azure' || provider === 'azure-openai') {
        // Azure OpenAI format
        const apiVersionParam = apiVersion || '2024-02-01'
        url = `${baseURL}/openai/deployments/${model}/embeddings?api-version=${apiVersionParam}`
        headers['api-key'] = apiKey
      } else {
        // OpenAI and compatible APIs
        url = `${baseURL}/embeddings`
        headers['Authorization'] = `Bearer ${apiKey}`
      }

      // Build request body
      const body: Record<string, any> = {
        input: text,
        model: model
      }

      // Add dimensions if specified and supported
      if (this.config.dimensions) {
        body.dimensions = this.config.dimensions
      }

      logger.debug('Generating embedding', { url, model, textLength: text.length })

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Embedding API request failed: ${response.status} ${errorText}`)
      }

      const data = await response.json()

      // Extract embedding from response
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        const embedding = data.data[0].embedding
        if (Array.isArray(embedding)) {
          logger.debug('Embedding generated', { dimensions: embedding.length })
          return embedding
        }
      }

      throw new Error('Invalid embedding response format')
    } catch (error) {
      logger.error('Failed to generate embedding:', error as Error)
      throw error
    }
  }
}
