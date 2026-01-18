import { loggerService } from '@logger'
import { QuickPanelReservedSymbol } from '@renderer/components/QuickPanel'
import SlashCommandService from '@renderer/services/SlashCommandService'
import type { SlashCommand } from '@renderer/types/slashCommand'
import {
  Code,
  FileText,
  HelpCircle,
  Languages,
  type LucideIcon,
  Search,
  Sparkles,
  Terminal,
  Wrench
} from 'lucide-react'
import { memo, useCallback, useEffect, useState } from 'react'

import {
  defineTool,
  registerTool,
  type ToolActionKey,
  type ToolRenderContext,
  type ToolStateKey,
  TopicType
} from '../types'
import SlashCommandsButton from './components/SlashCommandsButton'

const logger = loggerService.withContext('SlashCommandsTool')

/**
 * Map icon names to Lucide components
 */
const ICON_MAP: Record<string, LucideIcon> = {
  Languages,
  FileText,
  HelpCircle,
  Code,
  Search,
  Wrench,
  Sparkles,
  Terminal
}

/**
 * Get icon component for a command
 */
const getCommandIcon = (iconName?: string): React.ReactNode => {
  if (!iconName) return <Terminal size={16} />
  const IconComponent = ICON_MAP[iconName]
  return IconComponent ? <IconComponent size={16} /> : <Terminal size={16} />
}

/**
 * Helper function to insert slash command template into textarea
 * @param template - The template to insert (with ${placeholders})
 * @param onTextChange - Text change handler
 * @param replaceSlash - Whether to replace the preceding '/' character
 */
const insertSlashCommandTemplate = (
  template: string,
  onTextChange: (updater: (prev: string) => string) => void,
  replaceSlash: boolean = false
) => {
  onTextChange((prev: string) => {
    const textArea = document.querySelector('.inputbar textarea') as HTMLTextAreaElement | null

    if (!textArea) {
      logger.warn('TextArea not found')
      return prev + ' ' + template
    }

    const cursorPosition = textArea.selectionStart || 0

    let newText: string
    let newCursorPos: number

    if (replaceSlash) {
      // Find the '/' that triggered the menu
      const textBeforeCursor = prev.slice(0, cursorPosition)
      const lastSlashIndex = textBeforeCursor.lastIndexOf('/')

      if (lastSlashIndex !== -1 && cursorPosition > lastSlashIndex) {
        // Replace from '/' to cursor with template
        newText = prev.slice(0, lastSlashIndex) + template + prev.slice(cursorPosition)
        newCursorPos = lastSlashIndex + template.length
      } else {
        // No '/' found, just insert at cursor
        newText = prev.slice(0, cursorPosition) + template + prev.slice(cursorPosition)
        newCursorPos = cursorPosition + template.length
      }
    } else {
      // Just insert at cursor position
      newText = prev.slice(0, cursorPosition) + template + prev.slice(cursorPosition)
      newCursorPos = cursorPosition + template.length
    }

    // Find first placeholder for selection
    const placeholderMatch = /\$\{(\w+)\}/.exec(template)
    let selectStart = newCursorPos
    let selectEnd = newCursorPos

    if (placeholderMatch && replaceSlash) {
      // Select the first placeholder (including ${})
      const textBeforeCursor = prev.slice(0, cursorPosition)
      const lastSlashIndex = textBeforeCursor.lastIndexOf('/')
      const insertPos = lastSlashIndex !== -1 ? lastSlashIndex : cursorPosition
      const placeholderStart = insertPos + placeholderMatch.index
      selectStart = placeholderStart
      selectEnd = placeholderStart + placeholderMatch[0].length
    }

    // Set cursor position after the inserted template
    setTimeout(() => {
      if (textArea) {
        textArea.focus()
        if (placeholderMatch) {
          textArea.setSelectionRange(selectStart, selectEnd)
        } else {
          textArea.setSelectionRange(newCursorPos, newCursorPos)
        }
        logger.debug('Cursor set', { selectStart, selectEnd })
      }
    }, 0)

    return newText
  })
}

/**
 * QuickPanelManager component for SlashCommands
 * Handles loading commands and registering triggers
 */
interface SlashCommandsQuickPanelManagerProps {
  context: ToolRenderContext<readonly ToolStateKey[], readonly ToolActionKey[]>
}

const SlashCommandsQuickPanelManager = memo(({ context }: SlashCommandsQuickPanelManagerProps) => {
  const { quickPanel, quickPanelController, actions, t, assistant } = context
  const { onTextChange } = actions
  const [commands, setCommands] = useState<SlashCommand[]>([])

  // Load commands on mount
  useEffect(() => {
    const loadCommands = async () => {
      try {
        const loaded = await SlashCommandService.getByScope('global', assistant?.id)
        setCommands(loaded)
      } catch (error) {
        logger.error('Failed to load slash commands:', error as Error)
      }
    }
    loadCommands()
  }, [assistant?.id])

  // Create menu items from commands
  const createMenuItems = useCallback(
    (replaceSlash: boolean) => {
      return commands.map((cmd) => ({
        label: cmd.label,
        description: cmd.description || cmd.command,
        icon: getCommandIcon(cmd.icon),
        filterText: `${cmd.command} ${cmd.label} ${cmd.description || ''}`,
        action: () => {
          const template = SlashCommandService.getInsertableTemplate(cmd)
          insertSlashCommandTemplate(template, onTextChange, replaceSlash)
        }
      }))
    },
    [commands, onTextChange]
  )

  // Open panel helper
  const openPanel = useCallback(
    (replaceSlash: boolean = false) => {
      if (commands.length === 0) {
        quickPanelController.open({
          title: t('chat.input.slash_commands.title'),
          symbol: QuickPanelReservedSymbol.SlashCommands,
          list: [
            {
              label: t('chat.input.slash_commands.empty', 'No slash commands available'),
              description: '',
              icon: <Terminal size={16} />,
              disabled: true,
              action: () => {}
            }
          ]
        })
        return
      }

      quickPanelController.open({
        title: t('chat.input.slash_commands.title'),
        symbol: QuickPanelReservedSymbol.SlashCommands,
        list: createMenuItems(replaceSlash)
      })
    },
    [commands.length, quickPanelController, t, createMenuItems]
  )

  // Register root menu contribution
  useEffect(() => {
    if (commands.length === 0) return

    const dispose = quickPanel.registerRootMenu([
      {
        label: t('chat.input.slash_commands.title'),
        description: t('chat.input.slash_commands.description', 'Prompt templates and commands'),
        icon: <Terminal size={16} />,
        isMenu: true,
        action: () => {
          quickPanelController.close()
          setTimeout(() => {
            openPanel(true) // Replace the '/' when coming from root menu
          }, 0)
        }
      }
    ])

    return dispose
  }, [commands.length, quickPanel, quickPanelController, t, openPanel])

  // Register SlashCommands trigger
  useEffect(() => {
    const dispose = quickPanel.registerTrigger(QuickPanelReservedSymbol.SlashCommands, () => {
      openPanel(false)
    })

    return dispose
  }, [quickPanel, openPanel])

  return null
})

SlashCommandsQuickPanelManager.displayName = 'SlashCommandsQuickPanelManager'

/**
 * SlashCommandsToolRender component
 * Renders the button and manages commands state
 */
const SlashCommandsToolRender = memo(
  ({ context }: { context: ToolRenderContext<readonly ToolStateKey[], readonly ToolActionKey[]> }) => {
    const { quickPanelController, actions, t, assistant } = context
    const { onTextChange } = actions
    const [commands, setCommands] = useState<SlashCommand[]>([])

    // Load commands on mount
    useEffect(() => {
      const loadCommands = async () => {
        try {
          const loaded = await SlashCommandService.getByScope('global', assistant?.id)
          setCommands(loaded)
        } catch (error) {
          logger.error('Failed to load slash commands:', error as Error)
        }
      }
      loadCommands()
    }, [assistant?.id])

    // Open panel handler for button
    const openPanel = useCallback(() => {
      if (commands.length === 0) {
        quickPanelController.open({
          title: t('chat.input.slash_commands.title'),
          symbol: QuickPanelReservedSymbol.SlashCommands,
          list: [
            {
              label: t('chat.input.slash_commands.empty', 'No slash commands available'),
              description: '',
              icon: <Terminal size={16} />,
              disabled: true,
              action: () => {}
            }
          ]
        })
        return
      }

      quickPanelController.open({
        title: t('chat.input.slash_commands.title'),
        symbol: QuickPanelReservedSymbol.SlashCommands,
        list: commands.map((cmd) => ({
          label: cmd.label,
          description: cmd.description || cmd.command,
          icon: getCommandIcon(cmd.icon),
          filterText: `${cmd.command} ${cmd.label} ${cmd.description || ''}`,
          action: () => {
            const template = SlashCommandService.getInsertableTemplate(cmd)
            insertSlashCommandTemplate(template, onTextChange, false) // No replacement from button
          }
        }))
      })
    }, [commands, quickPanelController, t, onTextChange])

    return <SlashCommandsButton quickPanelController={quickPanelController} commands={commands} openPanel={openPanel} />
  }
)

SlashCommandsToolRender.displayName = 'SlashCommandsToolRender'

/**
 * Slash Commands Tool
 *
 * Provides prompt templates and quick commands for all contexts.
 * Integrates with the QuickPanel system via '/' trigger and root menu.
 *
 * Features:
 * - Built-in commands: /translate, /summarize, /explain, /code, /review, /fix, /improve
 * - Custom user-defined commands
 * - Template placeholders with ${variable} syntax
 * - Tab-cycling through placeholders (native inputbar feature)
 */
const slashCommandsTool = defineTool({
  key: 'slash_commands',
  label: (t) => t('chat.input.slash_commands.title'),

  // Available in all scopes
  visibleInScopes: [TopicType.Chat, TopicType.Session, 'mini-window'],

  dependencies: {
    actions: ['onTextChange'] as const
  },

  // Render the button
  render: (context) => <SlashCommandsToolRender context={context} />,

  // Manager handles QuickPanel registration
  quickPanelManager: SlashCommandsQuickPanelManager
})

// Register the tool
registerTool(slashCommandsTool)

export default slashCommandsTool
