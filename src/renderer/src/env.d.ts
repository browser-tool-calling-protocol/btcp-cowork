/// <reference types="vite/client" />

import type KeyvStorage from '@kangfenmao/keyv-storage'
import type { HookAPI } from 'antd/es/modal/useModal'
import type { NavigateFunction } from 'react-router-dom'

import type {
  addToast,
  closeAll,
  closeToast,
  error,
  getToastQueue,
  info,
  isToastClosing,
  loading,
  success,
  warning
} from './components/TopView/toast'

interface ImportMetaEnv {
  VITE_RENDERER_INTEGRATED_MODEL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Permissive type for window.api - allows any property access
interface WindowApi {
  [key: string]: any
}

interface ElectronApi {
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

declare global {
  interface Window {
    root: HTMLElement
    modal: HookAPI
    keyv: KeyvStorage
    store: any
    navigate: NavigateFunction
    api: WindowApi
    electron: ElectronApi
    toast: {
      getToastQueue: typeof getToastQueue
      addToast: typeof addToast
      closeToast: typeof closeToast
      closeAll: typeof closeAll
      isToastClosing: typeof isToastClosing
      error: typeof error
      success: typeof success
      warning: typeof warning
      info: typeof info
      loading: typeof loading
    }
    agentTools: {
      respondToPermission: (payload: {
        requestId: string
        behavior: 'allow' | 'deny'
        updatedInput?: Record<string, unknown>
        message?: string
        updatedPermissions?: any[]
      }) => Promise<{ success: boolean }>
    }
  }
}
