/**
 * ModelResolver Comprehensive Tests
 * Tests model resolution for language, embedding, and image models
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockImageModel, createMockLanguageModel } from '../../../__tests__'
import { globalRegistryManagement } from '../../providers/RegistryManagement'
import { globalModelResolver, ModelResolver } from '../ModelResolver'

// Mock the registry management
vi.mock('../../providers/RegistryManagement', () => ({
  globalRegistryManagement: {
    languageModel: vi.fn(),
    textEmbeddingModel: vi.fn(),
    imageModel: vi.fn()
  },
  DEFAULT_SEPARATOR: ':'
}))

// Mock the middleware wrapper
vi.mock('../../middleware/wrapper', () => ({
  wrapModelWithMiddlewares: vi.fn((model, middlewares) => {
    // Return a model with a marker to indicate middlewares were applied
    return { ...model, _middlewaresApplied: middlewares.length }
  })
}))

describe('ModelResolver', () => {
  let resolver: ModelResolver
  let mockLanguageModel: any
  let mockEmbeddingModel: any
  let mockImageModel: any

  beforeEach(() => {
    vi.clearAllMocks()
    resolver = new ModelResolver()

    mockLanguageModel = createMockLanguageModel({
      provider: 'test-provider',
      modelId: 'test-model'
    })

    mockEmbeddingModel = {
      specificationVersion: 'v1',
      provider: 'test-provider',
      modelId: 'test-embedding-model',
      doEmbed: vi.fn()
    }

    mockImageModel = createMockImageModel({
      provider: 'test-provider',
      modelId: 'test-image-model'
    })

    vi.mocked(globalRegistryManagement.languageModel).mockReturnValue(mockLanguageModel)
    vi.mocked(globalRegistryManagement.textEmbeddingModel).mockReturnValue(mockEmbeddingModel)
    vi.mocked(globalRegistryManagement.imageModel).mockReturnValue(mockImageModel)
  })

  describe('resolveLanguageModel', () => {
    describe('Traditional Format', () => {
      it('should resolve traditional format modelId with fallback provider', async () => {
        const model = await resolver.resolveLanguageModel('gpt-4', 'openai')

        expect(globalRegistryManagement.languageModel).toHaveBeenCalledWith('openai:gpt-4')
        expect(model).toBeDefined()
      })

      it('should resolve with different providers', async () => {
        const providers = ['anthropic', 'google', 'deepseek', 'xai']

        for (const providerId of providers) {
          vi.clearAllMocks()
          await resolver.resolveLanguageModel('test-model', providerId)
          expect(globalRegistryManagement.languageModel).toHaveBeenCalledWith(`${providerId}:test-model`)
        }
      })

      it('should handle special characters in model names', async () => {
        await resolver.resolveLanguageModel('gpt-4-turbo-preview', 'openai')
        expect(globalRegistryManagement.languageModel).toHaveBeenCalledWith('openai:gpt-4-turbo-preview')
      })
    })

    describe('Namespaced Format', () => {
      it('should resolve namespaced format modelId', async () => {
        const model = await resolver.resolveLanguageModel('anthropic:claude-3', 'openai')

        expect(globalRegistryManagement.languageModel).toHaveBeenCalledWith('anthropic:claude-3')
        expect(model).toBeDefined()
      })

      it('should resolve multi-level namespaced format', async () => {
        await resolver.resolveLanguageModel('aihubmix:anthropic:claude-3', 'openai')
        expect(globalRegistryManagement.languageModel).toHaveBeenCalledWith('aihubmix:anthropic:claude-3')
      })

      it('should ignore fallback provider for namespaced models', async () => {
        await resolver.resolveLanguageModel('google:gemini-pro', 'openai')
        expect(globalRegistryManagement.languageModel).toHaveBeenCalledWith('google:gemini-pro')
      })
    })

    describe('OpenAI Mode Selection', () => {
      it('should use openai-chat provider when mode is chat', async () => {
        await resolver.resolveLanguageModel('gpt-4', 'openai', { mode: 'chat' })
        expect(globalRegistryManagement.languageModel).toHaveBeenCalledWith('openai-chat:gpt-4')
      })

      it('should use azure-chat provider when mode is chat with azure', async () => {
        await resolver.resolveLanguageModel('gpt-4', 'azure', { mode: 'chat' })
        expect(globalRegistryManagement.languageModel).toHaveBeenCalledWith('azure-chat:gpt-4')
      })

      it('should not modify provider when mode is not chat', async () => {
        await resolver.resolveLanguageModel('gpt-4', 'openai', { mode: 'completion' })
        expect(globalRegistryManagement.languageModel).toHaveBeenCalledWith('openai:gpt-4')
      })

      it('should not modify non-openai/azure providers regardless of mode', async () => {
        await resolver.resolveLanguageModel('claude-3', 'anthropic', { mode: 'chat' })
        expect(globalRegistryManagement.languageModel).toHaveBeenCalledWith('anthropic:claude-3')
      })
    })

    describe('Middleware Application', () => {
      it('should apply middlewares to the model', async () => {
        const mockMiddleware1 = { wrapGenerate: vi.fn() }
        const mockMiddleware2 = { wrapStream: vi.fn() }

        const model = await resolver.resolveLanguageModel('gpt-4', 'openai', undefined, [
          mockMiddleware1,
          mockMiddleware2
        ])

        expect((model as any)._middlewaresApplied).toBe(2)
      })

      it('should not wrap model when no middlewares provided', async () => {
        const model = await resolver.resolveLanguageModel('gpt-4', 'openai', undefined, [])

        // Model should be returned as-is without middleware marker
        expect((model as any)._middlewaresApplied).toBeUndefined()
      })

      it('should not wrap model when middlewares is undefined', async () => {
        const model = await resolver.resolveLanguageModel('gpt-4', 'openai')

        expect((model as any)._middlewaresApplied).toBeUndefined()
      })
    })
  })

  describe('resolveTextEmbeddingModel', () => {
    describe('Traditional Format', () => {
      it('should resolve traditional format embedding model', async () => {
        const model = await resolver.resolveTextEmbeddingModel('text-embedding-ada-002', 'openai')

        expect(globalRegistryManagement.textEmbeddingModel).toHaveBeenCalledWith('openai:text-embedding-ada-002')
        expect(model).toBeDefined()
      })

      it('should handle different providers', async () => {
        await resolver.resolveTextEmbeddingModel('embed-english-v3.0', 'cohere')
        expect(globalRegistryManagement.textEmbeddingModel).toHaveBeenCalledWith('cohere:embed-english-v3.0')
      })
    })

    describe('Namespaced Format', () => {
      it('should resolve namespaced format embedding model', async () => {
        const model = await resolver.resolveTextEmbeddingModel('openai:text-embedding-3-large', 'fallback')

        expect(globalRegistryManagement.textEmbeddingModel).toHaveBeenCalledWith('openai:text-embedding-3-large')
        expect(model).toBeDefined()
      })
    })
  })

  describe('resolveImageModel', () => {
    describe('Traditional Format', () => {
      it('should resolve traditional format image model', async () => {
        const model = await resolver.resolveImageModel('dall-e-3', 'openai')

        expect(globalRegistryManagement.imageModel).toHaveBeenCalledWith('openai:dall-e-3')
        expect(model).toBeDefined()
      })

      it('should handle different providers', async () => {
        await resolver.resolveImageModel('imagen-3.0-generate-001', 'google')
        expect(globalRegistryManagement.imageModel).toHaveBeenCalledWith('google:imagen-3.0-generate-001')
      })
    })

    describe('Namespaced Format', () => {
      it('should resolve namespaced format image model', async () => {
        const model = await resolver.resolveImageModel('xai:grok-2-image', 'fallback')

        expect(globalRegistryManagement.imageModel).toHaveBeenCalledWith('xai:grok-2-image')
        expect(model).toBeDefined()
      })
    })
  })

  describe('Global Instance', () => {
    it('should export a global model resolver instance', () => {
      expect(globalModelResolver).toBeInstanceOf(ModelResolver)
    })

    it('should be usable without instantiation', async () => {
      await globalModelResolver.resolveLanguageModel('gpt-4', 'openai')
      expect(globalRegistryManagement.languageModel).toHaveBeenCalled()
    })
  })
})
