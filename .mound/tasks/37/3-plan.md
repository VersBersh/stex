# Plan

## Goal

Replace the placeholder grey square tray icon with a branded multi-resolution `.ico` file and update `tray.ts` to load it from disk.

## Steps

### 1. Create `resources/tray-icon.ico`

Create a `resources/` directory at the project root and place a branded `.ico` file there. The `.ico` is generated once via a throwaway Node.js script (not committed), and the resulting binary is checked in as a static asset.

**Icon design**: A dark rounded-rectangle background (#2D2D2D) with a light "S" letterform (#FFFFFF) — a clean, minimal mark that reads well at 16x16 and is visible against both light and dark Windows taskbar backgrounds. The `.ico` contains PNG payloads at 16x16, 24x24, and 32x32.

**Process**: Write a one-time `scripts/generate-tray-icon.js`, run it to produce `resources/tray-icon.ico`, commit the `.ico`, do NOT commit the script (or delete it after).

### 2. Update `electron-builder.json`

Add `"resources/**/*"` to the `files` array so the icon is included in packaged builds.

**File**: `electron-builder.json`
**Change**: `"files": ["dist/**/*", "package.json"]` → `"files": ["dist/**/*", "resources/**/*", "package.json"]`

### 3. Update `src/main/tray.ts`

Replace the base64 placeholder approach with file-based icon loading:

- Add `import * as path from 'path'`
- Remove the `TRAY_ICON_BASE64` constant
- Change `createTrayIcon()` to use `nativeImage.createFromPath()` with the icon path
- Use `path.join(app.getAppPath(), 'resources', 'tray-icon.ico')` for the path
- Add a runtime safety check: if `icon.isEmpty()`, log a warning (icon missing or bad path) — fail loudly rather than silently showing an invisible tray icon

**After**:
```typescript
import * as path from 'path';

function createTrayIcon() {
  const iconPath = path.join(app.getAppPath(), 'resources', 'tray-icon.ico');
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    console.warn(`Tray icon not found at ${iconPath}`);
  }
  return icon;
}
```

### 4. Update `src/main/tray.test.ts`

Update mocks to reflect the new loading approach:

- Mock `app.getAppPath` to return a dummy path (e.g., `/mock-app`)
- Replace `createFromBuffer: () => MOCK_NATIVE_IMAGE` with a `createFromPath` spy
- Assert that `createFromPath` was called with the expected path (`/mock-app/resources/tray-icon.ico`)
- Keep existing behavioral tests (tooltip, context menu, destroy) unchanged

### 5. Verify

Run `npm run build` and `npm test` to ensure compilation and tests pass. No lint script exists in this project.

## Risks / Open Questions

1. **Icon quality at 16x16**: Programmatically generated icons at very small sizes may look rough. A simple geometric shape (rounded rectangle + letter) should be legible. If quality is poor, a designer can replace the `.ico` later without any code changes.

2. **`app.getAppPath()` in dev vs packaged**: In dev (`electron .`), returns the project root. In packaged builds, returns the asar root. The `files` array in `electron-builder.json` ensures `resources/` is included in both cases. Standard Electron pattern.

3. **No brand guidelines**: There's no documented brand identity. The icon will be a reasonable interpretation — clean minimal mark. Easy to swap later since it's just a file replacement.

4. **Review issue #1 (generator complexity)**: Addressed by treating the generator as a throwaway script, not part of the build pipeline. Only the resulting `.ico` binary is committed.

5. **Review issue #2 (silent failure)**: Addressed by adding `icon.isEmpty()` check with `console.warn`.

6. **Review issue #3 (weak tests)**: Addressed by asserting `createFromPath` is called with the correct path.
