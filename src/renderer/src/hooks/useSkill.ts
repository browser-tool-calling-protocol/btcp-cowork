/**
 * Skill Hook
 *
 * Simple hook for managing skills - text prompts that teach the agent how to perform tasks.
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

  const update = useCallback(
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
    remove,
    reorder,
    getById,
    getEnabledSkills
  }
}

export function useSkill(skillId: string | undefined) {
  const { skills, update, remove } = useSkills()

  const skill = skillId ? skills.find((s) => s.id === skillId) : undefined

  return {
    skill,
    update,
    remove
  }
}
