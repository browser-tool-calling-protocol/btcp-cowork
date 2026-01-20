import { useAppDispatch, useAppSelector } from '@renderer/store'
import type { AgentPreset } from '@renderer/store/agents'
import { setUnifiedListOrder } from '@renderer/store/assistants'
import type { AgentEntity, Assistant } from '@renderer/types'
import { useCallback, useMemo } from 'react'

export type UnifiedItem =
  | { type: 'agent'; data: AgentEntity }
  | { type: 'assistant'; data: Assistant }
  | { type: 'preset'; data: AgentPreset }

interface UseUnifiedItemsOptions {
  agents: AgentEntity[]
  assistants: Assistant[]
  presets: AgentPreset[]
  installedAgentNames: string[]
  apiServerEnabled: boolean
  agentsLoading: boolean
  agentsError: Error | null
  updateAssistants: (assistants: Assistant[]) => void
}

export const useUnifiedItems = (options: UseUnifiedItemsOptions) => {
  const {
    agents,
    assistants,
    presets,
    installedAgentNames,
    apiServerEnabled,
    agentsLoading,
    agentsError,
    updateAssistants
  } = options
  const dispatch = useAppDispatch()
  const unifiedListOrder = useAppSelector((state) => state.assistants.unifiedListOrder || [])

  // Create unified items list (agents + assistants + presets) with saved order
  const unifiedItems = useMemo(() => {
    const items: UnifiedItem[] = []

    // Collect all available items
    const availableAgents = new Map<string, AgentEntity>()
    const availableAssistants = new Map<string, Assistant>()
    const availablePresets = new Map<string, AgentPreset>()

    // Show agents if API server is enabled OR if there are local agents (extension mode)
    if ((apiServerEnabled && !agentsLoading && !agentsError) || (!apiServerEnabled && agents.length > 0)) {
      agents.forEach((agent) => availableAgents.set(agent.id, agent))
    }
    assistants.forEach((assistant) => availableAssistants.set(assistant.id, assistant))

    // Show presets that haven't been installed yet
    presets.forEach((preset) => {
      if (!installedAgentNames.includes(preset.name)) {
        availablePresets.set(preset.id, preset)
      }
    })

    // Apply saved order
    unifiedListOrder.forEach((item) => {
      if (item.type === 'agent' && availableAgents.has(item.id)) {
        items.push({ type: 'agent', data: availableAgents.get(item.id)! })
        availableAgents.delete(item.id)
      } else if (item.type === 'assistant' && availableAssistants.has(item.id)) {
        items.push({ type: 'assistant', data: availableAssistants.get(item.id)! })
        availableAssistants.delete(item.id)
      } else if (item.type === 'preset' && availablePresets.has(item.id)) {
        items.push({ type: 'preset', data: availablePresets.get(item.id)! })
        availablePresets.delete(item.id)
      }
    })

    // Add new items (not in saved order) to the beginning
    const newItems: UnifiedItem[] = []
    availableAgents.forEach((agent) => newItems.push({ type: 'agent', data: agent }))
    availableAssistants.forEach((assistant) => newItems.push({ type: 'assistant', data: assistant }))
    // Add uninstalled presets at the beginning (they're new)
    availablePresets.forEach((preset) => newItems.push({ type: 'preset', data: preset }))
    items.unshift(...newItems)

    return items
  }, [agents, assistants, presets, installedAgentNames, apiServerEnabled, agentsLoading, agentsError, unifiedListOrder])

  const handleUnifiedListReorder = useCallback(
    (newList: UnifiedItem[]) => {
      // Save the unified order to Redux
      const orderToSave = newList.map((item) => ({
        type: item.type,
        id: item.data.id
      }))
      dispatch(setUnifiedListOrder(orderToSave))

      // Extract and update assistants order
      const newAssistants = newList.filter((item) => item.type === 'assistant').map((item) => item.data)
      updateAssistants(newAssistants)
    },
    [dispatch, updateAssistants]
  )

  return {
    unifiedItems,
    handleUnifiedListReorder
  }
}
