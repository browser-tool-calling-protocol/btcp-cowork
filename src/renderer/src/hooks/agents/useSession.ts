import { loggerService } from '@logger'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { selectSessionById } from '@renderer/store/agents'
import { loadTopicMessagesThunk } from '@renderer/store/thunk/messageThunk'
import { buildAgentSessionTopicId } from '@renderer/utils/agentSession'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import { useApiServer } from '../useApiServer'
import { useAgentClient } from './useAgentClient'
import { useUpdateSession } from './useUpdateSession'

const logger = loggerService.withContext('useSession')

export const useSession = (agentId: string | null, sessionId: string | null) => {
  const { t } = useTranslation()
  const client = useAgentClient()
  const { apiServerRunning } = useApiServer()
  const dispatch = useAppDispatch()
  const sessionTopicId = useMemo(() => (sessionId ? buildAgentSessionTopicId(sessionId) : null), [sessionId])
  const { updateSession } = useUpdateSession(agentId)

  // Get session from Redux store for when API server is not running
  const localSession = useAppSelector((state) => (sessionId ? selectSessionById(state, sessionId) : undefined))

  // Debug logging
  useEffect(() => {
    logger.info('[useSession] State', {
      agentId,
      sessionId,
      apiServerRunning,
      hasLocalSession: !!localSession,
      localSessionData: localSession
        ? {
            id: localSession.id,
            name: localSession.name,
            agent_id: localSession.agent_id
          }
        : null
    })
  }, [agentId, sessionId, apiServerRunning, localSession])

  // Disable SWR fetching when server is not running by setting key to null
  const key = apiServerRunning && agentId && sessionId ? client.getSessionPaths(agentId).withId(sessionId) : null

  const fetcher = async () => {
    if (!agentId) throw new Error(t('agent.get.error.null_id'))
    if (!sessionId) throw new Error(t('agent.session.get.error.null_id'))
    const data = await client.getSession(agentId, sessionId)
    return data
  }
  const { data, error, isLoading, mutate } = useSWR(key, fetcher)

  // Use loadTopicMessagesThunk to load messages (with caching mechanism)
  // This ensures messages are preserved when switching between sessions/tabs
  useEffect(() => {
    if (sessionTopicId) {
      // loadTopicMessagesThunk will check if messages already exist in Redux
      // and skip loading if they do (unless forceReload is true)
      dispatch(loadTopicMessagesThunk(sessionTopicId))
    }
  }, [dispatch, sessionId, sessionTopicId])

  // Use local session when API server is not running (extension mode)
  const result = {
    session: apiServerRunning ? data : localSession,
    error: apiServerRunning ? error : null,
    isLoading: apiServerRunning ? isLoading : false,
    updateSession,
    mutate
  }

  // Debug logging for return value
  useEffect(() => {
    logger.info('[useSession] Returning', {
      hasSession: !!result.session,
      isLoading: result.isLoading,
      hasError: !!result.error,
      mode: apiServerRunning ? 'API' : 'Local'
    })
  }, [result.session, result.isLoading, result.error, apiServerRunning])

  return result
}
