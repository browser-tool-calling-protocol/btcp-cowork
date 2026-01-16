/**
 * Content Script - BTCP Browser Agent
 */

// Import btcp content script - auto-registers aspect:command listener
import 'btcp-browser-agent/extension/content'

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

// Log that content script loaded (for debugging)
console.debug('[Cherry Studio] Content script loaded with BTCP support')

// Notify background that content script is ready
chrome.runtime
  .sendMessage({
    type: 'contentScriptReady',
    url: window.location.href,
    title: document.title
  })
  .catch(() => {
    // Extension context may be invalidated, ignore
  })
