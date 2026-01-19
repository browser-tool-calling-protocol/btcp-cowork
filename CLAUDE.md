# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cherry Studio is a Chrome extension AI assistant client supporting multiple LLM providers (OpenAI, Anthropic, Google, Ollama, etc.). Uses React for the UI with Redux state management.

## Requirements

- Node.js >= 22.0.0
- pnpm 10.27.0 (`corepack enable && corepack prepare pnpm@10.27.0 --activate`)

## Guiding Principles (MUST FOLLOW)

- **Keep it clear**: Write code that is easy to read, maintain, and explain.
- **Match the house style**: Reuse existing patterns, naming, and conventions.
- **Lint, test, and format before completion**: Coding tasks are only complete after running `pnpm build:check` (runs lint + test + typecheck).
- **Write conventional commits**: Commit small, focused changes using Conventional Commit messages (e.g., `feat:`, `fix:`, `refactor:`, `docs:`).

## Development Commands

```bash
pnpm install          # Install dependencies
cp .env.example .env  # Setup environment (first time only)
pnpm dev              # Run in development mode with hot reload
pnpm build            # Build extension for production
pnpm build:check      # REQUIRED before commits (lint + test + typecheck)
pnpm test             # Run all Vitest tests
pnpm test:renderer    # Test renderer process only
pnpm test:aicore      # Test aiCore package only
pnpm lint             # Fix linting + typecheck
pnpm format           # Auto-format with Biome
pnpm i18n:sync        # Fix i18n sort issues
```

## Pull Request Workflow (CRITICAL)

When creating a Pull Request:
1. **Read the PR template first**: Always read `.github/pull_request_template.md` before creating the PR
2. **Follow ALL template sections**: Include every section (even if N/A)
3. **Current restriction**: PRs changing Redux data models or IndexedDB schemas are NOT accepted until v2.0.0

### Branch Naming Convention
- Features: `feature/issue-number-brief-description`
- Bug fixes: `fix/issue-number-brief-description`
- Docs: `docs/brief-description`
- Hotfixes: `hotfix/issue-number-brief-description`

## Project Architecture

### Chrome Extension Structure

- **Extension** (`src/extension/`): Chrome extension specific code (background scripts, content scripts, shims)
- **Renderer** (`src/renderer/`): React 19 UI with Redux Toolkit

### AI Core (packages/aiCore/)

Standalone package providing a middleware pipeline for multiple AI providers. Uses Vercel AI SDK (`ai` package) for unified streaming across providers. Key abstractions:
- Provider adapters for OpenAI, Anthropic, Google, Azure, Bedrock, etc.
- Middleware chain for request/response transformation
- Tool calling with MCP integration

### State Management

- Redux Toolkit at `src/renderer/src/store/`
- IndexedDB via Dexie at `src/renderer/src/databases/`
- Redux-persist for state persistence

### Monorepo Packages (packages/)

- `aiCore` - AI provider middleware (publishable as `@cherrystudio/ai-core`)
- `shared` - Shared types and utilities
- `ai-sdk-provider` - Custom AI SDK providers
- `extension-table-plus` - Table extension

### Internationalization

- Locale files at `src/renderer/src/i18n/locales/`
- Run `pnpm i18n:sync` to sync translation template
- Run `pnpm i18n:translate` for auto-translation
