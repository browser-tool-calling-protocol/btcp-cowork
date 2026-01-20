/**
 * useSessions Hook
 *
 * Manages session CRUD operations through the agent service abstraction.
 * This hook delegates to the service layer for actual implementation.
 */
import { useServiceSessions } from '@renderer/services/agents'
import type { CreateAgentSessionResponse, CreateSessionForm, GetAgentSessionResponse } from '@renderer/types'

export const useSessions = (agentId: string | null) => {
  const {
    sessions,
    error,
    isLoading,
    isReady,
    createSession: serviceCreateSession,
    getSession: serviceGetSession,
    updateSession: serviceUpdateSession,
    deleteSession: serviceDeleteSession,
    refresh
  } = useServiceSessions(agentId)

  // Wrap service methods to maintain backward compatibility
  const createSession = async (form: CreateSessionForm): Promise<CreateAgentSessionResponse | null> => {
    return serviceCreateSession(form)
  }

  const getSession = async (id: string): Promise<GetAgentSessionResponse | null> => {
    return serviceGetSession(id)
  }

  const deleteSession = async (id: string): Promise<boolean> => {
    return serviceDeleteSession(id)
  }

  return {
    sessions,
    error,
    isLoading,
    isReady,
    createSession,
    getSession,
    updateSession: serviceUpdateSession,
    deleteSession,
    refresh
  }
}
