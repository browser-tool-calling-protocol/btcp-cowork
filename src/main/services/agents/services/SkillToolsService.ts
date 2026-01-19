import { loggerService } from '@logger'
import { parseSkillMetadata } from '@main/utils/markdownParser'
import type { PluginMetadata } from '@types'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

import { PluginService } from '../plugins/PluginService'

const logger = loggerService.withContext('SkillToolsService')

/**
 * Input types for skill operations
 */
export interface SkillCreateInput {
  /** Name of the skill (used for display) */
  name: string
  /** Description of what the skill does */
  description?: string
  /** Version of the skill (e.g., "1.0.0") */
  version?: string
  /** Author of the skill */
  author?: string
  /** Tags for categorizing the skill */
  tags?: string[]
  /** Tool IDs this skill uses */
  tools?: string[]
  /** The main content/instructions for the skill in markdown */
  content: string
  /** Folder name for the skill (must be valid directory name) */
  folderName: string
}

export interface SkillUpdateInput {
  /** Name of the skill (used for display) */
  name?: string
  /** Description of what the skill does */
  description?: string
  /** Version of the skill (e.g., "1.0.0") */
  version?: string
  /** Author of the skill */
  author?: string
  /** Tags for categorizing the skill */
  tags?: string[]
  /** Tool IDs this skill uses */
  tools?: string[]
  /** The main content/instructions for the skill in markdown */
  content?: string
}

export interface SkillListResult {
  available: PluginMetadata[]
  installed: PluginMetadata[]
}

export interface SkillReadResult {
  metadata: PluginMetadata
  content: string
}

/**
 * Service for managing skills through tools.
 * Provides CRUD operations for skills that can be used by agents.
 */
export class SkillToolsService {
  private static instance: SkillToolsService | null = null
  private readonly pluginService: PluginService

  private constructor() {
    this.pluginService = PluginService.getInstance()
    logger.info('SkillToolsService initialized')
  }

  static getInstance(): SkillToolsService {
    if (!SkillToolsService.instance) {
      SkillToolsService.instance = new SkillToolsService()
    }
    return SkillToolsService.instance
  }

  /**
   * Get the base path for skills in the resources directory
   */
  private getSkillsBasePath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'claude-code-plugins', 'skills')
    }
    return path.join(__dirname, '../../../node_modules/claude-code-plugins/plugins/skills')
  }

  /**
   * List all available and installed skills
   */
  async listSkills(agentId?: string): Promise<SkillListResult> {
    logger.info('Listing skills', { agentId })

    const availablePlugins = await this.pluginService.listAvailable()
    const available = availablePlugins.skills

    let installed: PluginMetadata[] = []
    if (agentId) {
      const installedPlugins = await this.pluginService.listInstalled(agentId)
      installed = installedPlugins.filter((p) => p.type === 'skill').map((p) => p.metadata)
    }

    logger.info('Skills listed', {
      availableCount: available.length,
      installedCount: installed.length
    })

    return { available, installed }
  }

  /**
   * Read the full content of a skill
   */
  async readSkill(folderName: string): Promise<SkillReadResult> {
    logger.info('Reading skill', { folderName })

    const skillsBasePath = this.getSkillsBasePath()
    const skillPath = path.join(skillsBasePath, folderName)
    const skillMdPath = path.join(skillPath, 'SKILL.md')

    // Check if skill exists
    try {
      await fs.promises.access(skillMdPath, fs.constants.R_OK)
    } catch {
      throw new Error(`Skill '${folderName}' not found`)
    }

    // Parse metadata and read content
    const sourcePath = path.join('skills', folderName)
    const metadata = await parseSkillMetadata(skillPath, sourcePath, 'skills')
    const content = await fs.promises.readFile(skillMdPath, 'utf-8')

    logger.info('Skill read successfully', { folderName })

    return { metadata, content }
  }

  /**
   * Create a new skill
   */
  async createSkill(input: SkillCreateInput): Promise<PluginMetadata> {
    logger.info('Creating skill', { name: input.name, folderName: input.folderName })

    // Validate folder name
    const sanitizedFolderName = this.sanitizeFolderName(input.folderName)
    if (!sanitizedFolderName) {
      throw new Error('Invalid folder name provided')
    }

    const skillsBasePath = this.getSkillsBasePath()
    const skillPath = path.join(skillsBasePath, sanitizedFolderName)
    const skillMdPath = path.join(skillPath, 'SKILL.md')

    // Check if skill already exists
    try {
      await fs.promises.access(skillPath)
      throw new Error(`Skill '${sanitizedFolderName}' already exists`)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }

    // Create skill directory
    await fs.promises.mkdir(skillPath, { recursive: true })

    // Generate SKILL.md content with frontmatter
    const skillContent = this.generateSkillMd(input)

    // Write SKILL.md
    await fs.promises.writeFile(skillMdPath, skillContent, 'utf-8')

    // Parse and return metadata
    const sourcePath = path.join('skills', sanitizedFolderName)
    const metadata = await parseSkillMetadata(skillPath, sourcePath, 'skills')

    // Invalidate cache to reflect new skill
    this.pluginService.invalidateCache()

    logger.info('Skill created successfully', { folderName: sanitizedFolderName })

    return metadata
  }

  /**
   * Update an existing skill
   */
  async updateSkill(folderName: string, input: SkillUpdateInput): Promise<PluginMetadata> {
    logger.info('Updating skill', { folderName })

    const sanitizedFolderName = this.sanitizeFolderName(folderName)
    const skillsBasePath = this.getSkillsBasePath()
    const skillPath = path.join(skillsBasePath, sanitizedFolderName)
    const skillMdPath = path.join(skillPath, 'SKILL.md')

    // Check if skill exists
    try {
      await fs.promises.access(skillMdPath, fs.constants.R_OK)
    } catch {
      throw new Error(`Skill '${folderName}' not found`)
    }

    // Read existing content
    const existingContent = await fs.promises.readFile(skillMdPath, 'utf-8')
    const existingData = this.parseSkillMd(existingContent)

    // Merge with updates
    const updatedData: SkillCreateInput = {
      name: input.name ?? existingData.name,
      description: input.description ?? existingData.description,
      version: input.version ?? existingData.version,
      author: input.author ?? existingData.author,
      tags: input.tags ?? existingData.tags,
      tools: input.tools ?? existingData.tools,
      content: input.content ?? existingData.content,
      folderName: sanitizedFolderName
    }

    // Generate updated SKILL.md
    const skillContent = this.generateSkillMd(updatedData)

    // Write updated SKILL.md
    await fs.promises.writeFile(skillMdPath, skillContent, 'utf-8')

    // Parse and return metadata
    const sourcePath = path.join('skills', sanitizedFolderName)
    const metadata = await parseSkillMetadata(skillPath, sourcePath, 'skills')

    // Invalidate cache to reflect changes
    this.pluginService.invalidateCache()

    logger.info('Skill updated successfully', { folderName: sanitizedFolderName })

    return metadata
  }

  /**
   * Delete a skill
   */
  async deleteSkill(folderName: string): Promise<void> {
    logger.info('Deleting skill', { folderName })

    const sanitizedFolderName = this.sanitizeFolderName(folderName)
    const skillsBasePath = this.getSkillsBasePath()
    const skillPath = path.join(skillsBasePath, sanitizedFolderName)

    // Check if skill exists
    try {
      await fs.promises.access(skillPath)
    } catch {
      throw new Error(`Skill '${folderName}' not found`)
    }

    // Remove skill directory
    await fs.promises.rm(skillPath, { recursive: true, force: true })

    // Invalidate cache to reflect deletion
    this.pluginService.invalidateCache()

    logger.info('Skill deleted successfully', { folderName: sanitizedFolderName })
  }

  /**
   * Install a skill to an agent's workspace
   */
  async installSkill(agentId: string, sourcePath: string): Promise<PluginMetadata> {
    logger.info('Installing skill', { agentId, sourcePath })

    const metadata = await this.pluginService.install({
      agentId,
      sourcePath,
      type: 'skill'
    })

    logger.info('Skill installed successfully', { agentId, sourcePath })

    return metadata
  }

  /**
   * Uninstall a skill from an agent's workspace
   */
  async uninstallSkill(agentId: string, folderName: string): Promise<void> {
    logger.info('Uninstalling skill', { agentId, folderName })

    await this.pluginService.uninstall({
      agentId,
      filename: folderName,
      type: 'skill'
    })

    logger.info('Skill uninstalled successfully', { agentId, folderName })
  }

  /**
   * Sanitize folder name to be safe for filesystem
   */
  private sanitizeFolderName(folderName: string): string {
    // Remove path separators
    let sanitized = folderName.replace(/[/\\]/g, '_')
    // Remove null bytes
    sanitized = sanitized.replace(new RegExp(String.fromCharCode(0), 'g'), '')
    // Limit to safe characters (alphanumeric, dash, underscore)
    sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, '_')
    // Remove leading/trailing underscores
    sanitized = sanitized.replace(/^_+|_+$/g, '')

    return sanitized
  }

  /**
   * Generate SKILL.md content from input
   */
  private generateSkillMd(input: SkillCreateInput): string {
    const frontmatter: string[] = ['---']

    frontmatter.push(`name: ${input.name}`)

    if (input.description) {
      frontmatter.push(`description: ${input.description}`)
    }

    if (input.version) {
      frontmatter.push(`version: ${input.version}`)
    }

    if (input.author) {
      frontmatter.push(`author: ${input.author}`)
    }

    if (input.tags && input.tags.length > 0) {
      frontmatter.push(`tags: [${input.tags.join(', ')}]`)
    }

    if (input.tools && input.tools.length > 0) {
      frontmatter.push(`tools: [${input.tools.join(', ')}]`)
    }

    frontmatter.push('---')
    frontmatter.push('')

    return frontmatter.join('\n') + input.content
  }

  /**
   * Parse SKILL.md content to extract frontmatter and content
   */
  private parseSkillMd(content: string): SkillCreateInput {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)

    if (!frontmatterMatch) {
      return {
        name: 'Untitled',
        content: content,
        folderName: ''
      }
    }

    const frontmatterStr = frontmatterMatch[1]
    const bodyContent = frontmatterMatch[2]

    const data: SkillCreateInput = {
      name: 'Untitled',
      content: bodyContent,
      folderName: ''
    }

    // Parse frontmatter lines
    const lines = frontmatterStr.split('\n')
    for (const line of lines) {
      const colonIndex = line.indexOf(':')
      if (colonIndex === -1) continue

      const key = line.slice(0, colonIndex).trim()
      const value = line.slice(colonIndex + 1).trim()

      // Handle array values
      if (value.startsWith('[') && value.endsWith(']')) {
        const arrayContent = value.slice(1, -1)
        const items = arrayContent
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)

        switch (key) {
          case 'tags':
            data.tags = items
            break
          case 'tools':
            data.tools = items
            break
        }
      } else {
        switch (key) {
          case 'name':
            data.name = value
            break
          case 'description':
            data.description = value
            break
          case 'version':
            data.version = value
            break
          case 'author':
            data.author = value
            break
        }
      }
    }

    return data
  }
}

export const skillToolsService = SkillToolsService.getInstance()
