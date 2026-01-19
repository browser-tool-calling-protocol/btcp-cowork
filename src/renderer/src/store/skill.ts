/**
 * Skill Store
 *
 * Simple CRUD store for skills - text prompts that teach the agent how to perform tasks.
 * Replaces the complex knowledge base store with RAG/vector storage.
 */
import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'
import type { Skill } from '@renderer/types/skill'

export interface SkillState {
  skills: Skill[]
}

const initialState: SkillState = {
  skills: []
}

const skillSlice = createSlice({
  name: 'skill',
  initialState,
  reducers: {
    addSkill(state, action: PayloadAction<Skill>) {
      state.skills.push(action.payload)
    },

    updateSkill(state, action: PayloadAction<Skill>) {
      const index = state.skills.findIndex((s) => s.id === action.payload.id)
      if (index !== -1) {
        state.skills[index] = action.payload
      }
    },

    deleteSkill(state, action: PayloadAction<string>) {
      state.skills = state.skills.filter((s) => s.id !== action.payload)
    },

    reorderSkills(state, action: PayloadAction<Skill[]>) {
      state.skills = action.payload
    },

    setSkills(state, action: PayloadAction<Skill[]>) {
      state.skills = action.payload
    }
  }
})

export const { addSkill, updateSkill, deleteSkill, reorderSkills, setSkills } = skillSlice.actions

export default skillSlice.reducer
