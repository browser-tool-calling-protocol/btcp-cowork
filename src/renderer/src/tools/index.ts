import type { MCPTool } from '@renderer/types'

import { addSkillTool } from './addSkill'
import { thinkTool } from './think'

export const BUILT_IN_TOOLS: MCPTool[] = [thinkTool, addSkillTool]

export function getBuiltInTool(name: string): MCPTool | undefined {
  return BUILT_IN_TOOLS.find((tool) => tool.name === name || tool.id === name)
}

export function isBuiltInTool(tool: MCPTool): boolean {
  return tool.isBuiltIn === true
}

export * from './addSkill'
export * from './think'
