/**
 * Browser-compatible file tools for agent use
 *
 * These tools wrap the BrowserFileSystemService to provide
 * agent-compatible interfaces for file operations in the browser.
 */

import type { FileSystemEntry } from './BrowserFileSystemService'
import { browserFileSystem } from './BrowserFileSystemService'

export interface ToolResult {
  success: boolean
  content?: string
  error?: string
}

/**
 * Browser Read Tool - Read file contents
 */
export async function browserRead(params: { file_path: string; offset?: number; limit?: number }): Promise<ToolResult> {
  try {
    const content = await browserFileSystem.readFile(params.file_path)
    const lines = content.split('\n')

    const offset = params.offset ?? 0
    const limit = params.limit ?? lines.length

    const selectedLines = lines.slice(offset, offset + limit)

    // Format like the native Read tool with line numbers
    const formatted = selectedLines.map((line, i) => `${String(offset + i + 1).padStart(6)}→${line}`).join('\n')

    return { success: true, content: formatted }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Browser Write Tool - Create or overwrite files
 */
export async function browserWrite(params: { file_path: string; content: string }): Promise<ToolResult> {
  try {
    await browserFileSystem.writeFile(params.file_path, params.content)
    return { success: true, content: `File written successfully: ${params.file_path}` }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Browser Edit Tool - Make targeted edits to files
 */
export async function browserEdit(params: {
  file_path: string
  old_string: string
  new_string: string
  replace_all?: boolean
}): Promise<ToolResult> {
  try {
    const content = await browserFileSystem.readFile(params.file_path)

    if (!content.includes(params.old_string)) {
      return { success: false, error: `Could not find the specified text in ${params.file_path}` }
    }

    // Check if old_string is unique (unless replace_all is true)
    if (!params.replace_all) {
      const occurrences = content.split(params.old_string).length - 1
      if (occurrences > 1) {
        return {
          success: false,
          error: `The text to replace appears ${occurrences} times. Use replace_all=true to replace all occurrences, or provide a more unique string.`
        }
      }
    }

    const newContent = params.replace_all
      ? content.replaceAll(params.old_string, params.new_string)
      : content.replace(params.old_string, params.new_string)

    await browserFileSystem.writeFile(params.file_path, newContent)
    return { success: true, content: `File edited successfully: ${params.file_path}` }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Browser Glob Tool - Find files by pattern
 */
export async function browserGlob(params: { pattern: string; path?: string }): Promise<ToolResult> {
  try {
    const files = await browserFileSystem.glob(params.pattern, params.path)

    if (files.length === 0) {
      return { success: true, content: 'No files found matching the pattern' }
    }

    return { success: true, content: files.join('\n') }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Browser Grep Tool - Search file contents
 */
export async function browserGrep(params: {
  pattern: string
  path?: string
  glob?: string
  case_sensitive?: boolean
}): Promise<ToolResult> {
  try {
    const results = await browserFileSystem.grep(params.pattern, {
      path: params.path,
      filePattern: params.glob,
      caseSensitive: params.case_sensitive ?? true
    })

    if (results.length === 0) {
      return { success: true, content: 'No matches found' }
    }

    const formatted = results.map((r) => `${r.file}:${r.line}: ${r.content}`).join('\n')

    return { success: true, content: formatted }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Browser ListDirectory Tool - List directory contents
 */
export async function browserListDirectory(params: { path?: string; recursive?: boolean }): Promise<ToolResult> {
  try {
    let entries: FileSystemEntry[]

    if (params.recursive) {
      entries = await browserFileSystem.listDirectoryRecursive(params.path ?? '')
    } else {
      entries = await browserFileSystem.listDirectory(params.path ?? '')
    }

    const formatted = entries
      .map((e) => {
        const prefix = e.kind === 'directory' ? '📁' : '📄'
        const size = e.size !== undefined ? ` (${formatFileSize(e.size)})` : ''
        return `${prefix} ${e.path}${size}`
      })
      .join('\n')

    return { success: true, content: formatted || 'Empty directory' }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Browser CreateDirectory Tool - Create new directories
 */
export async function browserCreateDirectory(params: { path: string }): Promise<ToolResult> {
  try {
    await browserFileSystem.createDirectory(params.path)
    return { success: true, content: `Directory created: ${params.path}` }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Browser DeleteFile Tool - Delete files
 */
export async function browserDeleteFile(params: { path: string }): Promise<ToolResult> {
  try {
    await browserFileSystem.deleteFile(params.path)
    return { success: true, content: `File deleted: ${params.path}` }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Browser DeleteDirectory Tool - Delete directories
 */
export async function browserDeleteDirectory(params: { path: string; recursive?: boolean }): Promise<ToolResult> {
  try {
    await browserFileSystem.deleteDirectory(params.path, params.recursive)
    return { success: true, content: `Directory deleted: ${params.path}` }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Browser CopyFile Tool - Copy files
 */
export async function browserCopyFile(params: { source: string; destination: string }): Promise<ToolResult> {
  try {
    await browserFileSystem.copyFile(params.source, params.destination)
    return { success: true, content: `File copied: ${params.source} -> ${params.destination}` }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Browser MoveFile Tool - Move/rename files
 */
export async function browserMoveFile(params: { source: string; destination: string }): Promise<ToolResult> {
  try {
    await browserFileSystem.moveFile(params.source, params.destination)
    return { success: true, content: `File moved: ${params.source} -> ${params.destination}` }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Browser RenameFile Tool - Rename files
 */
export async function browserRenameFile(params: { path: string; new_name: string }): Promise<ToolResult> {
  try {
    await browserFileSystem.renameFile(params.path, params.new_name)
    return { success: true, content: `File renamed to: ${params.new_name}` }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Browser FileExists Tool - Check if file/directory exists
 */
export async function browserExists(params: { path: string }): Promise<ToolResult> {
  try {
    const exists = await browserFileSystem.exists(params.path)
    return { success: true, content: exists ? 'true' : 'false' }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

// Helper function to format file sizes
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/**
 * Tool registry for browser environment
 */
export const browserFileToolHandlers: Record<string, (params: Record<string, unknown>) => Promise<ToolResult>> = {
  BrowserRead: browserRead as (params: Record<string, unknown>) => Promise<ToolResult>,
  BrowserWrite: browserWrite as (params: Record<string, unknown>) => Promise<ToolResult>,
  BrowserEdit: browserEdit as (params: Record<string, unknown>) => Promise<ToolResult>,
  BrowserGlob: browserGlob as (params: Record<string, unknown>) => Promise<ToolResult>,
  BrowserGrep: browserGrep as (params: Record<string, unknown>) => Promise<ToolResult>,
  BrowserListDirectory: browserListDirectory as (params: Record<string, unknown>) => Promise<ToolResult>,
  BrowserCreateDirectory: browserCreateDirectory as (params: Record<string, unknown>) => Promise<ToolResult>,
  BrowserDeleteFile: browserDeleteFile as (params: Record<string, unknown>) => Promise<ToolResult>,
  BrowserDeleteDirectory: browserDeleteDirectory as (params: Record<string, unknown>) => Promise<ToolResult>,
  BrowserCopyFile: browserCopyFile as (params: Record<string, unknown>) => Promise<ToolResult>,
  BrowserMoveFile: browserMoveFile as (params: Record<string, unknown>) => Promise<ToolResult>,
  BrowserRenameFile: browserRenameFile as (params: Record<string, unknown>) => Promise<ToolResult>,
  BrowserExists: browserExists as (params: Record<string, unknown>) => Promise<ToolResult>
}
