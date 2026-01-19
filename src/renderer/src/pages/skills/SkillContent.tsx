/**
 * Skill Content Editor
 *
 * Simple editor for skill name, description, and prompt.
 * Replaces the complex KnowledgeContent with tabs for files, URLs, etc.
 */
import Scrollbar from '@renderer/components/Scrollbar'
import type { Skill } from '@renderer/types/skill'
import { Input, Switch } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface SkillContentProps {
  skill: Skill
  onUpdate: (skill: Skill) => void
}

const SkillContent: FC<SkillContentProps> = ({ skill, onUpdate }) => {
  const { t } = useTranslation()
  const [localSkill, setLocalSkill] = useState(skill)

  // Sync with external skill changes
  useEffect(() => {
    setLocalSkill(skill)
  }, [skill])

  // Debounced update to avoid too many Redux dispatches
  const handleChange = useCallback(
    (field: keyof Skill, value: string | boolean) => {
      const updated = { ...localSkill, [field]: value }
      setLocalSkill(updated)
      onUpdate(updated)
    },
    [localSkill, onUpdate]
  )

  return (
    <MainContainer>
      <ContentScrollbar>
        <FormContainer>
          {/* Header with name and enabled toggle */}
          <HeaderRow>
            <NameInput
              value={localSkill.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder={t('skill.name_placeholder')}
              size="large"
            />
            <EnabledRow>
              <span>{t('skill.enabled')}</span>
              <Switch checked={localSkill.enabled} onChange={(checked) => handleChange('enabled', checked)} />
            </EnabledRow>
          </HeaderRow>

          {/* Description field */}
          <FieldGroup>
            <FieldLabel>{t('skill.description')}</FieldLabel>
            <Input.TextArea
              value={localSkill.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder={t('skill.description_placeholder')}
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </FieldGroup>

          {/* Main prompt editor */}
          <FieldGroup style={{ flex: 1 }}>
            <FieldLabel>{t('skill.prompt')}</FieldLabel>
            <PromptTextArea
              value={localSkill.prompt}
              onChange={(e) => handleChange('prompt', e.target.value)}
              placeholder={t('skill.prompt_placeholder')}
              autoSize={{ minRows: 10 }}
            />
          </FieldGroup>
        </FormContainer>
      </ContentScrollbar>
    </MainContainer>
  )
}

const MainContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
`

const ContentScrollbar = styled(Scrollbar)`
  flex: 1;
  padding: 20px;
`

const FormContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 800px;
`

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`

const NameInput = styled(Input)`
  flex: 1;
  font-weight: 500;
`

const EnabledRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-2);
  font-size: 13px;
`

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const FieldLabel = styled.label`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-2);
`

const PromptTextArea = styled(Input.TextArea)`
  font-family: var(--font-family-code);
  font-size: 13px;
  line-height: 1.6;
`

export default SkillContent
