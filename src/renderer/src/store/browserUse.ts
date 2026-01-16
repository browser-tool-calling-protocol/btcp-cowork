import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

export type BrowserUseToolset = 'minimal' | 'standard' | 'full'

export interface BrowserUseSettings {
  enabled: boolean
  toolset: BrowserUseToolset
  maxSnapshotSize: number
  enableScreencast: boolean
  enableTracking: boolean
  injectSystemPrompt: boolean
}

export interface BrowserUseAssistantState {
  enabled: boolean
  toolset: BrowserUseToolset
}

export interface BrowserUseState {
  globalSettings: BrowserUseSettings
  byAssistant: Record<string, BrowserUseAssistantState>
}

export const initialState: BrowserUseState = {
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
    setBrowserUseEnabled: (state, action: PayloadAction<boolean>) => {
      state.globalSettings.enabled = action.payload
    },
    setBrowserUseToolset: (state, action: PayloadAction<BrowserUseToolset>) => {
      state.globalSettings.toolset = action.payload
    },
    setMaxSnapshotSize: (state, action: PayloadAction<number>) => {
      state.globalSettings.maxSnapshotSize = action.payload
    },
    setEnableScreencast: (state, action: PayloadAction<boolean>) => {
      state.globalSettings.enableScreencast = action.payload
    },
    setEnableTracking: (state, action: PayloadAction<boolean>) => {
      state.globalSettings.enableTracking = action.payload
    },
    setInjectSystemPrompt: (state, action: PayloadAction<boolean>) => {
      state.globalSettings.injectSystemPrompt = action.payload
    },
    setBrowserUseForAssistant: (
      state,
      action: PayloadAction<{ assistantId: string; enabled: boolean; toolset: BrowserUseToolset }>
    ) => {
      const { assistantId, enabled, toolset } = action.payload
      state.byAssistant[assistantId] = { enabled, toolset }
    },
    clearBrowserUseForAssistant: (state, action: PayloadAction<{ assistantId: string }>) => {
      delete state.byAssistant[action.payload.assistantId]
    }
  }
})

export const {
  setGlobalSettings,
  setBrowserUseEnabled,
  setBrowserUseToolset,
  setMaxSnapshotSize,
  setEnableScreencast,
  setEnableTracking,
  setInjectSystemPrompt,
  setBrowserUseForAssistant,
  clearBrowserUseForAssistant
} = browserUseSlice.actions

export default browserUseSlice.reducer
