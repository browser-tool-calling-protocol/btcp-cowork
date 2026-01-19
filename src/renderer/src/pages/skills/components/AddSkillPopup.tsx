/**
 * Add/Edit Skill Popup
 *
 * Comprehensive form for creating and editing skills with:
 * - Name and description
 * - Domain pattern (regex) for website matching
 * - Prompt (main instructions)
 * - Content script (JavaScript)
 * - Page script (JavaScript)
 * - Tool schema (JSON text)
 */
import { CodeOutlined, FileTextOutlined, SettingOutlined, ToolOutlined } from '@ant-design/icons'
import { TopView } from '@renderer/components/TopView'
import { useSkills } from '@renderer/hooks/useSkill'
import type { Skill } from '@renderer/types/skill'
import { isValidDomainPattern } from '@renderer/types/skill'
import { Collapse, Input, Modal, Switch, Tabs, Tooltip } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface AddSkillPopupProps {
  title: string
  skill?: Skill // For editing existing skill
  resolve: (skill: Skill | null) => void
}

const AddSkillPopupContent: React.FC<AddSkillPopupProps> = ({ title, skill, resolve }) => {
  const { t } = useTranslation()
  const { create, update } = useSkills()
  const [open, setOpen] = useState(true)

  // Basic fields
  const [name, setName] = useState(skill?.name || '')
  const [description, setDescription] = useState(skill?.description || '')
  const [domainPattern, setDomainPattern] = useState(skill?.domainPattern || '')
  const [enabled, setEnabled] = useState(skill?.enabled ?? true)

  // Prompt field
  const [prompt, setPrompt] = useState(skill?.prompt || '')

  // Script fields
  const [contentScript, setContentScript] = useState(skill?.contentScript || '')
  const [pageScript, setPageScript] = useState(skill?.pageScript || '')

  // Tool schema (simple JSON text)
  const [toolSchema, setToolSchema] = useState(skill?.toolSchema || '')

  // Validation states
  const [domainPatternError, setDomainPatternError] = useState<string | null>(null)

  const handleClose = () => {
    setOpen(false)
    setTimeout(() => resolve(null), 300)
  }

  const validateDomainPattern = (pattern: string) => {
    if (!pattern) {
      setDomainPatternError(null)
      return true
    }
    if (!isValidDomainPattern(pattern)) {
      setDomainPatternError(t('skill.domain_pattern_invalid'))
      return false
    }
    setDomainPatternError(null)
    return true
  }

  const handleOk = () => {
    // Validate required fields
    if (!name.trim()) {
      window.toast.warning(t('skill.name_required'))
      return
    }
    if (!prompt.trim()) {
      window.toast.warning(t('skill.prompt_required'))
      return
    }

    // Validate domain pattern
    if (!validateDomainPattern(domainPattern)) {
      window.toast.warning(t('skill.domain_pattern_invalid'))
      return
    }

    const skillData = {
      name: name.trim(),
      description: description.trim() || undefined,
      domainPattern: domainPattern.trim() || undefined,
      prompt: prompt.trim(),
      contentScript: contentScript.trim() || undefined,
      pageScript: pageScript.trim() || undefined,
      toolSchema: toolSchema.trim() || undefined,
      enabled
    }

    let resultSkill: Skill
    if (skill) {
      // Editing existing skill
      resultSkill = update(skill.id, skillData)
    } else {
      // Creating new skill
      resultSkill = create(skillData)
    }

    setOpen(false)
    setTimeout(() => resolve(resultSkill), 300)
  }

  const tabItems = [
    {
      key: 'basic',
      label: (
        <TabLabel>
          <SettingOutlined />
          {t('skill.tab_basic')}
        </TabLabel>
      ),
      children: (
        <TabContent>
          <FieldGroup>
            <FieldRow>
              <FieldLabel>{t('skill.name')} *</FieldLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('skill.name_placeholder')}
                autoFocus
              />
            </FieldRow>
          </FieldGroup>

          <FieldGroup>
            <FieldRow>
              <FieldLabel>{t('skill.description')}</FieldLabel>
              <Input.TextArea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('skill.description_placeholder')}
                autoSize={{ minRows: 2, maxRows: 4 }}
              />
            </FieldRow>
          </FieldGroup>

          <FieldGroup>
            <FieldRow>
              <FieldLabel>
                {t('skill.domain_pattern')}
                <Tooltip title={t('skill.domain_pattern_help')}>
                  <HelpIcon>?</HelpIcon>
                </Tooltip>
              </FieldLabel>
              <Input
                value={domainPattern}
                onChange={(e) => {
                  setDomainPattern(e.target.value)
                  validateDomainPattern(e.target.value)
                }}
                placeholder={t('skill.domain_pattern_placeholder')}
                status={domainPatternError ? 'error' : undefined}
              />
              {domainPatternError && <ErrorText>{domainPatternError}</ErrorText>}
            </FieldRow>
          </FieldGroup>

          <FieldGroup>
            <FieldRow style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <FieldLabel style={{ marginBottom: 0 }}>{t('skill.enabled')}</FieldLabel>
              <Switch checked={enabled} onChange={setEnabled} />
            </FieldRow>
          </FieldGroup>
        </TabContent>
      )
    },
    {
      key: 'prompt',
      label: (
        <TabLabel>
          <FileTextOutlined />
          {t('skill.tab_prompt')}
        </TabLabel>
      ),
      children: (
        <TabContent>
          <FieldGroup>
            <FieldLabel>{t('skill.prompt')} *</FieldLabel>
            <FieldHint>{t('skill.prompt_hint')}</FieldHint>
            <CodeEditor
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('skill.prompt_placeholder')}
              rows={15}
            />
          </FieldGroup>
        </TabContent>
      )
    },
    {
      key: 'scripts',
      label: (
        <TabLabel>
          <CodeOutlined />
          {t('skill.tab_scripts')}
        </TabLabel>
      ),
      children: (
        <TabContent>
          <Collapse
            defaultActiveKey={contentScript ? ['content'] : []}
            ghost
            items={[
              {
                key: 'content',
                label: (
                  <CollapseLabel>
                    {t('skill.content_script')}
                    <Tooltip title={t('skill.content_script_help')}>
                      <HelpIcon>?</HelpIcon>
                    </Tooltip>
                  </CollapseLabel>
                ),
                children: (
                  <FieldGroup>
                    <FieldHint>{t('skill.content_script_hint')}</FieldHint>
                    <CodeEditor
                      value={contentScript}
                      onChange={(e) => setContentScript(e.target.value)}
                      placeholder={t('skill.content_script_placeholder')}
                      rows={10}
                      $isCode
                    />
                  </FieldGroup>
                )
              },
              {
                key: 'page',
                label: (
                  <CollapseLabel>
                    {t('skill.page_script')}
                    <Tooltip title={t('skill.page_script_help')}>
                      <HelpIcon>?</HelpIcon>
                    </Tooltip>
                  </CollapseLabel>
                ),
                children: (
                  <FieldGroup>
                    <FieldHint>{t('skill.page_script_hint')}</FieldHint>
                    <CodeEditor
                      value={pageScript}
                      onChange={(e) => setPageScript(e.target.value)}
                      placeholder={t('skill.page_script_placeholder')}
                      rows={10}
                      $isCode
                    />
                  </FieldGroup>
                )
              }
            ]}
          />
        </TabContent>
      )
    },
    {
      key: 'tools',
      label: (
        <TabLabel>
          <ToolOutlined />
          {t('skill.tab_tools')}
        </TabLabel>
      ),
      children: (
        <TabContent>
          <FieldGroup>
            <FieldLabel>
              {t('skill.tool_schema')}
              <Tooltip title={t('skill.tool_schema_help')}>
                <HelpIcon>?</HelpIcon>
              </Tooltip>
            </FieldLabel>
            <FieldHint>{t('skill.tool_schema_hint')}</FieldHint>
            <CodeEditor
              value={toolSchema}
              onChange={(e) => setToolSchema(e.target.value)}
              placeholder={t('skill.tool_schema_placeholder')}
              rows={12}
              $isCode
            />
          </FieldGroup>
        </TabContent>
      )
    }
  ]

  return (
    <Modal
      title={title}
      open={open}
      onCancel={handleClose}
      onOk={handleOk}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      centered
      width={700}
      destroyOnClose>
      <FormContainer>
        <Tabs defaultActiveKey="basic" items={tabItems} />
      </FormContainer>
    </Modal>
  )
}

const FormContainer = styled.div`
  min-height: 400px;
`

const TabContent = styled.div`
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const TabLabel = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
`

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const FieldRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const FieldLabel = styled.label`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-2);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
`

const FieldHint = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
  margin-bottom: 4px;
`

const HelpIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  font-size: 10px;
  border-radius: 50%;
  background: var(--color-border);
  color: var(--color-text-3);
  cursor: help;
`

const CollapseLabel = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
`

const CodeEditor = styled(Input.TextArea)<{ $isCode?: boolean }>`
  font-family: ${(props) => (props.$isCode ? "'Fira Code', 'Monaco', 'Consolas', monospace" : 'inherit')};
  font-size: ${(props) => (props.$isCode ? '12px' : '13px')};
  line-height: 1.5;
  background: ${(props) => (props.$isCode ? 'var(--color-background-soft)' : 'inherit')};
`

const ErrorText = styled.div`
  font-size: 12px;
  color: var(--color-error);
`

export default class AddSkillPopup {
  static async show(props: { title: string; skill?: Skill }): Promise<Skill | null> {
    return new Promise((resolve) => {
      TopView.show(
        <AddSkillPopupContent
          title={props.title}
          skill={props.skill}
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
