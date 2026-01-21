import type { RootState } from '@renderer/store'
import { messageBlocksSelectors } from '@renderer/store/messageBlock'
import type { MCPToolResponse, NormalToolResponse } from '@renderer/types'
import { MessageBlockStatus, type ToolMessageBlock } from '@renderer/types/newMessage'
import type { CollapseProps } from 'antd'
import { Collapse, Progress, Tooltip } from 'antd'
import { Check, ChevronRight, CircleAlert, Loader2, Wrench } from 'lucide-react'
import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import styled from 'styled-components'

import MessageTools from '../Tools/MessageTools'

interface Props {
  blockIds: string[]
}

type ToolStatus = 'pending' | 'executing' | 'done' | 'error' | 'cancelled'

interface ToolProgress {
  completed: number
  total: number
  currentToolName?: string
  status: ToolStatus
}

const getToolStatus = (block: ToolMessageBlock): ToolStatus => {
  const toolResponse = block.metadata?.rawMcpToolResponse as MCPToolResponse | NormalToolResponse | undefined
  if (!toolResponse) return 'pending'

  switch (toolResponse.status) {
    case 'done':
      return 'done'
    case 'error':
      return 'error'
    case 'cancelled':
      return 'cancelled'
    case 'invoking':
      return 'executing'
    case 'pending':
    default:
      return block.status === MessageBlockStatus.PENDING ? 'pending' : 'executing'
  }
}

const getToolName = (block: ToolMessageBlock): string => {
  const toolResponse = block.metadata?.rawMcpToolResponse as MCPToolResponse | NormalToolResponse | undefined
  if (!toolResponse) return block.toolName || 'Tool'

  const tool = toolResponse.tool
  if (tool.type === 'mcp') {
    return `${(tool as any).serverName || ''}: ${tool.name}`
  }
  return tool.name || block.toolName || 'Tool'
}

const ToolGroupBlock: React.FC<Props> = ({ blockIds }) => {
  const { t } = useTranslation()
  const [activeKeys, setActiveKeys] = useState<string[]>([])

  const blockEntities = useSelector((state: RootState) => messageBlocksSelectors.selectEntities(state))

  const blocks = useMemo(
    () => blockIds.map((id) => blockEntities[id] as ToolMessageBlock | undefined).filter(Boolean) as ToolMessageBlock[],
    [blockIds, blockEntities]
  )

  // Calculate overall progress
  const progress = useMemo<ToolProgress>(() => {
    let completed = 0
    let currentToolName: string | undefined
    let groupStatus: ToolStatus = 'done'

    for (const block of blocks) {
      const status = getToolStatus(block)
      if (status === 'done' || status === 'cancelled') {
        completed++
      } else if (status === 'executing' || status === 'pending') {
        if (!currentToolName) {
          currentToolName = getToolName(block)
        }
        groupStatus = status === 'executing' ? 'executing' : groupStatus === 'done' ? 'pending' : groupStatus
      } else if (status === 'error') {
        groupStatus = 'error'
      }
    }

    // If all completed but not all done, check for errors
    if (completed === blocks.length) {
      const hasError = blocks.some((b) => getToolStatus(b) === 'error')
      groupStatus = hasError ? 'error' : 'done'
    }

    return {
      completed,
      total: blocks.length,
      currentToolName,
      status: groupStatus
    }
  }, [blocks])

  // Auto-expand the currently executing tool
  useEffect(() => {
    const executingBlock = blocks.find((b) => {
      const status = getToolStatus(b)
      return status === 'pending' || status === 'executing'
    })
    if (executingBlock && !activeKeys.includes(executingBlock.id)) {
      setActiveKeys([executingBlock.id])
    }
  }, [blocks, activeKeys])

  const handleCollapseChange = (keys: string | string[]) => {
    setActiveKeys(Array.isArray(keys) ? keys : [keys])
  }

  if (blocks.length === 0) {
    return null
  }

  // For single tool, render directly without grouping
  if (blocks.length === 1) {
    return <MessageTools block={blocks[0]} />
  }

  const progressPercent = Math.round((progress.completed / progress.total) * 100)

  const collapseItems: CollapseProps['items'] = blocks.map((block) => {
    const status = getToolStatus(block)
    const toolName = getToolName(block)

    return {
      key: block.id,
      label: (
        <ToolItemHeader>
          <ToolItemStatus>
            <StatusIcon status={status} />
            <ToolItemName>{toolName}</ToolItemName>
          </ToolItemStatus>
          {status === 'executing' && <ElapsedTimeCounter />}
        </ToolItemHeader>
      ),
      children: <MessageTools block={block} />,
      className: `tool-item-${status}`
    }
  })

  return (
    <ToolGroupContainer>
      <ToolGroupHeader>
        <HeaderLeft>
          <Wrench size={16} />
          <HeaderTitle>
            {progress.status === 'done' || progress.status === 'error'
              ? t('message.tools.toolsCompleted', { count: progress.total })
              : t('message.tools.toolsRunning', {
                  completed: progress.completed,
                  total: progress.total
                })}
          </HeaderTitle>
        </HeaderLeft>
        <HeaderRight>
          {progress.status === 'executing' && (
            <Tooltip title={progress.currentToolName}>
              <CurrentToolBadge>
                <Loader2 size={12} className="spin-animation" />
                <span>{progress.currentToolName}</span>
              </CurrentToolBadge>
            </Tooltip>
          )}
          <ProgressIndicator>
            <Progress
              type="circle"
              size={24}
              percent={progressPercent}
              strokeColor={progress.status === 'error' ? 'var(--color-error)' : 'var(--color-primary)'}
              format={() =>
                progress.status === 'done' ? (
                  <Check size={12} color="var(--color-primary)" />
                ) : progress.status === 'error' ? (
                  <CircleAlert size={12} color="var(--color-error)" />
                ) : (
                  `${progress.completed}`
                )
              }
            />
          </ProgressIndicator>
        </HeaderRight>
      </ToolGroupHeader>

      <ToolGroupContent
        activeKey={activeKeys}
        onChange={handleCollapseChange}
        size="small"
        ghost
        expandIcon={({ isActive }) => (
          <ExpandIcon $isActive={isActive} size={14} color="var(--color-text-3)" strokeWidth={2} />
        )}
        expandIconPosition="start"
        items={collapseItems}
      />
    </ToolGroupContainer>
  )
}

// Elapsed time counter component
const ElapsedTimeCounter: React.FC = memo(() => {
  const [elapsed, setElapsed] = useState(0)
  const timer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    timer.current = setInterval(() => {
      setElapsed((prev) => prev + 100)
    }, 100)

    return () => {
      if (timer.current) {
        clearInterval(timer.current)
      }
    }
  }, [])

  const seconds = (elapsed / 1000).toFixed(1)

  return <ElapsedTime>{seconds}s</ElapsedTime>
})

// Status icon component
const StatusIcon: React.FC<{ status: ToolStatus }> = ({ status }) => {
  switch (status) {
    case 'done':
      return <Check size={14} color="var(--color-primary)" />
    case 'error':
      return <CircleAlert size={14} color="var(--color-error)" />
    case 'cancelled':
      return <CircleAlert size={14} color="var(--color-warning)" />
    case 'executing':
      return <Loader2 size={14} className="spin-animation" color="var(--color-primary)" />
    case 'pending':
    default:
      return <div className="pending-dot" />
  }
}

// Styled components
const ToolGroupContainer = styled.div`
  margin: 10px 0;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  background-color: var(--color-background);
`

const ToolGroupHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
`

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text);
`

const HeaderTitle = styled.span`
  font-weight: 500;
  font-size: 14px;
`

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const CurrentToolBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background-color: var(--color-primary-bg);
  border-radius: 12px;
  font-size: 12px;
  color: var(--color-primary);
  max-width: 200px;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .spin-animation {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`

const ProgressIndicator = styled.div`
  .ant-progress-inner {
    background-color: var(--color-background-mute) !important;
  }
`

const ToolGroupContent = styled(Collapse)`
  .ant-collapse-item {
    border-bottom: 1px solid var(--color-border);

    &:last-child {
      border-bottom: none;
    }
  }

  .ant-collapse-header {
    padding: 10px 16px !important;
    align-items: center !important;
  }

  .ant-collapse-content-box {
    padding: 0 16px 12px 16px !important;
  }

  .tool-item-done .ant-collapse-header {
    opacity: 0.8;
  }

  .tool-item-error .ant-collapse-header {
    background-color: var(--color-error-bg);
  }
`

const ToolItemHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
`

const ToolItemStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;

  .pending-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--color-text-3);
  }

  .spin-animation {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`

const ToolItemName = styled.span`
  font-size: 13px;
  color: var(--color-text);
`

const ElapsedTime = styled.span`
  font-size: 12px;
  color: var(--color-text-2);
  font-variant-numeric: tabular-nums;
  min-width: 40px;
  text-align: right;
`

const ExpandIcon = styled(ChevronRight)<{ $isActive?: boolean }>`
  transition: transform 0.2s;
  transform: ${({ $isActive }) => ($isActive ? 'rotate(90deg)' : 'rotate(0deg)')};
`

export default memo(ToolGroupBlock)
