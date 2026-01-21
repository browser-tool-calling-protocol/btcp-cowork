/// <reference types="chrome" />

// Extend chrome types for extension-specific APIs
declare namespace chrome {
  export namespace sidePanel {
    export function setOptions(options: { tabId?: number; path?: string; enabled?: boolean }): Promise<void>
    export function open(options: { windowId?: number; tabId?: number }): Promise<void>
    export function getOptions(options: { tabId?: number }): Promise<{ enabled?: boolean; path?: string }>
    export function setPanelBehavior(behavior: { openPanelOnActionClick?: boolean }): Promise<void>
    export function getPanelBehavior(): Promise<{ openPanelOnActionClick?: boolean }>
  }
}
