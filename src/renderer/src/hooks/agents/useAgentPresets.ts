/**
 * useAgentPresets Hook
 *
 * Manages built-in agent presets that can be installed locally.
 * Provides default Claude Code agent configurations for common use cases.
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
 * Built-in agent presets for common use cases
 */
const BUILT_IN_PRESETS: AgentPreset[] = [
  {
    id: 'preset-claude-code-general',
    name: 'Claude Code Assistant',
    description:
      'A general-purpose coding assistant powered by Claude. Helps with code review, debugging, and development tasks.',
    emoji: '🤖',
    type: 'claude-code',
    model: 'anthropic:claude-sonnet-4-20250514',
    instructions: `You are Claude Code, a helpful AI coding assistant. You help users with:
- Code review and improvements
- Debugging and fixing issues
- Writing new features
- Explaining code and concepts
- Best practices and patterns

Always be clear, concise, and provide working code examples when helpful.`,
    accessible_paths: [],
    allowed_tools: ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
    configuration: {
      permission_mode: 'default',
      max_turns: 100
    },
    isBuiltIn: true
  },
  {
    id: 'preset-claude-code-web',
    name: 'Web Developer',
    description: 'Specialized for web development with React, TypeScript, and modern frontend tools.',
    emoji: '🌐',
    type: 'claude-code',
    model: 'anthropic:claude-sonnet-4-20250514',
    instructions: `You are a web development specialist. You excel at:
- React and TypeScript development
- Modern CSS and styling (Tailwind, styled-components)
- State management (Redux, Zustand, React Query)
- API integration and data fetching
- Performance optimization
- Accessibility best practices

Focus on clean, maintainable code with proper typing.`,
    accessible_paths: [],
    allowed_tools: ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'WebSearch', 'WebFetch'],
    configuration: {
      permission_mode: 'acceptEdits',
      max_turns: 100
    },
    isBuiltIn: true
  },
  {
    id: 'preset-claude-code-reviewer',
    name: 'Code Reviewer',
    description: 'Reviews code for bugs, security issues, and best practices. Read-only mode for safety.',
    emoji: '🔍',
    type: 'claude-code',
    model: 'anthropic:claude-sonnet-4-20250514',
    instructions: `You are a code review specialist. Your role is to:
- Identify bugs and potential issues
- Check for security vulnerabilities
- Suggest performance improvements
- Ensure code follows best practices
- Review for maintainability and readability

Provide constructive feedback with specific line references and explanations.
Do NOT make changes directly - only provide recommendations.`,
    accessible_paths: [],
    allowed_tools: ['Read', 'Glob', 'Grep'],
    configuration: {
      permission_mode: 'default',
      max_turns: 50
    },
    isBuiltIn: true
  },
  {
    id: 'preset-claude-code-researcher',
    name: 'Research Assistant',
    description: 'Helps research codebases, documentation, and web resources. Great for learning new projects.',
    emoji: '📚',
    type: 'claude-code',
    model: 'anthropic:claude-sonnet-4-20250514',
    instructions: `You are a research assistant specialized in understanding codebases and technologies. You help with:
- Exploring and explaining code structure
- Finding relevant documentation
- Researching libraries and frameworks
- Understanding design patterns used
- Creating summaries and documentation

Be thorough but concise. Use web search when needed for up-to-date information.`,
    accessible_paths: [],
    allowed_tools: ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
    configuration: {
      permission_mode: 'default',
      max_turns: 100
    },
    isBuiltIn: true
  },
  {
    id: 'preset-claude-code-autonomous',
    name: 'Autonomous Developer',
    description: 'Full autonomy for complex tasks. Use with caution - bypasses all permission checks.',
    emoji: '⚡',
    type: 'claude-code',
    model: 'anthropic:claude-sonnet-4-20250514',
    instructions: `You are an autonomous development agent with full access to complete complex tasks independently. You can:
- Read, write, and edit files
- Execute commands
- Search the web
- Make architectural decisions

Always explain your reasoning and create backups before major changes.
Use your autonomy responsibly and ask for confirmation on irreversible actions.`,
    accessible_paths: [],
    configuration: {
      permission_mode: 'bypassPermissions',
      max_turns: 200
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
