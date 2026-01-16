/**
 * Content Script
 *
 * Runs on all web pages to:
 * - Handle text selection
 * - Extract page context
 * - Execute BTCP browser actions
 * - Communicate with the extension
 */

import { BrowserAgent, type Command, type Response } from 'btcp-browser-agent'

// =============================================================================
// BTCP BROWSER AGENT
// =============================================================================

let browserAgent: BrowserAgent | null = null

async function executeBTCPCommand(command: Command): Promise<Response> {
  try {
    if (!browserAgent) {
      browserAgent = new BrowserAgent({ targetWindow: window, targetDocument: document, autoLaunch: true })
      await browserAgent.launch()
    }
    return await browserAgent.execute(command)
  } catch (error) {
    return { id: command.id, success: false, error: String(error) }
  }
}

// =============================================================================
// EXTENSION MESSAGE HANDLING
// =============================================================================

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // BTCP: Handle all btcp:* messages
  if (message.type?.startsWith('btcp:')) {
    const command = message.payload?.command || message.command
    if (command) {
      executeBTCPCommand(command as Command)
        .then(sendResponse)
        .catch((error) => sendResponse({ success: false, error: String(error) }))
    } else {
      sendResponse({ success: false, error: 'No command provided' })
    }
    return true
  }

  // Non-BTCP messages
  switch (message.type) {
    case 'getSelection':
      sendResponse(window.getSelection()?.toString() || '')
      break
    case 'getPageContent':
      sendResponse(extractPageContent())
      break
    case 'getPageContext':
      sendResponse({
        url: window.location.href,
        title: document.title,
        selection: window.getSelection()?.toString() || ''
      })
      break
    default:
      sendResponse(null)
  }
  return false
})

// =============================================================================
// PAGE CONTENT EXTRACTION
// =============================================================================

/**
 * Extract main content from page (simple implementation)
 */
function extractPageContent(): string {
  // Try to find main content areas
  const selectors = ['article', 'main', '[role="main"]', '.content', '.post-content', '.article-content']

  for (const selector of selectors) {
    const element = document.querySelector(selector)
    if (element) {
      return cleanText(element.textContent || '')
    }
  }

  // Fallback to body text
  return cleanText(document.body.textContent || '')
}

/**
 * Clean extracted text
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
    .trim()
    .slice(0, 50000) // Limit length
}

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
