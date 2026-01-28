/**
 * Active Tab URL Hook
 *
 * Tracks the current browser tab URL using Chrome extension APIs.
 * Returns null in non-extension environments for graceful fallback.
 */
import { useCallback, useEffect, useState } from 'react'

/**
 * Hook to get and track the current browser tab URL
 * @returns The current tab URL or null if not available
 */
export function useActiveTabUrl(): string | null {
  const [url, setUrl] = useState<string | null>(null)

  const fetchCurrentTabUrl = useCallback(async () => {
    try {
      // Check if Chrome extension APIs are available
      if (typeof chrome === 'undefined' || !chrome.tabs) {
        return
      }

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tabs.length > 0 && tabs[0].url) {
        setUrl(tabs[0].url)
      }
    } catch {
      // Silently fail in non-extension environment
    }
  }, [])

  useEffect(() => {
    // Fetch initial URL
    fetchCurrentTabUrl()

    // Check if Chrome extension APIs are available
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      return
    }

    // Listen for tab activation changes
    const handleTabActivated = () => {
      fetchCurrentTabUrl()
    }

    // Listen for tab URL updates
    const handleTabUpdated = (_tabId: number, changeInfo: { url?: string }, tab: chrome.tabs.Tab) => {
      // Only update if URL changed and it's the active tab in the current window
      if (changeInfo.url && tab.active) {
        setUrl(changeInfo.url)
      }
    }

    chrome.tabs.onActivated?.addListener(handleTabActivated)
    chrome.tabs.onUpdated?.addListener(handleTabUpdated)

    return () => {
      chrome.tabs.onActivated?.removeListener(handleTabActivated)
      chrome.tabs.onUpdated?.removeListener(handleTabUpdated)
    }
  }, [fetchCurrentTabUrl])

  return url
}
