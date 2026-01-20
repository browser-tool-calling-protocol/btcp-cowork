/**
 * useSession Hook
 *
 * Manages a single session through the agent service abstraction.
 * This hook delegates to the service layer for actual implementation.
 */
import { useServiceSession } from '@renderer/services/agents'
import { useAppDispatch } from '@renderer/store'
import { loadTopicMessagesThunk } from '@renderer/store/thunk/messageThunk'
import { buildAgentSessionTopicId } from '@renderer/utils/agentSession'
import { useEffect, useMemo } from 'react'

export const useSession = (agentId: string | null, sessionId: string | null) => {
  const dispatch = useAppDispatch()
  const sessionTopicId = useMemo(() => (sessionId ? buildAgentSessionTopicId(sessionId) : null), [sessionId])

  const { session, error, isLoading, isReady, updateSession, refresh } = useServiceSession(agentId, sessionId)

  // Use loadTopicMessagesThunk to load messages (with caching mechanism)
  // This ensures messages are preserved when switching between sessions/tabs
  useEffect(() => {
    if (sessionTopicId) {
      // loadTopicMessagesThunk will check if messages already exist in Redux
      // and skip loading if they do (unless forceReload is true)
      dispatch(loadTopicMessagesThunk(sessionTopicId))
    }
  }, [dispatch, sessionId, sessionTopicId])

  return {
    session,
    error,
    isLoading,
    isReady,
    updateSession,
    mutate: refresh
  }
}
