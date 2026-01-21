/**
 * Agent Executor Registry
 *
 * Manages executors for different agent types.
 * Allows selecting the appropriate executor based on agent type and environment.
 */
import { loggerService } from '@logger'
import type { AgentType } from '@renderer/types'

import type { IAgentExecutor, IAgentExecutorRegistry } from '../AgentExecutor'

const logger = loggerService.withContext('AgentExecutorRegistry')

/**
 * Agent Executor Registry Implementation
 */
export class AgentExecutorRegistry implements IAgentExecutorRegistry {
  private executors: Map<AgentType, IAgentExecutor> = new Map()

  /**
   * Register an executor for a specific agent type
   */
  register(executor: IAgentExecutor): void {
    this.executors.set(executor.agentType, executor)
    logger.info('Executor registered', { agentType: executor.agentType })
  }

  /**
   * Unregister an executor for a specific agent type
   */
  unregister(agentType: AgentType): void {
    this.executors.delete(agentType)
    logger.info('Executor unregistered', { agentType })
  }

  /**
   * Get executor for an agent type
   */
  getExecutor(agentType: AgentType): IAgentExecutor | undefined {
    return this.executors.get(agentType)
  }

  /**
   * Get all registered executors
   */
  getAllExecutors(): IAgentExecutor[] {
    return Array.from(this.executors.values())
  }

  /**
   * Check if an executor is available for the given agent type
   */
  hasExecutor(agentType: AgentType): boolean {
    return this.executors.has(agentType)
  }

  /**
   * Find an executor that can handle the given agent type
   */
  findExecutor(agentType: AgentType): IAgentExecutor | undefined {
    // First, check for an exact match
    const exactMatch = this.executors.get(agentType)
    if (exactMatch) {
      return exactMatch
    }

    // Then, check if any executor can handle this type
    for (const executor of this.executors.values()) {
      if (executor.canExecute(agentType)) {
        return executor
      }
    }

    return undefined
  }

  /**
   * Get available executors (those that are currently available)
   */
  async getAvailableExecutors(): Promise<IAgentExecutor[]> {
    const results = await Promise.all(
      Array.from(this.executors.values()).map(async (executor) => ({
        executor,
        available: await executor.isAvailable()
      }))
    )

    return results.filter((r) => r.available).map((r) => r.executor)
  }

  /**
   * Check if execution is available for a given agent type
   */
  async isExecutionAvailable(agentType: AgentType): Promise<boolean> {
    const executor = this.findExecutor(agentType)
    if (!executor) {
      return false
    }
    return executor.isAvailable()
  }
}

// Singleton instance
let registryInstance: AgentExecutorRegistry | null = null

/**
 * Get the singleton executor registry instance
 */
export function getAgentExecutorRegistry(): AgentExecutorRegistry {
  if (!registryInstance) {
    registryInstance = new AgentExecutorRegistry()
  }
  return registryInstance
}

/**
 * Reset the registry (mainly for testing)
 */
export function resetAgentExecutorRegistry(): void {
  registryInstance = null
}
