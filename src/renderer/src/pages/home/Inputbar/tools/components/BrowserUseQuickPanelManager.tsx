import type { QuickPanelListItem } from '@renderer/components/QuickPanel'
import { useBrowserUseForAssistant } from '@renderer/hooks/useBrowserUseSettings'
import type { ToolRenderContext } from '@renderer/pages/home/Inputbar/types'
import { Globe, Shield, Sparkles, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo } from 'react'

interface ManagerProps {
  context: ToolRenderContext<any, any>
}

const BrowserUseQuickPanelManager = ({ context }: ManagerProps) => {
  const { assistant, quickPanel, quickPanelController, t } = context
  const { setEnabled, toolset: currentToolset } = useBrowserUseForAssistant(assistant.id)
  const { registerRootMenu } = quickPanel
  const { isVisible, symbol, updateList } = quickPanelController

  const toolsetItems = useMemo<QuickPanelListItem[]>(
    () => [
      {
        label: t('chat.input.browser_use.toolset.minimal.label'),
        description: t('chat.input.browser_use.toolset.minimal.description'),
        icon: <Shield size={18} />,
        isSelected: currentToolset === 'minimal',
        action: () => {
          setEnabled(true, 'minimal')
          quickPanelController.close()
        }
      },
      {
        label: t('chat.input.browser_use.toolset.standard.label'),
        description: t('chat.input.browser_use.toolset.standard.description'),
        icon: <Zap size={18} />,
        isSelected: currentToolset === 'standard',
        action: () => {
          setEnabled(true, 'standard')
          quickPanelController.close()
        }
      },
      {
        label: t('chat.input.browser_use.toolset.full.label'),
        description: t('chat.input.browser_use.toolset.full.description'),
        icon: <Sparkles size={18} />,
        isSelected: currentToolset === 'full',
        action: () => {
          setEnabled(true, 'full')
          quickPanelController.close()
        }
      }
    ],
    [t, currentToolset, setEnabled, quickPanelController]
  )

  const openQuickPanel = useCallback(() => {
    quickPanelController.open({
      title: t('chat.input.browser_use.panel_title'),
      list: toolsetItems,
      symbol: 'browser_use',
      pageSize: 5
    })
  }, [toolsetItems, quickPanelController, t])

  // Update list when visible
  useEffect(() => {
    if (isVisible && symbol === 'browser_use') {
      updateList(toolsetItems)
    }
  }, [isVisible, toolsetItems, symbol, updateList])

  // Register root menu entry
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

    return () => {
      disposeMenu()
    }
  }, [openQuickPanel, registerRootMenu, t])

  return null
}

export default BrowserUseQuickPanelManager
