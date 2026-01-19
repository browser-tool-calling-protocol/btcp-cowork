/**
 * Add Skill Popup
 *
 * Simple popup for creating a new skill with name and prompt.
 */
import { TopView } from '@renderer/components/TopView'
import { useSkills } from '@renderer/hooks/useSkill'
import type { Skill } from '@renderer/types/skill'
import { Input, Modal } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface AddSkillPopupProps {
  title: string
  resolve: (skill: Skill | null) => void
}

const AddSkillPopupContent: React.FC<AddSkillPopupProps> = ({ title, resolve }) => {
  const { t } = useTranslation()
  const { create } = useSkills()
  const [open, setOpen] = useState(true)
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [description, setDescription] = useState('')

  const handleClose = () => {
    setOpen(false)
    setTimeout(() => resolve(null), 300)
  }

  const handleOk = () => {
    if (!name.trim()) {
      window.toast.warning(t('skill.name_required'))
      return
    }
    if (!prompt.trim()) {
      window.toast.warning(t('skill.prompt_required'))
      return
    }

    const skill = create({
      name: name.trim(),
      description: description.trim() || undefined,
      prompt: prompt.trim(),
      enabled: true
    })

    setOpen(false)
    setTimeout(() => resolve(skill), 300)
  }

  return (
    <Modal
      title={title}
      open={open}
      onCancel={handleClose}
      onOk={handleOk}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      centered
      width={500}
      destroyOnClose>
      <FormContainer>
        <FieldGroup>
          <FieldLabel>{t('skill.name')}</FieldLabel>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('skill.name_placeholder')}
            autoFocus
          />
        </FieldGroup>

        <FieldGroup>
          <FieldLabel>{t('skill.description')}</FieldLabel>
          <Input.TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('skill.description_placeholder')}
            autoSize={{ minRows: 2, maxRows: 4 }}
          />
        </FieldGroup>

        <FieldGroup>
          <FieldLabel>{t('skill.prompt')}</FieldLabel>
          <Input.TextArea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('skill.prompt_placeholder')}
            autoSize={{ minRows: 6, maxRows: 12 }}
          />
        </FieldGroup>
      </FormContainer>
    </Modal>
  )
}

const FormContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;
`

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const FieldLabel = styled.label`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-2);
`

export default class AddSkillPopup {
  static async show(props: { title: string }): Promise<Skill | null> {
    return new Promise((resolve) => {
      TopView.show(
        <AddSkillPopupContent
          title={props.title}
          resolve={(skill) => {
            resolve(skill)
            TopView.hide('AddSkillPopup')
          }}
        />,
        'AddSkillPopup'
      )
    })
  }
}
