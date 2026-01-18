import { loggerService } from '@logger'
import SlashCommandService from '@renderer/services/SlashCommandService'
import type { SlashCommand, SlashCommandCreate, SlashCommandUpdate } from '@renderer/types/slashCommand'
import { useCallback, useEffect, useState } from 'react'

const logger = loggerService.withContext('useSlashCommands')

/**
 * Hook for managing slash commands
 *
 * Provides access to slash commands with CRUD operations.
 * Commands are persisted to IndexedDB and include built-in defaults.
 *
 * @param assistantId - Optional assistant ID to filter commands by scope
 * @returns Slash commands state and operations
 *
 * @example
 * ```tsx
 * const { commands, loading, addCommand, deleteCommand } = useSlashCommands()
 *
 * // Add a custom command
 * await addCommand({
 *   command: '/greet',
 *   label: 'Greet',
 *   type: 'prompt-template',
 *   template: 'Hello ${name}!',
 *   scope: 'global'
 * })
 * ```
 */
export function useSlashCommands(assistantId?: string) {
  const [commands, setCommands] = useState<SlashCommand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Load commands from the service
   */
  const loadCommands = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const loaded = assistantId
        ? await SlashCommandService.getByScope('global', assistantId)
        : await SlashCommandService.getAll()
      setCommands(loaded)
    } catch (err) {
      logger.error('Failed to load slash commands:', err as Error)
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [assistantId])

  /**
   * Add a new custom command
   */
  const addCommand = useCallback(async (data: SlashCommandCreate): Promise<SlashCommand | null> => {
    try {
      const command = await SlashCommandService.add(data)
      setCommands((prev) => [...prev, command])
      return command
    } catch (err) {
      logger.error('Failed to add slash command:', err as Error)
      setError(err as Error)
      return null
    }
  }, [])

  /**
   * Update an existing command
   */
  const updateCommand = useCallback(async (id: string, data: SlashCommandUpdate): Promise<boolean> => {
    try {
      await SlashCommandService.update(id, data)
      setCommands((prev) => prev.map((cmd) => (cmd.id === id ? { ...cmd, ...data, updatedAt: Date.now() } : cmd)))
      return true
    } catch (err) {
      logger.error('Failed to update slash command:', err as Error)
      setError(err as Error)
      return false
    }
  }, [])

  /**
   * Delete a command
   */
  const deleteCommand = useCallback(async (id: string): Promise<boolean> => {
    try {
      await SlashCommandService.delete(id)
      setCommands((prev) => prev.filter((cmd) => cmd.id !== id))
      return true
    } catch (err) {
      logger.error('Failed to delete slash command:', err as Error)
      setError(err as Error)
      return false
    }
  }, [])

  /**
   * Get a command by its trigger string
   */
  const getByCommand = useCallback(
    (commandStr: string): SlashCommand | undefined => {
      return commands.find((cmd) => cmd.command.toLowerCase() === commandStr.toLowerCase())
    },
    [commands]
  )

  /**
   * Get the insertable template for a command
   */
  const getInsertableTemplate = useCallback((command: SlashCommand): string => {
    return SlashCommandService.getInsertableTemplate(command)
  }, [])

  /**
   * Render a template with provided arguments
   */
  const renderTemplate = useCallback((template: string, args: Record<string, string>): string => {
    return SlashCommandService.renderTemplate(template, args)
  }, [])

  /**
   * Extract placeholder names from a template
   */
  const extractPlaceholders = useCallback((template: string): string[] => {
    return SlashCommandService.extractPlaceholders(template)
  }, [])

  /**
   * Refresh commands from storage
   */
  const refresh = useCallback(async () => {
    await loadCommands()
  }, [loadCommands])

  // Load commands on mount
  useEffect(() => {
    loadCommands()
  }, [loadCommands])

  return {
    // State
    commands,
    loading,
    error,

    // CRUD operations
    addCommand,
    updateCommand,
    deleteCommand,
    refresh,

    // Utility functions
    getByCommand,
    getInsertableTemplate,
    renderTemplate,
    extractPlaceholders
  }
}

/**
 * Hook to get built-in commands only (no async loading needed)
 */
export function useBuiltInSlashCommands() {
  return SlashCommandService.getBuiltIns()
}

export default useSlashCommands
