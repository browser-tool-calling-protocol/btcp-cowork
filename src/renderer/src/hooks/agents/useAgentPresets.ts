/**
 * useAgentPresets Hook
 *
 * Manages built-in agent presets that can be installed locally.
 * Currently empty as Claude Code agents require a backend which is not available
 * in the Chrome extension environment.
 *
 * Future: Add browser-based agent presets when a browser-compatible agent type is implemented.
 *
 * Usage:
 *   const { presets, installPreset, isInstalled } = useAgentPresets()
 */
import { useAppDispatch, useAppSelector } from '@renderer/store'
import type { AgentPreset } from '@renderer/store/agents'
import {
  installPreset as installPresetAction,
  selectAllAgents,
  selectAllPresets,
  setPresets
} from '@renderer/store/agents'
import { useCallback, useEffect, useMemo } from 'react'

/**
 * Built-in agent presets
 *
 * NOTE: Currently empty because:
 * - The only agent type is 'claude-code' which requires a backend to execute tools
 *   (Bash, file read/write/edit, etc.)
 * - Chrome extensions cannot run these tools - no filesystem access, no shell execution
 *
 * Future work needed:
 * - Add 'browser-agent' type that uses BTCP tools (navigate, click, type, screenshot, snapshot)
 * - Create presets for browser automation tasks
 *
 * Example future preset:
 * {
 *   id: 'preset-browser-assistant',
 *   name: 'Browser Assistant',
 *   description: 'Automates browser tasks using BTCP tools',
 *   emoji: '🌐',
 *   type: 'browser-agent',  // New type needed in AgentTypeSchema
 *   model: 'anthropic:claude-sonnet-4-20250514',
 *   instructions: 'You are a browser automation assistant...',
 *   accessible_paths: [],
 *   allowed_tools: ['navigate', 'click', 'type', 'fill', 'press', 'screenshot', 'snapshot'],
 *   configuration: { permission_mode: 'default', max_turns: 50 },
 *   isBuiltIn: true
 * }
 */
const BUILT_IN_PRESETS: AgentPreset[] = []

/**
 * Hook for managing built-in agent presets
 */
export const useAgentPresets = () => {
  const dispatch = useAppDispatch()
  const presets = useAppSelector(selectAllPresets)
  const agents = useAppSelector(selectAllAgents)
  const presetsInitialized = useAppSelector((state) => state.agents?.presetsInitialized ?? false)

  // Initialize presets on first load
  useEffect(() => {
    if (!presetsInitialized) {
      dispatch(setPresets(BUILT_IN_PRESETS))
    }
  }, [dispatch, presetsInitialized])

  const installPreset = useCallback(
    (presetId: string) => {
      dispatch(installPresetAction(presetId))
    },
    [dispatch]
  )

  const isInstalled = useCallback(
    (presetId: string) => {
      const preset = presets.find((p) => p.id === presetId)
      if (!preset) return false
      // Check if an agent with the same name exists (since we generate new IDs)
      return agents.some((a) => a.name === preset.name)
    },
    [agents, presets]
  )

  const getPreset = useCallback(
    (presetId: string) => {
      return presets.find((p) => p.id === presetId)
    },
    [presets]
  )

  return useMemo(
    () => ({
      presets,
      installPreset,
      isInstalled,
      getPreset,
      builtInCount: BUILT_IN_PRESETS.length
    }),
    [presets, installPreset, isInstalled, getPreset]
  )
}

export default useAgentPresets

/**
 * Get built-in presets without hook (for initialization)
 */
export const getBuiltInPresets = () => BUILT_IN_PRESETS
