/**
 * Agents Store
 *
 * Local CRUD store for AI agents - enables agent management without a backend API server.
 * Supports both user-created agents and built-in preset agents.
 *
 * This store is designed for the Chrome extension environment where no backend is available.
 */
import type { PayloadAction } from '@reduxjs/toolkit'
import { createSelector, createSlice } from '@reduxjs/toolkit'
import type {
  AgentConfiguration,
  AgentEntity,
  AgentSessionEntity,
  AgentType,
  GetAgentResponse
} from '@renderer/types/agent'
import { v4 as uuid } from 'uuid'

import type { RootState } from '.'

// Built-in agent preset (simplified version for local storage)
export interface AgentPreset {
  id: string
  name: string
  description?: string
  emoji?: string
  type: AgentType
  model: string
  instructions?: string
  accessible_paths: string[]
  allowed_tools?: string[]
  mcps?: string[]
  configuration?: AgentConfiguration
  isBuiltIn: boolean
}

export interface AgentsState {
  /** User-created and installed agents */
  agents: AgentEntity[]
  /** Agent sessions (conversations) */
  sessions: AgentSessionEntity[]
  /** Built-in agent presets that can be installed */
  presets: AgentPreset[]
  /** Whether presets have been initialized */
  presetsInitialized: boolean
}

const initialState: AgentsState = {
  agents: [],
  sessions: [],
  presets: [],
  presetsInitialized: false
}

const agentsSlice = createSlice({
  name: 'agents',
  initialState,
  reducers: {
    // ============ Agent CRUD ============

    addAgent(state, action: PayloadAction<AgentEntity>) {
      // Ensure no duplicate IDs
      if (!state.agents.find((a) => a.id === action.payload.id)) {
        state.agents.push(action.payload)
      }
    },

    updateAgent(state, action: PayloadAction<Partial<AgentEntity> & { id: string }>) {
      const index = state.agents.findIndex((a) => a.id === action.payload.id)
      if (index !== -1) {
        state.agents[index] = {
          ...state.agents[index],
          ...action.payload,
          updated_at: new Date().toISOString()
        }
      }
    },

    deleteAgent(state, action: PayloadAction<string>) {
      state.agents = state.agents.filter((a) => a.id !== action.payload)
      // Also delete associated sessions
      state.sessions = state.sessions.filter((s) => s.agent_id !== action.payload)
    },

    setAgents(state, action: PayloadAction<AgentEntity[]>) {
      state.agents = action.payload
    },

    // ============ Session CRUD ============

    addSession(state, action: PayloadAction<AgentSessionEntity>) {
      if (!state.sessions.find((s) => s.id === action.payload.id)) {
        state.sessions.push(action.payload)
      }
    },

    updateSession(state, action: PayloadAction<Partial<AgentSessionEntity> & { id: string }>) {
      const index = state.sessions.findIndex((s) => s.id === action.payload.id)
      if (index !== -1) {
        state.sessions[index] = {
          ...state.sessions[index],
          ...action.payload,
          updated_at: new Date().toISOString()
        }
      }
    },

    deleteSession(state, action: PayloadAction<string>) {
      state.sessions = state.sessions.filter((s) => s.id !== action.payload)
    },

    setSessions(state, action: PayloadAction<AgentSessionEntity[]>) {
      state.sessions = action.payload
    },

    // ============ Presets ============

    setPresets(state, action: PayloadAction<AgentPreset[]>) {
      state.presets = action.payload
      state.presetsInitialized = true
    },

    addPreset(state, action: PayloadAction<AgentPreset>) {
      if (!state.presets.find((p) => p.id === action.payload.id)) {
        state.presets.push(action.payload)
      }
    },

    /** Install a preset as a user agent */
    installPreset(state, action: PayloadAction<string>) {
      const preset = state.presets.find((p) => p.id === action.payload)
      if (preset && !state.agents.find((a) => a.id === preset.id)) {
        const now = new Date().toISOString()
        const agent: AgentEntity = {
          id: uuid(), // Generate new ID for the installed copy
          type: preset.type,
          name: preset.name,
          description: preset.description,
          model: preset.model,
          instructions: preset.instructions,
          accessible_paths: preset.accessible_paths,
          allowed_tools: preset.allowed_tools,
          mcps: preset.mcps,
          configuration: {
            ...preset.configuration,
            avatar: preset.emoji
          },
          created_at: now,
          updated_at: now
        }
        state.agents.push(agent)
      }
    }
  }
})

export const {
  addAgent,
  updateAgent,
  deleteAgent,
  setAgents,
  addSession,
  updateSession,
  deleteSession,
  setSessions,
  setPresets,
  addPreset,
  installPreset
} = agentsSlice.actions

// ============ Selectors ============

export const selectAllAgents = (state: RootState) => state.agents?.agents ?? []

export const selectAgentById = (state: RootState, id: string) => state.agents?.agents.find((a) => a.id === id)

export const selectSessionsByAgentId = (state: RootState, agentId: string) =>
  state.agents?.sessions.filter((s) => s.agent_id === agentId) ?? []

export const selectSessionById = (state: RootState, sessionId: string) =>
  state.agents?.sessions.find((s) => s.id === sessionId)

export const selectAllPresets = (state: RootState) => state.agents?.presets ?? []

export const selectAgentsWithTools = createSelector([selectAllAgents], (agents) =>
  agents.map(
    (agent) =>
      ({
        ...agent,
        tools: [] // Tools would be populated by the hook
      }) satisfies GetAgentResponse
  )
)

export default agentsSlice.reducer

// ============ Helper Functions ============

/**
 * Create a new agent entity with default values
 */
export function createAgentEntity(
  partial: Partial<AgentEntity> & { type: AgentType; model: string; accessible_paths: string[] }
): AgentEntity {
  const now = new Date().toISOString()
  return {
    id: uuid(),
    name: partial.name ?? 'New Agent',
    description: partial.description,
    instructions: partial.instructions,
    model: partial.model,
    plan_model: partial.plan_model,
    small_model: partial.small_model,
    accessible_paths: partial.accessible_paths,
    allowed_tools: partial.allowed_tools,
    mcps: partial.mcps,
    configuration: partial.configuration ?? {
      permission_mode: 'default',
      max_turns: 100
    },
    type: partial.type,
    created_at: now,
    updated_at: now
  }
}

/**
 * Create a new session entity with default values
 */
export function createSessionEntity(
  agentId: string,
  agentType: AgentType,
  partial: Partial<AgentSessionEntity> & { model: string; accessible_paths: string[] }
): AgentSessionEntity {
  const now = new Date().toISOString()
  return {
    id: uuid(),
    agent_id: agentId,
    agent_type: agentType,
    name: partial.name,
    description: partial.description,
    instructions: partial.instructions,
    model: partial.model,
    plan_model: partial.plan_model,
    small_model: partial.small_model,
    accessible_paths: partial.accessible_paths,
    allowed_tools: partial.allowed_tools,
    mcps: partial.mcps,
    configuration: partial.configuration,
    created_at: now,
    updated_at: now
  }
}
