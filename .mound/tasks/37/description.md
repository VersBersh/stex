# DESIGN: Replace placeholder tray icon with branded icon

## Summary
The current system tray icon is a minimal grey square PNG embedded as base64 in `src/main/tray.ts`. This was intentionally left as a placeholder during T5 (System Tray) implementation. A proper branded icon needs to be designed (likely .ico format for optimal Windows rendering) and the tray module updated to use it.

## Acceptance criteria
- A branded tray icon is created in .ico format (or appropriate multi-resolution format for Windows)
- The icon visually represents the Stex/Draftable brand
- `src/main/tray.ts` is updated to load the new icon file instead of the embedded base64 placeholder
- The icon renders crisply at standard Windows tray icon sizes (16x16, 24x24, 32x32)

## References
- Source: `.mound/tasks/5/6-discovered-tasks.md` (discovered during T5: System Tray implementation)
- `src/main/tray.ts` — current tray icon code
