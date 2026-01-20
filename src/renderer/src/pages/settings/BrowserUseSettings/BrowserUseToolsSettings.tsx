import { useTheme } from '@renderer/context/ThemeProvider'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingContainer, SettingGroup, SettingRowTitle } from '..'

// All available browser tools
// Uses the two-layer architecture from btcp-browser-agent:
// - BackgroundAgent: Session management, navigation, screenshots
// - ContentAgent: DOM operations (click, fill, type, snapshot, etc.)
const ALL_TOOLS = [
  // Session management
  'browser_launch',
  'browser_close',
  // Navigation
  'browser_navigate',
  'browser_back',
  'browser_forward',
  'browser_reload',
  // Inspection
  'browser_snapshot',
  'browser_get_text',
  // Interaction
  'browser_click',
  'browser_type',
  'browser_fill',
  'browser_press',
  'browser_scroll',
  // Visual
  'browser_screenshot'
]

const BrowserUseToolsSettings: FC = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()

  return (
    <SettingContainer theme={theme}>
      <SettingGroup theme={theme}>
        <SettingRowTitle>{t('settings.tool.browser_use.tools.available')}</SettingRowTitle>
        <ToolDescription>{t('settings.tool.browser_use.tools.all_tools_description')}</ToolDescription>
        <ToolsList>
          {ALL_TOOLS.map((tool) => (
            <ToolItem key={tool}>
              <ToolName>{tool}</ToolName>
            </ToolItem>
          ))}
        </ToolsList>
      </SettingGroup>
    </SettingContainer>
  )
}

const ToolDescription = styled.div`
  color: var(--color-text-3);
  font-size: 12px;
  margin: 8px 0 16px 0;
`

const ToolsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const ToolItem = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
`

const ToolName = styled.span`
  font-family: monospace;
  font-size: 13px;
  color: var(--color-text-1);
`

export default BrowserUseToolsSettings
