/**
 * Slash Command Types
 *
 * Defines the structure for slash commands that can be used as prompt starters/templates.
 * Commands can be registered globally or per-assistant and support variable placeholders.
 */

/**
 * Argument definition for a slash command
 */
export interface SlashCommandArg {
  /** Argument name (used in template as ${name}) */
  name: string
  /** Help text for the argument */
  description?: string
  /** Whether this argument is required */
  required?: boolean
  /** Default value if not provided */
  defaultValue?: string
  /** Enum-like choices for dropdown selection */
  options?: string[]
}

/**
 * Command type determines how the command behaves
 * - prompt-template: Inserts a template with placeholders into the input
 * - action: Executes a specific action (future use)
 * - hybrid: Both inserts template and executes action
 */
export type SlashCommandType = 'prompt-template' | 'action' | 'hybrid'

/**
 * Scope determines where the command is available
 * - global: Available in all contexts
 * - assistant: Only available for a specific assistant
 */
export type SlashCommandScope = 'global' | 'assistant'

/**
 * Category for grouping commands in the UI
 */
export type SlashCommandCategory = 'writing' | 'code' | 'analysis' | 'translation' | 'general' | 'custom'

/**
 * Main slash command interface
 */
export interface SlashCommand {
  /** Unique identifier */
  id: string
  /** Command trigger (e.g., "/translate") */
  command: string
  /** Display name */
  label: string
  /** Help text description */
  description?: string

  /** Command behavior type */
  type: SlashCommandType
  /** Prompt template with ${placeholders} */
  template?: string
  /** Argument definitions */
  args?: SlashCommandArg[]

  /** Availability scope */
  scope: SlashCommandScope
  /** Assistant ID if scope is 'assistant' */
  assistantId?: string

  /** Category for grouping */
  category?: SlashCommandCategory
  /** Lucide icon name */
  icon?: string
  /** Whether this is a built-in command (non-editable) */
  isBuiltIn?: boolean
  /** Whether the command is enabled */
  enabled?: boolean

  /** Creation timestamp */
  createdAt: number
  /** Last update timestamp */
  updatedAt: number
  /** Display order */
  order?: number
}

/**
 * Data for creating a new slash command
 */
export type SlashCommandCreate = Omit<SlashCommand, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>

/**
 * Data for updating an existing slash command
 */
export type SlashCommandUpdate = Partial<Omit<SlashCommand, 'id' | 'createdAt' | 'isBuiltIn'>>

/**
 * Parsed argument from command input
 */
export interface ParsedSlashCommandArg {
  name: string
  value: string
  position: { start: number; end: number }
}

/**
 * Result of parsing a command string
 */
export interface ParsedSlashCommand {
  command: SlashCommand
  args: ParsedSlashCommandArg[]
  rawInput: string
}
