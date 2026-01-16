# Plan: Separate Electron Code for Later Use

## Goal

Keep the codebase Electron-free for now. Document what would be needed if we add Electron support later.

---

## Current State

This project is a **web/extension-only** codebase. There is no Electron code or dependencies currently.

### What We Have
- `src/renderer/` - React UI (works in browser)
- `src/extension/` - Browser extension with `shim.ts` for platform APIs
- `packages/aiCore/` - AI provider middleware (platform agnostic)
- `packages/shared/` - Shared types

### What We Don't Have
- No `src/main/` (Electron main process)
- No `src/preload/` (Electron IPC bridge)
- No Electron dependencies in `package.json`

---

## Current Architecture

```
src/
├── renderer/       # React UI (browser-compatible)
└── extension/      # Browser extension
    └── shim.ts     # Platform API for browser environment

packages/
├── aiCore/         # AI middleware (no platform deps)
└── shared/         # Types and utilities
```

---

## If Adding Electron Later

### Step 1: Add Electron Package

Create `apps/desktop/` or `src/electron/`:
```
src/electron/       # or apps/desktop/
├── main/
│   └── index.ts   # Main process entry
├── preload/
│   └── index.ts   # IPC bridge
└── package.json   # Electron-specific deps
```

### Step 2: Electron Dependencies to Add

```json
{
  "devDependencies": {
    "electron": "^38.0.0",
    "electron-builder": "^26.0.0",
    "electron-vite": "^5.0.0"
  },
  "dependencies": {
    "@electron-toolkit/preload": "^3.0.0",
    "@electron-toolkit/utils": "^3.0.0"
  }
}
```

### Step 3: Platform Detection

The existing `shim.ts` pattern works well. For Electron, create a similar adapter:

```typescript
// src/electron/preload/index.ts
// Implements same WindowApiType interface as shim.ts
// but uses ipcRenderer.invoke() instead of browser APIs
```

### Step 4: Conditional Loading

```typescript
// Entry point detects platform
const isElectron = typeof window !== 'undefined' && window.electron
const api = isElectron ? window.api : extensionApi
```

---

## Features Requiring Electron

If these features are needed later, they require Electron:

| Feature | Why Electron Needed |
|---------|---------------------|
| Local file system access | Node.js fs module |
| Native window controls | BrowserWindow API |
| System tray | Tray API |
| Global shortcuts | globalShortcut API |
| Auto-updates | electron-updater |
| Local MCP servers (stdio) | Child process spawn |
| System OCR | Native modules |
| Deep OS integration | Node.js APIs |

---

## Current Web Alternatives (in shim.ts)

| Feature | Web Implementation |
|---------|-------------------|
| File storage | IndexedDB |
| Config | chrome.storage / localStorage |
| Notifications | Web Notification API |
| Compression | CompressionStream |
| Encryption | Web Crypto API |
| File picker | `<input type="file">` |
| Downloads | Blob + download link |

---

## Recommendation

**Keep it simple.** The current extension-based architecture works well for web deployment. Only add Electron complexity when there's a concrete need for native features.

When that time comes:
1. Create isolated `src/electron/` directory
2. Keep Electron deps in a separate package.json
3. Reuse existing `shim.ts` interface pattern
4. Don't restructure the whole monorepo
