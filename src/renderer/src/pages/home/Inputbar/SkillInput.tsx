/**
 * Skill Input Display
 *
 * Displays selected skills as tags in the input bar.
 */
import HorizontalScrollContainer from '@renderer/components/HorizontalScrollContainer'
import CustomTag from '@renderer/components/Tags/CustomTag'
import type { Skill } from '@renderer/types/skill'
import { Sparkles } from 'lucide-react'
import type { FC } from 'react'
import styled from 'styled-components'

const SkillInput: FC<{
  selectedSkills: Skill[]
  onRemoveSkill: (skill: Skill) => void
}> = ({ selectedSkills, onRemoveSkill }) => {
  return (
    <Container>
      <HorizontalScrollContainer dependencies={[selectedSkills]} expandable>
        {selectedSkills.map((skill) => (
          <CustomTag
            icon={<Sparkles size={12} />}
            color="#7c3aed"
            key={skill.id}
            closable
            onClose={() => onRemoveSkill(skill)}>
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
