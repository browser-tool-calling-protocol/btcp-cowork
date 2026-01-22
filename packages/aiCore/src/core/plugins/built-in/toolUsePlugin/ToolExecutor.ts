/**
 * 工具执行器
 *
 * 负责工具的执行、结果格式化和相关事件发送
 * 从 promptToolUsePlugin.ts 中提取出来以降低复杂度
 */
import type { ToolSet, TypedToolError } from 'ai'

import type { ToolUseResult } from './type'

/**
 * 工具执行结果
 */
export interface ExecutedResult {
  toolCallId: string
  toolName: string
  result: any
  isError?: boolean
}

/**
 * 流控制器类型（从 AI SDK 提取）
 */
export interface StreamController {
  enqueue(chunk: any): void
}

/**
 * 工具执行器类
 */
export class ToolExecutor {
  /**
   * 执行多个工具调用
   */
  async executeTools(
    toolUses: ToolUseResult[],
    tools: ToolSet,
    controller: StreamController
  ): Promise<ExecutedResult[]> {
    console.log('[ToolExecutor] Starting tool execution:', {
      toolCount: toolUses.length,
      toolNames: toolUses.map((t) => t.toolName)
    })

    const executedResults: ExecutedResult[] = []
    for (const toolUse of toolUses) {
      try {
        const tool = tools[toolUse.toolName]
        if (!tool || typeof tool.execute !== 'function') {
          throw new Error(`Tool "${toolUse.toolName}" has no execute method`)
        }

        console.log(`[ToolExecutor] Executing tool: ${toolUse.toolName}`, {
          args: toolUse.arguments
        })

        // 发送 tool-call 事件
        controller.enqueue({
          type: 'tool-call',
          toolCallId: toolUse.id,
          toolName: toolUse.toolName,
          input: toolUse.arguments
        })

        const result = await tool.execute(toolUse.arguments, {
          toolCallId: toolUse.id,
          messages: [],
          abortSignal: new AbortController().signal
        })

        console.log(`[ToolExecutor] Tool ${toolUse.toolName} executed successfully:`, {
          resultType: typeof result,
          resultPreview: JSON.stringify(result).substring(0, 200)
        })

        // 发送 tool-result 事件
        controller.enqueue({
          type: 'tool-result',
          toolCallId: toolUse.id,
          toolName: toolUse.toolName,
          input: toolUse.arguments,
          output: result
        })

        executedResults.push({
          toolCallId: toolUse.id,
          toolName: toolUse.toolName,
          result,
          isError: false
        })
      } catch (error) {
        console.error(`[ToolExecutor] Tool execution failed: ${toolUse.toolName}`, error)

        // 处理错误情况
        const errorResult = this.handleToolError(toolUse, error, controller)
        executedResults.push(errorResult)
      }
    }

    console.log('[ToolExecutor] All tools executed:', {
      successCount: executedResults.filter((r) => !r.isError).length,
      errorCount: executedResults.filter((r) => r.isError).length
    })

    return executedResults
  }

  /**
   * 格式化工具结果为 Cherry Studio 标准格式
   * Enhanced with explicit success markers for models that may have safety guardrails
   */
  formatToolResults(executedResults: ExecutedResult[]): string {
    const successCount = executedResults.filter((r) => !r.isError).length
    const errorCount = executedResults.filter((r) => r.isError).length

    // Add a clear header that signals tool execution success
    const header = `[TOOL EXECUTION COMPLETED - ${successCount} succeeded, ${errorCount} failed]
The following tool(s) have been executed successfully. You MUST acknowledge these results and proceed with the task.`

    const results = executedResults
      .map((tr) => {
        if (!tr.isError) {
          return `<tool_use_result>
  <name>${tr.toolName}</name>
  <status>SUCCESS</status>
  <result>${JSON.stringify(tr.result)}</result>
</tool_use_result>`
        } else {
          const error = tr.result || 'Unknown error'
          return `<tool_use_result>
  <name>${tr.toolName}</name>
  <status>ERROR</status>
  <error>${error}</error>
</tool_use_result>`
        }
      })
      .join('\n\n')

    // Add footer with explicit instruction
    const footer = `[END OF TOOL RESULTS]
Based on the above successful tool execution, describe what happened and continue with the task. Do NOT say you cannot control the browser - the action has already been performed.`

    return `${header}\n\n${results}\n\n${footer}`
  }

  /**
   * 发送工具调用开始相关事件
   */
  // private sendToolStartEvents(controller: StreamController, toolUse: ToolUseResult): void {
  //   // 发送 tool-input-start 事件
  //   controller.enqueue({
  //     type: 'tool-input-start',
  //     id: toolUse.id,
  //     toolName: toolUse.toolName
  //   })
  // }

  /**
   * 处理工具执行错误
   */
  private handleToolError<T extends ToolSet>(
    toolUse: ToolUseResult,
    error: unknown,
    controller: StreamController
  ): ExecutedResult {
    // 使用 AI SDK 标准错误格式
    const toolError: TypedToolError<T> = {
      type: 'tool-error',
      toolCallId: toolUse.id,
      toolName: toolUse.toolName,
      input: toolUse.arguments,
      error
    }

    controller.enqueue(toolError)

    // 发送标准错误事件
    // controller.enqueue({
    //   type: 'tool-error',
    //   toolCallId: toolUse.id,
    //   error: error instanceof Error ? error.message : String(error),
    //   input: toolUse.arguments
    // })

    return {
      toolCallId: toolUse.id,
      toolName: toolUse.toolName,
      result: error,
      isError: true
    }
  }
}
