/**
 * Content Script - BTCP Browser Agent
 *
 * Sets up ContentAgent for DOM operations and message handling.
 */

import type { Command, ExtensionMessage, ExtensionResponse, Response } from 'btcp-browser-agent/extension'
import { type ContentAgent, createContentAgent } from 'btcp-browser-agent/extension'

let agent: ContentAgent | null = null

function getContentAgent(): ContentAgent {
  if (!agent) {
    agent = createContentAgent(document, window)
  }
  return agent
}

// Handle commands from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const msg = message as ExtensionMessage
  if (msg.type !== 'aspect:command') return false

  getContentAgent()
    .execute(msg.command as Command)
    .then((response: Response) => {
      sendResponse({ type: 'aspect:response', response } satisfies ExtensionResponse)
    })
    .catch((error: unknown) => {
      sendResponse({
        type: 'aspect:response',
        response: {
          id: msg.command.id,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      } satisfies ExtensionResponse)
    })

  return true // Keep channel open for async response
})

// Handle postMessage from page scripts (for injected scripts)
window.addEventListener('message', async (event) => {
  if (event.source !== window) return

  const msg = event.data as ExtensionMessage
  if (msg?.type !== 'aspect:command') return

  const response = await getContentAgent().execute(msg.command as Command)
  window.postMessage({ type: 'aspect:response', response } satisfies ExtensionResponse, '*')
})

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
