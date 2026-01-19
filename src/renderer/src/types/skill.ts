/**
 * Skill Type Definition
 *
 * Skills are simple text prompts that teach the agent how to perform tasks.
 * This is a simplified replacement for the complex KnowledgeBase/RAG system.
 */

export interface Skill {
  id: string
  name: string
  description?: string
  prompt: string // The instruction text
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export type SkillCreateInput = Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>
