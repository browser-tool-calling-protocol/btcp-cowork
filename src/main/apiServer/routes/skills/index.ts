import { Router } from 'express'

import { createSkill, deleteSkill, installSkill, listSkills, readSkill, uninstallSkill, updateSkill } from './handlers'

const router = Router()

/**
 * Skills API Routes
 *
 * GET    /v1/skills              - List all available and installed skills
 * POST   /v1/skills              - Create a new skill
 * GET    /v1/skills/:folderName  - Read a specific skill
 * PATCH  /v1/skills/:folderName  - Update a specific skill
 * DELETE /v1/skills/:folderName  - Delete a specific skill
 * POST   /v1/skills/:folderName/install   - Install skill to an agent
 * POST   /v1/skills/:folderName/uninstall - Uninstall skill from an agent
 */

// List all skills
router.get('/', listSkills)

// Create a new skill
router.post('/', createSkill)

// Read a specific skill
router.get('/:folderName', readSkill)

// Update a skill
router.patch('/:folderName', updateSkill)

// Delete a skill
router.delete('/:folderName', deleteSkill)

// Install skill to an agent
router.post('/:folderName/install', installSkill)

// Uninstall skill from an agent
router.post('/:folderName/uninstall', uninstallSkill)

export const skillsRoutes = router
