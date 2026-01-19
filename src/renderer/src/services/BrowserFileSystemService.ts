/**
 * BrowserFileSystemService - Browser-based file system access using the File System Access API
 *
 * This service enables web-based agents to have full access to user-selected folders,
 * allowing file management operations including:
 * - Read files
 * - Write/Create new files
 * - Rename files (via copy + delete or move)
 * - Copy files
 * - Delete files and folders
 * - Create directories
 * - List directory contents
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/File_System_API
 */

export interface FileSystemEntry {
  name: string
  path: string
  kind: 'file' | 'directory'
  size?: number
  lastModified?: number
}

export interface FolderPermission {
  id: string
  name: string
  handle: FileSystemDirectoryHandle
  grantedAt: number
}

interface StoredPermission {
  id: string
  name: string
  grantedAt: number
}

const PERMISSIONS_STORAGE_KEY = 'browser-fs-permissions'

class BrowserFileSystemService {
  private folderHandles: Map<string, FileSystemDirectoryHandle> = new Map()
  private rootHandle: FileSystemDirectoryHandle | null = null

  /**
   * Check if the File System Access API is supported
   */
  isSupported(): boolean {
    return 'showDirectoryPicker' in window
  }

  /**
   * Request access to a folder from the user
   * This opens a native folder picker dialog
   */
  async requestFolderAccess(): Promise<FolderPermission | null> {
    if (!this.isSupported()) {
      throw new Error('File System Access API is not supported in this browser')
    }

    try {
      // Open folder picker - user must explicitly select a folder
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite', // Request both read and write access
        startIn: 'documents' // Start in Documents folder
      })

      const permission: FolderPermission = {
        id: crypto.randomUUID(),
        name: handle.name,
        handle,
        grantedAt: Date.now()
      }

      // Store the handle for later use
      this.folderHandles.set(permission.id, handle)
      this.rootHandle = handle

      // Persist permission metadata (handle can't be serialized)
      this.savePermissionMetadata(permission)

      return permission
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // User cancelled the picker
        return null
      }
      throw error
    }
  }

  /**
   * Set the active root folder handle
   */
  setRootHandle(handle: FileSystemDirectoryHandle): void {
    this.rootHandle = handle
  }

  /**
   * Get the current root handle
   */
  getRootHandle(): FileSystemDirectoryHandle | null {
    return this.rootHandle
  }

  /**
   * Verify we still have permission to access a folder
   */
  async verifyPermission(
    handle: FileSystemDirectoryHandle,
    mode: 'read' | 'readwrite' = 'readwrite'
  ): Promise<boolean> {
    const options: FileSystemHandlePermissionDescriptor = { mode }

    // Check if permission is already granted
    if ((await handle.queryPermission(options)) === 'granted') {
      return true
    }

    // Request permission if not granted
    if ((await handle.requestPermission(options)) === 'granted') {
      return true
    }

    return false
  }

  /**
   * Get a file handle from a path relative to the root
   */
  private async getFileHandle(path: string, create = false): Promise<FileSystemFileHandle> {
    if (!this.rootHandle) {
      throw new Error('No folder access granted. Please select a folder first.')
    }

    const parts = path.split('/').filter(Boolean)
    const fileName = parts.pop()

    if (!fileName) {
      throw new Error('Invalid file path')
    }

    // Navigate to the parent directory
    let currentDir = this.rootHandle
    for (const part of parts) {
      currentDir = await currentDir.getDirectoryHandle(part, { create })
    }

    return currentDir.getFileHandle(fileName, { create })
  }

  /**
   * Get a directory handle from a path relative to the root
   */
  private async getDirectoryHandle(path: string, create = false): Promise<FileSystemDirectoryHandle> {
    if (!this.rootHandle) {
      throw new Error('No folder access granted. Please select a folder first.')
    }

    if (!path || path === '/' || path === '.') {
      return this.rootHandle
    }

    const parts = path.split('/').filter(Boolean)
    let currentDir = this.rootHandle

    for (const part of parts) {
      currentDir = await currentDir.getDirectoryHandle(part, { create })
    }

    return currentDir
  }

  /**
   * Read a file's contents
   */
  async readFile(path: string): Promise<string> {
    const fileHandle = await this.getFileHandle(path)
    const file = await fileHandle.getFile()
    return file.text()
  }

  /**
   * Read a file as binary (ArrayBuffer)
   */
  async readFileBinary(path: string): Promise<ArrayBuffer> {
    const fileHandle = await this.getFileHandle(path)
    const file = await fileHandle.getFile()
    return file.arrayBuffer()
  }

  /**
   * Write content to a file (creates if doesn't exist)
   */
  async writeFile(path: string, content: string | Blob | ArrayBuffer): Promise<void> {
    const fileHandle = await this.getFileHandle(path, true)
    const writable = await fileHandle.createWritable()

    try {
      await writable.write(content)
      await writable.close()
    } catch (error) {
      await writable.abort()
      throw error
    }
  }

  /**
   * Create a new directory
   */
  async createDirectory(path: string): Promise<void> {
    await this.getDirectoryHandle(path, true)
  }

  /**
   * List contents of a directory
   */
  async listDirectory(path = ''): Promise<FileSystemEntry[]> {
    const dirHandle = await this.getDirectoryHandle(path)
    const entries: FileSystemEntry[] = []

    for await (const entry of dirHandle.values()) {
      const entryPath = path ? `${path}/${entry.name}` : entry.name
      const item: FileSystemEntry = {
        name: entry.name,
        path: entryPath,
        kind: entry.kind
      }

      if (entry.kind === 'file') {
        try {
          const file = await (entry as FileSystemFileHandle).getFile()
          item.size = file.size
          item.lastModified = file.lastModified
        } catch {
          // Ignore errors getting file metadata
        }
      }

      entries.push(item)
    }

    // Sort: directories first, then alphabetically
    return entries.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  }

  /**
   * List directory recursively
   */
  async listDirectoryRecursive(path = '', maxDepth = 10): Promise<FileSystemEntry[]> {
    if (maxDepth <= 0) return []

    const entries = await this.listDirectory(path)
    const result: FileSystemEntry[] = [...entries]

    for (const entry of entries) {
      if (entry.kind === 'directory') {
        const subEntries = await this.listDirectoryRecursive(entry.path, maxDepth - 1)
        result.push(...subEntries)
      }
    }

    return result
  }

  /**
   * Check if a file or directory exists
   */
  async exists(path: string): Promise<boolean> {
    try {
      const parts = path.split('/').filter(Boolean)
      const name = parts.pop()

      if (!name) return false

      const parentPath = parts.join('/')
      const parentDir = await this.getDirectoryHandle(parentPath)

      // Try to get as file first, then as directory
      try {
        await parentDir.getFileHandle(name)
        return true
      } catch {
        try {
          await parentDir.getDirectoryHandle(name)
          return true
        } catch {
          return false
        }
      }
    } catch {
      return false
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<void> {
    if (!this.rootHandle) {
      throw new Error('No folder access granted')
    }

    const parts = path.split('/').filter(Boolean)
    const fileName = parts.pop()

    if (!fileName) {
      throw new Error('Invalid file path')
    }

    const parentPath = parts.join('/')
    const parentDir = await this.getDirectoryHandle(parentPath)

    await parentDir.removeEntry(fileName)
  }

  /**
   * Delete a directory (and optionally its contents)
   */
  async deleteDirectory(path: string, recursive = false): Promise<void> {
    if (!this.rootHandle) {
      throw new Error('No folder access granted')
    }

    const parts = path.split('/').filter(Boolean)
    const dirName = parts.pop()

    if (!dirName) {
      throw new Error('Invalid directory path')
    }

    const parentPath = parts.join('/')
    const parentDir = await this.getDirectoryHandle(parentPath)

    await parentDir.removeEntry(dirName, { recursive })
  }

  /**
   * Copy a file to a new location
   */
  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    const content = await this.readFileBinary(sourcePath)
    await this.writeFile(destPath, content)
  }

  /**
   * Move/rename a file
   */
  async moveFile(sourcePath: string, destPath: string): Promise<void> {
    await this.copyFile(sourcePath, destPath)
    await this.deleteFile(sourcePath)
  }

  /**
   * Rename a file (same directory)
   */
  async renameFile(path: string, newName: string): Promise<void> {
    const parts = path.split('/').filter(Boolean)
    parts.pop() // Remove old name
    const newPath = [...parts, newName].join('/')
    await this.moveFile(path, newPath)
  }

  /**
   * Find files matching a glob pattern (simplified)
   * Supports: *, **, ?
   */
  async glob(pattern: string, basePath = ''): Promise<string[]> {
    const entries = await this.listDirectoryRecursive(basePath)
    const regex = this.globToRegex(pattern)

    return entries.filter((entry) => entry.kind === 'file' && regex.test(entry.path)).map((entry) => entry.path)
  }

  /**
   * Search for text in files
   */
  async grep(
    searchPattern: string,
    options: { path?: string; filePattern?: string; caseSensitive?: boolean } = {}
  ): Promise<
    Array<{
      file: string
      line: number
      content: string
    }>
  > {
    const { path = '', filePattern = '*', caseSensitive = true } = options
    const files = await this.glob(filePattern, path)
    const results: Array<{ file: string; line: number; content: string }> = []
    const regex = new RegExp(searchPattern, caseSensitive ? 'g' : 'gi')

    for (const filePath of files) {
      try {
        const content = await this.readFile(filePath)
        const lines = content.split('\n')

        lines.forEach((line, index) => {
          if (regex.test(line)) {
            results.push({
              file: filePath,
              line: index + 1,
              content: line.trim()
            })
          }
          // Reset regex lastIndex for global patterns
          regex.lastIndex = 0
        })
      } catch {
        // Skip files that can't be read
      }
    }

    return results
  }

  /**
   * Convert glob pattern to regex
   */
  private globToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*\*/g, '<<<GLOBSTAR>>>') // Temporarily replace **
      .replace(/\*/g, '[^/]*') // * matches anything except /
      .replace(/\?/g, '.') // ? matches single char
      .replace(/<<<GLOBSTAR>>>/g, '.*') // ** matches anything including /

    return new RegExp(`^${escaped}$`)
  }

  /**
   * Save permission metadata to localStorage
   */
  private savePermissionMetadata(permission: FolderPermission): void {
    const stored: StoredPermission[] = this.loadPermissionMetadata()
    stored.push({
      id: permission.id,
      name: permission.name,
      grantedAt: permission.grantedAt
    })
    localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(stored))
  }

  /**
   * Load permission metadata from localStorage
   */
  private loadPermissionMetadata(): StoredPermission[] {
    try {
      const data = localStorage.getItem(PERMISSIONS_STORAGE_KEY)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  /**
   * Get list of previously granted permissions (metadata only)
   * Note: Handles cannot be persisted, user must re-grant access
   */
  getStoredPermissions(): StoredPermission[] {
    return this.loadPermissionMetadata()
  }

  /**
   * Clear all stored permissions
   */
  clearStoredPermissions(): void {
    localStorage.removeItem(PERMISSIONS_STORAGE_KEY)
    this.folderHandles.clear()
    this.rootHandle = null
  }
}

// Singleton instance
export const browserFileSystem = new BrowserFileSystemService()

// Type augmentation for File System Access API
declare global {
  interface Window {
    showDirectoryPicker(options?: {
      id?: string
      mode?: 'read' | 'readwrite'
      startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'
    }): Promise<FileSystemDirectoryHandle>
  }

  interface FileSystemHandle {
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  }

  interface FileSystemHandlePermissionDescriptor {
    mode?: 'read' | 'readwrite'
  }

  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemHandle>
    keys(): AsyncIterableIterator<string>
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>
    [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>
  }
}
