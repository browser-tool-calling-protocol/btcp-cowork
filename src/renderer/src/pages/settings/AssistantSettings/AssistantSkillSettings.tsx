/**
 * Assistant Skill Settings
 *
 * Allows configuring which skills are associated with an assistant.
 * Simplified replacement for the complex knowledge base settings.
 */
import { CheckOutlined } from '@ant-design/icons'
import { Box } from '@renderer/components/Layout'
import { useAppSelector } from '@renderer/store'
import type { Assistant, AssistantSettings } from '@renderer/types'
import type { SelectProps } from 'antd'
import { Select } from 'antd'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  assistant: Assistant
  updateAssistant: (assistant: Assistant) => void
  updateAssistantSettings: (settings: AssistantSettings) => void
}

const AssistantSkillSettings: React.FC<Props> = ({ assistant, updateAssistant }) => {
  const { t } = useTranslation()

  const skillState = useAppSelector((state) => state.skill)
  const skillOptions: SelectProps['options'] = skillState.skills.map((skill) => ({
    label: skill.name,
    value: skill.id,
    title: skill.description || ''
  }))

  const onUpdate = (value: string[]) => {
    updateAssistant({ ...assistant, skills: value })
  }

  return (
    <Container>
      <Box mb={8} style={{ fontWeight: 'bold' }}>
        {t('skill.title')}
      </Box>
      <Select
        mode="multiple"
        allowClear
        value={assistant.skills || []}
        placeholder={t('skill.select_placeholder')}
        menuItemSelectedIcon={<CheckOutlined />}
        options={skillOptions}
        onChange={onUpdate}
        filterOption={(input, option) =>
          String(option?.label ?? '')
            .toLowerCase()
            .includes(input.toLowerCase())
        }
      />
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  padding: 5px;
`

export default AssistantSkillSettings
