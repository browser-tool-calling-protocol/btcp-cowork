import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  type BrowserUseToolset,
  clearBrowserUseForAssistant,
  setBrowserUseEnabled,
  setBrowserUseForAssistant,
  setBrowserUseToolset,
  setEnableScreencast,
  setEnableTracking,
  setInjectSystemPrompt,
  setMaxSnapshotSize
} from '@renderer/store/browserUse'
import { useCallback } from 'react'

export function useBrowserUseSettings() {
  const dispatch = useAppDispatch()
  const settings = useAppSelector((state) => state.browserUse.globalSettings)

  return {
    ...settings,
    setEnabled: useCallback((v: boolean) => dispatch(setBrowserUseEnabled(v)), [dispatch]),
    setToolset: useCallback((v: BrowserUseToolset) => dispatch(setBrowserUseToolset(v)), [dispatch]),
    setMaxSnapshotSize: useCallback((v: number) => dispatch(setMaxSnapshotSize(v)), [dispatch]),
    setEnableScreencast: useCallback((v: boolean) => dispatch(setEnableScreencast(v)), [dispatch]),
    setEnableTracking: useCallback((v: boolean) => dispatch(setEnableTracking(v)), [dispatch]),
    setInjectSystemPrompt: useCallback((v: boolean) => dispatch(setInjectSystemPrompt(v)), [dispatch])
  }
}

export function useBrowserUseForAssistant(assistantId: string) {
  const dispatch = useAppDispatch()
  const globalSettings = useAppSelector((state) => state.browserUse.globalSettings)
  const assistantSettings = useAppSelector((state) => state.browserUse.byAssistant[assistantId])

  const isEnabled = assistantSettings?.enabled ?? false
  const toolset = assistantSettings?.toolset ?? globalSettings.toolset

  const setEnabled = useCallback(
    (enabled: boolean, customToolset?: BrowserUseToolset) => {
      if (enabled) {
        dispatch(
          setBrowserUseForAssistant({
            assistantId,
            enabled: true,
            toolset: customToolset ?? globalSettings.toolset
          })
        )
      } else {
        dispatch(clearBrowserUseForAssistant({ assistantId }))
      }
    },
    [dispatch, assistantId, globalSettings.toolset]
  )

  const setToolset = useCallback(
    (newToolset: BrowserUseToolset) => {
      dispatch(
        setBrowserUseForAssistant({
          assistantId,
          enabled: true,
          toolset: newToolset
        })
      )
    },
    [dispatch, assistantId]
  )

  const disable = useCallback(() => {
    dispatch(clearBrowserUseForAssistant({ assistantId }))
  }, [dispatch, assistantId])

  return {
    isEnabled,
    toolset,
    globalEnabled: globalSettings.enabled,
    setEnabled,
    setToolset,
    disable
  }
}
