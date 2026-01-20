/// <reference types="chrome" />
/**
 * Minimal BTCP Client for Chrome Extension
 * Vendorized from btcp-browser-agent to avoid build issues
 */

interface CommandBase {
  id: string
  action: string
  [key: string]: unknown
}

interface ExtensionMessage {
  type: string
  command?: CommandBase
  [key: string]: any
}

interface ExtensionResponse {
  type: string
  response?: any
  [key: string]: any
}

/**
 * Creates a BTCP client that sends commands via chrome.runtime.sendMessage
 */
export function createClient() {
  let commandId = 0

  const generateCommandId = () => `cmd-${Date.now()}-${commandId++}`

  const execute = async (command: Partial<CommandBase>): Promise<any> => {
    const fullCommand = {
      id: command.id || generateCommandId(),
      ...command
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'btcp:command', command: fullCommand } as ExtensionMessage,
        (response: ExtensionResponse) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }

          if (response?.type === 'btcp:response') {
            if (response.response?.success === false) {
              reject(new Error(response.response.error || 'Command failed'))
            } else {
              resolve(response.response)
            }
          } else {
            reject(new Error('Invalid response type'))
          }
        }
      )
    })
  }

  // High-level API methods
  return {
    execute,

    // Session management
    async sessionGetCurrent() {
      return execute({ action: 'session.getCurrent' })
    },

    async groupCreate() {
      return execute({ action: 'group.create' })
    },

    // Tab operations
    async tabNew(options: { url?: string; active?: boolean } = {}) {
      return execute({ action: 'tab.new', ...options })
    },

    async tabSwitch(tabId: number) {
      return execute({ action: 'tab.switch', tabId })
    },

    // Navigation
    async navigate(url: string) {
      return execute({ action: 'navigate', url })
    },

    // DOM operations
    async snapshot(options: { format?: string } = {}) {
      return execute({ action: 'snapshot', ...options })
    },

    async click(selector: string) {
      return execute({ action: 'click', selector })
    },

    async type(selector: string, text: string) {
      return execute({ action: 'type', selector, text })
    },

    async fill(selector: string, value: string) {
      return execute({ action: 'fill', selector, value })
    },

    async press(key: string) {
      return execute({ action: 'press', key })
    },

    // Screenshot
    async screenshot() {
      return execute({ action: 'screenshot' })
    }
  }
}
