/**
 * Middleware Wrapper Tests
 * Tests the middleware wrapping functionality for language models
 */

import { wrapLanguageModel } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockLanguageModel } from '../../../__tests__'
import { wrapModelWithMiddlewares } from '../wrapper'

// Mock AI SDK's wrapLanguageModel
vi.mock('ai', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    wrapLanguageModel: vi.fn((options) => ({
      ...options.model,
      _wrapped: true,
      _middlewareCount: options.middleware?.length ?? 0
    }))
  }
})

describe('wrapModelWithMiddlewares', () => {
  let mockModel: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockModel = createMockLanguageModel({
      provider: 'test-provider',
      modelId: 'test-model'
    })
  })

  describe('Basic Functionality', () => {
    it('should return original model when no middlewares provided', () => {
      const result = wrapModelWithMiddlewares(mockModel, [])

      expect(result).toBe(mockModel)
      expect(wrapLanguageModel).not.toHaveBeenCalled()
    })

    it('should wrap model with single middleware', () => {
      const middleware = {
        wrapGenerate: vi.fn((fn) => fn)
      }

      const result = wrapModelWithMiddlewares(mockModel, [middleware])

      expect(wrapLanguageModel).toHaveBeenCalledWith({
        model: mockModel,
        middleware: [middleware]
      })
      expect((result as any)._wrapped).toBe(true)
    })

    it('should wrap model with multiple middlewares', () => {
      const middleware1 = { wrapGenerate: vi.fn((fn) => fn) }
      const middleware2 = { wrapStream: vi.fn((fn) => fn) }
      const middleware3 = { wrapGenerate: vi.fn((fn) => fn), wrapStream: vi.fn((fn) => fn) }

      const result = wrapModelWithMiddlewares(mockModel, [middleware1, middleware2, middleware3])

      expect(wrapLanguageModel).toHaveBeenCalledWith({
        model: mockModel,
        middleware: [middleware1, middleware2, middleware3]
      })
      expect((result as any)._middlewareCount).toBe(3)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty middleware array', () => {
      const result = wrapModelWithMiddlewares(mockModel, [])

      expect(result).toBe(mockModel)
      expect((result as any)._wrapped).toBeUndefined()
    })

    it('should preserve model properties after wrapping', () => {
      const middleware = { wrapGenerate: vi.fn((fn) => fn) }

      const result = wrapModelWithMiddlewares(mockModel, [middleware])

      expect((result as any).provider).toBe('test-provider')
      expect((result as any).modelId).toBe('test-model')
    })
  })

  describe('Middleware Types', () => {
    it('should accept middleware with wrapGenerate', () => {
      const middleware = {
        wrapGenerate: vi.fn(async ({ doGenerate }) => doGenerate())
      }

      wrapModelWithMiddlewares(mockModel, [middleware])

      expect(wrapLanguageModel).toHaveBeenCalledWith(
        expect.objectContaining({
          middleware: [middleware]
        })
      )
    })

    it('should accept middleware with wrapStream', () => {
      const middleware = {
        wrapStream: vi.fn(async ({ doStream }) => doStream())
      }

      wrapModelWithMiddlewares(mockModel, [middleware])

      expect(wrapLanguageModel).toHaveBeenCalledWith(
        expect.objectContaining({
          middleware: [middleware]
        })
      )
    })

    it('should accept middleware with both wrapGenerate and wrapStream', () => {
      const middleware = {
        wrapGenerate: vi.fn(async ({ doGenerate }) => doGenerate()),
        wrapStream: vi.fn(async ({ doStream }) => doStream())
      }

      wrapModelWithMiddlewares(mockModel, [middleware])

      expect(wrapLanguageModel).toHaveBeenCalledWith(
        expect.objectContaining({
          middleware: [middleware]
        })
      )
    })

    it('should accept middleware with transformParams', () => {
      const middleware = {
        transformParams: vi.fn(async (params) => params)
      }

      wrapModelWithMiddlewares(mockModel, [middleware])

      expect(wrapLanguageModel).toHaveBeenCalledWith(
        expect.objectContaining({
          middleware: [middleware]
        })
      )
    })
  })
})
