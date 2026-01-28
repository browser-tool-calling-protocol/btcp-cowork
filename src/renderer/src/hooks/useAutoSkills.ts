/**
 * Auto Skills Hook
 *
 * Filters and returns skills that should be auto-activated based on
 * the current browser tab URL matching their domain patterns.
 */
import { useAppSelector } from '@renderer/store'
import type { Skill } from '@renderer/types/skill'
import { matchesDomainPattern } from '@renderer/types/skill'
import { useMemo } from 'react'

import { useActiveTabUrl } from './useActiveTabUrl'

export interface AutoSkillsResult {
  /** Skills that match the current URL's domain pattern */
  autoActivatedSkills: Skill[]
  /** Set of skill IDs that are auto-activated */
  matchingSkillIds: Set<string>
  /** Current active tab URL */
  currentUrl: string | null
}

/**
 * Hook that filters skills by domain pattern match against current tab URL
 * @returns Auto-activated skills and their IDs
 */
export function useAutoSkills(): AutoSkillsResult {
  const skills = useAppSelector((state) => state.skill.skills)
  const currentUrl = useActiveTabUrl()

  const result = useMemo(() => {
    if (!currentUrl) {
      return {
        autoActivatedSkills: [],
        matchingSkillIds: new Set<string>()
      }
    }

    // Filter skills that are enabled, have a domain pattern, and match the current URL
    const matchingSkills = skills.filter(
      (skill) => skill.enabled && skill.domainPattern && matchesDomainPattern(currentUrl, skill.domainPattern)
    )

    const matchingIds = new Set(matchingSkills.map((skill) => skill.id))

    return {
      autoActivatedSkills: matchingSkills,
      matchingSkillIds: matchingIds
    }
  }, [skills, currentUrl])

  return {
    ...result,
    currentUrl
  }
}
