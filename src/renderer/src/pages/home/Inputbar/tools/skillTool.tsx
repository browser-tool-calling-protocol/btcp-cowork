/**
 * Skill Tool
 *
 * Allows users to select skills to provide context for their messages.
 * Skills are simple text prompts that get injected into the system message.
 */
import { useAssistant } from '@renderer/hooks/useAssistant'
import { defineTool, registerTool, TopicType } from '@renderer/pages/home/Inputbar/types'
import type { Skill } from '@renderer/types/skill'
import { useCallback } from 'react'

import SkillButton from './components/SkillButton'

const skillTool = defineTool({
  key: 'skill',
  label: (t) => t('chat.input.skills'),

  visibleInScopes: [TopicType.Chat],
  condition: () => true, // Skills work with any assistant

  dependencies: {
    state: ['selectedSkills'] as const,
    actions: ['setSelectedSkills'] as const
  },

  render: function SkillToolRender(context) {
    const { assistant, state, actions, quickPanel } = context

    const { updateAssistant } = useAssistant(assistant.id)

    const handleSelect = useCallback(
      (skills: Skill[]) => {
        updateAssistant({ skills: skills.map((s) => s.id) })
        actions.setSelectedSkills?.(skills)
      },
      [updateAssistant, actions]
    )

    return <SkillButton quickPanel={quickPanel} selectedSkills={state.selectedSkills} onSelect={handleSelect} />
  }
})

registerTool(skillTool)

export default skillTool
