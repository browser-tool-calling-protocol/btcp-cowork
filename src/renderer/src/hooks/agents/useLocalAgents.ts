/**
 * useLocalAgents Hook
 *
 * Manages agents using local Redux store instead of backend API.
 * Designed for Chrome extension environment where no backend is available.
 *
 * Usage:
 *   const { agents, addAgent, updateAgent, deleteAgent } = useLocalAgents()
 */
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  addAgent as addAgentAction,
  createAgentEntity,
  deleteAgent as deleteAgentAction,
  selectAllAgents,
  updateAgent as updateAgentAction
} from '@renderer/store/agents'
import { setActiveAgentId, setActiveSessionIdAction } from '@renderer/store/runtime'
import type { AddAgentForm, AgentEntity, UpdateAgentForm } from '@renderer/types/agent'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useRuntime } from '../useRuntime'

type Result<T> =
  | {
      success: true
      data: T
    }
  | {
      success: false
      error: Error
    }

/**
 * Hook for managing agents locally without a backend API
 */
export const useLocalAgents = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const agents = useAppSelector(selectAllAgents)
  const { chat } = useRuntime()
  const { activeAgentId } = chat

  const addAgent = useCallback(
    async (form: AddAgentForm): Promise<Result<AgentEntity>> => {
      try {
        const agent = createAgentEntity({
          type: form.type,
          name: form.name,
          description: form.description,
          instructions: form.instructions,
          model: form.model,
          accessible_paths: form.accessible_paths,
          allowed_tools: form.allowed_tools,
          mcps: form.mcps,
          configuration: form.configuration
        })

        dispatch(addAgentAction(agent))
        window.toast?.success(t('common.add_success'))
        return { success: true, data: agent }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add agent'
        window.toast?.error(message)
        return { success: false, error: error instanceof Error ? error : new Error(message) }
      }
    },
    [dispatch, t]
  )

  const updateAgent = useCallback(
    async (form: UpdateAgentForm): Promise<Result<AgentEntity>> => {
      try {
        const existing = agents.find((a) => a.id === form.id)
        if (!existing) {
          throw new Error('Agent not found')
        }

        const updated: AgentEntity = {
          ...existing,
          ...form,
          updated_at: new Date().toISOString()
        }

        dispatch(updateAgentAction(updated))
        window.toast?.success(t('common.update_success'))
        return { success: true, data: updated }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update agent'
        window.toast?.error(message)
        return { success: false, error: error instanceof Error ? error : new Error(message) }
      }
    },
    [agents, dispatch, t]
  )

  const deleteAgent = useCallback(
    async (id: string): Promise<void> => {
      try {
        dispatch(deleteAgentAction(id))
        dispatch(setActiveSessionIdAction({ agentId: id, sessionId: null }))

        // If deleting active agent, switch to another one
        if (activeAgentId === id) {
          const newId = agents.filter((a) => a.id !== id).find(() => true)?.id
          dispatch(setActiveAgentId(newId ?? null))
        }

        window.toast?.success(t('common.delete_success'))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete agent'
        window.toast?.error(message)
      }
    },
    [activeAgentId, agents, dispatch, t]
  )

  const getAgent = useCallback(
    (id: string): AgentEntity | undefined => {
      return agents.find((a) => a.id === id)
    },
    [agents]
  )

  return useMemo(
    () => ({
      agents,
      isLoading: false,
      error: null,
      addAgent,
      updateAgent,
      deleteAgent,
      getAgent
    }),
    [agents, addAgent, updateAgent, deleteAgent, getAgent]
  )
}

export default useLocalAgents
