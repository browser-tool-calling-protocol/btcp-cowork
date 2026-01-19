/**
 * Type definitions for the Chrome Extension API shim
 *
 * Note: Window.api and Window.electron types are defined in
 * src/renderer/src/env.d.ts to avoid conflicting declarations.
 */

export interface ElectronAPI {
  process: {
    platform: string
    versions: { chrome: string }
  }
  ipcRenderer: {
    on: (channel: string, callback: (...args: any[]) => void) => () => void
    once: (channel: string, callback: (...args: any[]) => void) => () => void
    removeListener: () => void
    removeAllListeners: () => void
    send: (channel: string, ...args: any[]) => void
    invoke: (channel: string, ...args: any[]) => Promise<any>
  }
}

// Permissive type for the extension API shim
export interface WindowApiType {
  [key: string]: any
}
