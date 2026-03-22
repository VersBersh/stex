# Add engines field to package.json for Node version requirement

## Summary
The project uses vitest v4 which requires Node >= 20.19.0 or >= 22.12.0, but `package.json` has no `engines` declaration. Developers on older Node versions will encounter confusing failures. Adding an `engines` field makes the requirement explicit and enables npm/yarn to warn early.

## Acceptance criteria
- `package.json` contains an `engines` field specifying the minimum Node version compatible with vitest v4 (e.g., `"node": ">=20.19.0 || >=22.12.0"`).
- `npm install` or `yarn install` on an incompatible Node version produces a clear warning or error.

## References
- Source: `.mound/tasks/20/6-discovered-tasks.md` item 3
