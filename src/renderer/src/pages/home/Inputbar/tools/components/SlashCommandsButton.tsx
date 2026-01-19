import { ActionIconButton } from '@renderer/components/Buttons'
import { QuickPanelReservedSymbol } from '@renderer/components/QuickPanel'
import type { ToolQuickPanelController } from '@renderer/pages/home/Inputbar/types'
import type { SlashCommand } from '@renderer/types/slashCommand'
import { Tooltip } from 'antd'
import { Terminal } from 'lucide-react'
import { type FC, type ReactElement, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  quickPanelController: ToolQuickPanelController
  commands: SlashCommand[]
  openPanel: () => void
}

/**
 * SlashCommandsButton
 *
 * Button component that opens the SlashCommands panel.
 * Works with global slash commands (prompt templates).
 */
const SlashCommandsButton: FC<Props> = ({ quickPanelController, commands, openPanel }): ReactElement => {
  const { t } = useTranslation()

  const handleOpenQuickPanel = useCallback(() => {
    if (quickPanelController.isVisible && quickPanelController.symbol === QuickPanelReservedSymbol.SlashCommands) {
      quickPanelController.close()
    } else {
      openPanel()
    }
  }, [openPanel, quickPanelController])

  const hasCommands = commands.length > 0
  const isActive =
    quickPanelController.isVisible && quickPanelController.symbol === QuickPanelReservedSymbol.SlashCommands

  return (
    <Tooltip placement="top" title={t('chat.input.slash_commands.title')} mouseLeaveDelay={0} arrow>
      <ActionIconButton
        onClick={handleOpenQuickPanel}
        active={isActive}
        disabled={!hasCommands}
        aria-label={t('chat.input.slash_commands.title')}>
        <Terminal size={18} />
      </ActionIconButton>
    </Tooltip>
  )
}

export default SlashCommandsButton
