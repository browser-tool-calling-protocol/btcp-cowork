import { useTheme } from '@renderer/context/ThemeProvider'
import { type DemoStep, useBrowserDemo } from '@renderer/hooks/useBrowserDemo'
import { useBrowserUseSettings } from '@renderer/hooks/useBrowserUseSettings'
import type { BrowserUseToolset } from '@renderer/store/browserUse'
import { Button, InputNumber, Modal, Progress, Radio, Switch, Tag } from 'antd'
import { CheckCircle, Circle, Github, Loader2, Play, Square, XCircle } from 'lucide-react'
import { type FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingContainer, SettingDivider, SettingGroup, SettingRow, SettingRowTitle } from '..'

const getStepIcon = (status: DemoStep['status']) => {
  switch (status) {
    case 'success':
      return <CheckCircle size={18} color="var(--color-success)" />
    case 'error':
      return <XCircle size={18} color="var(--color-error)" />
    case 'running':
      return <Loader2 size={18} className="spinning" color="var(--color-primary)" />
    case 'skipped':
      return <Circle size={18} color="var(--color-text-4)" />
    default:
      return <Circle size={18} color="var(--color-text-3)" />
  }
}

const BrowserUseGeneralSettings: FC = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const [demoModalOpen, setDemoModalOpen] = useState(false)
  const { steps, isRunning, currentStepIndex, runDemo, stopDemo, resetDemo, error } = useBrowserDemo()
  const {
    enabled,
    setEnabled,
    toolset,
    setToolset,
    maxSnapshotSize,
    setMaxSnapshotSize,
    enableScreencast,
    setEnableScreencast,
    enableTracking,
    setEnableTracking,
    injectSystemPrompt,
    setInjectSystemPrompt
  } = useBrowserUseSettings()

  return (
    <SettingContainer theme={theme}>
      <SettingGroup theme={theme}>
        <SettingRow>
          <SettingRowTitle>{t('settings.tool.browser_use.enabled.label')}</SettingRowTitle>
          <Switch checked={enabled} onChange={setEnabled} />
        </SettingRow>
        <SettingDescription>{t('settings.tool.browser_use.enabled.description')}</SettingDescription>
      </SettingGroup>

      <SettingDivider />

      <SettingGroup theme={theme}>
        <SettingRow>
          <SettingRowTitle>{t('settings.tool.browser_use.toolset.label')}</SettingRowTitle>
        </SettingRow>
        <SettingDescription>{t('settings.tool.browser_use.toolset.description')}</SettingDescription>
        <RadioGroup value={toolset} onChange={(e) => setToolset(e.target.value as BrowserUseToolset)}>
          <RadioOption value="minimal">
            <RadioLabel>{t('settings.tool.browser_use.toolset.minimal.label')}</RadioLabel>
            <RadioDescription>{t('settings.tool.browser_use.toolset.minimal.description')}</RadioDescription>
          </RadioOption>
          <RadioOption value="standard">
            <RadioLabel>{t('settings.tool.browser_use.toolset.standard.label')}</RadioLabel>
            <RadioDescription>{t('settings.tool.browser_use.toolset.standard.description')}</RadioDescription>
          </RadioOption>
          <RadioOption value="full">
            <RadioLabel>{t('settings.tool.browser_use.toolset.full.label')}</RadioLabel>
            <RadioDescription>{t('settings.tool.browser_use.toolset.full.description')}</RadioDescription>
          </RadioOption>
        </RadioGroup>
      </SettingGroup>

      <SettingDivider />

      <SettingGroup theme={theme}>
        <SettingRow>
          <SettingRowTitle>{t('settings.tool.browser_use.max_snapshot_size.label')}</SettingRowTitle>
          <InputNumber
            min={10000}
            max={200000}
            step={5000}
            value={maxSnapshotSize}
            onChange={(val) => val && setMaxSnapshotSize(val)}
            style={{ width: 120 }}
          />
        </SettingRow>
        <SettingDescription>{t('settings.tool.browser_use.max_snapshot_size.description')}</SettingDescription>
      </SettingGroup>

      <SettingDivider />

      <SettingGroup theme={theme}>
        <SettingRow>
          <SettingRowTitle>{t('settings.tool.browser_use.screencast.label')}</SettingRowTitle>
          <Switch checked={enableScreencast} onChange={setEnableScreencast} />
        </SettingRow>
        <SettingDescription>{t('settings.tool.browser_use.screencast.description')}</SettingDescription>
      </SettingGroup>

      <SettingDivider />

      <SettingGroup theme={theme}>
        <SettingRow>
          <SettingRowTitle>{t('settings.tool.browser_use.tracking.label')}</SettingRowTitle>
          <Switch checked={enableTracking} onChange={setEnableTracking} />
        </SettingRow>
        <SettingDescription>{t('settings.tool.browser_use.tracking.description')}</SettingDescription>
      </SettingGroup>

      <SettingDivider />

      <SettingGroup theme={theme}>
        <SettingRow>
          <SettingRowTitle>{t('settings.tool.browser_use.system_prompt.label')}</SettingRowTitle>
          <Switch checked={injectSystemPrompt} onChange={setInjectSystemPrompt} />
        </SettingRow>
        <SettingDescription>{t('settings.tool.browser_use.system_prompt.description')}</SettingDescription>
      </SettingGroup>

      <SettingDivider />

      <SettingGroup theme={theme}>
        <SettingRow>
          <SettingRowTitle>{t('settings.tool.browser_use.demo.title')}</SettingRowTitle>
        </SettingRow>
        <SettingDescription>{t('settings.tool.browser_use.demo.description')}</SettingDescription>
        <DemoButtonContainer>
          <Button type="primary" icon={<Play size={16} />} onClick={() => setDemoModalOpen(true)}>
            {t('settings.tool.browser_use.demo.run_demo')}
          </Button>
          <Button
            icon={<Github size={16} />}
            onClick={() => {
              window.open('https://github.com/browser-tool-calling-protocol/btcp-cowork', '_blank')
            }}>
            {t('settings.tool.browser_use.demo.view_github')}
          </Button>
        </DemoButtonContainer>
      </SettingGroup>

      <DemoModal
        title={t('settings.tool.browser_use.demo.modal_title')}
        open={demoModalOpen}
        onCancel={() => {
          if (isRunning) {
            stopDemo()
          }
          setDemoModalOpen(false)
        }}
        footer={
          <DemoModalFooter>
            {!isRunning ? (
              <>
                <Button onClick={resetDemo}>{t('settings.tool.browser_use.demo.reset')}</Button>
                <Button type="primary" icon={<Play size={14} />} onClick={runDemo}>
                  {t('settings.tool.browser_use.demo.start')}
                </Button>
              </>
            ) : (
              <Button danger icon={<Square size={14} />} onClick={stopDemo}>
                {t('settings.tool.browser_use.demo.stop')}
              </Button>
            )}
          </DemoModalFooter>
        }
        width={600}>
        <DemoContent>
          <DemoDescription>{t('settings.tool.browser_use.demo.modal_description')}</DemoDescription>

          {error && <DemoError>{error}</DemoError>}

          <DemoProgress>
            <Progress
              percent={Math.round((steps.filter((s) => s.status === 'success').length / steps.length) * 100)}
              status={error ? 'exception' : isRunning ? 'active' : 'normal'}
            />
          </DemoProgress>

          <DemoStepsList>
            {steps.map((step, index) => (
              <DemoStepItem key={step.id} $status={step.status} $isCurrent={index === currentStepIndex}>
                <DemoStepIcon>{getStepIcon(step.status)}</DemoStepIcon>
                <DemoStepInfo>
                  <DemoStepName>{step.name}</DemoStepName>
                  <DemoStepDescription>
                    {step.description}
                    <Tag style={{ marginLeft: 8 }}>{step.action}</Tag>
                  </DemoStepDescription>
                </DemoStepInfo>
              </DemoStepItem>
            ))}
          </DemoStepsList>
        </DemoContent>
      </DemoModal>
    </SettingContainer>
  )
}

const SettingDescription = styled.div`
  color: var(--color-text-3);
  font-size: 12px;
  margin-top: 4px;
`

const RadioGroup = styled(Radio.Group)`
  display: flex;
  flex-direction: column;
  margin-top: 12px;
`

const RadioOption = styled(Radio)`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 12px;
  padding: 8px 0;

  &:last-child {
    margin-bottom: 0;
  }
`

const RadioLabel = styled.span`
  font-weight: 500;
`

const RadioDescription = styled.span`
  color: var(--color-text-3);
  font-size: 12px;
  margin-top: 2px;
  margin-left: 24px;
`

const DemoButtonContainer = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 16px;
`

const DemoModal = styled(Modal)`
  .ant-modal-body {
    padding: 16px 24px;
  }
`

const DemoModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

const DemoContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const DemoDescription = styled.p`
  color: var(--color-text-2);
  margin: 0;
`

const DemoError = styled.div`
  padding: 12px;
  background: var(--color-error-bg, rgba(255, 77, 79, 0.1));
  border: 1px solid var(--color-error);
  border-radius: 6px;
  color: var(--color-error);
  font-size: 13px;
`

const DemoProgress = styled.div`
  margin: 8px 0;
`

const DemoStepsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
`

const DemoStepItem = styled.div<{ $status: DemoStep['status']; $isCurrent: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: ${({ $isCurrent }) => ($isCurrent ? 'var(--color-primary-bg, rgba(22, 119, 255, 0.1))' : 'transparent')};
  border: 1px solid ${({ $isCurrent }) => ($isCurrent ? 'var(--color-primary)' : 'var(--color-border)')};
  transition: all 0.2s;

  .spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`

const DemoStepIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`

const DemoStepInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
`

const DemoStepName = styled.span`
  font-weight: 500;
  font-size: 14px;
`

const DemoStepDescription = styled.span`
  font-size: 12px;
  color: var(--color-text-3);
  display: flex;
  align-items: center;
`

export default BrowserUseGeneralSettings
