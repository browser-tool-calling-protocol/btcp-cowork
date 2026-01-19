# Knowledge Base → Skills Migration Plan

## Executive Summary

Migrate the current "Knowledge Base" feature to a simplified "Skills" system. Skills are essentially prompts/instructions that teach the AI agent how to perform specific tasks, similar to Claude Code's skill system.

---

## Current State Analysis

### What Knowledge Base Is Today

The current implementation is a **full RAG (Retrieval-Augmented Generation) system**:

| Feature | Description |
|---------|-------------|
| Vector Storage | LibSQL-based vector database with embeddings |
| Multi-source Ingestion | Files, URLs, sitemaps, directories, notes, videos |
| Semantic Search | Vector similarity search with optional reranking |
| Processing Queue | Background processing with retry logic |
| Preprocessing | OCR/document conversion (Doc2x, MinerU, Mistral) |
| Chunking | Configurable chunk size and overlap |

### Key Files Affected

```
src/
├── main/services/KnowledgeService.ts          # Backend RAG service
├── renderer/
│   ├── src/types/knowledge.ts                 # Type definitions
│   ├── src/store/knowledge.ts                 # Redux state
│   ├── src/store/thunk/knowledgeThunk.ts      # Async actions
│   ├── src/services/KnowledgeService.ts       # Frontend service
│   ├── src/hooks/useKnowledge.ts              # React hooks
│   ├── src/queue/KnowledgeQueue.ts            # Processing queue
│   ├── src/databases/index.ts                 # Dexie schema
│   ├── src/aiCore/tools/KnowledgeSearchTool.ts
│   ├── src/aiCore/plugins/searchOrchestrationPlugin.ts
│   └── src/pages/
│       ├── knowledge/                         # Management UI
│       ├── home/Inputbar/KnowledgeBaseInput.tsx
│       ├── home/Inputbar/tools/components/KnowledgeBaseButton.tsx
│       └── settings/AssistantSettings/AssistantKnowledgeBaseSettings.tsx
packages/
└── shared/IpcChannel.ts                       # IPC definitions
```

---

## Target State: Skills System

### What Skills Should Be

Skills are **prompt-based instructions** that teach the AI how to perform specific tasks:

```typescript
interface Skill {
  id: string
  name: string
  description: string

  // Core: The instruction prompt
  prompt: string

  // Optional: Variables/placeholders in the prompt
  variables?: SkillVariable[]

  // Categorization
  category?: string
  tags?: string[]

  // Metadata
  createdAt: number
  updatedAt: number

  // Optional: Trigger patterns (auto-activate skill)
  triggers?: string[]

  // Optional: Icon for UI
  icon?: string
}

interface SkillVariable {
  name: string
  description: string
  required: boolean
  defaultValue?: string
}
```

### Example Skills

```typescript
// Code Review Skill
{
  id: 'code-review',
  name: 'Code Review',
  description: 'Review code for quality, bugs, and best practices',
  prompt: `You are a senior code reviewer. When reviewing code:
1. Check for bugs and edge cases
2. Evaluate code quality and readability
3. Suggest improvements and best practices
4. Consider performance implications
5. Verify error handling

{{additional_context}}

Review the following code:`,
  variables: [
    { name: 'additional_context', description: 'Additional review criteria', required: false }
  ],
  category: 'Development',
  triggers: ['review', 'code review']
}

// Writing Assistant Skill
{
  id: 'writing-assistant',
  name: 'Writing Assistant',
  description: 'Help improve writing clarity and style',
  prompt: `You are a professional editor. Help improve the writing by:
- Enhancing clarity and conciseness
- Fixing grammar and punctuation
- Improving flow and structure
- Maintaining the original voice and intent

Tone: {{tone}}`,
  variables: [
    { name: 'tone', description: 'Desired tone (formal, casual, technical)', required: true, defaultValue: 'professional' }
  ],
  category: 'Writing'
}
```

---

## Migration Strategy

### Option A: Clean Replacement (Recommended)

Completely replace Knowledge Base with Skills. This is simpler and aligns with the "skills are prompts" philosophy.

**Pros:**
- Simpler codebase
- Clear conceptual model
- Easier maintenance
- Lower complexity for users

**Cons:**
- Loses RAG capabilities
- Users with existing knowledge bases need migration path

### Option B: Parallel Systems

Keep Knowledge Base for RAG, add Skills as a separate feature.

**Pros:**
- Preserves existing functionality
- Gradual migration possible

**Cons:**
- Increased complexity
- Confusing UX with two similar features
- More code to maintain

### Option C: Unified Model

Rename Knowledge Base to Skills but keep dual modes: "Document Skills" (RAG) and "Prompt Skills".

**Pros:**
- Best of both worlds
- Single UI paradigm

**Cons:**
- Most complex implementation
- Potential user confusion

---

## Recommended Implementation Plan (Option A)

### Phase 1: Data Model & Types

**Create:** `src/renderer/src/types/skill.ts`

```typescript
export interface Skill {
  id: string
  name: string
  description: string
  prompt: string
  variables?: SkillVariable[]
  category?: string
  tags?: string[]
  icon?: string
  triggers?: string[]
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface SkillVariable {
  name: string
  description: string
  required: boolean
  defaultValue?: string
  type: 'text' | 'select' | 'number'
  options?: string[]  // For select type
}

export interface SkillExecution {
  skillId: string
  variables: Record<string, string>
  timestamp: number
}
```

**Modify:** Assistant type to reference skills

```typescript
// In types.ts
interface Assistant {
  // Remove: knowledge_bases?: KnowledgeBase[]
  // Remove: knowledgeRecognition?: 'on' | 'off'

  // Add:
  skills?: string[]  // Skill IDs
  skillAutoTrigger?: boolean  // Auto-detect and activate skills
}
```

### Phase 2: State Management

**Create:** `src/renderer/src/store/skill.ts`

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Skill } from '@renderer/types/skill'

interface SkillState {
  skills: Skill[]
  categories: string[]
}

const initialState: SkillState = {
  skills: [],
  categories: ['General', 'Development', 'Writing', 'Analysis']
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
      if (index !== -1) {
        state.skills[index] = action.payload
      }
    },
    deleteSkill: (state, action: PayloadAction<string>) => {
      state.skills = state.skills.filter(s => s.id !== action.payload)
    },
    duplicateSkill: (state, action: PayloadAction<string>) => {
      const skill = state.skills.find(s => s.id === action.payload)
      if (skill) {
        state.skills.push({
          ...skill,
          id: uuid(),
          name: `${skill.name} (Copy)`,
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
      }
    },
    importSkills: (state, action: PayloadAction<Skill[]>) => {
      state.skills.push(...action.payload)
    },
    reorderSkills: (state, action: PayloadAction<string[]>) => {
      state.skills.sort((a, b) =>
        action.payload.indexOf(a.id) - action.payload.indexOf(b.id)
      )
    }
  }
})
```

### Phase 3: UI Components

#### 3.1 Skills Management Page

**Create:** `src/renderer/src/pages/skills/`

```
skills/
├── SkillsPage.tsx           # Main page with skill list
├── components/
│   ├── SkillCard.tsx        # Skill preview card
│   ├── SkillEditor.tsx      # Create/edit skill form
│   ├── SkillPromptEditor.tsx # Rich prompt editor with variable insertion
│   ├── SkillVariableEditor.tsx # Variable definition UI
│   ├── SkillImportExport.tsx # Import/export functionality
│   └── SkillCategoryFilter.tsx # Category filtering
└── hooks/
    └── useSkill.ts          # Skill operations hook
```

#### 3.2 Input Bar Integration

**Modify:** `src/renderer/src/pages/home/Inputbar/`

```
Inputbar/
├── SkillInput.tsx           # Skill tags in input (replaces KnowledgeBaseInput)
└── tools/
    └── components/
        └── SkillButton.tsx  # Skill selection button (replaces KnowledgeBaseButton)
```

**SkillButton behavior:**
- Quick panel showing available skills
- Filter by category
- Search skills by name/description
- One-click to add skill to current message
- Show skill prompt preview on hover

#### 3.3 Assistant Settings

**Modify:** `src/renderer/src/pages/settings/AssistantSettings/`

```typescript
// AssistantSkillSettings.tsx (replaces AssistantKnowledgeBaseSettings)
// - Select default skills for assistant
// - Toggle auto-trigger mode
// - Reorder skill priority
```

### Phase 4: Skill Execution Service

**Create:** `src/renderer/src/services/SkillService.ts`

```typescript
export class SkillService {
  /**
   * Inject skill prompt into user message
   */
  static injectSkillPrompt(
    message: string,
    skill: Skill,
    variables: Record<string, string>
  ): string {
    let prompt = skill.prompt

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), value)
    }

    // Remove unfilled optional variables
    prompt = prompt.replace(/\{\{[^}]+\}\}/g, '')

    return `${prompt}\n\n${message}`
  }

  /**
   * Detect if message matches any skill triggers
   */
  static detectSkillTriggers(
    message: string,
    skills: Skill[]
  ): Skill[] {
    return skills.filter(skill =>
      skill.enabled &&
      skill.triggers?.some(trigger =>
        message.toLowerCase().includes(trigger.toLowerCase())
      )
    )
  }

  /**
   * Extract required variables from skill prompt
   */
  static extractVariables(skill: Skill): SkillVariable[] {
    return skill.variables?.filter(v => v.required) ?? []
  }
}
```

### Phase 5: AI Core Integration

**Modify:** `src/renderer/src/aiCore/plugins/`

```typescript
// skillInjectionPlugin.ts (replaces searchOrchestrationPlugin for skills)
export const skillInjectionPlugin: MiddlewarePlugin = {
  name: 'skillInjection',
  priority: 100,

  async beforeRequest(context) {
    const { skills, message } = context

    if (!skills?.length) return context

    // Inject skill prompts
    let enhancedMessage = message
    for (const skill of skills) {
      enhancedMessage = SkillService.injectSkillPrompt(
        enhancedMessage,
        skill,
        context.skillVariables ?? {}
      )
    }

    return { ...context, message: enhancedMessage }
  }
}
```

### Phase 6: Migration & Cleanup

#### 6.1 Data Migration

Create migration script for existing users:

```typescript
// src/renderer/src/store/migrations/knowledgeToSkills.ts
export async function migrateKnowledgeToSkills(
  knowledgeBases: KnowledgeBase[]
): Promise<Skill[]> {
  // For each knowledge base with notes, convert to skills
  return knowledgeBases
    .filter(kb => kb.items.some(i => i.type === 'note'))
    .map(kb => ({
      id: uuid(),
      name: kb.name,
      description: kb.description || `Migrated from knowledge base: ${kb.name}`,
      prompt: kb.items
        .filter(i => i.type === 'note')
        .map(i => i.content)
        .join('\n\n'),
      category: 'Migrated',
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }))
}
```

#### 6.2 Files to Delete

```
DELETE:
src/main/services/KnowledgeService.ts
src/renderer/src/types/knowledge.ts
src/renderer/src/store/knowledge.ts
src/renderer/src/store/thunk/knowledgeThunk.ts
src/renderer/src/services/KnowledgeService.ts
src/renderer/src/hooks/useKnowledge.ts
src/renderer/src/queue/KnowledgeQueue.ts
src/renderer/src/aiCore/tools/KnowledgeSearchTool.ts
src/renderer/src/pages/knowledge/ (entire directory)
src/renderer/src/pages/home/Inputbar/KnowledgeBaseInput.tsx
src/renderer/src/pages/home/Inputbar/tools/components/KnowledgeBaseButton.tsx
src/renderer/src/pages/home/Inputbar/tools/knowledgeBaseTool.tsx
src/renderer/src/pages/settings/AssistantSettings/AssistantKnowledgeBaseSettings.tsx
```

#### 6.3 Files to Modify

```
MODIFY:
packages/shared/IpcChannel.ts           # Remove KnowledgeBase channels
src/main/ipc.ts                         # Remove KnowledgeBase handlers
src/renderer/src/databases/index.ts     # Remove knowledge_notes table (or rename)
src/renderer/src/store/index.ts         # Replace knowledge reducer with skill
src/renderer/src/types/index.ts         # Export skill types instead
src/renderer/src/App.tsx               # Update routes
src/renderer/src/i18n/locales/*.json   # Update translations
```

### Phase 7: Default Skills

Ship with pre-built skills:

```typescript
const DEFAULT_SKILLS: Skill[] = [
  {
    id: 'code-review',
    name: 'Code Review',
    prompt: '...',
    category: 'Development'
  },
  {
    id: 'explain-code',
    name: 'Explain Code',
    prompt: '...',
    category: 'Development'
  },
  {
    id: 'writing-improve',
    name: 'Improve Writing',
    prompt: '...',
    category: 'Writing'
  },
  {
    id: 'summarize',
    name: 'Summarize',
    prompt: '...',
    category: 'General'
  },
  {
    id: 'translate',
    name: 'Translate',
    prompt: '...',
    category: 'General'
  }
]
```

---

## UI/UX Design

### Skills Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Skills                                    [+ New Skill]    │
├─────────────────────────────────────────────────────────────┤
│  [All] [Development] [Writing] [Analysis] [Custom]          │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ 📝 Code Review  │  │ 💡 Explain Code │                  │
│  │ Review code...  │  │ Explain what... │                  │
│  │ [Edit] [Delete] │  │ [Edit] [Delete] │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ ✍️ Improve...   │  │ 📋 Summarize    │                  │
│  │ Help improve... │  │ Create concise..│                  │
│  │ [Edit] [Delete] │  │ [Edit] [Delete] │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Skill Editor

```
┌─────────────────────────────────────────────────────────────┐
│  Edit Skill                                      [Save]     │
├─────────────────────────────────────────────────────────────┤
│  Name: [Code Review                              ]          │
│                                                             │
│  Category: [Development ▼]                                  │
│                                                             │
│  Description:                                               │
│  [Review code for quality, bugs, and best practices    ]   │
│                                                             │
│  Prompt:                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ You are a senior code reviewer. When reviewing:     │   │
│  │ 1. Check for bugs and edge cases                    │   │
│  │ 2. Evaluate code quality and readability            │   │
│  │ ...                                                 │   │
│  │ {{additional_context}}                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                        [+ Add Variable]     │
│                                                             │
│  Variables:                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ additional_context (optional)                       │   │
│  │ Description: Additional review criteria             │   │
│  │ [Edit] [Remove]                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Triggers (auto-activate):                                  │
│  [review] [code review] [+ Add]                            │
└─────────────────────────────────────────────────────────────┘
```

### Input Bar Integration

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [Code Review ×] [Explain Code ×]                    │   │
│  │                                                     │   │
│  │ Please review this function...                      │   │
│  └─────────────────────────────────────────────────────┘   │
│  [📎] [🔧 Skills ▼] [📷] [🎤]                    [Send ➤]  │
└─────────────────────────────────────────────────────────────┘
```

---

## i18n Keys to Add/Modify

```json
{
  "skills": {
    "title": "Skills",
    "add": "New Skill",
    "edit": "Edit Skill",
    "delete": "Delete Skill",
    "duplicate": "Duplicate Skill",
    "import": "Import Skills",
    "export": "Export Skills",
    "name": "Name",
    "description": "Description",
    "prompt": "Prompt",
    "category": "Category",
    "variables": "Variables",
    "triggers": "Auto-trigger words",
    "enabled": "Enabled",
    "confirmDelete": "Are you sure you want to delete this skill?",
    "categories": {
      "all": "All",
      "development": "Development",
      "writing": "Writing",
      "analysis": "Analysis",
      "general": "General",
      "custom": "Custom"
    }
  }
}
```

---

## Testing Plan

### Unit Tests

```typescript
// src/renderer/src/services/__tests__/SkillService.test.ts
describe('SkillService', () => {
  describe('injectSkillPrompt', () => {
    it('should inject skill prompt before user message')
    it('should replace variables in prompt')
    it('should remove unfilled optional variables')
  })

  describe('detectSkillTriggers', () => {
    it('should detect matching triggers')
    it('should be case-insensitive')
    it('should only check enabled skills')
  })
})
```

### Integration Tests

- Skill CRUD operations
- Skill selection in input bar
- Skill injection in message pipeline
- Assistant skill configuration
- Import/export functionality

---

## Rollout Plan

1. **Phase 1**: Create new Skills feature alongside Knowledge Base
2. **Phase 2**: Add migration tool for converting note-based knowledge bases
3. **Phase 3**: Mark Knowledge Base as deprecated in UI
4. **Phase 4**: Remove Knowledge Base in next major version

---

## Open Questions

1. **Should we keep any RAG functionality?**
   - Option: "Document Skills" that reference files but don't use embeddings

2. **Skill sharing/marketplace?**
   - Could add skill import from URL/GitHub in future

3. **Skill versioning?**
   - Track changes to skills over time?

4. **Skill composition?**
   - Allow skills to reference/extend other skills?

---

## Appendix: Comparison

| Feature | Knowledge Base | Skills |
|---------|---------------|--------|
| Core concept | Document storage + retrieval | Prompt instructions |
| Data storage | Vector DB + files | Simple text prompts |
| Search | Semantic search | N/A (direct injection) |
| Processing | Background queue | Instant |
| Complexity | High | Low |
| User mental model | "Library of documents" | "Teaching the AI" |
| Setup effort | High (add docs, wait for processing) | Low (write prompt) |
