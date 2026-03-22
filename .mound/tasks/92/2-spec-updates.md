# Spec Updates

No spec updates required. This task adds a new internal module (`logger.ts`) and replaces existing ad-hoc `console.error`/`console.warn` calls with structured logger calls. It does not change any external API contracts, IPC channels, shared types, or settings schema. The logger is purely an internal infrastructure addition.
