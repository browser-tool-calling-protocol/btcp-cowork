import { loggerService } from '@logger'
import { useApiServer } from '@renderer/hooks/useApiServer'
import { useRuntime } from '@renderer/hooks/useRuntime'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setActiveSessionIdAction, setActiveTopicOrSessionAction } from '@renderer/store/runtime'
import { useCallback, useEffect } from 'react'

import { useAgentClient } from './useAgentClient'

const logger = loggerService.withContext('useAgentSessionInitializer')

/**
 * Hook to automatically initialize and load the latest session for an agent
 * when the agent is activated. This ensures that when switching to an agent,
 * its most recent session is automatically selected.
 */
export const useAgentSessionInitializer = () => {
  const dispatch = useAppDispatch()
  const client = useAgentClient()
  const { apiServerRunning } = useApiServer()
  const { chat } = useRuntime()
  const { activeAgentId, activeSessionIdMap } = chat

  // Get all sessions from Redux store for when API server is not running
  const allSessions = useAppSelector((state) => state.agents?.sessions || [])

  /**
   * Initialize session for the given agent by loading its sessions
   * and setting the latest one as active
   */
  const initializeAgentSession = useCallback(
    async (agentId: string) => {
      logger.info('[initializeAgentSession] Called', { agentId })

      if (!agentId) {
        logger.warn('[initializeAgentSession] No agentId provided')
        return
      }

      try {
        // Check if this agent already has an active session
        const currentSessionId = activeSessionIdMap[agentId]
        logger.info('[initializeAgentSession] Checking for existing session', {
          agentId,
          currentSessionId,
          hasExistingSession: !!currentSessionId
        })

        if (currentSessionId) {
          // Session already exists, just switch to session view
          logger.info('[initializeAgentSession] Using existing session', { currentSessionId })
          dispatch(setActiveTopicOrSessionAction('session'))
          return
        }

        let sessions = []

        // Use local sessions when API server is not running (extension mode)
        if (apiServerRunning) {
          // Load sessions from API server
          logger.info('[initializeAgentSession] Loading sessions from API')
          const response = await client.listSessions(agentId)
          sessions = response.data || []
        } else {
          // Load sessions from Redux store
          logger.info('[initializeAgentSession] Loading sessions from Redux', {
            totalSessionsInStore: allSessions.length
          })
          sessions = allSessions.filter((s) => s.agent_id === agentId)
          logger.info('[initializeAgentSession] Filtered sessions', {
            agentId,
            sessionsFound: sessions.length,
            sessionIds: sessions.map((s) => s.id)
          })
        }

        if (sessions && sessions.length > 0) {
          // Get the latest session (first in the list, assuming they're sorted by updatedAt)
          const latestSession = sessions[0]

          logger.info('[initializeAgentSession] Setting active session', {
            sessionId: latestSession.id,
            sessionName: latestSession.name
          })

          // Set the latest session as active
          dispatch(setActiveSessionIdAction({ agentId, sessionId: latestSession.id }))
          dispatch(setActiveTopicOrSessionAction('session'))
        } else {
          // No sessions exist, we might want to create one
          // But for now, just switch to session view and let the Sessions component handle it
          logger.warn('[initializeAgentSession] No sessions found for agent', { agentId })
          dispatch(setActiveTopicOrSessionAction('session'))
        }
      } catch (error) {
        logger.error('[initializeAgentSession] Failed to initialize agent session:', error as Error)
        // Even if loading fails, switch to session view
        dispatch(setActiveTopicOrSessionAction('session'))
      }
    },
    [client, dispatch, activeSessionIdMap, apiServerRunning, allSessions]
  )

  /**
   * Auto-initialize when activeAgentId changes
   */
  useEffect(() => {
    logger.info('[useAgentSessionInitializer] Effect triggered', {
      activeAgentId,
      sessionIdMap: activeSessionIdMap
    })

    if (activeAgentId) {
      // Check if we need to initialize this agent's session
      const hasActiveSession = activeSessionIdMap[activeAgentId]
      logger.info('[useAgentSessionInitializer] Checking if initialization needed', {
        activeAgentId,
        hasActiveSession,
        willInitialize: !hasActiveSession
      })

      if (!hasActiveSession) {
        logger.info('[useAgentSessionInitializer] Initializing agent session')
        initializeAgentSession(activeAgentId)
      }
    }
  }, [activeAgentId, activeSessionIdMap, initializeAgentSession])

  return {
    initializeAgentSession
  }
}
