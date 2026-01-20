import { loggerService } from '@logger'
import { useAgent } from '@renderer/hooks/agents/useAgent'
import { useLocalSessions } from '@renderer/hooks/agents/useLocalSessions'
import { useSessions } from '@renderer/hooks/agents/useSessions'
import { useApiServer } from '@renderer/hooks/useApiServer'
import { useAppDispatch } from '@renderer/store'
import { setActiveSessionIdAction, setActiveTopicOrSessionAction } from '@renderer/store/runtime'
import type { CreateSessionForm } from '@renderer/types'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

const logger = loggerService.withContext('useCreateDefaultSession')

/**
 * Returns a stable callback that creates a default agent session and updates UI state.
 */
export const useCreateDefaultSession = (agentId: string | null) => {
  const { agent } = useAgent(agentId)
  const { apiServerRunning } = useApiServer()

  // Use local sessions when API server is not running (extension mode)
  const sessionsApi = useSessions(apiServerRunning ? agentId : null)
  const sessionsLocal = useLocalSessions(apiServerRunning ? null : agentId)

  const { createSession } = apiServerRunning ? sessionsApi : sessionsLocal
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const [creatingSession, setCreatingSession] = useState(false)

  const createDefaultSession = useCallback(async () => {
    if (!agentId || !agent || creatingSession) {
      return null
    }

    setCreatingSession(true)
    try {
      const session = {
        ...agent,
        id: undefined,
        name: t('common.unnamed')
      } satisfies CreateSessionForm

      const result = await createSession(session)

      // Handle different return types from API vs local sessions
      let created = null
      if (result) {
        if ('success' in result) {
          // useLocalSessions returns Result<AgentSessionEntity>
          created = result.success ? result.data : null
        } else {
          // useSessions returns CreateAgentSessionResponse | null
          created = result
        }
      }

      if (created) {
        dispatch(setActiveSessionIdAction({ agentId, sessionId: created.id }))
        dispatch(setActiveTopicOrSessionAction('session'))
      }

      return created
    } catch (error) {
      logger.error('Error creating default session:', error as Error)
      return null
    } finally {
      setCreatingSession(false)
    }
  }, [agentId, agent, createSession, creatingSession, dispatch, t, apiServerRunning])

  return {
    createDefaultSession,
    creatingSession
  }
}
