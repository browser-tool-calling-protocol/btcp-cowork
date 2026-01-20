/**
 * Agent Service Provider
 *
 * React Context provider for agent service dependency injection.
 * Automatically switches between server and local modes based on configuration.
 */
import { loggerService } from '@logger'
import { useSettings } from '@renderer/hooks/useSettings'
import type { FC, PropsWithChildren } from 'react'
import { createContext, use, useEffect, useMemo, useRef, useState } from 'react'

import { registerAgentService } from './AgentServiceRegistry'
import type { AgentServiceMode, IAgentService } from './IAgentService'
import { LocalAgentService } from './LocalAgentService'
import { ServerAgentService } from './ServerAgentService'

/**
 * Detect if running in extension/browser mode (no Electron backend)
 */
function isExtensionMode(): boolean {
  return typeof window !== 'undefined' && !window.electron
}

const logger = loggerService.withContext('AgentServiceProvider')

/**
 * Agent Service Context value
 */
interface AgentServiceContextValue {
  /** The current agent service instance */
  service: IAgentService | null
  /** Current service mode */
  mode: AgentServiceMode
  /** Whether the service is ready/available */
  isReady: boolean
  /** Whether the service is currently initializing */
  isInitializing: boolean
  /** Error if service initialization failed */
  error: Error | null
  /** Force switch to a specific mode */
  setMode: (mode: AgentServiceMode) => void
}

const AgentServiceContext = createContext<AgentServiceContextValue | null>(null)

/**
 * Props for AgentServiceProvider
 */
interface AgentServiceProviderProps extends PropsWithChildren {
  /** Override automatic mode detection */
  forceMode?: AgentServiceMode
  /** Callback when service becomes ready */
  onReady?: (service: IAgentService) => void
  /** Callback when service fails to initialize */
  onError?: (error: Error) => void
}

/**
 * Agent Service Provider Component
 *
 * Provides the agent service to the component tree via React Context.
 * Automatically detects and switches between server/local modes.
 */
export const AgentServiceProvider: FC<AgentServiceProviderProps> = ({ children, forceMode, onReady, onError }) => {
  const { apiServer } = useSettings()

  // Detect default mode based on environment
  const defaultMode: AgentServiceMode = isExtensionMode() ? 'local' : 'server'

  const [service, setService] = useState<IAgentService | null>(null)
  const [mode, setMode] = useState<AgentServiceMode>(forceMode ?? defaultMode)
  const [isReady, setIsReady] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Track previous config to detect changes
  const prevConfigRef = useRef<{ host: string; port: number; apiKey: string; mode: AgentServiceMode } | null>(null)

  // Initialize or update the service when settings change
  useEffect(() => {
    const initService = async () => {
      setIsInitializing(true)
      setError(null)

      const effectiveMode = forceMode ?? mode

      try {
        if (effectiveMode === 'server') {
          // Check if we need to create/update the server service
          const currentConfig = {
            host: apiServer.host,
            port: apiServer.port,
            apiKey: apiServer.apiKey,
            mode: effectiveMode
          }

          const configChanged =
            !prevConfigRef.current ||
            prevConfigRef.current.host !== currentConfig.host ||
            prevConfigRef.current.port !== currentConfig.port ||
            prevConfigRef.current.apiKey !== currentConfig.apiKey ||
            prevConfigRef.current.mode !== currentConfig.mode

          if (!configChanged && service && service.mode === 'server') {
            // Config hasn't changed, keep existing service
            setIsInitializing(false)
            return
          }

          prevConfigRef.current = currentConfig

          if (!apiServer.enabled) {
            logger.info('API server is disabled, falling back to local service')
            // Fall back to local service
            const localService = new LocalAgentService()
            setService(localService)
            setIsReady(true)
            setMode('local')
            onReady?.(localService)
            setIsInitializing(false)
            return
          }

          if (!apiServer.apiKey) {
            logger.warn('API server key not configured, falling back to local service')
            const localService = new LocalAgentService()
            setService(localService)
            setIsReady(true)
            setMode('local')
            onReady?.(localService)
            setIsInitializing(false)
            return
          }

          logger.info('Initializing server agent service', {
            host: apiServer.host,
            port: apiServer.port
          })

          const serverService = new ServerAgentService({
            host: apiServer.host,
            port: apiServer.port,
            apiKey: apiServer.apiKey
          })

          // Check if service is available
          const available = await serverService.isAvailable()

          if (available) {
            setService(serverService)
            setIsReady(true)
            setMode('server')
            logger.info('Server agent service initialized successfully')
            onReady?.(serverService)
          } else {
            logger.warn('Server agent service not available, falling back to local service')
            // Fall back to local service
            const localService = new LocalAgentService()
            setService(localService)
            setIsReady(true)
            setMode('local')
            onReady?.(localService)
          }
        } else {
          // Local mode
          logger.info('Initializing local agent service')

          // Check if config changed
          const currentConfig = {
            host: '',
            port: 0,
            apiKey: '',
            mode: effectiveMode
          }

          if (prevConfigRef.current?.mode === 'local' && service && service.mode === 'local') {
            // Already in local mode with a service
            setIsInitializing(false)
            return
          }

          prevConfigRef.current = currentConfig

          const localService = new LocalAgentService()
          setService(localService)
          setIsReady(true)
          setMode('local')
          logger.info('Local agent service initialized successfully')
          onReady?.(localService)
        }
      } catch (err) {
        const serviceError = err instanceof Error ? err : new Error(String(err))
        logger.error('Failed to initialize agent service', serviceError)
        setError(serviceError)
        setIsReady(false)
        onError?.(serviceError)
      } finally {
        setIsInitializing(false)
      }
    }

    initService()
  }, [apiServer.enabled, apiServer.host, apiServer.port, apiServer.apiKey, forceMode, mode, onReady, onError, service])

  // Register service in global registry for non-React code (thunks)
  useEffect(() => {
    registerAgentService(service)
    return () => {
      // Unregister on unmount or when service changes
      registerAgentService(null)
    }
  }, [service])

  const contextValue = useMemo<AgentServiceContextValue>(
    () => ({
      service,
      mode,
      isReady,
      isInitializing,
      error,
      setMode
    }),
    [service, mode, isReady, isInitializing, error]
  )

  return <AgentServiceContext value={contextValue}>{children}</AgentServiceContext>
}

/**
 * Hook to access the agent service context
 *
 * @throws Error if used outside of AgentServiceProvider
 */
export function useAgentServiceContext(): AgentServiceContextValue {
  const context = use(AgentServiceContext)
  if (!context) {
    throw new Error('useAgentServiceContext must be used within an AgentServiceProvider')
  }
  return context
}

/**
 * Hook to access the agent service instance
 *
 * @returns The agent service or null if not available
 */
export function useAgentService(): IAgentService | null {
  const { service } = useAgentServiceContext()
  return service
}

/**
 * Hook to check if agent service is ready
 */
export function useAgentServiceReady(): boolean {
  const { isReady } = useAgentServiceContext()
  return isReady
}

/**
 * Hook to get agent service status
 */
export function useAgentServiceStatus(): Pick<
  AgentServiceContextValue,
  'mode' | 'isReady' | 'isInitializing' | 'error'
> {
  const { mode, isReady, isInitializing, error } = useAgentServiceContext()
  return { mode, isReady, isInitializing, error }
}

export default AgentServiceProvider
