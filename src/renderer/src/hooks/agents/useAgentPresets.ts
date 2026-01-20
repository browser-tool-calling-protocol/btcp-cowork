/**
 * useAgentPresets Hook
 *
 * Manages built-in agent presets that can be installed locally.
 * Includes browser-compatible agent types that work without a backend.
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
 * Browser-compatible agents that work in the Chrome extension:
 * - skill-creator: Creates skills using the addSkill built-in tool
 *
 * NOT browser-compatible (require backend):
 * - claude-code: Requires Bash, filesystem tools
 */
const BUILT_IN_PRESETS: AgentPreset[] = [
  {
    id: 'preset-skill-creator',
    name: 'Skill Creator',
    description:
      'An AI assistant that helps you create skills for browser automation. Describe what you want to automate and it will generate and save the skill configuration.',
    emoji: '🛠️',
    type: 'skill-creator',
    model: 'anthropic:claude-sonnet-4-20250514',
    instructions: `You are a Skill Creator assistant. Your job is to help users create skills that teach AI agents how to interact with websites and perform tasks.

## What is a Skill?

A skill is a configuration that includes:
- **name**: A descriptive name for the skill
- **description**: What the skill does
- **prompt**: Instructions for the AI on how to perform the skill
- **domainPattern**: (Optional) A regex pattern to match URLs where this skill applies
- **contentScript**: (Optional) JavaScript to run in the page context
- **pageScript**: (Optional) JavaScript for isolated execution
- **toolSchema**: (Optional) JSON defining custom AI tools for this skill

## Your Workflow

1. **Understand the Request**: Ask clarifying questions to understand what the user wants to automate
2. **Design the Skill**: Plan the skill configuration based on the requirements
3. **Create the Skill**: Use the \`addSkill\` tool to save the skill

## Guidelines

- Write clear, detailed prompts that give the AI specific instructions
- Use regex domain patterns to scope skills to specific websites
- Keep skills focused on a single task or workflow
- Test regex patterns mentally before using them
- For complex interactions, consider using contentScript for DOM manipulation

## Example Skills

**GitHub PR Reviewer**:
- domainPattern: \`^https?://(www\\.)?github\\.com/.*/pull/\`
- prompt: "Review this pull request. Analyze the code changes, check for bugs, security issues, and suggest improvements..."

**Twitter Thread Summarizer**:
- domainPattern: \`^https?://(www\\.)?(twitter|x)\\.com/.*/status/\`
- prompt: "Summarize this Twitter thread. Extract the main points and present them as bullet points..."

Always use the \`addSkill\` tool to save skills when you've designed them.`,
    accessible_paths: [],
    allowed_tools: ['addSkill', 'think'],
    configuration: {
      permission_mode: 'default',
      max_turns: 20
    },
    isBuiltIn: true
  }
]

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
