# Knowledge Base to Skills Migration Plan (UI Reuse Strategy)

## Overview

**Goal**: Transform the Knowledge Base feature into a simple prompt-based Skills system while **reusing existing UI components**.

**What Skills Are**: Simple text prompts that teach the agent how to perform tasks. No vector storage, no embeddings, no document processing.

**Migration Strategy**: Instead of deleting and recreating UI components, we refactor the existing knowledge base UI to work with the simplified skills data model.

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

## UI Components to REUSE (Refactor, Don't Delete)

### Main Page Structure
```
KEEP & REFACTOR: src/renderer/src/pages/knowledge/
├── KnowledgePage.tsx          → SkillsPage.tsx (rename & simplify)
├── KnowledgeSideNav.tsx       → SkillsSideNav.tsx (reuse list structure)
└── KnowledgeContent.tsx       → SkillContent.tsx (simplify to show prompt editor)
```

### Input Bar Components
```
KEEP & REFACTOR: src/renderer/src/pages/home/Inputbar/
├── KnowledgeBaseInput.tsx     → SkillInput.tsx (reuse tag display)
├── tools/components/KnowledgeBaseButton.tsx → SkillButton.tsx
└── tools/knowledgeBaseTool.tsx → skillTool.tsx
```

### Assistant Settings
```
KEEP & REFACTOR: src/renderer/src/pages/settings/AssistantSettings/
└── AssistantKnowledgeBaseSettings.tsx → AssistantSkillSettings.tsx
```

---

## Files to DELETE (Backend/Processing Only)

### Main Process (All Backend Logic)
```
DELETE: src/main/services/KnowledgeService.ts
```

### Renderer - Services & Queue (Processing Logic)
```
DELETE: src/renderer/src/services/KnowledgeService.ts
DELETE: src/renderer/src/queue/KnowledgeQueue.ts
```

### Renderer - AI Core Tools (Vector Search)
```
DELETE: src/renderer/src/aiCore/tools/KnowledgeSearchTool.ts
```

### Renderer - Complex Knowledge Components (RAG-specific UI)
```
DELETE: src/renderer/src/pages/knowledge/components/KnowledgeSettings/
  - AdvancedSettingsPanel.tsx (chunking, reranking, preprocessing)
  - GeneralSettingsPanel.tsx (embedding model, dimensions)
  - KnowledgeBaseFormModal.tsx (tabbed form with advanced)
  - InputEmbeddingDimension.tsx
  - InputReferencesCount.tsx

DELETE: src/renderer/src/pages/knowledge/components/
  - KnowledgeFiles.tsx (file processing UI)
  - KnowledgeUrls.tsx (URL ingestion UI)
  - KnowledgeSitemaps.tsx (sitemap ingestion UI)
  - KnowledgeDirectories.tsx (directory ingestion UI)
  - KnowledgeVideos.tsx (video processing UI)
  - KnowledgeSearchPopup.tsx (vector search UI)
  - AddDocumentPopup.tsx (document ingestion)
  - Toolbar.tsx (if processing-specific)
```

---

## Files to Refactor

### 1. Types: Knowledge → Skill

**File:** `src/renderer/src/types/knowledge.ts` → Rename to `skill.ts`

```typescript
// BEFORE (complex)
export interface KnowledgeBase {
  id: string
  name: string
  model: Model  // embedding model
  dimensions?: number
  items: KnowledgeItem[]
  documentCount?: number
  chunkSize?: number
  chunkOverlap?: number
  threshold?: number
  rerankModel?: Model
  preprocessProvider?: {...}
  // ... many more fields
}

// AFTER (simplified)
export interface Skill {
  id: string
  name: string
  description?: string
  prompt: string           // The actual skill content (was "note" item type)
  enabled: boolean
  createdAt: number
  updatedAt: number
}
```

### 2. Store: Simplify to Skill Operations

**File:** `src/renderer/src/store/knowledge.ts` → Rename to `skill.ts`

```typescript
// BEFORE: Complex state with items, processing status, etc.
// AFTER: Simple CRUD

interface SkillState {
  skills: Skill[]
}

const skillSlice = createSlice({
  name: 'skill',
  initialState: { skills: [] },
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
```

**DELETE:** `src/renderer/src/store/thunk/knowledgeThunk.ts` (async processing not needed)

### 3. Hooks: Simplify

**File:** `src/renderer/src/hooks/useKnowledge.ts` → Rename to `useSkill.ts`

```typescript
// BEFORE: Complex hooks for items, processing, migration
// useKnowledgeBases(), useKnowledge(baseId), useKnowledgeBaseForm()

// AFTER: Single simple hook
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

  const reorder = (skills: Skill[]) => {
    dispatch(reorderSkills(skills))
  }

  return { skills, create, update, remove, reorder }
}
```

### 4. Main Page: KnowledgePage → SkillsPage

**File:** `src/renderer/src/pages/knowledge/KnowledgePage.tsx` → Rename to `SkillsPage.tsx`

**Changes:**
- Remove tabs (Files, URLs, Sitemaps, Directories, Videos)
- Keep sidebar with draggable list (skills instead of knowledge bases)
- Simplify content area to show single skill editor
- Remove embedding model display, search button, quota info
- Keep: Add button, context menu (rename, delete), drag reordering

```tsx
// Simplified structure
<Container>
  <SkillsSideNav
    skills={skills}
    selectedId={selectedSkillId}
    onSelect={setSelectedSkillId}
    onAdd={handleAdd}
    onDelete={handleDelete}
    onReorder={handleReorder}
  />
  <SkillContent
    skill={selectedSkill}
    onUpdate={handleUpdate}
  />
</Container>
```

### 5. Side Navigation: Reuse DraggableList Pattern

**File:** `src/renderer/src/pages/knowledge/KnowledgeSideNav.tsx` → Rename to `SkillsSideNav.tsx`

**Keep:**
- DraggableList component usage
- List item rendering with icon + name
- Context menu (rename, delete)
- Add button at bottom

**Remove:**
- Model info display
- Item count badges (no items in skills)

### 6. Content Area: Simplify to Prompt Editor

**File:** `src/renderer/src/pages/knowledge/KnowledgeContent.tsx` → Rename to `SkillContent.tsx`

**Replace complex tab system with simple skill editor:**

```tsx
const SkillContent: FC<{ skill: Skill; onUpdate: (skill: Skill) => void }> = ({ skill, onUpdate }) => {
  return (
    <ContentWrapper>
      {/* Header with skill name (editable) */}
      <Header>
        <Input
          value={skill.name}
          onChange={(e) => onUpdate({ ...skill, name: e.target.value })}
        />
        <Switch
          checked={skill.enabled}
          onChange={(checked) => onUpdate({ ...skill, enabled: checked })}
        />
      </Header>

      {/* Description field */}
      <Input.TextArea
        placeholder="Brief description..."
        value={skill.description}
        onChange={(e) => onUpdate({ ...skill, description: e.target.value })}
        rows={2}
      />

      {/* Main prompt editor */}
      <TextArea
        placeholder="Enter the instruction prompt for this skill..."
        value={skill.prompt}
        onChange={(e) => onUpdate({ ...skill, prompt: e.target.value })}
        autoSize={{ minRows: 10 }}
      />
    </ContentWrapper>
  )
}
```

### 7. KnowledgeNotes Component → Merge into SkillContent

**File:** `src/renderer/src/pages/knowledge/components/KnowledgeNotes.tsx`

The existing notes component already has the pattern we need. Merge its text editing logic into the new SkillContent component, then delete the file.

### 8. Input Bar: Simplify Tag Display

**File:** `src/renderer/src/pages/home/Inputbar/KnowledgeBaseInput.tsx` → Rename to `SkillInput.tsx`

**Keep:**
- Tag display pattern (colored chips)
- Close button to remove from selection
- Scroll container for multiple selections

**Change:**
- Icon: FileSearchOutlined → ThunderboltOutlined (or similar skill icon)
- Color: Keep green or use different theme color

### 9. Tool Button: Simplify Selection

**File:** `src/renderer/src/pages/home/Inputbar/tools/components/KnowledgeBaseButton.tsx` → Rename to `SkillButton.tsx`

**Keep:**
- Memoized component pattern
- Tooltip with label
- Active state when skills selected
- QuickPanel integration for multi-select

**Remove:**
- Item count display (skills don't have items)
- "Add knowledge base" option (simplify to just selection)
- Mutual exclusivity with files (skills can work with files)

### 10. Tool Definition: Update for Skills

**File:** `src/renderer/src/pages/home/Inputbar/tools/knowledgeBaseTool.tsx` → Rename to `skillTool.tsx`

```typescript
export const skillTool = defineTool({
  key: 'skill',
  label: (t) => t('chat.input.skills'),

  visibleInScopes: [TopicType.Chat],
  condition: ({ assistant }) => true, // Skills work with any assistant

  dependencies: {
    state: ['selectedSkills'],
    actions: ['setSelectedSkills']
  },

  render: (context) => <SkillButton {...context} />
})
```

### 11. Assistant Settings: Simplify

**File:** `src/renderer/src/pages/settings/AssistantSettings/AssistantKnowledgeBaseSettings.tsx` → Rename to `AssistantSkillSettings.tsx`

**Keep:**
- Multi-select dropdown pattern
- Enable/disable toggle pattern

**Remove:**
- "Knowledge Recognition" toggle (auto-recognition for RAG)
- Complex descriptions about semantic search

---

## IPC & Backend Cleanup

### Remove from IPC Channels
**File:** `packages/shared/IpcChannel.ts`

```typescript
// DELETE all these:
KnowledgeBase_Create
KnowledgeBase_Reset
KnowledgeBase_Delete
KnowledgeBase_Add
KnowledgeBase_Remove
KnowledgeBase_Search
KnowledgeBase_Rerank
KnowledgeBase_Check_Quota
```

### Remove from IPC Handlers
**File:** `src/main/ipc.ts`
- Remove all KnowledgeService handler registrations

### Remove from Preload
**File:** `src/preload/index.ts`
- Remove `window.api.knowledgeBase` exposure

---

## Database Updates

**File:** `src/renderer/src/databases/index.ts`
- Remove `knowledge_notes` table (skills stored in Redux-persist)

**File:** `src/renderer/src/databases/upgrades.ts`
- Add cleanup migration to remove knowledge data

---

## AI Core Updates

**File:** `src/renderer/src/aiCore/plugins/searchOrchestrationPlugin.ts`
- Remove knowledge base search logic
- Skills inject prompts at message construction, not via search

### Skill Injection (New Logic)

Skills don't need a search tool. Instead, inject selected skill prompts into the system message:

```typescript
// In message construction (not a plugin)
function buildSystemMessage(assistant: Assistant, selectedSkills: Skill[]): string {
  const basePrompt = assistant.prompt || ''

  const skillPrompts = selectedSkills
    .filter(s => s.enabled)
    .map(s => s.prompt)
    .join('\n\n---\n\n')

  if (skillPrompts) {
    return `${basePrompt}\n\n## Skills\n\n${skillPrompts}`
  }

  return basePrompt
}
```

---

## Route & Navigation Updates

### Routes
**File:** `src/renderer/src/App.tsx` (or router config)
- Rename `/knowledge` route to `/skills`

### Navigation
- Update navbar/sidebar labels from "Knowledge Base" to "Skills"
- Update icon if desired

---

## i18n Updates

### Keys to Rename/Update (not delete entirely)

Transform existing knowledge keys to skill keys:

| Old Key | New Key |
|---------|---------|
| `knowledge.title` | `skill.title` |
| `knowledge.add` | `skill.add` |
| `knowledge.edit` | `skill.edit` |
| `knowledge.delete` | `skill.delete` |
| `knowledge.delete_confirm` | `skill.delete_confirm` |
| `knowledge.empty` | `skill.empty` |
| `navbar.knowledge_base` | `navbar.skills` |
| `sidebar.knowledge` | `sidebar.skills` |

### Keys to Add

```json
{
  "skill": {
    "prompt": "Prompt",
    "prompt_placeholder": "Enter the instruction prompt for this skill...",
    "prompt_required": "Skill prompt is required",
    "description": "Description",
    "description_placeholder": "Brief description of what this skill does",
    "enabled": "Enabled"
  }
}
```

### Keys to Remove

```
knowledge.embedding_model
knowledge.dimensions
knowledge.chunk_size
knowledge.chunk_overlap
knowledge.threshold
knowledge.rerank_model
knowledge.preprocess
knowledge.files.*
knowledge.urls.*
knowledge.sitemaps.*
knowledge.directories.*
knowledge.search.*
knowledge.processing.*
```

---

## Migration Checklist

### Phase 1: Backend Cleanup (No UI Breakage)
- [ ] Delete `src/main/services/KnowledgeService.ts`
- [ ] Remove IPC channels from `packages/shared/IpcChannel.ts`
- [ ] Remove handlers from `src/main/ipc.ts`
- [ ] Remove API exposure from `src/preload/index.ts`
- [ ] Delete `src/renderer/src/services/KnowledgeService.ts`
- [ ] Delete `src/renderer/src/queue/KnowledgeQueue.ts`
- [ ] Delete `src/renderer/src/aiCore/tools/KnowledgeSearchTool.ts`

### Phase 2: Delete RAG-Specific UI Components
- [ ] Delete `KnowledgeSettings/` directory (model selection panels)
- [ ] Delete `KnowledgeFiles.tsx`
- [ ] Delete `KnowledgeUrls.tsx`
- [ ] Delete `KnowledgeSitemaps.tsx`
- [ ] Delete `KnowledgeDirectories.tsx`
- [ ] Delete `KnowledgeVideos.tsx`
- [ ] Delete `KnowledgeSearchPopup.tsx`
- [ ] Delete `AddDocumentPopup.tsx`

### Phase 3: Refactor Types & Store
- [ ] Rename `types/knowledge.ts` → `types/skill.ts`
- [ ] Simplify type from KnowledgeBase to Skill
- [ ] Rename `store/knowledge.ts` → `store/skill.ts`
- [ ] Simplify reducers for CRUD only
- [ ] Delete `store/thunk/knowledgeThunk.ts`
- [ ] Update `store/index.ts` reducer registration

### Phase 4: Refactor Hooks
- [ ] Rename `hooks/useKnowledge.ts` → `hooks/useSkill.ts`
- [ ] Simplify to single useSkills() hook
- [ ] Update all imports throughout codebase

### Phase 5: Refactor Main Page
- [ ] Rename `KnowledgePage.tsx` → `SkillsPage.tsx`
- [ ] Remove tabs, simplify to sidebar + editor layout
- [ ] Rename `KnowledgeSideNav.tsx` → `SkillsSideNav.tsx`
- [ ] Simplify list item rendering (no item counts)
- [ ] Rename `KnowledgeContent.tsx` → `SkillContent.tsx`
- [ ] Replace tab system with simple prompt editor
- [ ] Merge `KnowledgeNotes.tsx` logic, then delete file

### Phase 6: Refactor Input Bar Components
- [ ] Rename `KnowledgeBaseInput.tsx` → `SkillInput.tsx`
- [ ] Update icon and styling
- [ ] Rename `KnowledgeBaseButton.tsx` → `SkillButton.tsx`
- [ ] Remove item counts and complex options
- [ ] Rename `knowledgeBaseTool.tsx` → `skillTool.tsx`
- [ ] Update tool definition

### Phase 7: Refactor Settings
- [ ] Rename `AssistantKnowledgeBaseSettings.tsx` → `AssistantSkillSettings.tsx`
- [ ] Remove knowledge recognition toggle
- [ ] Simplify to skill selection only

### Phase 8: Update Routes & Navigation
- [ ] Update route from `/knowledge` to `/skills`
- [ ] Update navbar/sidebar labels
- [ ] Update all internal navigation links

### Phase 9: i18n Updates
- [ ] Rename knowledge keys to skill keys
- [ ] Add new skill-specific keys
- [ ] Remove RAG-specific keys
- [ ] Run `pnpm i18n:sync`

### Phase 10: Database Cleanup
- [ ] Remove `knowledge_notes` table
- [ ] Add migration to clean up old data

### Phase 11: Skill Injection Logic
- [ ] Add skill prompt injection to message builder
- [ ] Remove from searchOrchestrationPlugin

### Phase 12: Verification
- [ ] Run `pnpm build:check`
- [ ] Test skills page (create, edit, delete, reorder)
- [ ] Test skill selection in input bar
- [ ] Test skill injection into messages
- [ ] Verify no knowledge base references remain

---

## Data Migration for Existing Users

```typescript
// Migration helper - Convert existing notes to skills
function migrateKnowledgeNotesToSkills(knowledgeBases: any[]): Skill[] {
  return knowledgeBases
    .flatMap(kb => (kb.items || []).filter(item => item.type === 'note'))
    .map(note => ({
      id: uuid(),
      name: note.content.substring(0, 50).trim() + (note.content.length > 50 ? '...' : ''),
      description: `Migrated from knowledge base`,
      prompt: note.content,
      enabled: true,
      createdAt: note.created_at || Date.now(),
      updatedAt: Date.now()
    }))
}

// Run on app initialization
async function performMigration() {
  const oldKnowledgeBases = getPersistedKnowledgeBases()
  if (oldKnowledgeBases?.length) {
    const migratedSkills = migrateKnowledgeNotesToSkills(oldKnowledgeBases)
    dispatch(setSkills(migratedSkills))
    // Clear old knowledge base data
    clearPersistedKnowledgeBases()
  }
}
```

**Note:** Files, URLs, sitemaps, directories, videos will be lost (no vector storage equivalent).

---

## Component Mapping Reference

| Knowledge Component | Skills Component | Action |
|---------------------|------------------|--------|
| `KnowledgePage.tsx` | `SkillsPage.tsx` | Rename & simplify |
| `KnowledgeSideNav.tsx` | `SkillsSideNav.tsx` | Rename & simplify |
| `KnowledgeContent.tsx` | `SkillContent.tsx` | Replace with editor |
| `KnowledgeNotes.tsx` | (merged into SkillContent) | Delete after merge |
| `KnowledgeFiles.tsx` | - | Delete |
| `KnowledgeUrls.tsx` | - | Delete |
| `KnowledgeSitemaps.tsx` | - | Delete |
| `KnowledgeDirectories.tsx` | - | Delete |
| `KnowledgeVideos.tsx` | - | Delete |
| `KnowledgeSearchPopup.tsx` | - | Delete |
| `KnowledgeSettings/*` | - | Delete (all) |
| `AddKnowledgeBasePopup.tsx` | `AddSkillPopup.tsx` | Simplify (name + prompt only) |
| `EditKnowledgeBasePopup.tsx` | (inline editing) | Delete (edit in content area) |
| `KnowledgeBaseInput.tsx` | `SkillInput.tsx` | Rename |
| `KnowledgeBaseButton.tsx` | `SkillButton.tsx` | Rename & simplify |
| `knowledgeBaseTool.tsx` | `skillTool.tsx` | Rename & simplify |
| `AssistantKnowledgeBaseSettings.tsx` | `AssistantSkillSettings.tsx` | Rename & simplify |

---

## Benefits of UI Reuse Strategy

1. **Faster Implementation**: Refactoring is quicker than rebuilding
2. **Consistent UX**: Users familiar with knowledge base UI will recognize skills UI
3. **Less Testing**: Reused components already work; focus testing on changed logic
4. **Smaller Diff**: Code review is easier with renames vs full rewrites
5. **Preserved Patterns**: DraggableList, QuickPanel, tool system patterns stay intact

---

## Notes

1. **Incremental Migration**: Can be done phase by phase, keeping app functional
2. **Backend-first cleanup**: Remove IPC/services first, then refactor UI
3. **No new dependencies**: Skills system uses existing Redux/UI infrastructure
4. **Instant skills**: No processing queue, skills work immediately
5. **Simpler state**: No items, no processing status, just skills array
