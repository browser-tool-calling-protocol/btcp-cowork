# Custom AI Agents - Architecture Documentation

This document describes how custom AI agents work in Cherry Studio, covering the creation flow, data models, session management, and tool integration.

## Overview

Cherry Studio supports custom AI agents that provide autonomous assistant capabilities. Currently, the system supports `claude-code` type agents, which are designed to handle complex tasks using Claude's capabilities with tool calling.

### Key Concepts

- **Agent**: A reusable configuration that defines an AI assistant's behavior, tools, and permissions
- **Session**: A conversation instance with an agent, which can override agent-level settings
- **Skills**: Domain-specific configurations that instruct agents how to handle certain websites or tasks
- **Tools**: Built-in, MCP, or custom capabilities that agents can use during conversations

## Data Models

### AgentEntity (`src/renderer/src/types/agent.ts`)

The core agent configuration stored in the database:

```typescript
interface AgentEntity {
  id: string
  type: AgentType                    // Currently only 'claude-code'
  name?: string
  description?: string

  // Model Configuration
  model: string                      // Main model ID (required, format: "provider:modelId")
  plan_model?: string                // Optional planning/thinking model
  small_model?: string               // Optional lightweight model for quick responses

  // Access Control
  accessible_paths: string[]         // Directory paths the agent can access (required, non-empty)

  // Instructions
  instructions?: string              // System prompt for the agent

  // Tool Configuration
  allowed_tools?: string[]           // Whitelist of tool IDs
  mcps?: string[]                    // MCP server IDs to enable
  slash_commands?: SlashCommand[]    // Available slash commands

  // Behavior Settings
  configuration?: AgentConfiguration // Permission mode, max turns, avatar, etc.

  // Timestamps
  created_at: string                 // ISO datetime
  updated_at: string                 // ISO datetime
}
```

### AgentSessionEntity

A conversation session linked to an agent:

```typescript
interface AgentSessionEntity extends AgentBase {
  id: string
  agent_id: string                   // Parent agent ID
  agent_type: AgentType
  created_at: string
  updated_at: string
}
```

Sessions inherit agent configuration but can override any `AgentBase` field.

### Permission Modes

Agents operate under one of four permission modes:

| Mode | Description | Tool Approval |
|------|-------------|---------------|
| `default` | Standard mode | Read-only tools auto-approved; others require permission |
| `plan` | Planning mode | Read-only tools auto-approved; execution requires approval |
| `acceptEdits` | Auto-accept edits | File operations auto-approved |
| `bypassPermissions` | Full autonomy | All tools auto-approved (use with caution) |

## Agent Creation Flow

### 1. UI Entry Points

Agents can be created from:
- Agent settings popup (`AgentSettingsPopup.tsx`)
- Agent modal (`AgentModal.tsx`)

### 2. Form Submission

The `AddAgentForm` type defines required fields:

```typescript
type AddAgentForm = {
  type: AgentType              // Required: 'claude-code'
  name: string                 // Required
  model: string                // Required: "provider:modelId"
  accessible_paths: string[]   // Required: at least one path
  description?: string
  instructions?: string
  allowed_tools?: string[]
  mcps?: string[]
  configuration?: AgentConfiguration
}
```

### 3. API Request

```
POST /v1/agents
Content-Type: application/json

{
  "type": "claude-code",
  "name": "My Agent",
  "model": "anthropic:claude-sonnet-4-20250514",
  "accessible_paths": ["/home/user/projects"],
  ...
}
```

### 4. State Management

```
useAgents hook → AgentApiClient.createAgent() → Redux SWR cache update → UI refresh
```

The `useAgents` hook (`src/renderer/src/hooks/agents/useAgents.ts`) manages the agent list with SWR for caching and automatic revalidation.

## Session Management

### Creating a Session

When a user starts a conversation with an agent:

1. **Session Creation**: A new session is created via `POST /v1/agents/{agentId}/sessions`
2. **Topic ID Generation**: Session gets a special topic ID format: `agent-session:{sessionId}`
3. **State Update**: Redux state tracks active session via `activeSessionIdMap`

### Session Data Flow

```
User clicks agent → setActiveAgentId(agentId)
                 → setActiveSessionIdAction({ agentId, sessionId })
                 → setActiveTopicOrSessionAction('session')
                 → loadTopicMessagesThunk(sessionTopicId)
```

### Message Handling

Messages in agent sessions use a specialized data source:

```typescript
// AgentMessageDataSource.ts
class AgentMessageDataSource implements MessageDataSource {
  // LRU cache for streaming messages (100 max, 5min TTL)
  // Throttled persistence (500ms batching)

  fetchMessages(topicId: string): Promise<MessageDataSource.LoadResult>
  appendMessage(topicId: string, message: Message, blocks: MessageBlock[]): Promise<void>
  updateMessage(topicId: string, message: Message, blocks: MessageBlock[]): Promise<void>
}
```

### Sending Messages

The `AgentSessionInputbar` component handles user input:

1. User types message in textarea
2. Files can be attached (paths appended to message text)
3. `sendMessage()` dispatches `dispatchSendMessage` thunk
4. Message is persisted and streamed response begins

```typescript
dispatch(dispatchSendMessage(
  userMessage,
  userMessageBlocks,
  assistant,
  sessionTopicId,
  { agentId, sessionId }
))
```

## Tool System

### Tool Types

Agents have access to three types of tools:

1. **Built-in Tools**: Core capabilities like file operations, search, web fetch
2. **MCP Tools**: Model Context Protocol servers for extended functionality
3. **Custom Tools**: User-defined tools with custom schemas

### Tool Configuration (`src/renderer/src/pages/settings/AgentSettings/ToolingSettings.tsx`)

The tooling settings UI provides:

- Permission mode selection with visual cards
- Tool search and filtering
- Tool whitelist management (`allowed_tools`)
- MCP server selection (`mcps`)

### Tool Rendering

Agent tool calls are rendered by specialized components in `src/renderer/src/pages/home/Messages/Tools/MessageAgentTools/`:

| Tool | Component | Description |
|------|-----------|-------------|
| Bash | `BashTool.tsx` | Command execution |
| Edit | `EditTool.tsx` | File editing |
| Write | `WriteTool.tsx` | File creation |
| Read | `ReadTool.tsx` | File reading |
| Glob | `GlobTool.tsx` | File pattern matching |
| Grep | `GrepTool.tsx` | Text search |
| WebSearch | `WebSearchTool.tsx` | Web searching |
| WebFetch | `WebFetchTool.tsx` | URL fetching |
| Task | `TaskTool.tsx` | Sub-task execution |
| TodoWrite | `TodoWriteTool.tsx` | Task tracking |
| Skill | `SkillTool.tsx` | Skill invocation |

## Skills System

Skills are domain-specific configurations that instruct agents how to handle certain websites or tasks.

### Skill Structure (`src/renderer/src/types/skill.ts`)

```typescript
interface Skill {
  id: string
  name: string
  description?: string
  domainPattern?: string    // Regex for URL matching
  prompt: string            // Instructions for the agent
  contentScript?: string    // JavaScript for DOM manipulation
  pageScript?: string       // JavaScript for isolated context
  toolSchema?: string       // JSON defining custom tool capabilities
  enabled: boolean
  createdAt: number
  updatedAt: number
}
```

### Domain Matching

Skills can be automatically applied based on URL patterns:

```typescript
function matchesDomainPattern(url: string, pattern?: string): boolean {
  if (!pattern) return true  // No pattern matches all
  const regex = new RegExp(pattern, 'i')
  return regex.test(url)
}
```

## Plugin System

Agents support three plugin types:

1. **Agent Plugins**: Additional agent configurations
2. **Command Plugins**: Custom slash commands
3. **Skill Plugins**: Domain-specific skills

Plugins are managed through `PluginSettings.tsx` with install/uninstall capabilities.

## API Reference

### Agent Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/agents` | List all agents |
| `POST` | `/v1/agents` | Create agent |
| `GET` | `/v1/agents/{id}` | Get agent details |
| `PATCH` | `/v1/agents/{id}` | Update agent |
| `DELETE` | `/v1/agents/{id}` | Delete agent |

### Session Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/agents/{agentId}/sessions` | List sessions |
| `POST` | `/v1/agents/{agentId}/sessions` | Create session |
| `GET` | `/v1/agents/{agentId}/sessions/{sessionId}` | Get session |
| `PATCH` | `/v1/agents/{agentId}/sessions/{sessionId}` | Update session |
| `DELETE` | `/v1/agents/{agentId}/sessions/{sessionId}` | Delete session |

### Model Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/models` | List available models |

## Key File Locations

| Component | Path |
|-----------|------|
| Core Types | `src/renderer/src/types/agent.ts` |
| Skill Types | `src/renderer/src/types/skill.ts` |
| API Client | `src/renderer/src/api/agent.ts` |
| Agent Config | `src/renderer/src/config/agent.ts` |
| Runtime Store | `src/renderer/src/store/runtime.ts` |
| Skill Store | `src/renderer/src/store/skill.ts` |
| Agent Hooks | `src/renderer/src/hooks/agents/*.ts` |
| Settings UI | `src/renderer/src/pages/settings/AgentSettings/*.tsx` |
| Input Component | `src/renderer/src/pages/home/Inputbar/AgentSessionInputbar.tsx` |
| Message Display | `src/renderer/src/pages/home/Messages/AgentSessionMessages.tsx` |
| Tool Renderers | `src/renderer/src/pages/home/Messages/Tools/MessageAgentTools/` |
| Message Persistence | `src/renderer/src/services/db/AgentMessageDataSource.ts` |
| Session Utilities | `src/renderer/src/utils/agentSession.ts` |

## Sequence Diagrams

### Agent Creation

```
User                 UI                    API Client            Backend
 |                   |                         |                    |
 |--Create Agent---->|                         |                    |
 |                   |--addAgent(form)-------->|                    |
 |                   |                         |--POST /v1/agents-->|
 |                   |                         |<---AgentEntity-----|
 |                   |<---mutate(cache)--------|                    |
 |<---Toast Success--|                         |                    |
```

### Message Flow

```
User              Inputbar           Redux             Backend
 |                   |                 |                  |
 |--Type message---->|                 |                  |
 |--Send------------>|                 |                  |
 |                   |--dispatch------>|                  |
 |                   |                 |--Stream request->|
 |                   |                 |<--Stream chunks--|
 |                   |<--Render--------|                  |
 |<--See response----|                 |                  |
 |                   |                 |--Persist-------->|
```

## Best Practices

1. **Always specify accessible_paths**: At least one directory path is required
2. **Start with default permission mode**: Escalate only when needed
3. **Use tool whitelisting**: Restrict tools to only what's needed
4. **Leverage sessions**: Sessions can override agent settings for specific tasks
5. **Consider MCP servers**: Extend capabilities without custom code
