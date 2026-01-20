import { getStoreProviders } from '@renderer/hooks/useStore'
import type { ApiModel, ApiModelsFilter } from '@renderer/types'
import { merge } from 'lodash'
import { useCallback, useMemo } from 'react'
import useSWR from 'swr'

import { useApiServer } from '../useApiServer'
import { useAgentClient } from './useAgentClient'

export const useApiModels = (filter?: ApiModelsFilter) => {
  const client = useAgentClient()
  const { isRunning } = useApiServer()

  // Fallback: Get models from Redux store when API server is not running (extension mode)
  const localModels = useMemo(() => {
    if (isRunning) return []

    const providers = getStoreProviders()
    const enabledProviders = providers.filter((p) => p.enabled)
    const allModels: ApiModel[] = enabledProviders
      .flatMap((p) => p.models)
      .map((model) => ({
        id: model.id,
        name: model.name,
        provider: model.provider || '',
        provider_name: model.provider_name,
        group: model.group,
        capabilities: model.capabilities,
        pricing: model.pricing,
        owned_by: model.owned_by
      }))

    return allModels
  }, [isRunning])

  // const defaultFilter = { limit: -1 } satisfies ApiModelsFilter
  const defaultFilter = {} satisfies ApiModelsFilter
  const finalFilter = merge(filter, defaultFilter)
  const path = client.getModelsPath(finalFilter)
  const fetcher = useCallback(async () => {
    const limit = finalFilter.limit || 100
    let offset = finalFilter.offset || 0
    const allModels: ApiModel[] = []
    let total = Infinity

    while (offset < total) {
      const pageFilter = { ...finalFilter, limit, offset }
      const res = await client.getModels(pageFilter)
      allModels.push(...(res.data || []))
      total = res.total ?? 0
      offset += limit
    }
    return { data: allModels, total }
  }, [client, finalFilter])

  const { data, error, isLoading } = useSWR(isRunning ? path : null, fetcher)

  // Return local models when API server is not running
  if (!isRunning) {
    return {
      models: localModels,
      error: undefined,
      isLoading: false
    }
  }

  return {
    models: data?.data ?? [],
    error,
    isLoading
  }
}
