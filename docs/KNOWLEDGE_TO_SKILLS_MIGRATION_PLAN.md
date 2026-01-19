# Knowledge Base Removal & Skills Migration Plan

## Overview

**Goal**: Remove the Knowledge Base (RAG/vector store) feature entirely and replace with a simple prompt-based Skills system.

**What Skills Are**: Simple text prompts that teach the agent how to perform tasks. No vector storage, no embeddings, no document processing.

---

## Features to Remove

| Feature | Description |
|---------|-------------|
| Vector Store | LibSQL-based embeddings storage |
| Document Ingestion | File, URL, sitemap, directory processing |
| Semantic Search | Vector similarity search |
| Reranking | Result reranking with models |
| Processing Queue | Background document processing |
| Preprocessing | OCR/document conversion (Doc2x, MinerU, Mistral) |
| Chunking | Document chunk splitting |
| Embedding Models | Model selection for embeddings |

---

## Files to Delete

### Main Process
```
DELETE: src/main/services/KnowledgeService.ts
```

### Renderer - Types
```
DELETE: src/renderer/src/types/knowledge.ts
```

### Renderer - Store
```
DELETE: src/renderer/src/store/knowledge.ts
DELETE: src/renderer/src/store/thunk/knowledgeThunk.ts
```

### Renderer - Services
```
DELETE: src/renderer/src/services/KnowledgeService.ts
```

### Renderer - Hooks
```
DELETE: src/renderer/src/hooks/useKnowledge.ts
```

### Renderer - Queue
```
DELETE: src/renderer/src/queue/KnowledgeQueue.ts
```

### Renderer - AI Core
```
DELETE: src/renderer/src/aiCore/tools/KnowledgeSearchTool.ts
```

### Renderer - Pages
```
DELETE: src/renderer/src/pages/knowledge/  (entire directory)
  - KnowledgePage.tsx
  - components/AddKnowledgeBasePopup.tsx
  - components/KnowledgeSearchPopup.tsx
  - components/*.tsx (all)
```

### Renderer - Input Bar
```
DELETE: src/renderer/src/pages/home/Inputbar/KnowledgeBaseInput.tsx
DELETE: src/renderer/src/pages/home/Inputbar/tools/components/KnowledgeBaseButton.tsx
DELETE: src/renderer/src/pages/home/Inputbar/tools/knowledgeBaseTool.tsx
```

### Renderer - Settings
```
DELETE: src/renderer/src/pages/settings/AssistantSettings/AssistantKnowledgeBaseSettings.tsx
```

---

## Files to Modify

### IPC Channels
**File:** `packages/shared/IpcChannel.ts`
```typescript
// REMOVE these channels:
KnowledgeBase_Create
KnowledgeBase_Reset
KnowledgeBase_Delete
KnowledgeBase_Add
KnowledgeBase_Remove
KnowledgeBase_Search
KnowledgeBase_Rerank
KnowledgeBase_Check_Quota
```

### IPC Handlers
**File:** `src/main/ipc.ts`
- Remove all KnowledgeService handler registrations

### Preload
**File:** `src/preload/index.ts`
- Remove `window.api.knowledgeBase` exposure

### Database
**File:** `src/renderer/src/databases/index.ts`
- Remove `knowledge_notes` table

**File:** `src/renderer/src/databases/upgrades.ts`
- Remove knowledge-related migrations (or add cleanup migration)

### Store Index
**File:** `src/renderer/src/store/index.ts`
- Remove `knowledge` reducer import and registration

### AI Core Plugins
**File:** `src/renderer/src/aiCore/plugins/searchOrchestrationPlugin.ts`
- Remove knowledge base search logic
- Keep web search if needed, or simplify

### Assistant Type
**File:** `src/renderer/src/types/index.ts` (or types file with Assistant)
```typescript
// REMOVE from Assistant interface:
knowledge_bases?: KnowledgeBase[]
knowledgeRecognition?: 'on' | 'off'
```

### Routes
**File:** `src/renderer/src/App.tsx` (or router config)
- Remove `/knowledge` route

### Navigation
- Remove Knowledge Base from navbar/sidebar

### Input Bar
**File:** `src/renderer/src/pages/home/Inputbar/Inputbar.tsx`
- Remove KnowledgeBaseInput import and usage
- Remove knowledge base tool from tools list

### Settings
**File:** `src/renderer/src/pages/settings/AssistantSettings/index.tsx`
- Remove AssistantKnowledgeBaseSettings import and usage

---

## New Skills System (Simple Replacement)

### New Type
**Create:** `src/renderer/src/types/skill.ts`

```typescript
export interface Skill {
  id: string
  name: string
  description?: string
  prompt: string  // The instruction text
  enabled: boolean
  createdAt: number
  updatedAt: number
}
```

### New Store
**Create:** `src/renderer/src/store/skill.ts`

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Skill } from '@renderer/types/skill'

interface SkillState {
  skills: Skill[]
}

const initialState: SkillState = {
  skills: []
}

const skillSlice = createSlice({
  name: 'skill',
  initialState,
  reducers: {
    addSkill: (state, action: PayloadAction<Skill>) => {
      state.skills.push(action.payload)
    },
    updateSkill: (state, action: PayloadAction<Skill>) => {
      const index = state.skills.findIndex(s => s.id === action.payload.id)
      if (index !== -1) state.skills[index] = action.payload
    },
    deleteSkill: (state, action: PayloadAction<string>) => {
      state.skills = state.skills.filter(s => s.id !== action.payload)
    },
    reorderSkills: (state, action: PayloadAction<Skill[]>) => {
      state.skills = action.payload
    }
  }
})

export const { addSkill, updateSkill, deleteSkill, reorderSkills } = skillSlice.actions
export default skillSlice.reducer
```

### New Hook
**Create:** `src/renderer/src/hooks/useSkill.ts`

```typescript
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { addSkill, updateSkill, deleteSkill } from '@renderer/store/skill'
import { Skill } from '@renderer/types/skill'
import { uuid } from '@renderer/utils'

export function useSkills() {
  const dispatch = useAppDispatch()
  const skills = useAppSelector(state => state.skill.skills)

  const create = (data: Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>) => {
    const skill: Skill = {
      ...data,
      id: uuid(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    dispatch(addSkill(skill))
    return skill
  }

  const update = (skill: Skill) => {
    dispatch(updateSkill({ ...skill, updatedAt: Date.now() }))
  }

  const remove = (id: string) => {
    dispatch(deleteSkill(id))
  }

  return { skills, create, update, remove }
}
```

### New Page
**Create:** `src/renderer/src/pages/skills/SkillsPage.tsx`

Simple list UI with:
- List of skills (name, description preview)
- Add skill button → opens editor
- Edit/delete actions per skill
- Skill editor: name, description, prompt textarea

### New Input Bar Component
**Create:** `src/renderer/src/pages/home/Inputbar/SkillInput.tsx`

- Show selected skills as tags
- Button to open skill selector popup
- Selected skills get prepended to message as system context

### Assistant Type Update
```typescript
interface Assistant {
  skills?: string[]  // Array of skill IDs
}
```

---

## i18n Updates

### Keys to Remove (from all locale files)

Remove entire `knowledge` section and all related keys:

```
knowledge.*  (entire section)
navbar.knowledge_base
assistant.input_bar_tools.knowledge_base.*
assistant.settings.knowledge_base.*
common.knowledge_base
topicActions.knowledge.*
backup.content (update to remove knowledge base mention)
settings.data.app_knowledge.*
inputbar.clear.knowledge_base
mcp.presets.descriptions.dify_knowledge
mcp.presets.descriptions.memory (if knowledge graph related)
message.knowledge_embed
sidebar.knowledge
```

### Keys to Add

```json
{
  "skill": {
    "title": "Skills",
    "add": "Add Skill",
    "edit": "Edit Skill",
    "delete": "Delete Skill",
    "delete_confirm": "Are you sure you want to delete this skill?",
    "empty": "No skills yet",
    "name": "Name",
    "name_placeholder": "Enter skill name",
    "name_required": "Skill name is required",
    "description": "Description",
    "description_placeholder": "Brief description of what this skill does",
    "prompt": "Prompt",
    "prompt_placeholder": "Enter the instruction prompt for this skill...",
    "prompt_required": "Skill prompt is required",
    "enabled": "Enabled"
  },
  "navbar": {
    "skills": "Skills"
  },
  "assistant": {
    "input_bar_tools": {
      "skill": {
        "label": "Skills",
        "placeholder": "Select Skills"
      }
    },
    "settings": {
      "skill": {
        "label": "Skill Settings"
      }
    }
  },
  "sidebar": {
    "skills": "Skills"
  }
}
```

### Locale Files to Update
- `src/renderer/src/i18n/locales/en-us.json`
- `src/renderer/src/i18n/locales/zh-cn.json`
- `src/renderer/src/i18n/locales/zh-tw.json`
- Run `pnpm i18n:sync` after changes

---

## Migration Checklist

### Phase 1: Delete Knowledge Base Files
- [ ] Delete `src/main/services/KnowledgeService.ts`
- [ ] Delete `src/renderer/src/types/knowledge.ts`
- [ ] Delete `src/renderer/src/store/knowledge.ts`
- [ ] Delete `src/renderer/src/store/thunk/knowledgeThunk.ts`
- [ ] Delete `src/renderer/src/services/KnowledgeService.ts`
- [ ] Delete `src/renderer/src/hooks/useKnowledge.ts`
- [ ] Delete `src/renderer/src/queue/KnowledgeQueue.ts`
- [ ] Delete `src/renderer/src/aiCore/tools/KnowledgeSearchTool.ts`
- [ ] Delete `src/renderer/src/pages/knowledge/` directory
- [ ] Delete `src/renderer/src/pages/home/Inputbar/KnowledgeBaseInput.tsx`
- [ ] Delete `src/renderer/src/pages/home/Inputbar/tools/components/KnowledgeBaseButton.tsx`
- [ ] Delete `src/renderer/src/pages/home/Inputbar/tools/knowledgeBaseTool.tsx`
- [ ] Delete `src/renderer/src/pages/settings/AssistantSettings/AssistantKnowledgeBaseSettings.tsx`

### Phase 2: Clean Up References
- [ ] Remove IPC channels from `packages/shared/IpcChannel.ts`
- [ ] Remove handlers from `src/main/ipc.ts`
- [ ] Remove API exposure from `src/preload/index.ts`
- [ ] Remove `knowledge_notes` table from `src/renderer/src/databases/index.ts`
- [ ] Remove knowledge reducer from `src/renderer/src/store/index.ts`
- [ ] Remove knowledge search from `searchOrchestrationPlugin.ts`
- [ ] Remove `knowledge_bases` from Assistant type
- [ ] Remove `/knowledge` route
- [ ] Remove from navbar/sidebar
- [ ] Clean up Input Bar imports
- [ ] Clean up Settings imports

### Phase 3: Create Skills System
- [ ] Create `src/renderer/src/types/skill.ts`
- [ ] Create `src/renderer/src/store/skill.ts`
- [ ] Add skill reducer to `src/renderer/src/store/index.ts`
- [ ] Create `src/renderer/src/hooks/useSkill.ts`
- [ ] Create `src/renderer/src/pages/skills/SkillsPage.tsx`
- [ ] Create `src/renderer/src/pages/home/Inputbar/SkillInput.tsx`
- [ ] Create `src/renderer/src/pages/home/Inputbar/tools/components/SkillButton.tsx`
- [ ] Create `src/renderer/src/pages/home/Inputbar/tools/skillTool.tsx`
- [ ] Add `/skills` route
- [ ] Add Skills to navbar/sidebar
- [ ] Update Assistant type with `skills?: string[]`

### Phase 4: i18n Updates
- [ ] Remove `knowledge` keys from `en-us.json`
- [ ] Remove `knowledge` keys from `zh-cn.json`
- [ ] Remove `knowledge` keys from `zh-tw.json`
- [ ] Add `skill` keys to `en-us.json`
- [ ] Add `skill` keys to `zh-cn.json`
- [ ] Add `skill` keys to `zh-tw.json`
- [ ] Run `pnpm i18n:sync`

### Phase 5: Verification
- [ ] Run `pnpm build:check`
- [ ] Test skills page (create, edit, delete)
- [ ] Test skill selection in input bar
- [ ] Test skill injection into messages
- [ ] Verify no knowledge base references remain

---

## Data Migration for Existing Users

Existing `knowledge_bases` with notes can be converted to skills:

```typescript
// Migration helper (run once on app start)
function migrateKnowledgeToSkills(knowledgeBases: any[]): Skill[] {
  return knowledgeBases
    .flatMap(kb => kb.items.filter(item => item.type === 'note'))
    .map(note => ({
      id: uuid(),
      name: note.content.substring(0, 50) + '...',
      prompt: note.content,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }))
}
```

Note: Files, URLs, sitemaps, directories, videos will be lost (no vector storage equivalent).

---

## Notes

1. **Complete removal** - No RAG functionality preserved
2. **Simple replacement** - Skills are just text prompts stored in Redux
3. **No backend needed** - Skills don't require main process service
4. **No embeddings** - No model selection for embeddings
5. **Instant** - No processing queue, skills work immediately
