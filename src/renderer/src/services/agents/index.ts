/**
 * Agent Services
 *
 * Provides an abstraction layer for agent execution that supports
 * both server-based (Electron) and local (Extension) modes.
 */

// Interface and types
export {
  type AgentMessageStreamConfig,
  type AgentServiceConfig,
  type AgentServiceMode,
  BaseAgentService,
  type IAgentService,
  isAgentEntity,
  isAgentSessionEntity,
  type ServiceResult
} from './IAgentService'

// Server implementation
export { createServerAgentService, ServerAgentService, type ServerAgentServiceConfig } from './ServerAgentService'

// React context and hooks
export {
  AgentServiceProvider,
  useAgentService,
  useAgentServiceContext,
  useAgentServiceReady,
  useAgentServiceStatus
} from './AgentServiceProvider'

// Service-based hooks
export {
  useAgentMessageStream,
  useServiceAgents,
  useServiceModels,
  useServiceSession,
  useServiceSessions
} from './useAgentServiceHooks'

// Global registry for non-React code
export { getAgentService, hasAgentService, registerAgentService, requireAgentService } from './AgentServiceRegistry'
