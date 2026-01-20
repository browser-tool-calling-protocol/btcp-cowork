import { loggerService } from '@logger'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  clearBrowserUseForAssistant,
  setBrowserUseEnabled,
  setBrowserUseForAssistant,
  setEnableScreencast,
  setEnableTracking,
  setInjectSystemPrompt,
  setMaxSnapshotSize
} from '@renderer/store/browserUse'
import { useCallback } from 'react'

const logger = loggerService.withContext('useBrowserUseSettings')

export function useBrowserUseSettings() {
  const dispatch = useAppDispatch()
  const settings = useAppSelector((state) => state.browserUse.globalSettings)

  return {
    ...settings,
    setEnabled: useCallback((v: boolean) => dispatch(setBrowserUseEnabled(v)), [dispatch]),
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

  const setEnabled = useCallback(
    (enabled: boolean) => {
      logger.info('🔘 Browser Use Button Clicked', {
        assistantId,
        enabled,
        currentState: assistantSettings
      })

      if (enabled) {
        logger.info('✅ Enabling Browser Use', { assistantId })
        dispatch(
          setBrowserUseForAssistant({
            assistantId,
            enabled: true
          })
        )
      } else {
        logger.info('❌ Disabling Browser Use', { assistantId })
        dispatch(clearBrowserUseForAssistant({ assistantId }))
      }
    },
    [dispatch, assistantId, assistantSettings]
  )

  const disable = useCallback(() => {
    dispatch(clearBrowserUseForAssistant({ assistantId }))
  }, [dispatch, assistantId])

  return {
    isEnabled,
    globalEnabled: globalSettings.enabled,
    setEnabled,
    disable
  }
}
