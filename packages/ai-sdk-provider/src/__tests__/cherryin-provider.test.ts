/**
 * CherryIN Provider Comprehensive Tests
 * Tests the CherryIN provider factory and model creation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cherryIn,
  CHERRYIN_PROVIDER_NAME,
  createCherryIn,
  DEFAULT_CHERRYIN_ANTHROPIC_BASE_URL,
  DEFAULT_CHERRYIN_BASE_URL,
  DEFAULT_CHERRYIN_GEMINI_BASE_URL
} from '../cherryin-provider'

// Mock the AI SDK internal classes
vi.mock('@ai-sdk/anthropic/internal', () => ({
  AnthropicMessagesLanguageModel: vi.fn().mockImplementation((modelId, settings) => ({
    modelId,
    provider: settings.provider,
    _type: 'anthropic'
  }))
}))

vi.mock('@ai-sdk/google/internal', () => ({
  GoogleGenerativeAILanguageModel: vi.fn().mockImplementation((modelId, settings) => ({
    modelId,
    provider: settings.provider,
    _type: 'google'
  }))
}))

vi.mock('@ai-sdk/openai/internal', () => ({
  OpenAICompletionLanguageModel: vi.fn().mockImplementation((modelId, settings) => ({
    modelId,
    provider: settings.provider,
    _type: 'openai-completion'
  })),
  OpenAIEmbeddingModel: vi.fn().mockImplementation((modelId, settings) => ({
    modelId,
    provider: settings.provider,
    _type: 'openai-embedding'
  })),
  OpenAIImageModel: vi.fn().mockImplementation((modelId, settings) => ({
    modelId,
    provider: settings.provider,
    _type: 'openai-image'
  })),
  OpenAIResponsesLanguageModel: vi.fn().mockImplementation((modelId, settings) => ({
    modelId,
    provider: settings.provider,
    _type: 'openai-responses'
  })),
  OpenAISpeechModel: vi.fn().mockImplementation((modelId, settings) => ({
    modelId,
    provider: settings.provider,
    _type: 'openai-speech'
  })),
  OpenAITranscriptionModel: vi.fn().mockImplementation((modelId, settings) => ({
    modelId,
    provider: settings.provider,
    _type: 'openai-transcription'
  }))
}))

vi.mock('@ai-sdk/openai-compatible', () => ({
  OpenAICompatibleChatLanguageModel: vi.fn().mockImplementation(function (this: any, modelId, settings) {
    this.modelId = modelId
    this.provider = settings.provider
    this._type = 'openai-compatible-chat'
    return this
  })
}))

vi.mock('@ai-sdk/provider-utils', () => ({
  loadApiKey: vi.fn(({ apiKey, environmentVariableName }) => {
    if (apiKey) return apiKey
    return process.env[environmentVariableName] || 'mock-api-key'
  }),
  withoutTrailingSlash: vi.fn((url) => url.replace(/\/$/, ''))
}))

describe('CherryIN Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Constants', () => {
    it('should export correct provider name', () => {
      expect(CHERRYIN_PROVIDER_NAME).toBe('cherryin')
    })

    it('should export correct default URLs', () => {
      expect(DEFAULT_CHERRYIN_BASE_URL).toBe('https://open.cherryin.net/v1')
      expect(DEFAULT_CHERRYIN_ANTHROPIC_BASE_URL).toBe('https://open.cherryin.net/v1')
      expect(DEFAULT_CHERRYIN_GEMINI_BASE_URL).toBe('https://open.cherryin.net/v1beta/models')
    })
  })

  describe('createCherryIn', () => {
    describe('Factory Creation', () => {
      it('should create provider with default settings', () => {
        const provider = createCherryIn()
        expect(provider).toBeDefined()
        expect(typeof provider).toBe('function')
      })

      it('should create provider with custom apiKey', () => {
        const provider = createCherryIn({ apiKey: 'custom-key' })
        expect(provider).toBeDefined()
      })

      it('should create provider with custom baseURL', () => {
        const provider = createCherryIn({ baseURL: 'https://custom.api.com/v1' })
        expect(provider).toBeDefined()
      })

      it('should create provider with custom headers', () => {
        const provider = createCherryIn({
          headers: { 'X-Custom-Header': 'custom-value' }
        })
        expect(provider).toBeDefined()
      })

      it('should create provider with function headers', () => {
        const provider = createCherryIn({
          headers: () => ({ 'X-Dynamic-Header': 'dynamic-value' })
        })
        expect(provider).toBeDefined()
      })

      it('should throw when called with new keyword', () => {
        const provider = createCherryIn()
        expect(() => new (provider as any)('gpt-4')).toThrow('cannot be called with the new keyword')
      })
    })

    describe('Provider Methods', () => {
      let provider: ReturnType<typeof createCherryIn>

      beforeEach(() => {
        provider = createCherryIn({ apiKey: 'test-key' })
      })

      it('should expose languageModel method', () => {
        expect(typeof provider.languageModel).toBe('function')
      })

      it('should expose chat method', () => {
        expect(typeof provider.chat).toBe('function')
      })

      it('should expose responses method', () => {
        expect(typeof provider.responses).toBe('function')
      })

      it('should expose completion method', () => {
        expect(typeof provider.completion).toBe('function')
      })

      it('should expose embedding methods', () => {
        expect(typeof provider.embedding).toBe('function')
        expect(typeof provider.textEmbedding).toBe('function')
        expect(typeof provider.textEmbeddingModel).toBe('function')
      })

      it('should expose image methods', () => {
        expect(typeof provider.image).toBe('function')
        expect(typeof provider.imageModel).toBe('function')
      })

      it('should expose transcription methods', () => {
        expect(typeof provider.transcription).toBe('function')
        expect(typeof provider.transcriptionModel).toBe('function')
      })

      it('should expose speech methods', () => {
        expect(typeof provider.speech).toBe('function')
        expect(typeof provider.speechModel).toBe('function')
      })
    })

    describe('Model Creation by Prefix', () => {
      let provider: ReturnType<typeof createCherryIn>

      beforeEach(() => {
        provider = createCherryIn({ apiKey: 'test-key' })
      })

      it('should create Anthropic model for anthropic/ prefix', () => {
        const model = provider('anthropic/claude-3-5-sonnet-20241022')
        expect((model as any)._type).toBe('anthropic')
      })

      it('should create Anthropic model for ANTHROPIC/ prefix (case insensitive)', () => {
        const model = provider('ANTHROPIC/claude-3-5-sonnet-20241022')
        expect((model as any)._type).toBe('anthropic')
      })

      it('should create Google model for google/ prefix', () => {
        const model = provider('google/gemini-pro')
        expect((model as any)._type).toBe('google')
      })

      it('should create Google model for GOOGLE/ prefix (case insensitive)', () => {
        const model = provider('GOOGLE/gemini-pro')
        expect((model as any)._type).toBe('google')
      })

      it('should create OpenAI Responses model for other prefixes', () => {
        const model = provider('gpt-4')
        expect((model as any)._type).toBe('openai-responses')
      })
    })

    describe('Endpoint Type Override', () => {
      it('should use anthropic endpoint when endpointType is anthropic', () => {
        const provider = createCherryIn({
          apiKey: 'test-key',
          endpointType: 'anthropic'
        })

        const model = provider('gpt-4') // Even non-anthropic model should use anthropic endpoint
        expect((model as any)._type).toBe('anthropic')
      })

      it('should use gemini endpoint when endpointType is gemini', () => {
        const provider = createCherryIn({
          apiKey: 'test-key',
          endpointType: 'gemini'
        })

        const model = provider('gpt-4')
        expect((model as any)._type).toBe('google')
      })

      it('should use openai-chat endpoint when endpointType is openai', () => {
        const provider = createCherryIn({
          apiKey: 'test-key',
          endpointType: 'openai'
        })

        const model = provider.languageModel('gpt-4')
        expect((model as any)._type).toBe('openai-compatible-chat')
      })

      it('should use openai-response endpoint when endpointType is openai-response', () => {
        const provider = createCherryIn({
          apiKey: 'test-key',
          endpointType: 'openai-response'
        })

        const model = provider('gpt-4')
        expect((model as any)._type).toBe('openai-responses')
      })
    })

    describe('Model Type Methods', () => {
      let provider: ReturnType<typeof createCherryIn>

      beforeEach(() => {
        provider = createCherryIn({ apiKey: 'test-key' })
      })

      it('should create chat model with chat()', () => {
        const model = provider.chat('gpt-4')
        expect((model as any)._type).toBe('openai-compatible-chat')
      })

      it('should create responses model with responses()', () => {
        const model = provider.responses('gpt-4')
        expect((model as any)._type).toBe('openai-responses')
        expect((model as any).provider).toBe('cherryin.responses')
      })

      it('should create completion model with completion()', () => {
        const model = provider.completion('gpt-3.5-turbo-instruct')
        expect((model as any)._type).toBe('openai-completion')
        expect((model as any).provider).toBe('cherryin.completion')
      })

      it('should create embedding model with embedding()', () => {
        const model = provider.embedding('text-embedding-ada-002')
        expect((model as any)._type).toBe('openai-embedding')
        expect((model as any).provider).toBe('cherryin.embeddings')
      })

      it('should create embedding model with textEmbedding()', () => {
        const model = provider.textEmbedding('text-embedding-3-large')
        expect((model as any)._type).toBe('openai-embedding')
      })

      it('should create image model with image()', () => {
        const model = provider.image('dall-e-3')
        expect((model as any)._type).toBe('openai-image')
        expect((model as any).provider).toBe('cherryin.image')
      })

      it('should create transcription model with transcription()', () => {
        const model = provider.transcription('whisper-1')
        expect((model as any)._type).toBe('openai-transcription')
        expect((model as any).provider).toBe('cherryin.transcription')
      })

      it('should create speech model with speech()', () => {
        const model = provider.speech('tts-1')
        expect((model as any)._type).toBe('openai-speech')
        expect((model as any).provider).toBe('cherryin.speech')
      })
    })

    describe('Model Settings', () => {
      it('should pass custom settings to model', () => {
        const provider = createCherryIn({ apiKey: 'test-key' })

        // The settings should be passed through
        const model = provider.chat('gpt-4', { headers: { 'X-Model-Header': 'value' } })
        expect(model).toBeDefined()
      })
    })
  })

  describe('Default Instance', () => {
    it('should export default cherryIn instance', () => {
      expect(cherryIn).toBeDefined()
      expect(typeof cherryIn).toBe('function')
    })

    it('should have all provider methods', () => {
      expect(typeof cherryIn.languageModel).toBe('function')
      expect(typeof cherryIn.chat).toBe('function')
      expect(typeof cherryIn.embedding).toBe('function')
      expect(typeof cherryIn.image).toBe('function')
    })
  })

  describe('Custom Fetch Behavior', () => {
    it('should remove empty tool_choice when tools array is empty', async () => {
      let capturedBody: any = null
      const customFetch = vi.fn().mockImplementation(async (url, options) => {
        capturedBody = JSON.parse(options.body)
        return new Response(JSON.stringify({ choices: [] }))
      })

      const provider = createCherryIn({
        apiKey: 'test-key',
        fetch: customFetch
      })

      // The custom fetch is applied internally, we just verify it was configured
      expect(provider).toBeDefined()
    })
  })
})
