import type { MCPToolResponse, NormalToolResponse } from '@renderer/types'
import type { ToolMessageBlock } from '@renderer/types/newMessage'
import { FileText, FolderSearch, Globe, Search, Terminal, Wrench } from 'lucide-react'
import type React from 'react'
import { memo, useMemo } from 'react'
import styled from 'styled-components'

import { AgentToolsType } from '../Tools/MessageAgentTools/types'

interface Props {
  block: ToolMessageBlock
  compact?: boolean
}

interface ParamInfo {
  icon: React.ReactNode
  label: string
  value: string
  secondary?: string
}

/**
 * Extracts the most relevant parameter info for each tool type
 */
const getToolParamsInfo = (toolName: string, args: Record<string, unknown> | undefined): ParamInfo | null => {
  if (!args) return null

  // Helper to truncate long strings
  const truncate = (str: string | undefined, maxLen = 50): string => {
    if (!str) return ''
    if (str.length <= maxLen) return str
    return str.slice(0, maxLen) + '...'
  }

  // Helper to get filename from path
  const getFileName = (path: string | undefined): string => {
    if (!path) return ''
    const parts = path.split('/')
    return parts[parts.length - 1] || path
  }

  switch (toolName) {
    case AgentToolsType.Read:
      return {
        icon: <FileText size={12} />,
        label: 'File',
        value: getFileName(args.file_path as string),
        secondary: args.offset ? `line ${args.offset}` : undefined
      }

    case AgentToolsType.Write:
      return {
        icon: <FileText size={12} />,
        label: 'File',
        value: getFileName(args.file_path as string)
      }

    case AgentToolsType.Edit:
    case AgentToolsType.MultiEdit:
      return {
        icon: <FileText size={12} />,
        label: 'Edit',
        value: getFileName(args.file_path as string),
        secondary: args.replace_all ? 'all occurrences' : undefined
      }

    case AgentToolsType.Bash:
      return {
        icon: <Terminal size={12} />,
        label: '',
        value: truncate((args.description as string) || (args.command as string), 80)
      }

    case AgentToolsType.Glob:
      return {
        icon: <FolderSearch size={12} />,
        label: 'Pattern',
        value: args.pattern as string,
        secondary: args.path ? `in ${getFileName(args.path as string)}` : undefined
      }

    case AgentToolsType.Grep:
      return {
        icon: <Search size={12} />,
        label: 'Search',
        value: truncate(args.pattern as string, 40),
        secondary: args.path ? `in ${getFileName(args.path as string)}` : undefined
      }

    case AgentToolsType.WebSearch:
      return {
        icon: <Globe size={12} />,
        label: 'Query',
        value: truncate(args.query as string, 60)
      }

    case AgentToolsType.WebFetch:
      return {
        icon: <Globe size={12} />,
        label: 'URL',
        value: truncate(args.url as string, 60)
      }

    case AgentToolsType.Task:
      return {
        icon: <Wrench size={12} />,
        label: args.subagent_type as string,
        value: truncate(args.description as string, 60)
      }

    case AgentToolsType.NotebookEdit:
      return {
        icon: <FileText size={12} />,
        label: (args.edit_mode as string) || 'Edit',
        value: getFileName(args.notebook_path as string)
      }

    default:
      // For MCP tools or unknown tools, show first significant parameter
      const entries = Object.entries(args).filter(([, v]) => typeof v === 'string' && v.length > 0 && v.length < 100)
      if (entries.length > 0) {
        const [key, value] = entries[0]
        return {
          icon: <Wrench size={12} />,
          label: key,
          value: truncate(value as string, 50)
        }
      }
      return null
  }
}

const ToolParamsPreview: React.FC<Props> = ({ block, compact }) => {
  const toolResponse = block.metadata?.rawMcpToolResponse as MCPToolResponse | NormalToolResponse | undefined

  const paramsInfo = useMemo(() => {
    const toolName = toolResponse?.tool?.name || block.toolName || ''
    const args = (toolResponse?.arguments || block.arguments) as Record<string, unknown> | undefined
    return getToolParamsInfo(toolName, args)
  }, [toolResponse, block.toolName, block.arguments])

  if (!paramsInfo) return null

  if (compact) {
    return (
      <CompactContainer>
        {paramsInfo.icon}
        <ParamValue title={paramsInfo.value}>
          {paramsInfo.label && <ParamLabel>{paramsInfo.label}:</ParamLabel>}
          {paramsInfo.value}
          {paramsInfo.secondary && <SecondaryText> ({paramsInfo.secondary})</SecondaryText>}
        </ParamValue>
      </CompactContainer>
    )
  }

  return (
    <Container>
      <ParamRow>
        {paramsInfo.icon}
        <ParamContent>
          {paramsInfo.label && <ParamLabel>{paramsInfo.label}:</ParamLabel>}
          <ParamValue title={paramsInfo.value}>{paramsInfo.value}</ParamValue>
        </ParamContent>
      </ParamRow>
      {paramsInfo.secondary && (
        <SecondaryRow>
          <SecondaryText>{paramsInfo.secondary}</SecondaryText>
        </SecondaryRow>
      )}
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
  padding-left: 22px;
`

const CompactContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-3);
  font-size: 12px;
  margin-top: 2px;
  max-width: 100%;
  overflow: hidden;
`

const ParamRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-2);
  font-size: 12px;
`

const ParamContent = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex: 1;
`

const ParamLabel = styled.span`
  color: var(--color-text-3);
  flex-shrink: 0;
`

const ParamValue = styled.span`
  color: var(--color-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-family-code);
`

const SecondaryRow = styled.div`
  padding-left: 18px;
`

const SecondaryText = styled.span`
  color: var(--color-text-3);
  font-size: 11px;
  font-style: italic;
`

export default memo(ToolParamsPreview)
