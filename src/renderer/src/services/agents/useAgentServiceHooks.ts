/**
 * Agent Service Hooks
 *
 * React hooks that use the agent service abstraction layer.
 * These hooks provide a unified API that works with both server and local modes.
 */
import { loggerService } from '@logger'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setActiveAgentId, setActiveSessionIdAction } from '@renderer/store/runtime'
import type {
  AddAgentForm,
  ApiModelsFilter,
  CreateAgentResponse,
  CreateAgentSessionResponse,
  CreateSessionForm,
  GetAgentResponse,
  GetAgentSessionResponse,
  UpdateAgentForm,
  UpdateSessionForm
} from '@renderer/types'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import { useAgentService, useAgentServiceReady } from './AgentServiceProvider'
import type { ServiceResult } from './IAgentService'

const logger = loggerService.withContext('AgentServiceHooks')

/**
 * Hook for managing agents using the agent service
 */
export function useServiceAgents() {
  const { t } = useTranslation()
  const service = useAgentService()
  const isReady = useAgentServiceReady()
  const dispatch = useAppDispatch()

  // Get active agent ID from runtime state
  const activeAgentId = useAppSelector((state) => state.runtime.chat?.activeAgentId)

  // SWR key - only fetch when service is ready
  const swrKey = isReady && service ? 'agents:list' : null

  const fetcher = useCallback(async () => {
    if (!service) {
      throw new Error(t('agent.server.error.not_running'))
    }
    const result = await service.listAgents({ sortBy: 'created_at', orderBy: 'desc' })
    return result.data
  }, [service, t])

  const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher)

  const addAgent = useCallback(
    async (form: AddAgentForm): Promise<ServiceResult<CreateAgentResponse>> => {
      if (!service) {
        return { success: false, error: new Error(t('agent.server.error.not_running')) }
      }

      const result = await service.createAgent(form)
      if (result.success) {
        mutate((prev) => [...(prev ?? []), result.data])
        window.toast?.success(t('common.add_success'))
      } else {
        window.toast?.error(result.error.message)
      }
      return result
    },
    [service, mutate, t]
  )

  const deleteAgent = useCallback(
    async (id: string): Promise<void> => {
      if (!service) {
        window.toast?.error(t('agent.server.error.not_running'))
        return
      }

      try {
        await service.deleteAgent(id)
        dispatch(setActiveSessionIdAction({ agentId: id, sessionId: null }))

        if (activeAgentId === id) {
          const newId = data?.filter((a) => a.id !== id).find(() => true)?.id
          dispatch(setActiveAgentId(newId ?? null))
        }

        mutate((prev) => prev?.filter((a) => a.id !== id) ?? [])
        window.toast?.success(t('common.delete_success'))
      } catch (error) {
        const message = error instanceof Error ? error.message : t('agent.delete.error.failed')
        window.toast?.error(message)
      }
    },
    [service, activeAgentId, data, dispatch, mutate, t]
  )

  const getAgent = useCallback(
    async (id: string): Promise<GetAgentResponse | null> => {
      if (!service) return null
      try {
        const result = await service.getAgent(id)
        mutate((prev) => prev?.map((a) => (a.id === result.id ? result : a)) ?? [])
        return result
      } catch (error) {
        logger.error('Failed to get agent', error as Error)
        return null
      }
    },
    [service, mutate]
  )

  const updateAgent = useCallback(
    async (form: UpdateAgentForm): Promise<ServiceResult<GetAgentResponse>> => {
      if (!service) {
        return { success: false, error: new Error(t('agent.server.error.not_running')) }
      }

      const result = await service.updateAgent(form)
      if (result.success) {
        mutate((prev) => prev?.map((a) => (a.id === result.data.id ? result.data : a)) ?? [])
        window.toast?.success(t('common.update_success'))
      } else {
        window.toast?.error(result.error.message)
      }
      return result
    },
    [service, mutate, t]
  )

  return useMemo(
    () => ({
      agents: data ?? [],
      error,
      isLoading,
      isReady,
      addAgent,
      deleteAgent,
      getAgent,
      updateAgent,
      refresh: () => mutate()
    }),
    [data, error, isLoading, isReady, addAgent, deleteAgent, getAgent, updateAgent, mutate]
  )
}

/**
 * Hook for managing sessions using the agent service
 */
export function useServiceSessions(agentId: string | null) {
  const { t } = useTranslation()
  const service = useAgentService()
  const isReady = useAgentServiceReady()
  const dispatch = useAppDispatch()

  // SWR key - only fetch when service is ready and agentId is provided
  const swrKey = isReady && service && agentId ? `agents:${agentId}:sessions` : null

  const fetcher = useCallback(async () => {
    if (!service || !agentId) {
      throw new Error('Service or agent ID not available')
    }
    const result = await service.listSessions(agentId)
    return result.data
  }, [service, agentId])

  const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher)

  const createSession = useCallback(
    async (form: CreateSessionForm): Promise<CreateAgentSessionResponse | null> => {
      if (!service || !agentId) return null

      const result = await service.createSession(agentId, form)
      if (result.success) {
        await mutate((prev) => [result.data, ...(prev ?? [])], { revalidate: false })
        dispatch(setActiveSessionIdAction({ agentId, sessionId: result.data.id }))
        return result.data
      } else {
        window.toast?.error(result.error.message)
        return null
      }
    },
    [service, agentId, mutate, dispatch]
  )

  const getSession = useCallback(
    async (sessionId: string): Promise<GetAgentSessionResponse | null> => {
      if (!service || !agentId) return null

      try {
        const result = await service.getSession(agentId, sessionId)
        mutate((prev) => prev?.map((s) => (s.id === result.id ? result : s)))
        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : t('agent.session.get.error.failed')
        window.toast?.error(message)
        return null
      }
    },
    [service, agentId, mutate, t]
  )

  const updateSession = useCallback(
    async (form: UpdateSessionForm): Promise<ServiceResult<GetAgentSessionResponse>> => {
      if (!service || !agentId) {
        return { success: false, error: new Error('Service or agent ID not available') }
      }

      const result = await service.updateSession(agentId, form)
      if (result.success) {
        mutate((prev) => prev?.map((s) => (s.id === result.data.id ? result.data : s)))
        window.toast?.success(t('common.update_success'))
      } else {
        window.toast?.error(result.error.message)
      }
      return result
    },
    [service, agentId, mutate, t]
  )

  const deleteSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (!service || !agentId) return false

      try {
        await service.deleteSession(agentId, sessionId)
        dispatch(setActiveSessionIdAction({ agentId, sessionId: null }))
        mutate((prev) => prev?.filter((s) => s.id !== sessionId))
        window.toast?.success(t('common.delete_success'))
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : t('agent.session.delete.error.failed')
        window.toast?.error(message)
        return false
      }
    },
    [service, agentId, mutate, dispatch, t]
  )

  return useMemo(
    () => ({
      sessions: data ?? [],
      error,
      isLoading,
      isReady,
      createSession,
      getSession,
      updateSession,
      deleteSession,
      refresh: () => mutate()
    }),
    [data, error, isLoading, isReady, createSession, getSession, updateSession, deleteSession, mutate]
  )
}

/**
 * Hook for getting a single session using the agent service
 */
export function useServiceSession(agentId: string | null, sessionId: string | null) {
  const { t } = useTranslation()
  const service = useAgentService()
  const isReady = useAgentServiceReady()

  // SWR key - only fetch when service is ready and both IDs are provided
  const swrKey = isReady && service && agentId && sessionId ? `agents:${agentId}:sessions:${sessionId}` : null

  const fetcher = useCallback(async () => {
    if (!service || !agentId || !sessionId) {
      throw new Error('Service or IDs not available')
    }
    return service.getSession(agentId, sessionId)
  }, [service, agentId, sessionId])

  const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher)

  const updateSession = useCallback(
    async (form: UpdateSessionForm): Promise<ServiceResult<GetAgentSessionResponse>> => {
      if (!service || !agentId) {
        return { success: false, error: new Error('Service or agent ID not available') }
      }

      const result = await service.updateSession(agentId, form)
      if (result.success) {
        mutate(result.data, { revalidate: false })
        window.toast?.success(t('common.update_success'))
      } else {
        window.toast?.error(result.error.message)
      }
      return result
    },
    [service, agentId, mutate, t]
  )

  return useMemo(
    () => ({
      session: data,
      error,
      isLoading,
      isReady,
      updateSession,
      refresh: () => mutate()
    }),
    [data, error, isLoading, isReady, updateSession, mutate]
  )
}

/**
 * Hook for getting available models using the agent service
 */
export function useServiceModels(filter?: ApiModelsFilter) {
  const service = useAgentService()
  const isReady = useAgentServiceReady()

  // Create a stable key based on filter
  const filterKey = filter ? JSON.stringify(filter) : ''
  const swrKey = isReady && service ? `models:${filterKey}` : null

  const fetcher = useCallback(async () => {
    if (!service) {
      throw new Error('Service not available')
    }
    return service.getModels(filter)
  }, [service, filter])

  const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher)

  return useMemo(
    () => ({
      models: data,
      error,
      isLoading,
      isReady,
      refresh: () => mutate()
    }),
    [data, error, isLoading, isReady, mutate]
  )
}

/**
 * Hook for creating agent message streams
 */
export function useAgentMessageStream() {
  const service = useAgentService()
  const isReady = useAgentServiceReady()

  const createStream = useCallback(
    async (config: { agentId: string; sessionId: string; content: string; signal?: AbortSignal }) => {
      if (!service) {
        throw new Error('Agent service not available')
      }
      return service.createMessageStream(config)
    },
    [service]
  )

  return useMemo(
    () => ({
      createStream,
      isReady
    }),
    [createStream, isReady]
  )
}
