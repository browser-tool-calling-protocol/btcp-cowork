import { useBrowserUseForAssistant } from '@renderer/hooks/useBrowserUseSettings'
import type { ToolRenderContext } from '@renderer/pages/home/Inputbar/types'
import { Globe } from 'lucide-react'
import { useCallback, useEffect } from 'react'

interface ManagerProps {
  context: ToolRenderContext<any, any>
}

const BrowserUseQuickPanelManager = ({ context }: ManagerProps) => {
  const { assistant, quickPanel, t } = context
  const { isEnabled, setEnabled, disable } = useBrowserUseForAssistant(assistant.id)
  const { registerRootMenu } = quickPanel

  const toggleBrowserUse = useCallback(() => {
    if (isEnabled) {
      disable()
    } else {
      setEnabled(true)
    }
  }, [isEnabled, setEnabled, disable])

  // Register root menu entry
  useEffect(() => {
    const disposeMenu = registerRootMenu([
      {
        label: t('chat.input.browser_use.label'),
        description: t('chat.input.browser_use.menu_description'),
        icon: <Globe size={18} />,
        action: toggleBrowserUse
      }
    ])

    return () => {
      disposeMenu()
    }
  }, [toggleBrowserUse, registerRootMenu, t])

  return null
}

export default BrowserUseQuickPanelManager
