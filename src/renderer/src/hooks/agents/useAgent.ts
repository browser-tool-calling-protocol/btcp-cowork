import { useAppSelector } from '@renderer/store'
import { selectAgentById } from '@renderer/store/agents'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import { useApiServer } from '../useApiServer'
import { useAgentClient } from './useAgentClient'

export const useAgent = (id: string | null) => {
  const { t } = useTranslation()
  const client = useAgentClient()
  const key = id ? client.agentPaths.withId(id) : null
  const { apiServerConfig, apiServerRunning } = useApiServer()

  // Get agent from Redux store for when API server is not running
  const localAgent = useAppSelector((state) => (id ? selectAgentById(state, id) : undefined))

  // Disable SWR fetching when server is not running by setting key to null
  const swrKey = apiServerRunning && id ? key : null

  const fetcher = useCallback(async () => {
    if (!id) {
      throw new Error(t('agent.get.error.null_id'))
    }
    if (!apiServerConfig.enabled) {
      throw new Error(t('apiServer.messages.notEnabled'))
    }
    const result = await client.getAgent(id)
    return result
  }, [apiServerConfig.enabled, client, id, t])
  const { data, error, isLoading } = useSWR(swrKey, fetcher)

  // Use local agent when API server is not running (extension mode)
  return {
    agent: apiServerRunning ? data : localAgent,
    error: apiServerRunning ? error : null,
    isLoading: apiServerRunning ? isLoading : false
  }
}
