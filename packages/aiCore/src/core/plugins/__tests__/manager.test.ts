/**
 * PluginManager Comprehensive Tests
 * Tests plugin lifecycle management, hook execution, and sorting
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PluginManager } from '../manager'
import type { AiPlugin, AiRequestContext } from '../types'

describe('PluginManager', () => {
  let manager: PluginManager
  let mockContext: AiRequestContext

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new PluginManager()
    mockContext = {
      providerId: 'openai',
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      requestId: 'test-request-id',
      startTime: Date.now()
    }
  })

  describe('Constructor and Initialization', () => {
    it('should create an empty manager', () => {
      const manager = new PluginManager()
      expect(manager.getPlugins()).toHaveLength(0)
    })

    it('should create manager with initial plugins', () => {
      const plugin1: AiPlugin = { name: 'plugin-1' }
      const plugin2: AiPlugin = { name: 'plugin-2' }

      const manager = new PluginManager([plugin1, plugin2])
      expect(manager.getPlugins()).toHaveLength(2)
    })

    it('should sort plugins on construction', () => {
      const prePlugin: AiPlugin = { name: 'pre', enforce: 'pre' }
      const postPlugin: AiPlugin = { name: 'post', enforce: 'post' }
      const normalPlugin: AiPlugin = { name: 'normal' }

      const manager = new PluginManager([postPlugin, normalPlugin, prePlugin])
      const plugins = manager.getPlugins()

      expect(plugins[0].name).toBe('pre')
      expect(plugins[1].name).toBe('normal')
      expect(plugins[2].name).toBe('post')
    })
  })

  describe('Plugin Management', () => {
    describe('use()', () => {
      it('should add a plugin', () => {
        const plugin: AiPlugin = { name: 'test-plugin' }
        manager.use(plugin)

        expect(manager.getPlugins()).toHaveLength(1)
        expect(manager.getPlugins()[0].name).toBe('test-plugin')
      })

      it('should maintain plugin order after adding', () => {
        const plugin1: AiPlugin = { name: 'plugin-1', enforce: 'post' }
        const plugin2: AiPlugin = { name: 'plugin-2', enforce: 'pre' }
        const plugin3: AiPlugin = { name: 'plugin-3' }

        manager.use(plugin1).use(plugin2).use(plugin3)
        const plugins = manager.getPlugins()

        expect(plugins[0].name).toBe('plugin-2') // pre
        expect(plugins[1].name).toBe('plugin-3') // normal
        expect(plugins[2].name).toBe('plugin-1') // post
      })

      it('should support method chaining', () => {
        const result = manager.use({ name: 'p1' }).use({ name: 'p2' }).use({ name: 'p3' })

        expect(result).toBe(manager)
        expect(manager.getPlugins()).toHaveLength(3)
      })
    })

    describe('remove()', () => {
      it('should remove a plugin by name', () => {
        manager.use({ name: 'plugin-1' }).use({ name: 'plugin-2' }).use({ name: 'plugin-3' })

        manager.remove('plugin-2')

        expect(manager.getPlugins()).toHaveLength(2)
        expect(manager.getPlugins().find((p) => p.name === 'plugin-2')).toBeUndefined()
      })

      it('should do nothing when removing non-existent plugin', () => {
        manager.use({ name: 'plugin-1' })

        manager.remove('non-existent')

        expect(manager.getPlugins()).toHaveLength(1)
      })

      it('should support method chaining', () => {
        manager.use({ name: 'p1' }).use({ name: 'p2' })

        const result = manager.remove('p1')

        expect(result).toBe(manager)
      })
    })
  })

  describe('Plugin Sorting', () => {
    it('should sort pre plugins first', () => {
      manager.use({ name: 'normal', enforce: undefined }).use({ name: 'pre', enforce: 'pre' })

      const plugins = manager.getPlugins()
      expect(plugins[0].name).toBe('pre')
    })

    it('should sort post plugins last', () => {
      manager.use({ name: 'post', enforce: 'post' }).use({ name: 'normal', enforce: undefined })

      const plugins = manager.getPlugins()
      expect(plugins[1].name).toBe('post')
    })

    it('should maintain insertion order within same enforce level', () => {
      manager
        .use({ name: 'pre-1', enforce: 'pre' })
        .use({ name: 'pre-2', enforce: 'pre' })
        .use({ name: 'normal-1' })
        .use({ name: 'normal-2' })

      const plugins = manager.getPlugins()
      expect(plugins[0].name).toBe('pre-1')
      expect(plugins[1].name).toBe('pre-2')
      expect(plugins[2].name).toBe('normal-1')
      expect(plugins[3].name).toBe('normal-2')
    })
  })

  describe('Hook Execution', () => {
    describe('executeFirst()', () => {
      it('should return first non-null result', async () => {
        const plugin1: AiPlugin = {
          name: 'plugin-1',
          resolveModel: vi.fn().mockResolvedValue(null)
        }
        const plugin2: AiPlugin = {
          name: 'plugin-2',
          resolveModel: vi.fn().mockResolvedValue('resolved-model')
        }
        const plugin3: AiPlugin = {
          name: 'plugin-3',
          resolveModel: vi.fn().mockResolvedValue('another-model')
        }

        manager.use(plugin1).use(plugin2).use(plugin3)

        const result = await manager.executeFirst('resolveModel', 'model-id', mockContext)

        expect(result).toBe('resolved-model')
        expect(plugin3.resolveModel).not.toHaveBeenCalled()
      })

      it('should return null when no plugin returns value', async () => {
        const plugin1: AiPlugin = {
          name: 'plugin-1',
          resolveModel: vi.fn().mockResolvedValue(null)
        }
        const plugin2: AiPlugin = {
          name: 'plugin-2',
          resolveModel: vi.fn().mockResolvedValue(undefined)
        }

        manager.use(plugin1).use(plugin2)

        const result = await manager.executeFirst('resolveModel', 'model-id', mockContext)

        expect(result).toBeNull()
      })

      it('should skip plugins without the hook', async () => {
        const plugin1: AiPlugin = { name: 'plugin-1' } // No resolveModel hook
        const plugin2: AiPlugin = {
          name: 'plugin-2',
          resolveModel: vi.fn().mockResolvedValue('resolved')
        }

        manager.use(plugin1).use(plugin2)

        const result = await manager.executeFirst('resolveModel', 'model-id', mockContext)

        expect(result).toBe('resolved')
      })
    })

    describe('executeSequential()', () => {
      it('should chain transform results', async () => {
        const plugin1: AiPlugin = {
          name: 'plugin-1',
          transformParams: vi.fn().mockImplementation(async (params) => ({
            ...params,
            temperature: 0.5
          }))
        }
        const plugin2: AiPlugin = {
          name: 'plugin-2',
          transformParams: vi.fn().mockImplementation(async (params) => ({
            ...params,
            maxTokens: 100
          }))
        }

        manager.use(plugin1).use(plugin2)

        const initialParams = { messages: [] }
        const result = await manager.executeSequential('transformParams', initialParams, mockContext)

        expect(result).toEqual({
          messages: [],
          temperature: 0.5,
          maxTokens: 100
        })
      })

      it('should pass result from one plugin to the next', async () => {
        const plugin1: AiPlugin = {
          name: 'plugin-1',
          transformParams: vi.fn().mockImplementation(async (params) => ({
            ...params,
            step: 1
          }))
        }
        const plugin2: AiPlugin = {
          name: 'plugin-2',
          transformParams: vi.fn().mockImplementation(async (params) => ({
            ...params,
            step: params.step + 1
          }))
        }

        manager.use(plugin1).use(plugin2)

        const result = await manager.executeSequential('transformParams', { step: 0 }, mockContext)

        expect(result).toEqual({ step: 2 })
        expect(plugin2.transformParams).toHaveBeenCalledWith(expect.objectContaining({ step: 1 }), expect.anything())
      })

      it('should return original value when no plugins have the hook', async () => {
        const plugin: AiPlugin = { name: 'plugin-1' }
        manager.use(plugin)

        const initialValue = { test: 'value' }
        const result = await manager.executeSequential('transformParams', initialValue, mockContext)

        expect(result).toBe(initialValue)
      })
    })

    describe('executeConfigureContext()', () => {
      it('should call configureContext on all plugins', async () => {
        const plugin1: AiPlugin = {
          name: 'plugin-1',
          configureContext: vi.fn()
        }
        const plugin2: AiPlugin = {
          name: 'plugin-2',
          configureContext: vi.fn()
        }

        manager.use(plugin1).use(plugin2)

        await manager.executeConfigureContext(mockContext)

        expect(plugin1.configureContext).toHaveBeenCalledWith(mockContext)
        expect(plugin2.configureContext).toHaveBeenCalledWith(mockContext)
      })

      it('should mutate context in sequence', async () => {
        const plugin1: AiPlugin = {
          name: 'plugin-1',
          configureContext: vi.fn().mockImplementation(async (ctx) => {
            ctx.extra1 = 'value1'
          })
        }
        const plugin2: AiPlugin = {
          name: 'plugin-2',
          configureContext: vi.fn().mockImplementation(async (ctx) => {
            ctx.extra2 = 'value2'
          })
        }

        manager.use(plugin1).use(plugin2)

        await manager.executeConfigureContext(mockContext)

        expect((mockContext as any).extra1).toBe('value1')
        expect((mockContext as any).extra2).toBe('value2')
      })
    })

    describe('executeParallel()', () => {
      it('should execute onRequestStart hooks in parallel', async () => {
        const executionOrder: string[] = []

        const plugin1: AiPlugin = {
          name: 'plugin-1',
          onRequestStart: vi.fn().mockImplementation(async () => {
            await new Promise((r) => setTimeout(r, 10))
            executionOrder.push('plugin-1')
          })
        }
        const plugin2: AiPlugin = {
          name: 'plugin-2',
          onRequestStart: vi.fn().mockImplementation(async () => {
            executionOrder.push('plugin-2')
          })
        }

        manager.use(plugin1).use(plugin2)

        await manager.executeParallel('onRequestStart', mockContext)

        expect(plugin1.onRequestStart).toHaveBeenCalledWith(mockContext)
        expect(plugin2.onRequestStart).toHaveBeenCalledWith(mockContext)
        // plugin-2 should complete first since it has no delay
        expect(executionOrder[0]).toBe('plugin-2')
      })

      it('should execute onRequestEnd hooks with result', async () => {
        const mockResult = { text: 'response' }
        const plugin: AiPlugin = {
          name: 'plugin-1',
          onRequestEnd: vi.fn()
        }

        manager.use(plugin)

        await manager.executeParallel('onRequestEnd', mockContext, mockResult)

        expect(plugin.onRequestEnd).toHaveBeenCalledWith(mockContext, mockResult)
      })

      it('should execute onError hooks with error', async () => {
        const error = new Error('Test error')
        const plugin: AiPlugin = {
          name: 'plugin-1',
          onError: vi.fn()
        }

        manager.use(plugin)

        await manager.executeParallel('onError', mockContext, undefined, error)

        expect(plugin.onError).toHaveBeenCalledWith(error, mockContext)
      })

      it('should propagate errors from hooks', async () => {
        const plugin: AiPlugin = {
          name: 'plugin-1',
          onRequestStart: vi.fn().mockRejectedValue(new Error('Hook error'))
        }

        manager.use(plugin)

        await expect(manager.executeParallel('onRequestStart', mockContext)).rejects.toThrow('Hook error')
      })
    })

    describe('collectStreamTransforms()', () => {
      it('should collect all stream transforms', () => {
        const transform1 = vi.fn()
        const transform2 = vi.fn()

        const plugin1: AiPlugin = {
          name: 'plugin-1',
          transformStream: vi.fn().mockReturnValue(transform1)
        }
        const plugin2: AiPlugin = {
          name: 'plugin-2',
          transformStream: vi.fn().mockReturnValue(transform2)
        }
        const plugin3: AiPlugin = {
          name: 'plugin-3' // No transformStream
        }

        manager.use(plugin1).use(plugin2).use(plugin3)

        const transforms = manager.collectStreamTransforms({}, mockContext)

        expect(transforms).toHaveLength(2)
        expect(transforms).toContain(transform1)
        expect(transforms).toContain(transform2)
      })

      it('should return empty array when no transforms', () => {
        manager.use({ name: 'plugin-1' })

        const transforms = manager.collectStreamTransforms({}, mockContext)

        expect(transforms).toEqual([])
      })
    })
  })

  describe('getStats()', () => {
    it('should return correct statistics', () => {
      manager
        .use({
          name: 'pre-plugin',
          enforce: 'pre',
          onRequestStart: vi.fn(),
          transformParams: vi.fn()
        })
        .use({
          name: 'normal-plugin',
          resolveModel: vi.fn(),
          onError: vi.fn()
        })
        .use({
          name: 'post-plugin',
          enforce: 'post',
          transformResult: vi.fn(),
          transformStream: vi.fn()
        })

      const stats = manager.getStats()

      expect(stats.total).toBe(3)
      expect(stats.pre).toBe(1)
      expect(stats.normal).toBe(1)
      expect(stats.post).toBe(1)
      expect(stats.hooks.onRequestStart).toBe(1)
      expect(stats.hooks.transformParams).toBe(1)
      expect(stats.hooks.resolveModel).toBe(1)
      expect(stats.hooks.onError).toBe(1)
      expect(stats.hooks.transformResult).toBe(1)
      expect(stats.hooks.transformStream).toBe(1)
    })

    it('should return zero stats for empty manager', () => {
      const stats = manager.getStats()

      expect(stats.total).toBe(0)
      expect(stats.pre).toBe(0)
      expect(stats.normal).toBe(0)
      expect(stats.post).toBe(0)
    })
  })
})
