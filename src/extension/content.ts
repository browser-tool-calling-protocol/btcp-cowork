/**
 * Content Script
 *
 * Runs on all web pages to:
 * - Handle text selection
 * - Extract page context
 * - Execute BTCP browser actions
 * - Communicate with the extension
 */

import { BrowserAgent, type Command, type Response,setupContentHandler } from 'btcp-browser-agent'

// =============================================================================
// BTCP BROWSER AGENT INITIALIZATION
// =============================================================================

/**
 * BrowserAgent instance for executing BTCP commands in this page's context.
 * Lazily initialized on first BTCP command.
 */
let browserAgent: BrowserAgent | null = null
let agentReady = false

/**
 * Get or initialize the BrowserAgent
 */
async function getAgent(): Promise<BrowserAgent> {
  if (!browserAgent) {
    browserAgent = new BrowserAgent({
      targetWindow: window,
      targetDocument: document,
      autoLaunch: true
    })
    await browserAgent.launch()
    agentReady = true
  }
  return browserAgent
}

/**
 * Execute a BTCP command and return the response
 */
async function executeBTCPCommand(command: Command): Promise<Response> {
  try {
    const agent = await getAgent()
    return await agent.execute(command)
  } catch (error) {
    return {
      id: command.id,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

// Set up the BTCP content handler for extension message passing
// This enables the background script to route BTCP commands to this content script
setupContentHandler()

// =============================================================================
// EXTENSION MESSAGE HANDLING
// =============================================================================

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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

    // BTCP: Execute a browser action command
    case 'btcp:execute': {
      const command = message.command as Command
      executeBTCPCommand(command)
        .then((response) => sendResponse(response))
        .catch((error) => {
          sendResponse({
            id: command?.id || 'unknown',
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        })
      return true // Keep the message channel open for async response
    }

    // BTCP: Get a snapshot of the current page
    case 'btcp:snapshot': {
      getAgent()
        .then((agent) => agent.snapshot(message.options))
        .then((snapshot) => sendResponse({ success: true, data: snapshot }))
        .catch((error) => {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        })
      return true
    }

    // BTCP: Check if agent is ready
    case 'btcp:status':
      sendResponse({
        ready: agentReady,
        url: window.location.href,
        title: document.title
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
