/**
 * Skill Button
 *
 * Button in the input toolbar for selecting skills.
 */
import { ActionIconButton } from '@renderer/components/Buttons'
import type { QuickPanelListItem } from '@renderer/components/QuickPanel'
import { QuickPanelReservedSymbol, useQuickPanel } from '@renderer/components/QuickPanel'
import type { ToolQuickPanelApi } from '@renderer/pages/home/Inputbar/types'
import { useAppSelector } from '@renderer/store'
import type { Skill } from '@renderer/types/skill'
import { Tooltip } from 'antd'
import { CircleX, Plus, Sparkles } from 'lucide-react'
import type { FC } from 'react'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

interface Props {
  quickPanel: ToolQuickPanelApi
  selectedSkills?: Skill[]
  onSelect: (skills: Skill[]) => void
  disabled?: boolean
}

const SkillButton: FC<Props> = ({ quickPanel, selectedSkills, onSelect, disabled }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const quickPanelHook = useQuickPanel()
  const skillState = useAppSelector((state) => state.skill)
  const selectedSkillsRef = useRef(selectedSkills)

  useEffect(() => {
    selectedSkillsRef.current = selectedSkills
  }, [selectedSkills])

  const handleSkillSelect = useCallback(
    (skill: Skill) => {
      const currentSelectedSkills = selectedSkillsRef.current

      if (currentSelectedSkills?.some((selected) => selected.id === skill.id)) {
        onSelect(currentSelectedSkills.filter((selected) => selected.id !== skill.id))
      } else {
        onSelect([...(currentSelectedSkills || []), skill])
      }
    },
    [onSelect]
  )

  const skillItems = useMemo<QuickPanelListItem[]>(() => {
    const items: QuickPanelListItem[] = skillState.skills.map((skill) => ({
      label: skill.name,
      description: skill.description || '',
      icon: <Sparkles />,
      action: () => handleSkillSelect(skill),
      isSelected: selectedSkills?.some((selected) => selected.id === skill.id)
    }))

    items.push({
      label: t('skill.add') + '...',
      icon: <Plus />,
      action: () => navigate('/skills'),
      isSelected: false
    })

    items.unshift({
      label: t('settings.input.clear.all'),
      description: t('settings.input.clear.skills'),
      icon: <CircleX />,
      isSelected: false,
      action: ({ context: ctx }) => {
        onSelect([])
        ctx.close()
      }
    })

    return items
  }, [skillState.skills, t, selectedSkills, handleSkillSelect, navigate, onSelect])

  const openQuickPanel = useCallback(() => {
    quickPanelHook.open({
      title: t('chat.input.skills'),
      list: skillItems,
      symbol: QuickPanelReservedSymbol.Skills,
      multiple: true,
      afterAction({ item }) {
        item.isSelected = !item.isSelected
      }
    })
  }, [skillItems, quickPanelHook, t])

  const handleOpenQuickPanel = useCallback(() => {
    if (quickPanelHook.isVisible && quickPanelHook.symbol === QuickPanelReservedSymbol.Skills) {
      quickPanelHook.close()
    } else {
      openQuickPanel()
    }
  }, [openQuickPanel, quickPanelHook])

  useEffect(() => {
    const disposeRootMenu = quickPanel.registerRootMenu([
      {
        label: t('chat.input.skills'),
        description: '',
        icon: <Sparkles />,
        isMenu: true,
        action: () => openQuickPanel()
      }
    ])

    const disposeTrigger = quickPanel.registerTrigger(QuickPanelReservedSymbol.Skills, () => openQuickPanel())

    return () => {
      disposeRootMenu()
      disposeTrigger()
    }
  }, [openQuickPanel, quickPanel, t])

  return (
    <Tooltip placement="top" title={t('chat.input.skills')} mouseLeaveDelay={0} arrow>
      <ActionIconButton
        onClick={handleOpenQuickPanel}
        active={selectedSkills && selectedSkills.length > 0}
        disabled={disabled}
        aria-label={t('chat.input.skills')}>
        <Sparkles size={18} />
      </ActionIconButton>
    </Tooltip>
  )
}

export default memo(SkillButton)
