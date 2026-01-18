import { ActionIconButton } from '@renderer/components/Buttons'
import { useBrowserUseForAssistant } from '@renderer/hooks/useBrowserUseSettings'
import type { ToolQuickPanelController } from '@renderer/pages/home/Inputbar/types'
import { Tooltip } from 'antd'
import { Globe } from 'lucide-react'
import type { FC } from 'react'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  quickPanelController: ToolQuickPanelController
  assistantId: string
}

const BrowserUseButton: FC<Props> = ({ assistantId }) => {
  const { t } = useTranslation()
  const { isEnabled, setEnabled, disable } = useBrowserUseForAssistant(assistantId)

  const onClick = useCallback(() => {
    if (isEnabled) {
      disable()
    } else {
      setEnabled(true, 'standard')
    }
  }, [isEnabled, setEnabled, disable])

  const ariaLabel = isEnabled ? t('chat.input.browser_use.disable') : t('chat.input.browser_use.label')

  const tooltipTitle = isEnabled ? t('chat.input.browser_use.enabled_tooltip') : t('chat.input.browser_use.label')

  return (
    <Tooltip placement="top" title={tooltipTitle} mouseLeaveDelay={0} arrow>
      <ActionIconButton onClick={onClick} active={isEnabled} aria-label={ariaLabel} aria-pressed={isEnabled}>
        <Globe size={18} />
      </ActionIconButton>
    </Tooltip>
  )
}

export default memo(BrowserUseButton)
