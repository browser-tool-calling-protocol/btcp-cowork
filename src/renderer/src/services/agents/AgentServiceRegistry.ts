/**
 * Agent Service Registry
 *
 * Provides global access to the agent service from non-React code (e.g., thunks).
 * The AgentServiceProvider registers the service instance here on initialization.
 */
import { loggerService } from '@logger'

import type { IAgentService } from './IAgentService'

const logger = loggerService.withContext('AgentServiceRegistry')

let currentService: IAgentService | null = null

/**
 * Register an agent service instance
 * Called by AgentServiceProvider when the service is initialized
 */
export function registerAgentService(service: IAgentService | null): void {
  currentService = service
  logger.debug('Agent service registered', { mode: service?.mode ?? 'none' })
}

/**
 * Get the current agent service instance
 * Returns null if no service is registered
 */
export function getAgentService(): IAgentService | null {
  return currentService
}

/**
 * Check if an agent service is available
 */
export function hasAgentService(): boolean {
  return currentService !== null
}

/**
 * Get the agent service or throw if not available
 * Use this when the service is required
 */
export function requireAgentService(): IAgentService {
  if (!currentService) {
    throw new Error('Agent service not available. Ensure AgentServiceProvider is mounted.')
  }
  return currentService
}
