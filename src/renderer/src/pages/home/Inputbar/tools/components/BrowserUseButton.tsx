import { ActionIconButton } from '@renderer/components/Buttons'
import { useBrowserUseForAssistant } from '@renderer/hooks/useBrowserUseSettings'
import type { ToolQuickPanelController } from '@renderer/pages/home/Inputbar/types'
import { Tooltip } from 'antd'
import { Globe } from 'lucide-react'
import type { FC } from 'react'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

const BROWSER_USE_SYMBOL = 'browser_use'

interface Props {
  quickPanelController: ToolQuickPanelController
  assistantId: string
}

const BrowserUseButton: FC<Props> = ({ quickPanelController, assistantId }) => {
  const { t } = useTranslation()
  const { isEnabled, toolset, disable } = useBrowserUseForAssistant(assistantId)

  const toggleQuickPanel = useCallback(() => {
    if (quickPanelController.isVisible && quickPanelController.symbol === BROWSER_USE_SYMBOL) {
      quickPanelController.close()
    } else {
      quickPanelController.open({
        title: t('chat.input.browser_use.panel_title'),
        list: [],
        symbol: BROWSER_USE_SYMBOL,
        pageSize: 5
      })
    }
  }, [quickPanelController, t])

  const onClick = useCallback(() => {
    if (isEnabled) {
      disable()
    } else {
      toggleQuickPanel()
    }
  }, [isEnabled, disable, toggleQuickPanel])

  const ariaLabel = isEnabled ? t('chat.input.browser_use.disable') : t('chat.input.browser_use.label')

  const tooltipTitle = isEnabled
    ? t('chat.input.browser_use.enabled_tooltip', { toolset })
    : t('chat.input.browser_use.label')

  return (
    <Tooltip placement="top" title={tooltipTitle} mouseLeaveDelay={0} arrow>
      <ActionIconButton onClick={onClick} active={isEnabled} aria-label={ariaLabel} aria-pressed={isEnabled}>
        <Globe size={18} />
      </ActionIconButton>
    </Tooltip>
  )
}

export default memo(BrowserUseButton)
