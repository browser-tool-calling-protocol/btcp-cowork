import { useTheme } from '@renderer/context/ThemeProvider'
import { useBrowserUseSettings } from '@renderer/hooks/useBrowserUseSettings'
import { Tag } from 'antd'
import type { FC } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingContainer, SettingGroup, SettingRowTitle } from '..'

// Tool presets matching the btcpBrowserPlugin constants
const TOOL_PRESETS = {
  minimal: [
    'browser_snapshot',
    'browser_url',
    'browser_title',
    'browser_get_text',
    'browser_get_attribute',
    'browser_is_visible',
    'browser_count',
    'browser_describe'
  ],
  standard: [
    'browser_snapshot',
    'browser_url',
    'browser_title',
    'browser_get_text',
    'browser_get_attribute',
    'browser_is_visible',
    'browser_count',
    'browser_describe',
    'browser_navigate',
    'browser_back',
    'browser_forward',
    'browser_reload',
    'browser_click',
    'browser_type',
    'browser_fill',
    'browser_press',
    'browser_hover',
    'browser_scroll',
    'browser_clear',
    'browser_check',
    'browser_select',
    'browser_get_by_role',
    'browser_get_by_text',
    'browser_get_by_label',
    'browser_wait',
    'browser_scroll_into_view',
    'browser_screenshot',
    'browser_highlight'
  ],
  full: [
    'browser_snapshot',
    'browser_url',
    'browser_title',
    'browser_get_text',
    'browser_get_attribute',
    'browser_is_visible',
    'browser_count',
    'browser_describe',
    'browser_navigate',
    'browser_back',
    'browser_forward',
    'browser_reload',
    'browser_click',
    'browser_type',
    'browser_fill',
    'browser_press',
    'browser_hover',
    'browser_scroll',
    'browser_clear',
    'browser_check',
    'browser_select',
    'browser_get_by_role',
    'browser_get_by_text',
    'browser_get_by_label',
    'browser_wait',
    'browser_scroll_into_view',
    'browser_screenshot',
    'browser_highlight',
    'browser_evaluate',
    'browser_frame',
    'browser_mainframe',
    'browser_uncheck',
    'browser_get_by_placeholder',
    'browser_is_enabled',
    'browser_wait_for_url',
    'browser_console'
  ]
}

const BrowserUseToolsSettings: FC = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { toolset } = useBrowserUseSettings()

  const minimalTools = useMemo(() => new Set(TOOL_PRESETS.minimal), [])
  const standardTools = useMemo(() => new Set(TOOL_PRESETS.standard), [])

  const getToolPresets = (tool: string): string[] => {
    const presets: string[] = []
    if (minimalTools.has(tool)) presets.push('minimal')
    if (standardTools.has(tool)) presets.push('standard')
    presets.push('full')
    return presets
  }

  const activeTools = useMemo(() => new Set(TOOL_PRESETS[toolset] || TOOL_PRESETS.standard), [toolset])

  return (
    <SettingContainer theme={theme}>
      <SettingGroup theme={theme}>
        <SettingRowTitle>{t('settings.tool.browser_use.tools.available')}</SettingRowTitle>
        <ToolDescription>{t('settings.tool.browser_use.tools.description', { preset: toolset })}</ToolDescription>
        <ToolsList>
          {TOOL_PRESETS.full.map((tool) => {
            const presets = getToolPresets(tool)
            const isActive = activeTools.has(tool)

            return (
              <ToolItem key={tool} $active={isActive}>
                <ToolName $active={isActive}>{tool}</ToolName>
                <PresetsContainer>
                  {presets.map((preset) => (
                    <Tag
                      key={preset}
                      color={preset === 'minimal' ? 'green' : preset === 'standard' ? 'blue' : 'orange'}
                      style={{ marginRight: 4 }}>
                      {preset}
                    </Tag>
                  ))}
                </PresetsContainer>
              </ToolItem>
            )
          })}
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

const ToolItem = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--color-background-soft);
  opacity: ${(props) => (props.$active ? 1 : 0.5)};
  border: 1px solid ${(props) => (props.$active ? 'var(--color-primary)' : 'transparent')};
`

const ToolName = styled.span<{ $active: boolean }>`
  font-family: monospace;
  font-size: 13px;
  color: ${(props) => (props.$active ? 'var(--color-text-1)' : 'var(--color-text-3)')};
`

const PresetsContainer = styled.div`
  display: flex;
  gap: 4px;
`

export default BrowserUseToolsSettings
