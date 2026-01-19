import { loggerService } from '@logger'
import db from '@renderer/databases'
import type { SlashCommand, SlashCommandCreate, SlashCommandUpdate } from '@renderer/types/slashCommand'
import { v4 as uuidv4 } from 'uuid'

const logger = loggerService.withContext('SlashCommandService')

const STORAGE_KEY = 'slash_commands'

/**
 * Built-in slash commands that come pre-installed
 */
const BUILT_IN_COMMANDS: Omit<SlashCommand, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'builtin-tools',
    command: '/tools',
    label: 'List Tools',
    description: 'List available tools for the agent',
    type: 'prompt-template',
    template:
      'List all available tools and their capabilities. For each tool, provide:\n- Tool name\n- Brief description\n- Key parameters or inputs it accepts',
    args: [],
    scope: 'global',
    category: 'general',
    icon: 'Wrench',
    isBuiltIn: true,
    enabled: true,
    order: 0
  }
]

/**
 * SlashCommandService manages slash commands with IndexedDB persistence
 */
export class SlashCommandService {
  private static _isInitialized: boolean = false
  private static _customCommands: SlashCommand[] = []

  /**
   * Initialize the service and load commands from storage
   */
  static async init(): Promise<void> {
    if (SlashCommandService._isInitialized) {
      return
    }

    try {
      await db.open()
      await SlashCommandService.loadFromStorage()
      SlashCommandService._isInitialized = true
      logger.info('SlashCommandService initialized')
    } catch (error) {
      logger.error('Failed to initialize SlashCommandService:', error as Error)
    }
  }

  /**
   * Load custom commands from IndexedDB settings table
   */
  private static async loadFromStorage(): Promise<void> {
    try {
      const stored = await db.settings.get(STORAGE_KEY)
      if (stored?.value) {
        SlashCommandService._customCommands = stored.value as SlashCommand[]
        logger.debug('Loaded custom commands', { count: SlashCommandService._customCommands.length })
      }
    } catch (error) {
      logger.error('Failed to load commands from storage:', error as Error)
      SlashCommandService._customCommands = []
    }
  }

  /**
   * Save custom commands to IndexedDB settings table
   */
  private static async saveToStorage(): Promise<void> {
    try {
      await db.settings.put({
        id: STORAGE_KEY,
        value: SlashCommandService._customCommands
      })
      logger.debug('Saved custom commands', { count: SlashCommandService._customCommands.length })
    } catch (error) {
      logger.error('Failed to save commands to storage:', error as Error)
    }
  }

  /**
   * Get all built-in commands
   */
  static getBuiltIns(): SlashCommand[] {
    const now = Date.now()
    return BUILT_IN_COMMANDS.map((cmd) => ({
      ...cmd,
      createdAt: now,
      updatedAt: now
    }))
  }

  /**
   * Get all commands (built-in + custom)
   */
  static async getAll(): Promise<SlashCommand[]> {
    await SlashCommandService.init()
    const builtIns = SlashCommandService.getBuiltIns()
    const all = [...builtIns, ...SlashCommandService._customCommands]
    return all.filter((cmd) => cmd.enabled !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }

  /**
   * Get commands by scope
   * @param scope - 'global' returns only global commands, 'assistant' returns global + assistant-specific
   * @param assistantId - Required when scope is 'assistant' to filter assistant-specific commands
   */
  static async getByScope(scope: 'global' | 'assistant', assistantId?: string): Promise<SlashCommand[]> {
    const all = await SlashCommandService.getAll()
    return all.filter((cmd) => {
      // Always include global commands
      if (cmd.scope === 'global') return true
      // Only include assistant-specific commands when requesting assistant scope
      if (scope === 'assistant' && cmd.scope === 'assistant' && assistantId && cmd.assistantId === assistantId) {
        return true
      }
      return false
    })
  }

  /**
   * Get a single command by ID
   */
  static async getById(id: string): Promise<SlashCommand | undefined> {
    const all = await SlashCommandService.getAll()
    return all.find((cmd) => cmd.id === id)
  }

  /**
   * Get a command by its command string
   */
  static async getByCommand(command: string): Promise<SlashCommand | undefined> {
    const all = await SlashCommandService.getAll()
    return all.find((cmd) => cmd.command.toLowerCase() === command.toLowerCase())
  }

  /**
   * Add a new custom command
   */
  static async add(data: SlashCommandCreate): Promise<SlashCommand> {
    await SlashCommandService.init()

    const now = Date.now()
    const command: SlashCommand = {
      ...data,
      id: uuidv4(),
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
      order: SlashCommandService._customCommands.length
    }

    SlashCommandService._customCommands.push(command)
    await SlashCommandService.saveToStorage()

    logger.info('Added slash command', { id: command.id, command: command.command })
    return command
  }

  /**
   * Update an existing command
   */
  static async update(id: string, data: SlashCommandUpdate): Promise<void> {
    await SlashCommandService.init()

    const index = SlashCommandService._customCommands.findIndex((cmd) => cmd.id === id)
    if (index === -1) {
      logger.warn('Command not found for update', { id })
      return
    }

    SlashCommandService._customCommands[index] = {
      ...SlashCommandService._customCommands[index],
      ...data,
      updatedAt: Date.now()
    }

    await SlashCommandService.saveToStorage()
    logger.info('Updated slash command', { id })
  }

  /**
   * Delete a custom command
   */
  static async delete(id: string): Promise<void> {
    await SlashCommandService.init()

    const index = SlashCommandService._customCommands.findIndex((cmd) => cmd.id === id)
    if (index === -1) {
      logger.warn('Command not found for deletion', { id })
      return
    }

    SlashCommandService._customCommands.splice(index, 1)
    await SlashCommandService.saveToStorage()
    logger.info('Deleted slash command', { id })
  }

  /**
   * Render a template with provided arguments
   */
  static renderTemplate(template: string, args: Record<string, string>): string {
    let result = template
    for (const [key, value] of Object.entries(args)) {
      const placeholder = new RegExp(`\\$\\{${key}\\}`, 'g')
      result = result.replace(placeholder, value)
    }
    return result
  }

  /**
   * Extract placeholder names from a template
   */
  static extractPlaceholders(template: string): string[] {
    const regex = /\$\{(\w+)\}/g
    const placeholders: string[] = []
    let match
    while ((match = regex.exec(template)) !== null) {
      if (!placeholders.includes(match[1])) {
        placeholders.push(match[1])
      }
    }
    return placeholders
  }

  /**
   * Get the template ready for insertion (with placeholders intact for tab-cycling)
   */
  static getInsertableTemplate(command: SlashCommand): string {
    if (!command.template) {
      return command.command
    }
    return command.template
  }
}

export default SlashCommandService
