import type { Tool } from '@types'

/**
 * Built-in tools for skill management.
 * These tools allow agents to create, update, delete, and manage skills.
 */
export const skillManagementTools: Tool[] = [
  {
    id: 'SkillList',
    name: 'SkillList',
    description: 'Lists all available skills from the resources directory and installed skills for the current agent',
    requirePermissions: false,
    type: 'builtin'
  },
  {
    id: 'SkillCreate',
    name: 'SkillCreate',
    description:
      'Creates a new skill by generating a SKILL.md file with frontmatter and content in the specified directory',
    requirePermissions: true,
    type: 'builtin'
  },
  {
    id: 'SkillUpdate',
    name: 'SkillUpdate',
    description: 'Updates an existing skill by modifying its SKILL.md file content and metadata',
    requirePermissions: true,
    type: 'builtin'
  },
  {
    id: 'SkillDelete',
    name: 'SkillDelete',
    description: 'Deletes a skill folder and its contents from the skills directory',
    requirePermissions: true,
    type: 'builtin'
  },
  {
    id: 'SkillRead',
    name: 'SkillRead',
    description: 'Reads the full content of a skill including its SKILL.md file and metadata',
    requirePermissions: false,
    type: 'builtin'
  },
  {
    id: 'SkillInstall',
    name: 'SkillInstall',
    description: 'Installs an available skill to the current agent workspace (.claude/skills directory)',
    requirePermissions: true,
    type: 'builtin'
  },
  {
    id: 'SkillUninstall',
    name: 'SkillUninstall',
    description: 'Uninstalls a skill from the current agent workspace',
    requirePermissions: true,
    type: 'builtin'
  }
]

/**
 * Tool IDs that are available for skill management
 */
export const skillToolIds = skillManagementTools.map((t) => t.id)
