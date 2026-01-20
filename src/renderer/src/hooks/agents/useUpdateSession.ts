import { useAppDispatch, useAppSelector } from '@renderer/store'
import { updateSession as updateSessionAction } from '@renderer/store/agents'
import type { AgentSessionEntity, ListAgentSessionsResponse, UpdateSessionForm } from '@renderer/types'
import type { UpdateAgentBaseOptions, UpdateAgentSessionFunction } from '@renderer/types/agent'
import { getErrorMessage } from '@renderer/utils/error'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { mutate } from 'swr'

import { useApiServer } from '../useApiServer'
import { useAgentClient } from './useAgentClient'

export const useUpdateSession = (agentId: string | null) => {
  const { t } = useTranslation()
  const client = useAgentClient()
  const { apiServerRunning } = useApiServer()
  const dispatch = useAppDispatch()
  const sessions = useAppSelector((state) => state.agents?.sessions ?? [])

  const updateSession: UpdateAgentSessionFunction = useCallback(
    async (form: UpdateSessionForm, options?: UpdateAgentBaseOptions): Promise<AgentSessionEntity | undefined> => {
      if (!agentId) return

      const sessionId = form.id

      // Use local Redux when API server is not running (extension mode)
      if (!apiServerRunning) {
        try {
          const existingSession = sessions.find((s) => s.id === sessionId)
          if (!existingSession) {
            window.toast.error(t('agent.session.update.error.failed'))
            return undefined
          }

          const updated: AgentSessionEntity = {
            ...existingSession,
            ...form,
            updated_at: new Date().toISOString()
          }

          dispatch(updateSessionAction(updated))
          if (options?.showSuccessToast ?? true) {
            window.toast.success(t('common.update_success'))
          }
          return updated
        } catch (error) {
          window.toast.error({ title: t('agent.session.update.error.failed'), description: getErrorMessage(error) })
          return undefined
        }
      }

      // Use API server when running
      const paths = client.getSessionPaths(agentId)
      const listKey = paths.base
      try {
        const itemKey = paths.withId(sessionId)
        // may change to optimistic update
        const result = await client.updateSession(agentId, form)
        mutate<ListAgentSessionsResponse['data']>(
          listKey,
          (prev) => prev?.map((session) => (session.id === result.id ? result : session)) ?? []
        )
        mutate(itemKey, result)
        if (options?.showSuccessToast ?? true) {
          window.toast.success(t('common.update_success'))
        }
        return result
      } catch (error) {
        window.toast.error({ title: t('agent.session.update.error.failed'), description: getErrorMessage(error) })
        return undefined
      }
    },
    [agentId, client, t, apiServerRunning, dispatch, sessions]
  )

  const updateModel = useCallback(
    async (sessionId: string, modelId: string, options?: UpdateAgentBaseOptions) => {
      if (!agentId) return
      return updateSession(
        {
          id: sessionId,
          model: modelId
        },
        options
      )
    },
    [agentId, updateSession]
  )

  return { updateSession, updateModel }
}
