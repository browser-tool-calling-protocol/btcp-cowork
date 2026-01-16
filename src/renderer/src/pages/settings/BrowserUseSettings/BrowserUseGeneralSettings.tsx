import { useTheme } from '@renderer/context/ThemeProvider'
import { useBrowserUseSettings } from '@renderer/hooks/useBrowserUseSettings'
import type { BrowserUseToolset } from '@renderer/store/browserUse'
import { Button, InputNumber, message,Radio, Switch } from 'antd'
import { Github, Star } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingContainer, SettingDivider, SettingGroup, SettingRow, SettingRowTitle } from '..'

const BrowserUseGeneralSettings: FC = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()
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
          <SettingRowTitle>{t('settings.browser_use.enabled.label')}</SettingRowTitle>
          <Switch checked={enabled} onChange={setEnabled} />
        </SettingRow>
        <SettingDescription>{t('settings.browser_use.enabled.description')}</SettingDescription>
      </SettingGroup>

      <SettingDivider />

      <SettingGroup theme={theme}>
        <SettingRow>
          <SettingRowTitle>{t('settings.browser_use.toolset.label')}</SettingRowTitle>
        </SettingRow>
        <SettingDescription>{t('settings.browser_use.toolset.description')}</SettingDescription>
        <RadioGroup value={toolset} onChange={(e) => setToolset(e.target.value as BrowserUseToolset)}>
          <RadioOption value="minimal">
            <RadioLabel>{t('settings.browser_use.toolset.minimal.label')}</RadioLabel>
            <RadioDescription>{t('settings.browser_use.toolset.minimal.description')}</RadioDescription>
          </RadioOption>
          <RadioOption value="standard">
            <RadioLabel>{t('settings.browser_use.toolset.standard.label')}</RadioLabel>
            <RadioDescription>{t('settings.browser_use.toolset.standard.description')}</RadioDescription>
          </RadioOption>
          <RadioOption value="full">
            <RadioLabel>{t('settings.browser_use.toolset.full.label')}</RadioLabel>
            <RadioDescription>{t('settings.browser_use.toolset.full.description')}</RadioDescription>
          </RadioOption>
        </RadioGroup>
      </SettingGroup>

      <SettingDivider />

      <SettingGroup theme={theme}>
        <SettingRow>
          <SettingRowTitle>{t('settings.browser_use.max_snapshot_size.label')}</SettingRowTitle>
          <InputNumber
            min={10000}
            max={200000}
            step={5000}
            value={maxSnapshotSize}
            onChange={(val) => val && setMaxSnapshotSize(val)}
            style={{ width: 120 }}
          />
        </SettingRow>
        <SettingDescription>{t('settings.browser_use.max_snapshot_size.description')}</SettingDescription>
      </SettingGroup>

      <SettingDivider />

      <SettingGroup theme={theme}>
        <SettingRow>
          <SettingRowTitle>{t('settings.browser_use.screencast.label')}</SettingRowTitle>
          <Switch checked={enableScreencast} onChange={setEnableScreencast} />
        </SettingRow>
        <SettingDescription>{t('settings.browser_use.screencast.description')}</SettingDescription>
      </SettingGroup>

      <SettingDivider />

      <SettingGroup theme={theme}>
        <SettingRow>
          <SettingRowTitle>{t('settings.browser_use.tracking.label')}</SettingRowTitle>
          <Switch checked={enableTracking} onChange={setEnableTracking} />
        </SettingRow>
        <SettingDescription>{t('settings.browser_use.tracking.description')}</SettingDescription>
      </SettingGroup>

      <SettingDivider />

      <SettingGroup theme={theme}>
        <SettingRow>
          <SettingRowTitle>{t('settings.browser_use.system_prompt.label')}</SettingRowTitle>
          <Switch checked={injectSystemPrompt} onChange={setInjectSystemPrompt} />
        </SettingRow>
        <SettingDescription>{t('settings.browser_use.system_prompt.description')}</SettingDescription>
      </SettingGroup>

      <SettingDivider />

      <SettingGroup theme={theme}>
        <SettingRow>
          <SettingRowTitle>{t('settings.browser_use.demo.title')}</SettingRowTitle>
        </SettingRow>
        <SettingDescription>{t('settings.browser_use.demo.description')}</SettingDescription>
        <DemoButtonContainer>
          <Button
            type="primary"
            icon={<Star size={16} />}
            onClick={() => {
              message.info(t('settings.browser_use.demo.star_message'))
              // This would trigger browser automation to:
              // 1. Navigate to Google
              // 2. Search for "btcp browser cowork"
              // 3. Click on the GitHub link
              // 4. Star the repository
              window.open('https://github.com/browser-tool-calling-protocol/btcp-cowork', '_blank')
            }}>
            {t('settings.browser_use.demo.star_button')}
          </Button>
          <Button
            icon={<Github size={16} />}
            onClick={() => {
              window.open('https://github.com/browser-tool-calling-protocol/btcp-cowork', '_blank')
            }}>
            {t('settings.browser_use.demo.view_github')}
          </Button>
        </DemoButtonContainer>
      </SettingGroup>
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

export default BrowserUseGeneralSettings
