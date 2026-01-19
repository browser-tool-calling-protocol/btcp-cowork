/**
 * useLocalSessions Hook
 *
 * Manages agent sessions using local Redux store instead of backend API.
 * Designed for Chrome extension environment where no backend is available.
 *
 * Usage:
 *   const { sessions, createSession, updateSession, deleteSession } = useLocalSessions(agentId)
 */
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  addSession as addSessionAction,
  createSessionEntity,
  deleteSession as deleteSessionAction,
  selectAgentById,
  selectSessionsByAgentId,
  updateSession as updateSessionAction
} from '@renderer/store/agents'
import { setActiveSessionIdAction } from '@renderer/store/runtime'
import type { AgentSessionEntity, CreateSessionForm, UpdateSessionForm } from '@renderer/types/agent'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

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
 * Hook for managing agent sessions locally without a backend API
 */
export const useLocalSessions = (agentId: string | null) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const agent = useAppSelector((state) => (agentId ? selectAgentById(state, agentId) : undefined))

  const sessions = useAppSelector((state) => (agentId ? selectSessionsByAgentId(state, agentId) : []))

  const createSession = useCallback(
    async (form: CreateSessionForm): Promise<Result<AgentSessionEntity>> => {
      if (!agentId || !agent) {
        return { success: false, error: new Error('Agent not found') }
      }

      try {
        const session = createSessionEntity(agentId, agent.type, {
          name: form.name,
          description: form.description,
          instructions: form.instructions ?? agent.instructions,
          model: form.model ?? agent.model,
          plan_model: form.plan_model ?? agent.plan_model,
          small_model: form.small_model ?? agent.small_model,
          accessible_paths: form.accessible_paths ?? agent.accessible_paths,
          allowed_tools: form.allowed_tools ?? agent.allowed_tools,
          mcps: form.mcps ?? agent.mcps,
          configuration: form.configuration ?? agent.configuration
        })

        dispatch(addSessionAction(session))
        dispatch(setActiveSessionIdAction({ agentId, sessionId: session.id }))
        window.toast?.success(t('common.add_success'))
        return { success: true, data: session }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create session'
        window.toast?.error(message)
        return { success: false, error: error instanceof Error ? error : new Error(message) }
      }
    },
    [agent, agentId, dispatch, t]
  )

  const updateSession = useCallback(
    async (form: UpdateSessionForm): Promise<Result<AgentSessionEntity>> => {
      try {
        const existing = sessions.find((s) => s.id === form.id)
        if (!existing) {
          throw new Error('Session not found')
        }

        const updated: AgentSessionEntity = {
          ...existing,
          ...form,
          updated_at: new Date().toISOString()
        }

        dispatch(updateSessionAction(updated))
        window.toast?.success(t('common.update_success'))
        return { success: true, data: updated }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update session'
        window.toast?.error(message)
        return { success: false, error: error instanceof Error ? error : new Error(message) }
      }
    },
    [dispatch, sessions, t]
  )

  const deleteSession = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        dispatch(deleteSessionAction(sessionId))
        if (agentId) {
          dispatch(setActiveSessionIdAction({ agentId, sessionId: null }))
        }
        window.toast?.success(t('common.delete_success'))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete session'
        window.toast?.error(message)
      }
    },
    [agentId, dispatch, t]
  )

  const getSession = useCallback(
    (sessionId: string): AgentSessionEntity | undefined => {
      return sessions.find((s) => s.id === sessionId)
    },
    [sessions]
  )

  return useMemo(
    () => ({
      sessions,
      isLoading: false,
      error: null,
      createSession,
      updateSession,
      deleteSession,
      getSession
    }),
    [sessions, createSession, updateSession, deleteSession, getSession]
  )
}

export default useLocalSessions
