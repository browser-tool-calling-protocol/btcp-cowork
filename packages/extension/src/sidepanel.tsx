/**
 * Sidepanel Entry Point
 *
 * Loads a conversation-only chat interface for the Chrome extension sidepanel.
 * Initializes all required services then renders MinimalChat.
 */

// CRITICAL: Load shim FIRST before any other imports
// This ensures window.api is available before any module tries to use it
import './shim'
// Initialize database (must be imported before any hooks that use db)
import '@renderer/databases'
// Import styles
import '@renderer/assets/styles/index.css'
import '@renderer/assets/styles/tailwind.css'
// React 19 compatibility patch for Ant Design v5
import '@ant-design/v5-patch-for-react-19'

import KeyvStorage from '@kangfenmao/keyv-storage'
import { loggerService } from '@logger'
import { QuickPanelProvider } from '@renderer/components/QuickPanel'
import TopViewContainer from '@renderer/components/TopView'
import AntdProvider from '@renderer/context/AntdProvider'
import { CodeStyleProvider } from '@renderer/context/CodeStyleProvider'
import { NotificationProvider } from '@renderer/context/NotificationProvider'
import StyleSheetManager from '@renderer/context/StyleSheetManager'
import { ThemeProvider } from '@renderer/context/ThemeProvider'
import { startAutoSync } from '@renderer/services/BackupService'
import { startNutstoreAutoSync } from '@renderer/services/NutstoreService'
import storeSyncService from '@renderer/services/StoreSyncService'
import { webTraceService } from '@renderer/services/WebTraceService'
import store, { persistor } from '@renderer/store'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { PersistGate } from 'redux-persist/integration/react'

// Minimal chat component (conversation only)
import MinimalChat from './MinimalChat'

// Initialize logger for sidepanel
loggerService.initWindowSource('sidepanel')

// Initialize custom mini apps after window.api is ready
import { initializeCustomMiniApps } from '@renderer/config/minapps'
initializeCustomMiniApps().catch(console.error)

// Initialize KeyvStorage
function initKeyv() {
  window.keyv = new KeyvStorage()
  window.keyv.init()
}

function initAutoSync() {
  setTimeout(() => {
    const { webdavAutoSync, localBackupAutoSync, s3 } = store.getState().settings
    const { nutstoreAutoSync } = store.getState().nutstore
    if (webdavAutoSync || (s3 && s3.autoSync) || localBackupAutoSync) {
      startAutoSync()
    }
    if (nutstoreAutoSync) {
      startNutstoreAutoSync()
    }
  }, 8000)
}

function initStoreSync() {
  storeSyncService.subscribe()
}

function initWebTrace() {
  webTraceService.init()
}

// Run all initialization
initKeyv()
initAutoSync()
initStoreSync()
initWebTrace()

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false
    }
  }
})

/**
 * Sidepanel App Component
 *
 * Uses same provider hierarchy as App.tsx but with:
 * - MemoryRouter (no URL routing)
 * - QuickPanelProvider (required by Chat component)
 * - MinimalChat instead of full Router
 */
function SidepanelApp() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <StyleSheetManager>
          <ThemeProvider>
            <AntdProvider>
              <NotificationProvider>
                <CodeStyleProvider>
                  <PersistGate loading={<LoadingScreen />} persistor={persistor}>
                    <TopViewContainer>
                      <MemoryRouter>
                        <QuickPanelProvider>
                          <MinimalChat />
                        </QuickPanelProvider>
                      </MemoryRouter>
                    </TopViewContainer>
                  </PersistGate>
                </CodeStyleProvider>
              </NotificationProvider>
            </AntdProvider>
          </ThemeProvider>
        </StyleSheetManager>
      </QueryClientProvider>
    </Provider>
  )
}

function LoadingScreen() {
  console.log('[Sidepanel] PersistGate loading screen showing...')
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--color-background)',
        color: 'var(--color-text)'
      }}>
      Loading Redux state...
    </div>
  )
}

// Mount the app
const root = document.getElementById('root')
console.log('[Sidepanel] Initializing sidepanel app...')
console.log('[Sidepanel] Store state:', store.getState())
console.log('[Sidepanel] Persistor state:', persistor.getState())

if (root) {
  createRoot(root).render(<SidepanelApp />)
  console.log('[Sidepanel] React app rendered')

  // Remove loading spinner after React renders
  setTimeout(() => {
    const spinner = document.getElementById('spinner')
    if (spinner) {
      console.log('[Sidepanel] Removing spinner')
      spinner.style.opacity = '0'
      spinner.style.transition = 'opacity 0.3s ease'
      setTimeout(() => spinner.remove(), 300)
    }
  }, 100)
} else {
  console.error('[sidepanel] Root element not found')
}

console.log('[sidepanel] Sidepanel loaded')
