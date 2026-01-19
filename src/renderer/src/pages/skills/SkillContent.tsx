/**
 * Skill Content Editor
 *
 * Full editor for skill configuration including:
 * - Basic info (name, description, domain pattern, enabled)
 * - Prompt (main instructions)
 * - Scripts (content script, page script)
 * - Tools (tool schema JSON)
 */
import { CodeOutlined, FileTextOutlined, SettingOutlined, ToolOutlined } from '@ant-design/icons'
import Scrollbar from '@renderer/components/Scrollbar'
import type { Skill, SkillTool } from '@renderer/types/skill'
import { isValidDomainPattern, isValidToolSchema } from '@renderer/types/skill'
import { Collapse, Input, Switch, Tabs, Tooltip } from 'antd'
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

  // Tool schema as JSON string for editing
  const [toolSchemaJson, setToolSchemaJson] = useState(
    skill.toolSchema ? JSON.stringify(skill.toolSchema, null, 2) : ''
  )

  // Validation states
  const [domainPatternError, setDomainPatternError] = useState<string | null>(null)
  const [toolSchemaError, setToolSchemaError] = useState<string | null>(null)

  // Sync with external skill changes
  useEffect(() => {
    setLocalSkill(skill)
    setToolSchemaJson(skill.toolSchema ? JSON.stringify(skill.toolSchema, null, 2) : '')
  }, [skill])

  const validateDomainPattern = useCallback(
    (pattern: string) => {
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
    },
    [t]
  )

  const validateAndParseToolSchema = useCallback(
    (json: string): SkillTool[] | null => {
      if (!json.trim()) {
        setToolSchemaError(null)
        return []
      }
      try {
        const parsed = JSON.parse(json)
        if (!isValidToolSchema(parsed)) {
          setToolSchemaError(t('skill.tool_schema_invalid_format'))
          return null
        }
        setToolSchemaError(null)
        return parsed
      } catch {
        setToolSchemaError(t('skill.tool_schema_invalid_json'))
        return null
      }
    },
    [t]
  )

  // Handle field changes
  const handleChange = useCallback(
    (field: keyof Skill, value: string | boolean | SkillTool[] | undefined) => {
      const updated = { ...localSkill, [field]: value }
      setLocalSkill(updated)
      onUpdate(updated)
    },
    [localSkill, onUpdate]
  )

  // Handle domain pattern change with validation
  const handleDomainPatternChange = useCallback(
    (value: string) => {
      validateDomainPattern(value)
      handleChange('domainPattern', value || undefined)
    },
    [handleChange, validateDomainPattern]
  )

  // Handle tool schema JSON change
  const handleToolSchemaChange = useCallback(
    (json: string) => {
      setToolSchemaJson(json)
      const parsed = validateAndParseToolSchema(json)
      if (parsed !== null) {
        handleChange('toolSchema', parsed.length > 0 ? parsed : undefined)
      }
    },
    [handleChange, validateAndParseToolSchema]
  )

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
            <FieldLabel>{t('skill.name')} *</FieldLabel>
            <Input
              value={localSkill.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder={t('skill.name_placeholder')}
              size="large"
            />
          </FieldGroup>

          <FieldGroup>
            <FieldLabel>{t('skill.description')}</FieldLabel>
            <Input.TextArea
              value={localSkill.description || ''}
              onChange={(e) => handleChange('description', e.target.value || undefined)}
              placeholder={t('skill.description_placeholder')}
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </FieldGroup>

          <FieldGroup>
            <FieldLabel>
              {t('skill.domain_pattern')}
              <Tooltip title={t('skill.domain_pattern_help')}>
                <HelpIcon>?</HelpIcon>
              </Tooltip>
            </FieldLabel>
            <Input
              value={localSkill.domainPattern || ''}
              onChange={(e) => handleDomainPatternChange(e.target.value)}
              placeholder={t('skill.domain_pattern_placeholder')}
              status={domainPatternError ? 'error' : undefined}
            />
            {domainPatternError && <ErrorText>{domainPatternError}</ErrorText>}
          </FieldGroup>

          <FieldGroup>
            <FieldRow>
              <FieldLabel style={{ marginBottom: 0 }}>{t('skill.enabled')}</FieldLabel>
              <Switch checked={localSkill.enabled} onChange={(checked) => handleChange('enabled', checked)} />
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
          <FieldGroup style={{ flex: 1 }}>
            <FieldLabel>{t('skill.prompt')} *</FieldLabel>
            <FieldHint>{t('skill.prompt_hint')}</FieldHint>
            <PromptTextArea
              value={localSkill.prompt}
              onChange={(e) => handleChange('prompt', e.target.value)}
              placeholder={t('skill.prompt_placeholder')}
              autoSize={{ minRows: 15 }}
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
            defaultActiveKey={localSkill.contentScript ? ['content'] : localSkill.pageScript ? ['page'] : []}
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
                      value={localSkill.contentScript || ''}
                      onChange={(e) => handleChange('contentScript', e.target.value || undefined)}
                      placeholder={t('skill.content_script_placeholder')}
                      autoSize={{ minRows: 10 }}
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
                      value={localSkill.pageScript || ''}
                      onChange={(e) => handleChange('pageScript', e.target.value || undefined)}
                      placeholder={t('skill.page_script_placeholder')}
                      autoSize={{ minRows: 10 }}
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
              value={toolSchemaJson}
              onChange={(e) => handleToolSchemaChange(e.target.value)}
              placeholder={t('skill.tool_schema_placeholder')}
              autoSize={{ minRows: 12 }}
              status={toolSchemaError ? 'error' : undefined}
            />
            {toolSchemaError && <ErrorText>{toolSchemaError}</ErrorText>}
          </FieldGroup>
        </TabContent>
      )
    }
  ]

  return (
    <MainContainer>
      <ContentScrollbar>
        <FormContainer>
          <Tabs defaultActiveKey="basic" items={tabItems} />
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
  max-width: 900px;
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
  align-items: center;
  justify-content: space-between;
  gap: 16px;
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

const PromptTextArea = styled(Input.TextArea)`
  font-family: var(--font-family-code);
  font-size: 13px;
  line-height: 1.6;
`

const CodeEditor = styled(Input.TextArea)<{ status?: string }>`
  font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  background: ${(props) => (props.status === 'error' ? 'var(--color-error-bg)' : 'var(--color-background-soft)')};
`

const ErrorText = styled.div`
  font-size: 12px;
  color: var(--color-error);
`

export default SkillContent
