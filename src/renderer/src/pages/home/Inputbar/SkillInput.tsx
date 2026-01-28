/**
 * Skill Input Display
 *
 * Displays selected skills as tags in the input bar.
 * Shows both manually selected skills (purple) and auto-activated skills (green).
 */
import HorizontalScrollContainer from '@renderer/components/HorizontalScrollContainer'
import CustomTag from '@renderer/components/Tags/CustomTag'
import type { Skill } from '@renderer/types/skill'
import { Sparkles, Zap } from 'lucide-react'
import type { FC } from 'react'
import styled from 'styled-components'

interface SkillInputProps {
  /** Manually selected skills */
  selectedSkills: Skill[]
  /** Auto-activated skills based on domain pattern */
  autoActivatedSkills?: Skill[]
  /** Handler for removing manually selected skills */
  onRemoveSkill: (skill: Skill) => void
  /** Handler for dismissing auto-activated skills */
  onDismissAutoSkill?: (skill: Skill) => void
}

const MANUAL_SKILL_COLOR = '#7c3aed' // Purple
const AUTO_SKILL_COLOR = '#16a34a' // Green

const SkillInput: FC<SkillInputProps> = ({
  selectedSkills,
  autoActivatedSkills = [],
  onRemoveSkill,
  onDismissAutoSkill
}) => {
  const hasSkills = selectedSkills.length > 0 || autoActivatedSkills.length > 0

  if (!hasSkills) {
    return null
  }

  return (
    <Container>
      <HorizontalScrollContainer dependencies={[selectedSkills, autoActivatedSkills]} expandable>
        {/* Manual skills (purple) */}
        {selectedSkills.map((skill) => (
          <CustomTag
            icon={<Sparkles size={12} />}
            color={MANUAL_SKILL_COLOR}
            key={`manual-${skill.id}`}
            closable
            onClose={() => onRemoveSkill(skill)}>
            {skill.name}
          </CustomTag>
        ))}

        {/* Auto-activated skills (green) */}
        {autoActivatedSkills.map((skill) => (
          <CustomTag
            icon={<Zap size={12} />}
            color={AUTO_SKILL_COLOR}
            key={`auto-${skill.id}`}
            closable
            onClose={() => onDismissAutoSkill?.(skill)}>
            {skill.name}
          </CustomTag>
        ))}
      </HorizontalScrollContainer>
    </Container>
  )
}

const Container = styled.div`
  width: 100%;
  padding: 5px 15px 5px 15px;
`

export default SkillInput
