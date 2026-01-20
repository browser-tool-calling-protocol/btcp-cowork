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

  // High-level API methods matching BrowserAgent public API
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

    // DOM operations - matching BrowserAgent API
    async snapshot(options: { mode?: 'interaction' | 'content' | 'outline'; format?: 'tree' | 'markdown' } = {}) {
      return execute({ action: 'snapshot', ...options })
    },

    async click(selector: string, options?: { button?: 'left' | 'right' | 'middle' }) {
      return execute({ action: 'click', selector, ...options })
    },

    async type(selector: string, text: string, options?: { delay?: number; clear?: boolean }) {
      return execute({ action: 'type', selector, text, ...options })
    },

    async fill(selector: string, value: string) {
      return execute({ action: 'fill', selector, value })
    },

    async hover(selector: string) {
      return execute({ action: 'hover', selector })
    },

    async press(key: string, selector?: string) {
      return execute({ action: 'press', key, selector })
    },

    async waitFor(selector: string, options?: { timeout?: number; state?: 'visible' | 'hidden' }) {
      return execute({ action: 'waitFor', selector, ...options })
    },

    async scroll(options: {
      selector?: string
      direction?: 'up' | 'down' | 'left' | 'right'
      amount?: number
      x?: number
      y?: number
    }) {
      return execute({ action: 'scroll', ...options })
    },

    // JavaScript evaluation
    async evaluate<T = unknown>(script: string): Promise<T> {
      const result = await execute({ action: 'evaluate', script })
      return result as T
    },

    // Element inspection - matching BrowserAgent API
    async getText(selector: string): Promise<string | null> {
      const result = await execute({ action: 'getText', selector })
      return result?.text ?? null
    },

    async getAttribute(selector: string, attribute: string): Promise<string | null> {
      const result = await execute({ action: 'getAttribute', selector, attribute })
      return result?.value ?? null
    },

    async isVisible(selector: string): Promise<boolean> {
      const result = await execute({ action: 'isVisible', selector })
      return result?.visible ?? false
    },

    // Page information - matching BrowserAgent API
    async getUrl(): Promise<string> {
      const result = await execute({ action: 'getUrl' })
      return result?.url ?? ''
    },

    async getTitle(): Promise<string> {
      const result = await execute({ action: 'getTitle' })
      return result?.title ?? ''
    },

    // Screenshot - matching BrowserAgent API
    async screenshot(options?: { format?: 'png' | 'jpeg'; quality?: number }) {
      return execute({ action: 'screenshot', ...options })
    }
  }
}

/** Client type for external usage */
export type Client = ReturnType<typeof createClient>
