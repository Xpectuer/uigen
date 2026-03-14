# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # First-time: install deps + prisma generate + migrate
npm run dev          # Dev server at http://localhost:3000 (Turbopack)
npm run dev:daemon   # Dev server in background, logs to logs.txt
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest (jsdom environment)
npm run db:reset     # Force-reset and re-migrate the SQLite database
```

Run a single test file:
```bash
npx vitest src/lib/__tests__/file-system.test.ts
```

## Environment

Copy `.env` and set `ANTHROPIC_API_KEY`. Without it, a `MockLanguageModel` is used that returns static components (Counter/Card/Form) — useful for development without API costs.

## Architecture

**Layout**: Split-panel SPA. Left (35%): chat. Right (65%): Preview or Code tabs.

**Routing**: Two Next.js App Router pages:
- `/` — anonymous users get `MainContent` with no project
- `/[projectId]` — authenticated users are redirected here; auto-creates a project if none exists

**State**: Two React contexts wrap the entire UI:
- `FileSystemProvider` (`src/lib/contexts/file-system-context.tsx`) — holds a `VirtualFileSystem` instance; exposes `getAllFiles`, `refreshTrigger`
- `ChatProvider` (`src/lib/contexts/chat-context.tsx`) — manages chat messages and streams

**VirtualFileSystem** (`src/lib/file-system.ts`): In-memory filesystem, no disk writes. Serializes to `Record<string, FileNode>` (JSON) for Prisma storage and HTTP transport. The AI operates on this VFS via two tools:
- `str_replace_editor` — view/create/str_replace/insert operations
- `file_manager` — rename/delete operations

**AI pipeline** (`src/app/api/chat/route.ts`): Uses Vercel AI SDK `streamText`. The system prompt is in `src/lib/prompts/generation.tsx` with Anthropic prompt caching (`ephemeral`). On finish, saves messages + VFS snapshot to Prisma if authenticated.

**Live preview** (`src/components/preview/PreviewFrame.tsx`): JSX files are transpiled via `@babel/standalone` inside a sandboxed `<iframe srcdoc>`. Entry point is auto-detected (`/App.jsx`, `/App.tsx`, `/index.jsx`, etc.). Import map resolves `@/` aliases.

**Auth** (`src/lib/auth.ts`): JWT via `jose`, stored as HTTP-only cookie. Middleware protects `/api/projects` and `/api/filesystem`. Anonymous users can use the app without auth; projects only persist for authenticated users.

**Database** (Prisma + SQLite `prisma/dev.db`): Two models — `User` and `Project`. `Project.messages` and `Project.data` are JSON-serialized strings (not native JSON columns).

**Provider abstraction** (`src/lib/provider.ts`): `getLanguageModel()` returns `anthropic("claude-haiku-4-5")` when `ANTHROPIC_API_KEY` is set, otherwise `MockLanguageModel`.

## Key Paths

| Path | Purpose |
|------|---------|
| `src/lib/file-system.ts` | VirtualFileSystem class |
| `src/lib/transform/jsx-transformer.ts` | Babel-based JSX→preview HTML |
| `src/lib/tools/` | AI tool definitions (str-replace, file-manager) |
| `src/lib/prompts/generation.tsx` | System prompt for component generation |
| `src/lib/provider.ts` | LLM provider selection (real vs mock) |
| `src/lib/auth.ts` | JWT session management |
| `src/app/api/chat/route.ts` | Streaming AI endpoint |
| `src/components/preview/PreviewFrame.tsx` | Sandboxed iframe preview |
| `prisma/schema.prisma` | DB schema (User, Project) |
