/// <reference types="chrome" />
/**
 * Content Script - BTCP Browser Agent
 *
 * Sets up ContentAgent for DOM operations and message handling.
 * Following official btcp-browser-agent extension/content.ts pattern.
 */

import { createContentAgent } from 'btcp-browser-agent/extension'

// Create agent immediately
const agent = createContentAgent()

// Register message listener - handleMessage is designed for Chrome's listener API
chrome.runtime.onMessage.addListener(agent.handleMessage)

// =============================================================================
// TEXT SELECTION TRACKING
// =============================================================================

/**
 * Notify extension of text selection (optional feature)
 */
let selectionTimeout: ReturnType<typeof setTimeout> | null = null

document.addEventListener('mouseup', () => {
  // Debounce selection events
  if (selectionTimeout) {
    clearTimeout(selectionTimeout)
  }

  selectionTimeout = setTimeout(() => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()

    if (text && text.length > 10 && text.length < 5000) {
      // Only notify for meaningful selections
      chrome.runtime
        .sendMessage({
          type: 'textSelected',
          text,
          url: window.location.href,
          title: document.title
        })
        .catch(() => {
          // Extension context may be invalidated, ignore
        })
    }
  }, 300)
})

// =============================================================================
// INITIALIZATION
// =============================================================================

// Notify background that content script is ready (following official pattern)
chrome.runtime
  .sendMessage({
    type: 'contentScriptReady',
    url: window.location.href,
    title: document.title
  })
  .catch(() => {
    // Extension context may be invalidated, ignore
  })
