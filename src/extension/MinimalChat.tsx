/**
 * Minimal Chat Component for Chrome Extension Sidepanel
 *
 * Provides full chat functionality with a simplified layout:
 * - Full conversation and messaging (using existing Chat component)
 * - "Open Full App" button to open in separate window
 * - No sidebar tabs (topics accessed via ChatNavbar)
 * - Compact layout optimized for sidepanel width
 */

import { useAssistants } from '@renderer/hooks/useAssistant'
import { useActiveTopic } from '@renderer/hooks/useTopic'
import Chat from '@renderer/pages/home/Chat'
import type { Assistant, Topic } from '@renderer/types'
import { ExternalLink } from 'lucide-react'
import { Component, useCallback, useState } from 'react'
import styled from 'styled-components'

// Custom error boundary for better debugging
class DebugErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[MinimalChat ErrorBoundary] Caught error:', error)
    console.error('[MinimalChat ErrorBoundary] Error name:', error?.name)
    console.error('[MinimalChat ErrorBoundary] Error message:', error?.message)
    console.error('[MinimalChat ErrorBoundary] Error stack:', error?.stack)
    console.error('[MinimalChat ErrorBoundary] Error info:', errorInfo)
    console.error(
      '[MinimalChat ErrorBoundary] Full error object:',
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    )
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red' }}>
          <h3>Error Details:</h3>
          <p>Name: {this.state.error?.name}</p>
          <p>Message: {this.state.error?.message}</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>{this.state.error?.stack}</pre>
        </div>
      )
    }

    return this.props.children
  }
}

export default function MinimalChat() {
  const { assistants } = useAssistants()
  const [activeAssistant, setActiveAssistantState] = useState<Assistant | undefined>(assistants[0])
  const { activeTopic, setActiveTopic: _setActiveTopic } = useActiveTopic(activeAssistant?.id ?? '')

  // Debug logging
  console.log('[MinimalChat] Render:', {
    assistantsCount: assistants.length,
    activeAssistant: activeAssistant?.id,
    activeTopic: activeTopic?.id,
    hasActiveAssistant: !!activeAssistant,
    hasActiveTopic: !!activeTopic
  })

  const setActiveAssistant = useCallback(
    (newAssistant: Assistant) => {
      if (newAssistant.id === activeAssistant?.id) return
      setActiveAssistantState(newAssistant)
      const newTopic = newAssistant.topics[0]
      if (newTopic) {
        _setActiveTopic(newTopic)
      }
    },
    [activeAssistant?.id, _setActiveTopic]
  )

  const setActiveTopic = useCallback(
    (newTopic: Topic) => {
      _setActiveTopic(newTopic)
    },
    [_setActiveTopic]
  )

  const openFullApp = useCallback(async () => {
    const chromeApi = (globalThis as any).chrome
    if (chromeApi?.windows?.create) {
      await chromeApi.windows.create({
        url: chromeApi.runtime.getURL('src/extension/window.html'),
        type: 'popup',
        width: 1200,
        height: 800,
        focused: true
      })
    }
  }, [])

  // Show loading state if no assistant or topic is available
  if (!activeAssistant || !activeTopic) {
    return (
      <Container>
        <Header>
          <Logo>Cherry Studio</Logo>
          <OpenFullAppButton onClick={openFullApp} title="Open full app in window">
            <ExternalLink size={14} />
            <span>Full App</span>
          </OpenFullAppButton>
        </Header>
        <LoadingContainer>
          <LoadingText>Loading...</LoadingText>
        </LoadingContainer>
      </Container>
    )
  }

  return (
    <Container>
      {/* Compact header with Open Full App button */}
      <Header>
        <Logo>Cherry Studio</Logo>
        <OpenFullAppButton onClick={openFullApp} title="Open full app in window">
          <ExternalLink size={14} />
          <span>Full App</span>
        </OpenFullAppButton>
      </Header>

      {/* Match HomePage's ContentContainer structure */}
      <ContentContainer>
        <DebugErrorBoundary>
          <Chat
            assistant={activeAssistant}
            activeTopic={activeTopic}
            setActiveTopic={setActiveTopic}
            setActiveAssistant={setActiveAssistant}
          />
        </DebugErrorBoundary>
      </ContentContainer>
    </Container>
  )
}

// Styled Components - Match HomePage structure
const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background-color: var(--color-background);
  overflow: hidden;
`

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-background-soft);
  flex-shrink: 0;
  min-height: 40px;
`

const Logo = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
`

const OpenFullAppButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  border-radius: 6px;
  background-color: var(--color-primary, #7c3aed);
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background-color: var(--color-primary-dark, #6d28d9);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`

// Match HomePage's ContentContainer exactly, with overrides for sidepanel
const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  overflow: hidden;

  /* Ensure Chat component fills the container */
  #chat {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  /* HStack needs to fill height */
  #chat > div {
    height: 100% !important;
    flex: 1;
  }

  /* The motion.div inside HStack should fill vertically */
  #chat > div > div {
    height: 100% !important;
  }

  /* Main component - override the calculated mainHeight */
  #chat-main {
    height: 100% !important;
    max-width: 100% !important;
  }

  /* The inner flex container that holds messages + inputbar */
  #chat-main > div > div.flex.flex-1.flex-col.justify-between {
    height: 100% !important;
    min-height: 0 !important;
    overflow: hidden;
  }

  /* Messages container must have constrained height to enable scroll */
  #messages,
  .messages-container {
    flex: 1 !important;
    min-height: 0 !important;
    overflow-y: auto !important;
  }

  /* Hide the topic sidebar in sidepanel - use ChatNavbar dropdown instead */
  .topic-sidebar {
    display: none;
  }
`

const LoadingContainer = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`

const LoadingText = styled.span`
  color: var(--color-text-secondary);
  font-size: 14px;
`
