import { ActionIconButton } from '@renderer/components/Buttons'
import type { ToolQuickPanelController } from '@renderer/pages/home/Inputbar/types'
import { Tooltip } from 'antd'
import { Globe, Loader2 } from 'lucide-react'
import type { FC } from 'react'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { useBrowserUsePanelController } from './BrowserUseQuickPanelManager'

interface Props {
  quickPanelController: ToolQuickPanelController
  assistantId: string
}

const BrowserUseButton: FC<Props> = ({ quickPanelController, assistantId }) => {
  const { t } = useTranslation()
  const { isEnabled, sessionState, toggleQuickPanel, disconnectSession } = useBrowserUsePanelController(
    assistantId,
    quickPanelController
  )

  const isConnecting = sessionState.status === 'connecting'
  const isConnected = sessionState.status === 'connected'

  const onClick = useCallback(() => {
    if (isEnabled && isConnected) {
      // If enabled and connected, clicking disables/disconnects
      disconnectSession()
    } else {
      // Otherwise, open the quick panel to connect/configure
      toggleQuickPanel()
    }
  }, [isEnabled, isConnected, toggleQuickPanel, disconnectSession])

  const getTooltipTitle = () => {
    if (isConnecting) {
      return t('chat.input.browser_use.panel.connecting')
    }
    if (isEnabled && isConnected) {
      return t('chat.input.browser_use.enabled_tooltip')
    }
    return t('chat.input.browser_use.label')
  }

  const ariaLabel = isEnabled ? t('chat.input.browser_use.disable') : t('chat.input.browser_use.label')

  return (
    <Tooltip placement="top" title={getTooltipTitle()} mouseLeaveDelay={0} arrow>
      <ActionIconButton
        onClick={onClick}
        active={isEnabled && isConnected}
        aria-label={ariaLabel}
        aria-pressed={isEnabled && isConnected}
        disabled={isConnecting}>
        {isConnecting ? <Loader2 size={18} className="animate-spin" /> : <Globe size={18} />}
      </ActionIconButton>
    </Tooltip>
  )
}

export default memo(BrowserUseButton)
