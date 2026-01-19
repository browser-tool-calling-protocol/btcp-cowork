import { loggerService } from '@logger'
import { skillToolsService } from '@main/services/agents/services/SkillToolsService'
import type { Request, Response } from 'express'

const logger = loggerService.withContext('ApiServerSkillsHandlers')

/**
 * @swagger
 * /v1/skills:
 *   get:
 *     summary: List all skills
 *     description: Lists all available skills and optionally installed skills for an agent
 *     tags: [Skills]
 *     parameters:
 *       - in: query
 *         name: agentId
 *         schema:
 *           type: string
 *         description: Optional agent ID to include installed skills
 *     responses:
 *       200:
 *         description: List of skills
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PluginMetadata'
 *                 installed:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PluginMetadata'
 *       500:
 *         description: Internal server error
 */
export const listSkills = async (req: Request, res: Response): Promise<Response> => {
  try {
    const agentId = req.query.agentId as string | undefined
    logger.debug('Listing skills', { agentId })

    const result = await skillToolsService.listSkills(agentId)

    logger.info('Skills listed', {
      availableCount: result.available.length,
      installedCount: result.installed.length
    })

    return res.json(result)
  } catch (error: any) {
    logger.error('Error listing skills', { error })
    return res.status(500).json({
      error: {
        message: `Failed to list skills: ${error.message}`,
        type: 'internal_error',
        code: 'skills_list_failed'
      }
    })
  }
}

/**
 * @swagger
 * /v1/skills/{folderName}:
 *   get:
 *     summary: Read a skill
 *     description: Reads the full content and metadata of a skill
 *     tags: [Skills]
 *     parameters:
 *       - in: path
 *         name: folderName
 *         required: true
 *         schema:
 *           type: string
 *         description: The folder name of the skill
 *     responses:
 *       200:
 *         description: Skill content and metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 metadata:
 *                   $ref: '#/components/schemas/PluginMetadata'
 *                 content:
 *                   type: string
 *       404:
 *         description: Skill not found
 *       500:
 *         description: Internal server error
 */
export const readSkill = async (req: Request, res: Response): Promise<Response> => {
  try {
    const folderName = req.params.folderName as string
    logger.debug('Reading skill', { folderName })

    const result = await skillToolsService.readSkill(folderName)

    logger.info('Skill read', { folderName })
    return res.json(result)
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      logger.warn('Skill not found', { folderName: req.params.folderName })
      return res.status(404).json({
        error: {
          message: error.message,
          type: 'not_found',
          code: 'skill_not_found'
        }
      })
    }

    logger.error('Error reading skill', { error, folderName: req.params.folderName })
    return res.status(500).json({
      error: {
        message: `Failed to read skill: ${error.message}`,
        type: 'internal_error',
        code: 'skill_read_failed'
      }
    })
  }
}

/**
 * @swagger
 * /v1/skills:
 *   post:
 *     summary: Create a new skill
 *     description: Creates a new skill with the specified configuration
 *     tags: [Skills]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - folderName
 *               - content
 *             properties:
 *               name:
 *                 type: string
 *                 description: Display name of the skill
 *               description:
 *                 type: string
 *                 description: Description of the skill
 *               version:
 *                 type: string
 *                 description: Version string (e.g., "1.0.0")
 *               author:
 *                 type: string
 *                 description: Author name
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Tags for categorization
 *               tools:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Tool IDs this skill uses
 *               content:
 *                 type: string
 *                 description: Main content/instructions in markdown
 *               folderName:
 *                 type: string
 *                 description: Folder name for the skill
 *     responses:
 *       201:
 *         description: Skill created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PluginMetadata'
 *       400:
 *         description: Validation error
 *       409:
 *         description: Skill already exists
 *       500:
 *         description: Internal server error
 */
export const createSkill = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, description, version, author, tags, tools, content, folderName } = req.body

    if (!name || !folderName || !content) {
      return res.status(400).json({
        error: {
          message: 'Missing required fields: name, folderName, and content are required',
          type: 'validation_error',
          code: 'missing_required_fields'
        }
      })
    }

    logger.debug('Creating skill', { name, folderName })

    const metadata = await skillToolsService.createSkill({
      name,
      description,
      version,
      author,
      tags,
      tools,
      content,
      folderName
    })

    logger.info('Skill created', { folderName })
    return res.status(201).json(metadata)
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      logger.warn('Skill already exists', { folderName: req.body.folderName })
      return res.status(409).json({
        error: {
          message: error.message,
          type: 'conflict',
          code: 'skill_exists'
        }
      })
    }

    logger.error('Error creating skill', { error })
    return res.status(500).json({
      error: {
        message: `Failed to create skill: ${error.message}`,
        type: 'internal_error',
        code: 'skill_create_failed'
      }
    })
  }
}

/**
 * @swagger
 * /v1/skills/{folderName}:
 *   patch:
 *     summary: Update a skill
 *     description: Updates an existing skill with the provided fields
 *     tags: [Skills]
 *     parameters:
 *       - in: path
 *         name: folderName
 *         required: true
 *         schema:
 *           type: string
 *         description: The folder name of the skill
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               version:
 *                 type: string
 *               author:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               tools:
 *                 type: array
 *                 items:
 *                   type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Skill updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PluginMetadata'
 *       404:
 *         description: Skill not found
 *       500:
 *         description: Internal server error
 */
export const updateSkill = async (req: Request, res: Response): Promise<Response> => {
  try {
    const folderName = req.params.folderName as string
    const { name, description, version, author, tags, tools, content } = req.body

    logger.debug('Updating skill', { folderName })

    const metadata = await skillToolsService.updateSkill(folderName, {
      name,
      description,
      version,
      author,
      tags,
      tools,
      content
    })

    logger.info('Skill updated', { folderName })
    return res.json(metadata)
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      logger.warn('Skill not found for update', { folderName: req.params.folderName })
      return res.status(404).json({
        error: {
          message: error.message,
          type: 'not_found',
          code: 'skill_not_found'
        }
      })
    }

    logger.error('Error updating skill', { error, folderName: req.params.folderName })
    return res.status(500).json({
      error: {
        message: `Failed to update skill: ${error.message}`,
        type: 'internal_error',
        code: 'skill_update_failed'
      }
    })
  }
}

/**
 * @swagger
 * /v1/skills/{folderName}:
 *   delete:
 *     summary: Delete a skill
 *     description: Deletes a skill and its folder
 *     tags: [Skills]
 *     parameters:
 *       - in: path
 *         name: folderName
 *         required: true
 *         schema:
 *           type: string
 *         description: The folder name of the skill
 *     responses:
 *       204:
 *         description: Skill deleted successfully
 *       404:
 *         description: Skill not found
 *       500:
 *         description: Internal server error
 */
export const deleteSkill = async (req: Request, res: Response): Promise<Response> => {
  try {
    const folderName = req.params.folderName as string
    logger.debug('Deleting skill', { folderName })

    await skillToolsService.deleteSkill(folderName)

    logger.info('Skill deleted', { folderName })
    return res.status(204).send()
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      logger.warn('Skill not found for deletion', { folderName: req.params.folderName })
      return res.status(404).json({
        error: {
          message: error.message,
          type: 'not_found',
          code: 'skill_not_found'
        }
      })
    }

    logger.error('Error deleting skill', { error, folderName: req.params.folderName })
    return res.status(500).json({
      error: {
        message: `Failed to delete skill: ${error.message}`,
        type: 'internal_error',
        code: 'skill_delete_failed'
      }
    })
  }
}

/**
 * @swagger
 * /v1/skills/{folderName}/install:
 *   post:
 *     summary: Install a skill to an agent
 *     description: Installs a skill to an agent's workspace
 *     tags: [Skills]
 *     parameters:
 *       - in: path
 *         name: folderName
 *         required: true
 *         schema:
 *           type: string
 *         description: The folder name of the skill
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agentId
 *             properties:
 *               agentId:
 *                 type: string
 *                 description: The ID of the agent to install the skill to
 *     responses:
 *       200:
 *         description: Skill installed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PluginMetadata'
 *       400:
 *         description: Missing agent ID
 *       404:
 *         description: Skill or agent not found
 *       500:
 *         description: Internal server error
 */
export const installSkill = async (req: Request, res: Response): Promise<Response> => {
  try {
    const folderName = req.params.folderName as string
    const { agentId } = req.body

    if (!agentId) {
      return res.status(400).json({
        error: {
          message: 'Missing required field: agentId',
          type: 'validation_error',
          code: 'missing_agent_id'
        }
      })
    }

    logger.debug('Installing skill', { folderName, agentId })

    const sourcePath = `skills/${folderName}`
    const metadata = await skillToolsService.installSkill(agentId, sourcePath)

    logger.info('Skill installed', { folderName, agentId })
    return res.json(metadata)
  } catch (error: any) {
    if (error.message?.includes('not found') || error.type === 'FILE_NOT_FOUND') {
      logger.warn('Skill or agent not found for installation', {
        folderName: req.params.folderName,
        agentId: req.body.agentId
      })
      return res.status(404).json({
        error: {
          message: error.message || 'Skill or agent not found',
          type: 'not_found',
          code: 'not_found'
        }
      })
    }

    logger.error('Error installing skill', { error, folderName: req.params.folderName })
    return res.status(500).json({
      error: {
        message: `Failed to install skill: ${error.message}`,
        type: 'internal_error',
        code: 'skill_install_failed'
      }
    })
  }
}

/**
 * @swagger
 * /v1/skills/{folderName}/uninstall:
 *   post:
 *     summary: Uninstall a skill from an agent
 *     description: Uninstalls a skill from an agent's workspace
 *     tags: [Skills]
 *     parameters:
 *       - in: path
 *         name: folderName
 *         required: true
 *         schema:
 *           type: string
 *         description: The folder name of the skill
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agentId
 *             properties:
 *               agentId:
 *                 type: string
 *                 description: The ID of the agent to uninstall the skill from
 *     responses:
 *       204:
 *         description: Skill uninstalled successfully
 *       400:
 *         description: Missing agent ID
 *       404:
 *         description: Skill or agent not found
 *       500:
 *         description: Internal server error
 */
export const uninstallSkill = async (req: Request, res: Response): Promise<Response> => {
  try {
    const folderName = req.params.folderName as string
    const { agentId } = req.body

    if (!agentId) {
      return res.status(400).json({
        error: {
          message: 'Missing required field: agentId',
          type: 'validation_error',
          code: 'missing_agent_id'
        }
      })
    }

    logger.debug('Uninstalling skill', { folderName, agentId })

    await skillToolsService.uninstallSkill(agentId, folderName)

    logger.info('Skill uninstalled', { folderName, agentId })
    return res.status(204).send()
  } catch (error: any) {
    if (error.message?.includes('not found') || error.type === 'PLUGIN_NOT_INSTALLED') {
      logger.warn('Skill or agent not found for uninstallation', {
        folderName: req.params.folderName,
        agentId: req.body.agentId
      })
      return res.status(404).json({
        error: {
          message: error.message || 'Skill or agent not found',
          type: 'not_found',
          code: 'not_found'
        }
      })
    }

    logger.error('Error uninstalling skill', { error, folderName: req.params.folderName })
    return res.status(500).json({
      error: {
        message: `Failed to uninstall skill: ${error.message}`,
        type: 'internal_error',
        code: 'skill_uninstall_failed'
      }
    })
  }
}
