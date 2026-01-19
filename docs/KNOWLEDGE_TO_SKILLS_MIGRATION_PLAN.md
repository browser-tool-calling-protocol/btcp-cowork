# Knowledge Base → Skills Migration Plan

## Overview

**Goal**: Rename "Knowledge Base" to "Skills" throughout the codebase with minimal changes. This is a terminology shift, not a feature change.

**Principle**: A Skill is essentially a prompt that teaches the agent how to do something. The existing "note" type in Knowledge Base maps directly to this concept.

---

## Terminology Mapping

| Current Term | New Term |
|--------------|----------|
| Knowledge Base | Skill |
| Knowledge Item | Skill Item |
| knowledge_bases | skills |
| knowledgeBase | skill |
| KnowledgeBase | Skill |

---

## File Renames

### Types
| From | To |
|------|-----|
| `src/renderer/src/types/knowledge.ts` | `src/renderer/src/types/skill.ts` |

**Type renames inside file:**
- `KnowledgeItem` → `SkillItem`
- `KnowledgeBase` → `Skill`
- `KnowledgeItemType` → `SkillItemType`
- `KnowledgeBaseSearchResult` → `SkillSearchResult`
- `KnowledgeReference` → `SkillReference`

### Store
| From | To |
|------|-----|
| `src/renderer/src/store/knowledge.ts` | `src/renderer/src/store/skill.ts` |
| `src/renderer/src/store/thunk/knowledgeThunk.ts` | `src/renderer/src/store/thunk/skillThunk.ts` |

**Slice rename:** `knowledge` → `skill`

### Services
| From | To |
|------|-----|
| `src/main/services/KnowledgeService.ts` | `src/main/services/SkillService.ts` |
| `src/renderer/src/services/KnowledgeService.ts` | `src/renderer/src/services/SkillService.ts` |

### Hooks
| From | To |
|------|-----|
| `src/renderer/src/hooks/useKnowledge.ts` | `src/renderer/src/hooks/useSkill.ts` |

**Hook renames:**
- `useKnowledge` → `useSkill`
- `useKnowledgeBases` → `useSkills`

### Queue
| From | To |
|------|-----|
| `src/renderer/src/queue/KnowledgeQueue.ts` | `src/renderer/src/queue/SkillQueue.ts` |

### AI Core
| From | To |
|------|-----|
| `src/renderer/src/aiCore/tools/KnowledgeSearchTool.ts` | `src/renderer/src/aiCore/tools/SkillSearchTool.ts` |

### Pages
| From | To |
|------|-----|
| `src/renderer/src/pages/knowledge/` | `src/renderer/src/pages/skills/` |
| `src/renderer/src/pages/knowledge/KnowledgePage.tsx` | `src/renderer/src/pages/skills/SkillsPage.tsx` |
| `src/renderer/src/pages/knowledge/components/AddKnowledgeBasePopup.tsx` | `src/renderer/src/pages/skills/components/AddSkillPopup.tsx` |
| `src/renderer/src/pages/knowledge/components/KnowledgeSearchPopup.tsx` | `src/renderer/src/pages/skills/components/SkillSearchPopup.tsx` |

### Input Bar Components
| From | To |
|------|-----|
| `src/renderer/src/pages/home/Inputbar/KnowledgeBaseInput.tsx` | `src/renderer/src/pages/home/Inputbar/SkillInput.tsx` |
| `src/renderer/src/pages/home/Inputbar/tools/components/KnowledgeBaseButton.tsx` | `src/renderer/src/pages/home/Inputbar/tools/components/SkillButton.tsx` |
| `src/renderer/src/pages/home/Inputbar/tools/knowledgeBaseTool.tsx` | `src/renderer/src/pages/home/Inputbar/tools/skillTool.tsx` |

### Settings
| From | To |
|------|-----|
| `src/renderer/src/pages/settings/AssistantSettings/AssistantKnowledgeBaseSettings.tsx` | `src/renderer/src/pages/settings/AssistantSettings/AssistantSkillSettings.tsx` |

---

## IPC Channel Renames

**File:** `packages/shared/IpcChannel.ts`

| From | To |
|------|-----|
| `KnowledgeBase_Create` | `Skill_Create` |
| `KnowledgeBase_Reset` | `Skill_Reset` |
| `KnowledgeBase_Delete` | `Skill_Delete` |
| `KnowledgeBase_Add` | `Skill_Add` |
| `KnowledgeBase_Remove` | `Skill_Remove` |
| `KnowledgeBase_Search` | `Skill_Search` |
| `KnowledgeBase_Rerank` | `Skill_Rerank` |
| `KnowledgeBase_Check_Quota` | `Skill_Check_Quota` |

**File:** `src/main/ipc.ts` - Update handler registrations

**File:** `src/preload/index.ts` - Update API exposure
- `window.api.knowledgeBase` → `window.api.skill`

---

## Database Schema

**File:** `src/renderer/src/databases/index.ts`

| From | To |
|------|-----|
| `knowledge_notes` table | `skill_notes` table |

**Migration:** Add Dexie upgrade to rename table (or keep old name for compatibility)

---

## i18n Updates

**Files to update:**
- `src/renderer/src/i18n/locales/en-us.json`
- `src/renderer/src/i18n/locales/zh-cn.json`
- `src/renderer/src/i18n/locales/zh-tw.json`

### English (en-us.json) Key Changes

```json
{
  "navbar": {
    "knowledge_base": "Skills"  // was "Knowledge Base"
  },
  "assistant": {
    "input_bar_tools": {
      "knowledge_base": {
        "label": "Skills",  // was "Knowledge Base"
        "placeholder": "Select Skill"  // was "Select Knowledge Base"
      }
    },
    "settings": {
      "knowledge_base": {
        "label": "Skill Settings",  // was "Knowledge Base Settings"
        "enable": {
          "label": "Use Skills",  // was "Use Knowledge Base"
          "tip": "The assistant will use the large model's intent recognition capability to determine whether to use skills for answering."
        }
      }
    }
  },
  "knowledge": {  // Rename entire section to "skill"
    "add": {
      "title": "Add Skill"  // was "Add Knowledge Base"
    },
    "delete_confirm": "Are you sure you want to delete this skill?",
    "embedding_model_required": "Skill Embedding Model is required",
    "empty": "No skills found",
    "errors": {
      "failed_to_create": "Skill creation failed",
      "failed_to_edit": "Skill editing failed"
    },
    "name_required": "Skill Name is required",
    "no_bases": "No skills available",
    "no_match": "No matching content found in the skill.",
    "search": "Search skill",
    "title": "Skills",
    // ... rest of knowledge section renamed
  },
  "common": {
    "knowledge_base": "Skill"  // was "Knowledge Base"
  },
  "topicActions": {
    "knowledge": {
      "success": "Topic successfully saved to skill ({{count}} items)"
    }
  }
}
```

### Full i18n Key Mapping

| Old Key Path | New Key Path |
|--------------|--------------|
| `knowledge` | `skill` |
| `knowledge.title` | `skill.title` ("Skills") |
| `knowledge.add.title` | `skill.add.title` ("Add Skill") |
| `knowledge.delete_confirm` | `skill.delete_confirm` |
| `knowledge.embedding_model_required` | `skill.embedding_model_required` |
| `knowledge.empty` | `skill.empty` ("No skills found") |
| `knowledge.name_required` | `skill.name_required` |
| `knowledge.no_bases` | `skill.no_bases` ("No skills available") |
| `knowledge.search` | `skill.search` ("Search skill") |
| `knowledge.settings.title` | `skill.settings.title` ("Skill Settings") |
| `navbar.knowledge_base` | `navbar.skills` |
| `assistant.input_bar_tools.knowledge_base` | `assistant.input_bar_tools.skill` |
| `assistant.settings.knowledge_base` | `assistant.settings.skill` |
| `common.knowledge_base` | `common.skill` |

### Values to Change (Search/Replace in JSON)

| Old Value | New Value |
|-----------|-----------|
| "Knowledge Base" | "Skill" |
| "Knowledge Bases" | "Skills" |
| "knowledge base" | "skill" |
| "knowledge bases" | "skills" |
| "no knowledge base" | "no skill" |
| "knowledge_base" (in keys) | "skill" |

---

## Assistant Type Update

**File:** `src/renderer/src/types/index.ts` (or wherever Assistant type is defined)

```typescript
interface Assistant {
  // Rename property
  skills?: Skill[]  // was knowledge_bases?: KnowledgeBase[]
  skillRecognition?: 'on' | 'off'  // was knowledgeRecognition
}
```

---

## Import Path Updates

All files importing from knowledge-related paths need updates:

```typescript
// Before
import { KnowledgeBase } from '@renderer/types/knowledge'
import { useKnowledge } from '@renderer/hooks/useKnowledge'
import { KnowledgeService } from '@renderer/services/KnowledgeService'

// After
import { Skill } from '@renderer/types/skill'
import { useSkill } from '@renderer/hooks/useSkill'
import { SkillService } from '@renderer/services/SkillService'
```

---

## Files Requiring Import Updates

Search for imports containing "knowledge" (case-insensitive):

```bash
grep -r "from.*knowledge" src/
grep -r "import.*Knowledge" src/
```

Expected files needing updates:
- `src/renderer/src/store/index.ts`
- `src/renderer/src/App.tsx` (routes)
- `src/renderer/src/pages/home/Inputbar/Inputbar.tsx`
- `src/renderer/src/pages/settings/AssistantSettings/index.tsx`
- `src/renderer/src/aiCore/plugins/searchOrchestrationPlugin.ts`
- Any file using `useKnowledge` or `useKnowledgeBases` hooks

---

## Redux Store Update

**File:** `src/renderer/src/store/index.ts`

```typescript
// Before
import knowledge from './knowledge'

// After
import skill from './skill'

const rootReducer = {
  // ...
  skill,  // was knowledge
}
```

**Selector updates throughout codebase:**
```typescript
// Before
state.knowledge.bases

// After
state.skill.skills  // or state.skill.bases if keeping internal structure
```

---

## Route Updates

**File:** `src/renderer/src/App.tsx` (or router config)

```typescript
// Before
{ path: '/knowledge', element: <KnowledgePage /> }

// After
{ path: '/skills', element: <SkillsPage /> }
```

---

## Migration Checklist

### Phase 1: Type & Store Renames
- [ ] Rename `src/renderer/src/types/knowledge.ts` → `skill.ts`
- [ ] Update type names inside file
- [ ] Rename `src/renderer/src/store/knowledge.ts` → `skill.ts`
- [ ] Update slice name and action names
- [ ] Rename `src/renderer/src/store/thunk/knowledgeThunk.ts` → `skillThunk.ts`
- [ ] Update `src/renderer/src/store/index.ts` imports

### Phase 2: Service Renames
- [ ] Rename `src/main/services/KnowledgeService.ts` → `SkillService.ts`
- [ ] Rename `src/renderer/src/services/KnowledgeService.ts` → `SkillService.ts`
- [ ] Update class/function names inside

### Phase 3: Hook Renames
- [ ] Rename `src/renderer/src/hooks/useKnowledge.ts` → `useSkill.ts`
- [ ] Update hook names: `useKnowledge` → `useSkill`, `useKnowledgeBases` → `useSkills`

### Phase 4: Queue Rename
- [ ] Rename `src/renderer/src/queue/KnowledgeQueue.ts` → `SkillQueue.ts`

### Phase 5: AI Core Rename
- [ ] Rename `src/renderer/src/aiCore/tools/KnowledgeSearchTool.ts` → `SkillSearchTool.ts`
- [ ] Update `searchOrchestrationPlugin.ts` references

### Phase 6: Page Renames
- [ ] Rename `src/renderer/src/pages/knowledge/` → `skills/`
- [ ] Rename all component files inside
- [ ] Update component names

### Phase 7: Input Bar Component Renames
- [ ] Rename `KnowledgeBaseInput.tsx` → `SkillInput.tsx`
- [ ] Rename `KnowledgeBaseButton.tsx` → `SkillButton.tsx`
- [ ] Rename `knowledgeBaseTool.tsx` → `skillTool.tsx`
- [ ] Update `Inputbar.tsx` imports

### Phase 8: Settings Component Rename
- [ ] Rename `AssistantKnowledgeBaseSettings.tsx` → `AssistantSkillSettings.tsx`

### Phase 9: IPC Updates
- [ ] Update `packages/shared/IpcChannel.ts` channel names
- [ ] Update `src/main/ipc.ts` handler registrations
- [ ] Update `src/preload/index.ts` API exposure

### Phase 10: Database
- [ ] Update `src/renderer/src/databases/index.ts` table name
- [ ] Add migration in `upgrades.ts` if needed

### Phase 11: i18n
- [ ] Update `en-us.json` - rename `knowledge` section to `skill`
- [ ] Update all "Knowledge Base" strings to "Skill"
- [ ] Update `zh-cn.json` - same changes with Chinese translations
- [ ] Update `zh-tw.json` - same changes with Traditional Chinese
- [ ] Run `pnpm i18n:sync` to sync other locales

### Phase 12: Import Path Updates
- [ ] Find all files importing from old paths
- [ ] Update import statements
- [ ] Update any hardcoded "knowledge" strings in code

### Phase 13: Route & Navigation
- [ ] Update route from `/knowledge` to `/skills`
- [ ] Update navigation links/buttons

### Phase 14: Assistant Type
- [ ] Rename `knowledge_bases` → `skills` property
- [ ] Rename `knowledgeRecognition` → `skillRecognition`
- [ ] Update all usages

### Phase 15: Verification
- [ ] Run `pnpm build:check` (lint + test + typecheck)
- [ ] Manual testing of skills page
- [ ] Test skill selection in input bar
- [ ] Test assistant skill settings

---

## Search Patterns for Global Replace

Use these patterns to find all occurrences:

```bash
# Find all knowledge-related code
rg -i "knowledge" --type ts --type tsx
rg "KnowledgeBase" --type ts --type tsx
rg "knowledge_base" --type ts --type tsx

# Find i18n usages
rg "t\(['\"].*knowledge" --type ts --type tsx
rg "knowledge" src/renderer/src/i18n/
```

---

## Notes

1. **No new features** - This is purely a rename operation
2. **Preserve all existing functionality** - RAG, search, notes, files, etc. all stay the same
3. **Database compatibility** - Consider keeping old table name internally with alias, or add proper migration
4. **Backwards compatibility** - May need to handle old `knowledge_bases` property in Assistant for existing user data
