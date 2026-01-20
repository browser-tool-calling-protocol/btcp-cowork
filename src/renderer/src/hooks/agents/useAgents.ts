/**
 * useAgents Hook
 *
 * Manages agent CRUD operations through the agent service abstraction.
 * This hook delegates to the service layer for actual implementation.
 */
import { useServiceAgents } from '@renderer/services/agents'
import type { AddAgentForm, CreateAgentResponse, GetAgentResponse } from '@renderer/types'

type Result<T> =
  | {
      success: true
      data: T
    }
  | {
      success: false
      error: Error
    }

export const useAgents = () => {
  const {
    agents,
    error,
    isLoading,
    isReady,
    addAgent: serviceAddAgent,
    deleteAgent: serviceDeleteAgent,
    getAgent: serviceGetAgent,
    updateAgent: serviceUpdateAgent,
    refresh
  } = useServiceAgents()

  // Wrap service methods to maintain backward compatibility with Result<T> type
  const addAgent = async (form: AddAgentForm): Promise<Result<CreateAgentResponse>> => {
    const result = await serviceAddAgent(form)
    return result
  }

  const deleteAgent = async (id: string): Promise<void> => {
    await serviceDeleteAgent(id)
  }

  const getAgent = async (id: string): Promise<GetAgentResponse | null> => {
    return serviceGetAgent(id)
  }

  return {
    agents,
    error,
    isLoading,
    isReady,
    addAgent,
    deleteAgent,
    getAgent,
    updateAgent: serviceUpdateAgent,
    refresh
  }
}
