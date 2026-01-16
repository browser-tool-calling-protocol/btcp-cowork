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

  visibleInScopes: [TopicType.Chat],

  render: function BrowserUseToolRender(context) {
    const { assistant, quickPanelController } = context

    return <BrowserUseButton quickPanelController={quickPanelController} assistantId={assistant.id} />
  },
  quickPanelManager: BrowserUseQuickPanelManager
})

registerTool(browserUseTool)

export default browserUseTool
