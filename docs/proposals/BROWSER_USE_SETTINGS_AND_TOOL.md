# Browser Use Settings Page and Inputbar Tool Proposal

This document outlines the implementation plan for adding:
1. A new **Browser Use Settings** page in the Settings menu
2. A new **Browser Use Tool** in the chat Inputbar for toggling browser automation

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Settings Page Implementation](#2-settings-page-implementation)
- [3. Inputbar Tool Implementation](#3-inputbar-tool-implementation)
- [4. State Management](#4-state-management)
- [5. i18n Keys](#5-i18n-keys)
- [6. File Structure](#6-file-structure)
- [7. Implementation Steps](#7-implementation-steps)

---

## 1. Overview

### Goals

- Allow users to configure the BTCP Browser Plugin settings globally
- Provide a test interface to verify browser tools are working
- Enable per-conversation browser tool toggling in the chat Inputbar
- Display active browser tool status and allow quick configuration

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Settings Page                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  BrowserUseSettings (global configuration)                │   │
│  │  ├── Toolset Preset (minimal/standard/full)              │   │
│  │  ├── Max Snapshot Size                                    │   │
│  │  ├── Enable Screencast                                    │   │
│  │  ├── Enable Tracking                                      │   │
│  │  ├── Inject System Prompt                                 │   │
│  │  └── Test Connection Button                               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       Inputbar Tool                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  BrowserUseTool (per-conversation toggle)                 │   │
│  │  ├── Enable/Disable browser tools for this chat          │   │
│  │  ├── Quick Panel: Select toolset preset                  │   │
│  │  └── Visual indicator when active                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Settings Page Implementation

### 2.1 Add Route to SettingsPage.tsx

**File:** `src/renderer/src/pages/settings/SettingsPage.tsx`

```tsx
// Add import
import BrowserUseSettings from './BrowserUseSettings'
import { Globe } from 'lucide-react'

// Add menu item (after MCP settings, around line 92)
<MenuItemLink to="/settings/browser-use">
  <MenuItem className={isRoute('/settings/browser-use')}>
    <Globe size={18} />
    {t('settings.browser_use.title')}
  </MenuItem>
</MenuItemLink>

// Add route (around line 158)
<Route path="browser-use/*" element={<BrowserUseSettings />} />
```

### 2.2 Create BrowserUseSettings Directory

**Directory:** `src/renderer/src/pages/settings/BrowserUseSettings/`

#### index.tsx (Main Settings Page)

```tsx
import ListItem from '@renderer/components/ListItem'
import Scrollbar from '@renderer/components/Scrollbar'
import { Flex } from 'antd'
import { Globe, Settings, Wrench } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import styled from 'styled-components'

import BrowserUseGeneralSettings from './BrowserUseGeneralSettings'
import BrowserUseToolsSettings from './BrowserUseToolsSettings'

const BrowserUseSettings: FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const getActiveView = () => {
    const path = location.pathname
    if (path.includes('/tools')) return 'tools'
    return 'general'
  }

  const activeView = getActiveView()

  return (
    <Container>
      <MainContainer>
        <MenuList>
          <ListItem
            title={t('settings.browser_use.general.title')}
            active={activeView === 'general'}
            onClick={() => navigate('/settings/browser-use/general')}
            icon={<Settings size={18} />}
            titleStyle={{ fontWeight: 500 }}
          />
          <ListItem
            title={t('settings.browser_use.tools.title')}
            active={activeView === 'tools'}
            onClick={() => navigate('/settings/browser-use/tools')}
            icon={<Wrench size={18} />}
            titleStyle={{ fontWeight: 500 }}
          />
        </MenuList>
        <RightContainer>
          <Routes>
            <Route index element={<Navigate to="general" replace />} />
            <Route path="general" element={<BrowserUseGeneralSettings />} />
            <Route path="tools" element={<BrowserUseToolsSettings />} />
          </Routes>
        </RightContainer>
      </MainContainer>
    </Container>
  )
}

// Styled components (same pattern as WebSearchSettings)
const Container = styled(Flex)`
  flex: 1;
`

const MainContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  width: 100%;
  height: calc(100vh - var(--navbar-height) - 6px);
  overflow: hidden;
`

const MenuList = styled(Scrollbar)`
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: var(--settings-width);
  padding: 12px;
  padding-bottom: 48px;
  border-right: 0.5px solid var(--color-border);
  height: calc(100vh - var(--navbar-height));
`

const RightContainer = styled.div`
  flex: 1;
  position: relative;
  display: flex;
`

export default BrowserUseSettings
```

#### BrowserUseGeneralSettings.tsx

```tsx
import { useTheme } from '@renderer/context/ThemeProvider'
import { useBrowserUseSettings } from '@renderer/hooks/useBrowserUseSettings'
import { InputNumber, Radio, Switch, Button, message } from 'antd'
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
    setInjectSystemPrompt,
    testConnection
  } = useBrowserUseSettings()

  const handleTestConnection = async () => {
    try {
      const result = await testConnection()
      if (result.success) {
        message.success(t('settings.browser_use.test.success'))
      } else {
        message.error(t('settings.browser_use.test.failed', { error: result.error }))
      }
    } catch (error) {
      message.error(t('settings.browser_use.test.failed', { error: String(error) }))
    }
  }

  return (
    <SettingContainer theme={theme}>
      <SettingGroup>
        <SettingRow>
          <SettingRowTitle>{t('settings.browser_use.enabled.label')}</SettingRowTitle>
          <Switch checked={enabled} onChange={setEnabled} />
        </SettingRow>
        <SettingDescription>{t('settings.browser_use.enabled.description')}</SettingDescription>
      </SettingGroup>

      <SettingDivider />

      <SettingGroup>
        <SettingRow>
          <SettingRowTitle>{t('settings.browser_use.toolset.label')}</SettingRowTitle>
        </SettingRow>
        <SettingDescription>{t('settings.browser_use.toolset.description')}</SettingDescription>
        <Radio.Group value={toolset} onChange={(e) => setToolset(e.target.value)} style={{ marginTop: 12 }}>
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
        </Radio.Group>
      </SettingGroup>

      <SettingDivider />

      <SettingGroup>
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

      <SettingGroup>
        <SettingRow>
          <SettingRowTitle>{t('settings.browser_use.screencast.label')}</SettingRowTitle>
          <Switch checked={enableScreencast} onChange={setEnableScreencast} />
        </SettingRow>
        <SettingDescription>{t('settings.browser_use.screencast.description')}</SettingDescription>
      </SettingGroup>

      <SettingDivider />

      <SettingGroup>
        <SettingRow>
          <SettingRowTitle>{t('settings.browser_use.tracking.label')}</SettingRowTitle>
          <Switch checked={enableTracking} onChange={setEnableTracking} />
        </SettingRow>
        <SettingDescription>{t('settings.browser_use.tracking.description')}</SettingDescription>
      </SettingGroup>

      <SettingDivider />

      <SettingGroup>
        <SettingRow>
          <SettingRowTitle>{t('settings.browser_use.system_prompt.label')}</SettingRowTitle>
          <Switch checked={injectSystemPrompt} onChange={setInjectSystemPrompt} />
        </SettingRow>
        <SettingDescription>{t('settings.browser_use.system_prompt.description')}</SettingDescription>
      </SettingGroup>

      <SettingDivider />

      <SettingGroup>
        <SettingRow>
          <SettingRowTitle>{t('settings.browser_use.test.label')}</SettingRowTitle>
          <Button type="primary" onClick={handleTestConnection}>
            {t('settings.browser_use.test.button')}
          </Button>
        </SettingRow>
        <SettingDescription>{t('settings.browser_use.test.description')}</SettingDescription>
      </SettingGroup>
    </SettingContainer>
  )
}

// Styled components
const SettingDescription = styled.div`
  color: var(--color-text-3);
  font-size: 12px;
  margin-top: 4px;
`

const RadioOption = styled(Radio)`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 12px;
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

export default BrowserUseGeneralSettings
```

#### BrowserUseToolsSettings.tsx

```tsx
import { useTheme } from '@renderer/context/ThemeProvider'
import { useBrowserUseSettings } from '@renderer/hooks/useBrowserUseSettings'
import { TOOL_PRESETS } from '@cherrystudio/ai-core' // or wherever exported
import { Checkbox, Tag } from 'antd'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingContainer, SettingGroup, SettingRowTitle } from '..'

const BrowserUseToolsSettings: FC = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { toolset, customTools, setCustomTools } = useBrowserUseSettings()

  // Show all available tools with their preset membership
  const allTools = TOOL_PRESETS.full
  const minimalTools = new Set(TOOL_PRESETS.minimal)
  const standardTools = new Set(TOOL_PRESETS.standard)

  const getToolPresets = (tool: string) => {
    const presets: string[] = []
    if (minimalTools.has(tool)) presets.push('minimal')
    if (standardTools.has(tool)) presets.push('standard')
    presets.push('full')
    return presets
  }

  return (
    <SettingContainer theme={theme}>
      <SettingGroup>
        <SettingRowTitle>{t('settings.browser_use.tools.available')}</SettingRowTitle>
        <ToolDescription>
          {t('settings.browser_use.tools.description', { preset: toolset })}
        </ToolDescription>
        <ToolsList>
          {allTools.map((tool) => {
            const presets = getToolPresets(tool)
            const isActiveInPreset = TOOL_PRESETS[toolset]?.includes(tool)

            return (
              <ToolItem key={tool}>
                <Checkbox
                  checked={customTools ? customTools.includes(tool) : isActiveInPreset}
                  onChange={(e) => {
                    if (customTools) {
                      if (e.target.checked) {
                        setCustomTools([...customTools, tool])
                      } else {
                        setCustomTools(customTools.filter((t) => t !== tool))
                      }
                    }
                  }}
                  disabled={!customTools}
                >
                  <ToolName>{tool}</ToolName>
                </Checkbox>
                <PresetsContainer>
                  {presets.map((preset) => (
                    <Tag key={preset} color={preset === 'minimal' ? 'green' : preset === 'standard' ? 'blue' : 'orange'}>
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

const ToolItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--color-background-soft);
`

const ToolName = styled.span`
  font-family: monospace;
  font-size: 13px;
`

const PresetsContainer = styled.div`
  display: flex;
  gap: 4px;
`

export default BrowserUseToolsSettings
```

---

## 3. Inputbar Tool Implementation

### 3.1 Create Tool Definition

**File:** `src/renderer/src/pages/home/Inputbar/tools/browserUseTool.tsx`

```tsx
import { defineTool, registerTool, TopicType } from '@renderer/pages/home/Inputbar/types'

import BrowserUseButton from './components/BrowserUseButton'
import BrowserUseQuickPanelManager from './components/BrowserUseQuickPanelManager'

/**
 * Browser Use Tool
 *
 * Allows users to enable browser automation tools for their messages.
 * Integrates with the BTCP Browser Plugin for AI-driven browser control.
 */
const browserUseTool = defineTool({
  key: 'browser_use',
  label: (t) => t('chat.input.browser_use.label'),

  visibleInScopes: [TopicType.Chat, TopicType.Agent],
  condition: ({ assistant }) => {
    // Only show for assistants that support tool calling
    return assistant?.settings?.enableToolUse !== false
  },

  render: function BrowserUseToolRender(context) {
    const { assistant, quickPanelController } = context

    return <BrowserUseButton quickPanelController={quickPanelController} assistantId={assistant.id} />
  },
  quickPanelManager: BrowserUseQuickPanelManager
})

registerTool(browserUseTool)

export default browserUseTool
```

### 3.2 Create Button Component

**File:** `src/renderer/src/pages/home/Inputbar/tools/components/BrowserUseButton.tsx`

```tsx
import { ActionIconButton } from '@renderer/components/Buttons'
import type { ToolQuickPanelController } from '@renderer/pages/home/Inputbar/types'
import { Tooltip } from 'antd'
import { Globe } from 'lucide-react'
import type { FC } from 'react'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { useBrowserUsePanelController } from './BrowserUseQuickPanelManager'

interface Props {
  quickPanelController: ToolQuickPanelController
  assistantId: string
}

const BrowserUseButton: FC<Props> = ({ quickPanelController, assistantId }) => {
  const { t } = useTranslation()
  const { enableBrowserUse, toggleQuickPanel, disableBrowserUse, selectedToolset } =
    useBrowserUsePanelController(assistantId, quickPanelController)

  const onClick = useCallback(() => {
    if (enableBrowserUse) {
      disableBrowserUse()
    } else {
      toggleQuickPanel()
    }
  }, [enableBrowserUse, toggleQuickPanel, disableBrowserUse])

  const ariaLabel = enableBrowserUse
    ? t('chat.input.browser_use.disable')
    : t('chat.input.browser_use.label')

  const tooltipTitle = enableBrowserUse
    ? t('chat.input.browser_use.enabled_tooltip', { toolset: selectedToolset })
    : t('chat.input.browser_use.label')

  return (
    <Tooltip placement="top" title={tooltipTitle} mouseLeaveDelay={0} arrow>
      <ActionIconButton
        onClick={onClick}
        active={!!enableBrowserUse}
        aria-label={ariaLabel}
        aria-pressed={!!enableBrowserUse}>
        <Globe size={18} />
      </ActionIconButton>
    </Tooltip>
  )
}

export default memo(BrowserUseButton)
```

### 3.3 Create Quick Panel Manager

**File:** `src/renderer/src/pages/home/Inputbar/tools/components/BrowserUseQuickPanelManager.tsx`

```tsx
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setBrowserUseForAssistant, clearBrowserUseForAssistant } from '@renderer/store/chat'
import { QuickPanelBuilder, type ToolQuickPanelController } from '@renderer/pages/home/Inputbar/types'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

type BrowserUseToolset = 'minimal' | 'standard' | 'full'

export function useBrowserUsePanelController(
  assistantId: string,
  quickPanelController: ToolQuickPanelController
) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()

  const browserUseState = useAppSelector(
    (state) => state.chat.browserUseByAssistant?.[assistantId]
  )

  const enableBrowserUse = browserUseState?.enabled ?? false
  const selectedToolset = browserUseState?.toolset ?? 'standard'

  const setToolset = useCallback(
    (toolset: BrowserUseToolset) => {
      dispatch(setBrowserUseForAssistant({ assistantId, enabled: true, toolset }))
    },
    [dispatch, assistantId]
  )

  const disableBrowserUse = useCallback(() => {
    dispatch(clearBrowserUseForAssistant({ assistantId }))
  }, [dispatch, assistantId])

  const toggleQuickPanel = useCallback(() => {
    quickPanelController.toggle('browser_use')
  }, [quickPanelController])

  return {
    enableBrowserUse,
    selectedToolset,
    setToolset,
    disableBrowserUse,
    toggleQuickPanel
  }
}

const BrowserUseQuickPanelManager: QuickPanelBuilder = (context, { closePanel }) => {
  const { t } = useTranslation()
  const { assistant, quickPanelController } = context
  const { setToolset, selectedToolset } = useBrowserUsePanelController(
    assistant.id,
    quickPanelController
  )

  const options = useMemo(
    () => [
      {
        id: 'minimal',
        label: t('chat.input.browser_use.toolset.minimal.label'),
        description: t('chat.input.browser_use.toolset.minimal.description'),
        selected: selectedToolset === 'minimal'
      },
      {
        id: 'standard',
        label: t('chat.input.browser_use.toolset.standard.label'),
        description: t('chat.input.browser_use.toolset.standard.description'),
        selected: selectedToolset === 'standard'
      },
      {
        id: 'full',
        label: t('chat.input.browser_use.toolset.full.label'),
        description: t('chat.input.browser_use.toolset.full.description'),
        selected: selectedToolset === 'full'
      }
    ],
    [t, selectedToolset]
  )

  const handleSelect = useCallback(
    (optionId: string) => {
      setToolset(optionId as BrowserUseToolset)
      closePanel()
    },
    [setToolset, closePanel]
  )

  return {
    title: t('chat.input.browser_use.panel_title'),
    options,
    onSelect: handleSelect
  }
}

export default BrowserUseQuickPanelManager
```

### 3.4 Register Tool in Index

**File:** `src/renderer/src/pages/home/Inputbar/tools/index.ts`

Add the import:

```tsx
// ... existing imports
import './browserUseTool'
```

---

## 4. State Management

### 4.1 Add Redux Slice for Browser Use Settings

**File:** `src/renderer/src/store/browserUse.ts` (new file)

```tsx
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface BrowserUseSettings {
  enabled: boolean
  toolset: 'minimal' | 'standard' | 'full'
  maxSnapshotSize: number
  enableScreencast: boolean
  enableTracking: boolean
  injectSystemPrompt: boolean
}

export interface BrowserUseState {
  globalSettings: BrowserUseSettings
  byAssistant: Record<string, { enabled: boolean; toolset: string }>
}

const initialState: BrowserUseState = {
  globalSettings: {
    enabled: true,
    toolset: 'standard',
    maxSnapshotSize: 50000,
    enableScreencast: false,
    enableTracking: false,
    injectSystemPrompt: true
  },
  byAssistant: {}
}

const browserUseSlice = createSlice({
  name: 'browserUse',
  initialState,
  reducers: {
    setGlobalSettings: (state, action: PayloadAction<Partial<BrowserUseSettings>>) => {
      state.globalSettings = { ...state.globalSettings, ...action.payload }
    },
    setBrowserUseForAssistant: (
      state,
      action: PayloadAction<{ assistantId: string; enabled: boolean; toolset: string }>
    ) => {
      const { assistantId, enabled, toolset } = action.payload
      state.byAssistant[assistantId] = { enabled, toolset }
    },
    clearBrowserUseForAssistant: (state, action: PayloadAction<{ assistantId: string }>) => {
      delete state.byAssistant[action.payload.assistantId]
    }
  }
})

export const { setGlobalSettings, setBrowserUseForAssistant, clearBrowserUseForAssistant } =
  browserUseSlice.actions

export default browserUseSlice.reducer
```

### 4.2 Create Custom Hook

**File:** `src/renderer/src/hooks/useBrowserUseSettings.ts`

```tsx
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setGlobalSettings, type BrowserUseSettings } from '@renderer/store/browserUse'
import { useCallback } from 'react'

export function useBrowserUseSettings() {
  const dispatch = useAppDispatch()
  const settings = useAppSelector((state) => state.browserUse.globalSettings)

  const updateSetting = useCallback(
    <K extends keyof BrowserUseSettings>(key: K, value: BrowserUseSettings[K]) => {
      dispatch(setGlobalSettings({ [key]: value }))
    },
    [dispatch]
  )

  const testConnection = useCallback(async () => {
    // Test browser plugin connectivity via IPC
    try {
      const result = await window.api.browserUse.testConnection()
      return result
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }, [])

  return {
    ...settings,
    setEnabled: (v: boolean) => updateSetting('enabled', v),
    setToolset: (v: BrowserUseSettings['toolset']) => updateSetting('toolset', v),
    setMaxSnapshotSize: (v: number) => updateSetting('maxSnapshotSize', v),
    setEnableScreencast: (v: boolean) => updateSetting('enableScreencast', v),
    setEnableTracking: (v: boolean) => updateSetting('enableTracking', v),
    setInjectSystemPrompt: (v: boolean) => updateSetting('injectSystemPrompt', v),
    testConnection,
    // For custom tools (future enhancement)
    customTools: null as string[] | null,
    setCustomTools: () => {}
  }
}
```

---

## 5. i18n Keys

### 5.1 Add to en-us.json

**File:** `src/renderer/src/i18n/locales/en-us.json`

Add the following keys:

```json
{
  "settings": {
    "browser_use": {
      "title": "Browser Use",
      "general": {
        "title": "General"
      },
      "tools": {
        "title": "Tools",
        "available": "Available Browser Tools",
        "description": "Tools enabled for the '{{preset}}' preset. Custom selection coming soon."
      },
      "enabled": {
        "label": "Enable Browser Use",
        "description": "Allow AI to control browser for automation tasks"
      },
      "toolset": {
        "label": "Default Toolset",
        "description": "Choose which browser tools are available to AI models",
        "minimal": {
          "label": "Minimal (Read-only)",
          "description": "Safe read-only operations: snapshot, URL, title, text extraction"
        },
        "standard": {
          "label": "Standard",
          "description": "Common automation: navigation, clicks, typing, forms, scrolling"
        },
        "full": {
          "label": "Full (Advanced)",
          "description": "All tools including JavaScript execution and iframe handling"
        }
      },
      "max_snapshot_size": {
        "label": "Max Snapshot Size",
        "description": "Maximum characters for page snapshots (prevents token overflow)"
      },
      "screencast": {
        "label": "Enable Screencast",
        "description": "Stream visual updates for vision models (increases token usage)"
      },
      "tracking": {
        "label": "Enable Request Tracking",
        "description": "Track network requests and console logs for debugging"
      },
      "system_prompt": {
        "label": "Inject System Prompt",
        "description": "Add browser workflow hints to AI system prompt"
      },
      "test": {
        "label": "Test Connection",
        "description": "Verify browser tools are working correctly",
        "button": "Test",
        "success": "Browser tools are working correctly!",
        "failed": "Connection test failed: {{error}}"
      }
    }
  },
  "chat": {
    "input": {
      "browser_use": {
        "label": "Browser Use",
        "disable": "Disable Browser Use",
        "enabled_tooltip": "Browser tools enabled ({{toolset}})",
        "panel_title": "Select Toolset",
        "toolset": {
          "minimal": {
            "label": "Minimal",
            "description": "Read-only: snapshot, text, URL"
          },
          "standard": {
            "label": "Standard",
            "description": "Navigation and interaction"
          },
          "full": {
            "label": "Full",
            "description": "All tools including JS execution"
          }
        }
      }
    }
  }
}
```

### 5.2 Add to Other Locales

Run `pnpm i18n:sync` after adding English keys to propagate template to other locales.

---

## 6. File Structure

```
src/renderer/src/
├── pages/
│   ├── settings/
│   │   ├── BrowserUseSettings/
│   │   │   ├── index.tsx                    # Main settings page with navigation
│   │   │   ├── BrowserUseGeneralSettings.tsx # General configuration
│   │   │   └── BrowserUseToolsSettings.tsx  # Tools list view
│   │   └── SettingsPage.tsx                 # Add route and menu item
│   └── home/
│       └── Inputbar/
│           └── tools/
│               ├── browserUseTool.tsx       # Tool definition
│               ├── components/
│               │   ├── BrowserUseButton.tsx             # Toggle button
│               │   └── BrowserUseQuickPanelManager.tsx  # Toolset selection panel
│               └── index.ts                 # Register tool
├── store/
│   └── browserUse.ts                        # Redux slice (new)
├── hooks/
│   └── useBrowserUseSettings.ts             # Settings hook (new)
└── i18n/
    └── locales/
        └── en-us.json                       # Add i18n keys
```

---

## 7. Implementation Steps

### Phase 1: State Management
1. Create `src/renderer/src/store/browserUse.ts` Redux slice
2. Add slice to root store configuration
3. Create `useBrowserUseSettings` hook

### Phase 2: Settings Page
1. Create `BrowserUseSettings/` directory with components
2. Add route to `SettingsPage.tsx`
3. Add menu item with Globe icon
4. Implement general settings with all config options
5. Implement tools list view

### Phase 3: Inputbar Tool
1. Create `browserUseTool.tsx` tool definition
2. Create `BrowserUseButton.tsx` component
3. Create `BrowserUseQuickPanelManager.tsx` panel
4. Register tool in `tools/index.ts`

### Phase 4: Integration
1. Connect settings to aiCore plugin configuration
2. Add IPC handler for test connection
3. Pass per-conversation settings to executor

### Phase 5: i18n & Testing
1. Add all i18n keys to `en-us.json`
2. Run `pnpm i18n:sync`
3. Run `pnpm build:check` to verify
4. Manual testing in dev mode

---

## Notes

- The Browser Use tool will only appear for models/assistants that support tool calling
- Settings are persisted via Redux-persist
- The quick panel allows users to quickly select a toolset without going to settings
- Test connection verifies the Chrome extension message bridge is working
- Per-conversation toolset overrides the global default
