import { loggerService } from '@logger'
import type { QuickPanelListItem } from '@renderer/components/QuickPanel'
import { QuickPanelReservedSymbol } from '@renderer/components/QuickPanel'
import { useBrowserUseForAssistant } from '@renderer/hooks/useBrowserUseSettings'
import type { ToolQuickPanelController, ToolRenderContext } from '@renderer/pages/home/Inputbar/types'
import { browserAgentService } from '@renderer/services/BrowserAgentService'
import { Globe, Loader2, MonitorSmartphone, Play, Power } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const logger = loggerService.withContext('BrowserUseQuickPanel')

export type BrowserSessionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface BrowserSessionState {
  status: BrowserSessionStatus
  errorMessage?: string
}

export const useBrowserUsePanelController = (assistantId: string, quickPanelController: ToolQuickPanelController) => {
  const { t } = useTranslation()
  const { isEnabled, setEnabled, disable } = useBrowserUseForAssistant(assistantId)
  const [sessionState, setSessionState] = useState<BrowserSessionState>({
    status: browserAgentService.isInitialized() ? 'connected' : 'disconnected'
  })

  const connectSession = useCallback(async () => {
    logger.info('Connecting browser session...')
    setSessionState({ status: 'connecting' })

    try {
      await browserAgentService.getOrInit()
      setSessionState({ status: 'connected' })
      logger.info('Browser session connected successfully')
      // Auto-enable browser use when session connects
      setEnabled(true)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to connect browser session', error as Error)
      setSessionState({ status: 'error', errorMessage })
    }
  }, [setEnabled])

  const disconnectSession = useCallback(() => {
    logger.info('Disconnecting browser session...')
    browserAgentService.reset()
    setSessionState({ status: 'disconnected' })
    disable()
  }, [disable])

  const sessionItems = useMemo<QuickPanelListItem[]>(() => {
    const items: QuickPanelListItem[] = []

    if (sessionState.status === 'connected') {
      // Session is connected - show enable/disable option and disconnect
      items.push({
        label: isEnabled
          ? t('chat.input.browser_use.panel.disable_tools')
          : t('chat.input.browser_use.panel.enable_tools'),
        description: isEnabled
          ? t('chat.input.browser_use.panel.disable_tools_desc')
          : t('chat.input.browser_use.panel.enable_tools_desc'),
        icon: <Power size={16} />,
        isSelected: isEnabled,
        action: () => {
          if (isEnabled) {
            disable()
          } else {
            setEnabled(true)
          }
        }
      })

      items.push({
        label: t('chat.input.browser_use.panel.disconnect'),
        description: t('chat.input.browser_use.panel.disconnect_desc'),
        icon: <MonitorSmartphone size={16} />,
        action: disconnectSession
      })
    } else if (sessionState.status === 'connecting') {
      // Show connecting state
      items.push({
        label: t('chat.input.browser_use.panel.connecting'),
        description: t('chat.input.browser_use.panel.connecting_desc'),
        icon: <Loader2 size={16} className="animate-spin" />,
        disabled: true
      })
    } else {
      // Session not connected - show connect option
      items.push({
        label: t('chat.input.browser_use.panel.connect'),
        description:
          sessionState.status === 'error'
            ? sessionState.errorMessage || t('chat.input.browser_use.panel.connect_error')
            : t('chat.input.browser_use.panel.connect_desc'),
        icon: <Play size={16} />,
        action: connectSession
      })
    }

    return items
  }, [sessionState, isEnabled, t, connectSession, disconnectSession, disable, setEnabled])

  const openQuickPanel = useCallback(() => {
    quickPanelController.open({
      title: t('chat.input.browser_use.panel.title'),
      list: sessionItems,
      symbol: QuickPanelReservedSymbol.BrowserUse,
      pageSize: 5
    })
  }, [sessionItems, quickPanelController, t])

  const toggleQuickPanel = useCallback(() => {
    if (quickPanelController.isVisible && quickPanelController.symbol === QuickPanelReservedSymbol.BrowserUse) {
      quickPanelController.close()
    } else {
      openQuickPanel()
    }
  }, [openQuickPanel, quickPanelController])

  return {
    isEnabled,
    sessionState,
    sessionItems,
    openQuickPanel,
    toggleQuickPanel,
    connectSession,
    disconnectSession
  }
}

interface ManagerProps {
  context: ToolRenderContext<any, any>
}

const BrowserUseQuickPanelManager = ({ context }: ManagerProps) => {
  const { assistant, quickPanel, quickPanelController, t } = context
  const { sessionItems, openQuickPanel } = useBrowserUsePanelController(assistant.id, quickPanelController)
  const { registerRootMenu, registerTrigger } = quickPanel
  const { updateList, isVisible, symbol } = quickPanelController

  useEffect(() => {
    if (isVisible && symbol === QuickPanelReservedSymbol.BrowserUse) {
      updateList(sessionItems)
    }
  }, [isVisible, sessionItems, symbol, updateList])

  useEffect(() => {
    const disposeMenu = registerRootMenu([
      {
        label: t('chat.input.browser_use.label'),
        description: t('chat.input.browser_use.menu_description'),
        icon: <Globe size={18} />,
        isMenu: true,
        action: () => openQuickPanel()
      }
    ])

    const disposeTrigger = registerTrigger(QuickPanelReservedSymbol.BrowserUse, () => openQuickPanel())

    return () => {
      disposeMenu()
      disposeTrigger()
    }
  }, [openQuickPanel, registerRootMenu, registerTrigger, t])

  return null
}

export default BrowserUseQuickPanelManager
