/**
 * Skill Hook
 *
 * Simple hook for managing skills - configurations that teach AI agents how to manage websites.
 * Replaces the complex useKnowledge hooks with RAG/vector storage operations.
 */
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { addSkill, deleteSkill, reorderSkills, updateSkill } from '@renderer/store/skill'
import type { Skill, SkillCreateInput } from '@renderer/types/skill'
import { uuid } from '@renderer/utils'
import { useCallback } from 'react'

export function useSkills() {
  const dispatch = useAppDispatch()
  const skills = useAppSelector((state) => state.skill.skills)

  const create = useCallback(
    (data: SkillCreateInput): Skill => {
      const skill: Skill = {
        ...data,
        id: uuid(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      dispatch(addSkill(skill))
      return skill
    },
    [dispatch]
  )

  /**
   * Update a skill by id with partial data
   * @param id - The skill id to update
   * @param data - Partial skill data to merge
   * @returns The updated skill
   */
  const update = useCallback(
    (id: string, data: Partial<Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>>): Skill => {
      const existingSkill = skills.find((s) => s.id === id)
      if (!existingSkill) {
        throw new Error(`Skill with id ${id} not found`)
      }
      const updatedSkill: Skill = {
        ...existingSkill,
        ...data,
        updatedAt: Date.now()
      }
      dispatch(updateSkill(updatedSkill))
      return updatedSkill
    },
    [dispatch, skills]
  )

  /**
   * Update a skill with a full skill object
   * @param skill - The full skill object to update
   */
  const updateFull = useCallback(
    (skill: Skill) => {
      dispatch(updateSkill({ ...skill, updatedAt: Date.now() }))
    },
    [dispatch]
  )

  const remove = useCallback(
    (id: string) => {
      dispatch(deleteSkill(id))
    },
    [dispatch]
  )

  const reorder = useCallback(
    (newSkills: Skill[]) => {
      dispatch(reorderSkills(newSkills))
    },
    [dispatch]
  )

  const getById = useCallback(
    (id: string): Skill | undefined => {
      return skills.find((s) => s.id === id)
    },
    [skills]
  )

  const getEnabledSkills = useCallback((): Skill[] => {
    return skills.filter((s) => s.enabled)
  }, [skills])

  return {
    skills,
    create,
    update,
    updateFull,
    remove,
    reorder,
    getById,
    getEnabledSkills
  }
}

export function useSkill(skillId: string | undefined) {
  const { skills, update, updateFull, remove } = useSkills()

  const skill = skillId ? skills.find((s) => s.id === skillId) : undefined

  return {
    skill,
    update,
    updateFull,
    remove
  }
}
