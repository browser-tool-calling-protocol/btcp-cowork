import { useSettings } from '@renderer/hooks/useSettings'
import type { AgentPreset } from '@renderer/store/agents'
import { cn } from '@renderer/utils'
import { Download } from 'lucide-react'
import type { FC } from 'react'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { AgentNameWrapper, AssistantNameRow, Container } from './AgentItem'

interface AgentPresetItemProps {
  preset: AgentPreset
  onInstall: (presetId: string) => void
}

const AgentPresetItem: FC<AgentPresetItemProps> = ({ preset, onInstall }) => {
  const { t } = useTranslation()
  const { assistantIconType } = useSettings()

  const handleInstall = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onInstall(preset.id)
    },
    [preset.id, onInstall]
  )

  return (
    <Container className="opacity-70 hover:opacity-100">
      <AssistantNameRow className="name" title={preset.description || preset.name}>
        <AgentNameWrapper>
          <div className="flex items-center gap-2">
            {preset.emoji && assistantIconType !== 'none' && <span className="text-base">{preset.emoji}</span>}
            <span className="truncate">{preset.name}</span>
          </div>
        </AgentNameWrapper>
        <button
          onClick={handleInstall}
          className={cn(
            'flex h-[22px] min-h-[22px] min-w-[22px] flex-row items-center justify-center',
            'rounded-[11px] border-[0.5px] border-[var(--color-border)]',
            'bg-[var(--color-background)] px-[5px]',
            'hover:bg-primary/10 hover:border-primary transition-colors'
          )}
          title={t('agent.preset.install')}>
          <Download size={14} className="text-primary" />
        </button>
      </AssistantNameRow>
    </Container>
  )
}

export default memo(AgentPresetItem)
