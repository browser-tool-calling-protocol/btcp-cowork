/**
 * useBrowserFolderAccess - React hook for managing browser folder access
 *
 * This hook provides:
 * - Folder access request/grant workflow
 * - Permission state management
 * - Re-permission prompts when needed
 */

import { browserFileSystem } from '@renderer/services/BrowserFileSystemService'
import { useCallback, useEffect, useState } from 'react'

export interface FolderAccessState {
  isSupported: boolean
  hasAccess: boolean
  folderName: string | null
  isLoading: boolean
  error: string | null
}

export interface UseBrowserFolderAccessReturn {
  state: FolderAccessState
  requestAccess: () => Promise<boolean>
  revokeAccess: () => void
  verifyAccess: () => Promise<boolean>
}

/**
 * Hook for managing browser folder access using the File System Access API
 */
export function useBrowserFolderAccess(): UseBrowserFolderAccessReturn {
  const [state, setState] = useState<FolderAccessState>({
    isSupported: false,
    hasAccess: false,
    folderName: null,
    isLoading: false,
    error: null
  })

  // Check if API is supported on mount
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      isSupported: browserFileSystem.isSupported()
    }))
  }, [])

  /**
   * Request access to a folder from the user
   */
  const requestAccess = useCallback(async (): Promise<boolean> => {
    if (!browserFileSystem.isSupported()) {
      setState((prev) => ({
        ...prev,
        error: 'File System Access API is not supported in this browser. Please use Chrome, Edge, or Opera.'
      }))
      return false
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const permission = await browserFileSystem.requestFolderAccess()

      if (permission) {
        setState((prev) => ({
          ...prev,
          hasAccess: true,
          folderName: permission.name,
          isLoading: false,
          error: null
        }))
        return true
      } else {
        // User cancelled
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: null
        }))
        return false
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message
      }))
      return false
    }
  }, [])

  /**
   * Revoke folder access
   */
  const revokeAccess = useCallback(() => {
    browserFileSystem.clearStoredPermissions()
    setState((prev) => ({
      ...prev,
      hasAccess: false,
      folderName: null,
      error: null
    }))
  }, [])

  /**
   * Verify that we still have access to the folder
   */
  const verifyAccess = useCallback(async (): Promise<boolean> => {
    const handle = browserFileSystem.getRootHandle()
    if (!handle) {
      setState((prev) => ({ ...prev, hasAccess: false }))
      return false
    }

    try {
      const hasPermission = await browserFileSystem.verifyPermission(handle)
      setState((prev) => ({
        ...prev,
        hasAccess: hasPermission,
        folderName: hasPermission ? handle.name : null
      }))
      return hasPermission
    } catch {
      setState((prev) => ({ ...prev, hasAccess: false, folderName: null }))
      return false
    }
  }, [])

  return {
    state,
    requestAccess,
    revokeAccess,
    verifyAccess
  }
}

/**
 * Get a descriptive message about browser support
 */
export function getBrowserSupportMessage(): string {
  if (browserFileSystem.isSupported()) {
    return 'Your browser supports full folder access.'
  }

  const userAgent = navigator.userAgent.toLowerCase()
  if (userAgent.includes('firefox')) {
    return 'Firefox does not support the File System Access API. Please use Chrome, Edge, or Opera for full folder access.'
  }
  if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
    return 'Safari has limited support for the File System Access API. Please use Chrome, Edge, or Opera for full folder access.'
  }

  return 'Your browser does not support the File System Access API. Please use Chrome, Edge, or Opera for full folder access.'
}
