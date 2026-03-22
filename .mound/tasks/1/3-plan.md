# Plan

## Goal

Scaffold the Electron + TypeScript + React project with build tooling, directory structure, and minimal working entry points so that `npm install`, `npm run build`, and `npm start` all succeed.

## Steps

### 1. Create `package.json`

**File**: `package.json`

Initialize with:
- `name`: `"stex"`
- `version`: `"0.1.0"`
- `main`: `"dist/main/index.js"` (compiled main process entry)
- `scripts`:
  - `"build"`: `"webpack --config webpack.main.config.js && webpack --config webpack.renderer.config.js"`
  - `"start"`: `"npm run build && electron ."`
- **Dependencies**: `react`, `react-dom`, `lexical`, `@lexical/react`
- **Dev dependencies**: `electron`, `electron-builder`, `typescript`, `webpack`, `webpack-cli`, `ts-loader`, `html-webpack-plugin`, `css-loader`, `style-loader`, `@types/react`, `@types/react-dom`, `@types/node`

### 2. Create TypeScript configuration

**Files**: `tsconfig.json`, `tsconfig.main.json`, `tsconfig.renderer.json`

- `tsconfig.json`: Base config with `strict: true`, `esModuleInterop: true`, `skipLibCheck: true`, `moduleResolution: "node"`, `target: "ES2020"`, `module: "commonjs"`, `resolveJsonModule: true`, `declaration: true`, `sourceMap: true`
- `tsconfig.main.json`: Extends base. `outDir: "dist/main"`, `types: ["node"]`, `include: ["src/main/**/*", "src/shared/**/*"]`
- `tsconfig.renderer.json`: Extends base. `jsx: "react-jsx"`, `module: "ES2020"`, `outDir: "dist/renderer"`, `include: ["src/renderer/**/*", "src/shared/**/*"]`

### 3. Create Webpack configuration

**Files**: `webpack.main.config.js`, `webpack.renderer.config.js`

**Main process config** (`webpack.main.config.js`):
- `target: "electron-main"`
- Entry: `./src/main/index.ts`
- Output: `dist/main/index.js`
- Uses `ts-loader` with `tsconfig.main.json`
- `externals`: mark `electron` as external (via regex for all electron requires)
- `node: { __dirname: false, __filename: false }` to preserve path semantics
- `mode: "development"` for source maps

**Renderer config** (`webpack.renderer.config.js`):
- `target: "electron-renderer"`
- Two entries: `overlay: ./src/renderer/overlay/index.tsx`, `settings: ./src/renderer/settings/index.tsx`
- Output: `dist/renderer/[name]/bundle.js`
- Uses `ts-loader` with `tsconfig.renderer.json`
- `HtmlWebpackPlugin` for each entry:
  - overlay: template `src/renderer/overlay/index.html` → output `dist/renderer/overlay/index.html`
  - settings: template `src/renderer/settings/index.html` → output `dist/renderer/settings/index.html`
- CSS loaders: `style-loader` + `css-loader`
- `mode: "development"`

### 4. Create HTML templates

**File**: `src/renderer/overlay/index.html`

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>stex</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

**File**: `src/renderer/settings/index.html`

Same structure with title "stex - Settings".

These match the spec's file structure (`spec/architecture.md` lines 146, 156).

### 5. Create `electron-builder.json`

**File**: `electron-builder.json`

Minimal config:
```json
{
  "appId": "com.draftable.stex",
  "productName": "stex",
  "directories": { "output": "release" },
  "files": ["dist/**/*", "package.json"],
  "win": { "target": "nsis" }
}
```

### 6. Create shared types

**File**: `src/shared/types.ts`
**File**: `src/shared/ipc.ts`

Empty module stubs (`export {};`). These files establish the directory structure. The actual type definitions and IPC constants are separate tasks that will fill these in.

### 7. Create main process entry point

**File**: `src/main/index.ts`

Minimal Electron main that creates a single window loading the overlay HTML. This is intentionally simpler than the full tray-resident architecture — the tray, multi-window management, and hotkey registration are separate tasks. The acceptance criteria require "shows an empty window" which this satisfies.

```typescript
import { app, BrowserWindow } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 300,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/overlay/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
```

Window size (600x300) matches the spec default dimensions from `spec/ui.md`.

### 8. Create overlay renderer entry point

**File**: `src/renderer/overlay/index.tsx`

Minimal React app mounting into `#root`:
```tsx
import { createRoot } from 'react-dom/client';

function App() {
  return <div>stex overlay</div>;
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
```

### 9. Create settings renderer entry point

**File**: `src/renderer/settings/index.tsx`

Same pattern as overlay, with "stex settings" text.

### 10. Create main process module stubs

**Files**: `src/main/tray.ts`, `src/main/window.ts`, `src/main/hotkey.ts`, `src/main/settings.ts`, `src/main/audio.ts`, `src/main/soniox.ts`, `src/main/session.ts`

Each file is a minimal placeholder (`export {};`). Establishes the file structure from `spec/architecture.md`.

### 11. Create `.gitignore`

**File**: `.gitignore`

```
node_modules/
dist/
release/
*.js.map
```

### 12. Install dependencies and verify

Run:
1. `npm install` — verify no errors
2. `npm run build` — verify webpack compiles both main and renderer without errors
3. Verify output files exist in `dist/main/index.js`, `dist/renderer/overlay/index.html`, `dist/renderer/settings/index.html`

## Risks / Open Questions

1. **Webpack vs Vite**: Choosing Webpack — more mature Electron support, simpler for dual main/renderer setup without extra plugins.

2. **Simple main process**: The review flagged that the main entry doesn't implement the full tray-resident architecture. This is intentional — tray management (T3), window management (T4), and hotkey registration (T5) are separate tasks. The scaffolding just needs a buildable, launchable entry point.

3. **Empty shared stubs**: The review suggested filling in shared types/IPC constants. These are out of scope — other tasks (T2: Shared Types, etc.) will implement the actual contracts. Stubs prove the directory structure and import paths work.

4. **Preload script**: `contextIsolation: true` without a preload script means renderers can't access Node APIs — which is correct for now. The preload bridge will be added when IPC is implemented.

5. **naudiodon**: Not included — requires native compilation, out of scope for scaffolding.

6. **`npm start` verification**: Cannot fully automate Electron GUI launch in a headless environment. Will verify build succeeds and output files exist.
