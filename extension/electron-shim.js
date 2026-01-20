/**
 * Electron API Shim - External Script
 *
 * CRITICAL: This file must load BEFORE any module code.
 * It provides window.electron stub for extension compatibility.
 */

window.electron = {
  process: {
    platform: 'browser',
    versions: { chrome: navigator.userAgent }
  },
  ipcRenderer: {
    on: (channel, callback) => {
      const handler = (event) => {
        if (event.detail?.channel === channel) {
          callback(...event.detail.args)
        }
      }
      window.addEventListener('ipc-message', handler)
      return () => window.removeEventListener('ipc-message', handler)
    },
    once: (channel) => {
      console.log('[Extension] Ignoring ipcRenderer.once:', channel)
      return () => {}
    },
    removeListener: () => {},
    removeAllListeners: () => {},
    send: (channel, ...args) => {
      console.log('[Extension] Ignoring ipcRenderer.send:', channel, args)
    },
    invoke: async (channel, ...args) => {
      console.log('[Extension] Ignoring ipcRenderer.invoke:', channel, args)
      return null
    }
  }
}

console.log('[Extension] window.electron initialized')
