# Plan

## Goal

Define all shared TypeScript interfaces and IPC channel constants in `src/shared/types.ts` and `src/shared/ipc.ts`, transcribed directly from the spec.

## Steps

### Step 1: Implement `src/shared/types.ts`

Replace the empty stub with exported interfaces. All interfaces come from `spec/models.md`:

1. **`SonioxToken`** — fields: `text: string`, `start_ms: number`, `end_ms: number`, `confidence: number`, `is_final: boolean`, `speaker?: string`

2. **`TranscriptSegment`** — fields: `id: string`, `text: string`, `source: "soniox"`, `startMs: number`, `endMs: number`, `confidence: number`

3. **`EditorBlock`** — fields: `id: string`, `text: string`, `source: "soniox" | "user"`, `modified: boolean`

4. **`GhostText`** — fields: `tokens: SonioxToken[]`, `text: string`

5. **`SessionState`** — fields: `status: "idle" | "connecting" | "recording" | "paused" | "finalizing" | "error"`, `blocks: EditorBlock[]`, `ghostText: GhostText | null`, `websocketConnected: boolean`, `microphoneActive: boolean`, `error?: string`

6. **`AppSettings`** — fields: `hotkey: string`, `launchOnStartup: boolean`, `onHide: "clipboard" | "none"`, `onShow: "fresh" | "append"`, `audioInputDevice: string | null`, `sonioxApiKey: string`, `sonioxModel: string`, `language: string`, `maxEndpointDelayMs: number`, `theme: "system" | "light" | "dark"`, `windowPosition: { x: number; y: number } | null`, `windowSize: { width: number; height: number }`

7. **`TranscriptionRecord`** — fields: `id: string`, `text: string`, `createdAt: string`, `durationMs: number`, `language: string`

All interfaces are exported with `export interface`.

### Step 2: Implement `src/shared/ipc.ts`

Replace the empty stub with exported IPC channel constants. All channels come from the IPC Messages table in `spec/architecture.md`.

Define an `IpcChannels` object with `as const` for type safety:

```typescript
export const IpcChannels = {
  SESSION_START: 'session:start',
  SESSION_STOP: 'session:stop',
  SESSION_PAUSED: 'session:paused',
  SESSION_RESUMED: 'session:resumed',
  TOKENS_FINAL: 'tokens:final',
  TOKENS_NONFINAL: 'tokens:nonfinal',
  SESSION_STATUS: 'session:status',
  SESSION_TEXT: 'session:text',
  SESSION_REQUEST_PAUSE: 'session:request-pause',
  SESSION_REQUEST_RESUME: 'session:request-resume',
  SETTINGS_UPDATED: 'settings:updated',
} as const;
```

This pattern provides:
- Autocompletion via `IpcChannels.SESSION_START`
- Type narrowing — each value is a string literal type
- Centralized channel name management

## Risks / Open Questions

- **No test framework**: The project has no test runner installed (no jest/vitest in devDependencies). Tests will be limited to TypeScript compilation checks. This is acceptable for a pure-types task.
- **`SonioxToken` naming**: The spec uses `snake_case` for `start_ms`, `end_ms`, `is_final` but `camelCase` for `TranscriptSegment.startMs`, `endMs`. This is intentional — `SonioxToken` mirrors the external API wire format, while `TranscriptSegment` uses project conventions.
