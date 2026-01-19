/**
 * Skill Manager
 *
 * Standalone skill management with local JSON file persistence.
 * No Electron, no MCP, no server required.
 *
 * Usage:
 *   const manager = await SkillManager.create('./skills.json')
 *   const skill = await manager.create({ name: 'My Skill', prompt: '...' })
 *   const skills = await manager.list()
 */
import { Mutex } from 'async-mutex'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuid } from 'uuid'

export interface Skill {
  id: string
  name: string
  description?: string
  /** Regex pattern for URL matching */
  domainPattern?: string
  /** Main instruction prompt */
  prompt: string
  /** JavaScript for DOM manipulation */
  contentScript?: string
  /** JavaScript for page behavior */
  pageScript?: string
  /** JSON string defining AI tool capabilities */
  toolSchema?: string
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export type SkillCreateInput = Omit<Skill, 'id' | 'createdAt' | 'updatedAt'> & { enabled?: boolean }
export type SkillUpdateInput = Partial<Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>>

interface SkillsData {
  skills: Skill[]
}

/**
 * SkillManager - CRUD operations for skills with file-based persistence
 */
export class SkillManager {
  private skillsPath: string
  private skills: Map<string, Skill>
  private fileMutex: Mutex

  private constructor(skillsPath: string) {
    this.skillsPath = skillsPath
    this.skills = new Map()
    this.fileMutex = new Mutex()
  }

  /**
   * Create a new SkillManager instance
   * @param skillsPath - Path to the JSON file for persistence (default: ./skills.json)
   */
  static async create(skillsPath = './skills.json'): Promise<SkillManager> {
    const resolvedPath = path.resolve(skillsPath)
    const manager = new SkillManager(resolvedPath)
    await manager.ensureFileExists()
    await manager.loadFromDisk()
    return manager
  }

  private async ensureFileExists(): Promise<void> {
    const directory = path.dirname(this.skillsPath)
    await fs.promises.mkdir(directory, { recursive: true })
    try {
      await fs.promises.access(this.skillsPath)
    } catch {
      await fs.promises.writeFile(this.skillsPath, JSON.stringify({ skills: [] }, null, 2))
    }
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const data = await fs.promises.readFile(this.skillsPath, 'utf-8')
      if (data.trim() === '') {
        this.skills = new Map()
        await this.persist()
        return
      }
      const parsed: SkillsData = JSON.parse(data)
      this.skills.clear()
      for (const skill of parsed.skills) {
        this.skills.set(skill.id, skill)
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.skills = new Map()
        await this.persist()
      } else {
        throw error
      }
    }
  }

  private async persist(): Promise<void> {
    const release = await this.fileMutex.acquire()
    try {
      const data: SkillsData = {
        skills: Array.from(this.skills.values())
      }
      await fs.promises.writeFile(this.skillsPath, JSON.stringify(data, null, 2))
    } finally {
      release()
    }
  }

  /** List all skills */
  async list(enabledOnly = false): Promise<Skill[]> {
    const skills = Array.from(this.skills.values())
    return enabledOnly ? skills.filter((s) => s.enabled) : skills
  }

  /** Get a skill by ID */
  async get(id: string): Promise<Skill | null> {
    return this.skills.get(id) || null
  }

  /** Find skills by name (partial match, case-insensitive) */
  async findByName(name: string): Promise<Skill[]> {
    const lower = name.toLowerCase()
    return Array.from(this.skills.values()).filter((s) => s.name.toLowerCase().includes(lower))
  }

  /** Find skills matching a URL by domain pattern */
  async findByUrl(url: string): Promise<Skill[]> {
    return Array.from(this.skills.values()).filter((skill) => {
      if (!skill.domainPattern || !skill.enabled) return false
      try {
        return new RegExp(skill.domainPattern, 'i').test(url)
      } catch {
        return false
      }
    })
  }

  /** Create a new skill */
  async create(input: SkillCreateInput): Promise<Skill> {
    if (input.domainPattern) {
      try {
        new RegExp(input.domainPattern)
      } catch {
        throw new Error('Invalid domain pattern regex')
      }
    }
    if (input.toolSchema) {
      try {
        JSON.parse(input.toolSchema)
      } catch {
        throw new Error('Invalid tool schema JSON')
      }
    }

    const skill: Skill = {
      id: uuid(),
      name: input.name,
      prompt: input.prompt,
      description: input.description,
      domainPattern: input.domainPattern,
      contentScript: input.contentScript,
      pageScript: input.pageScript,
      toolSchema: input.toolSchema,
      enabled: input.enabled !== false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    this.skills.set(skill.id, skill)
    await this.persist()
    return skill
  }

  /** Update an existing skill */
  async update(id: string, data: SkillUpdateInput): Promise<Skill | null> {
    const existing = this.skills.get(id)
    if (!existing) return null

    if (data.domainPattern !== undefined && data.domainPattern) {
      try {
        new RegExp(data.domainPattern)
      } catch {
        throw new Error('Invalid domain pattern regex')
      }
    }
    if (data.toolSchema !== undefined && data.toolSchema) {
      try {
        JSON.parse(data.toolSchema)
      } catch {
        throw new Error('Invalid tool schema JSON')
      }
    }

    const updated: Skill = {
      ...existing,
      ...data,
      updatedAt: Date.now()
    }

    this.skills.set(id, updated)
    await this.persist()
    return updated
  }

  /** Delete a skill by ID */
  async delete(id: string): Promise<boolean> {
    if (!this.skills.has(id)) return false
    this.skills.delete(id)
    await this.persist()
    return true
  }

  /** Enable a skill */
  async enable(id: string): Promise<Skill | null> {
    return this.update(id, { enabled: true })
  }

  /** Disable a skill */
  async disable(id: string): Promise<Skill | null> {
    return this.update(id, { enabled: false })
  }

  /** Get the file path being used for persistence */
  getPath(): string {
    return this.skillsPath
  }

  /** Reload skills from disk */
  async reload(): Promise<void> {
    await this.loadFromDisk()
  }
}

export default SkillManager
