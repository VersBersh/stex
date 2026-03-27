# Struggles

## 1. Ambiguous feedback scope

- **Category:** description-quality
- **What happened:** The feedback "fix the compilaton error" (singular, with typo) didn't specify which compilation error or how to reproduce it. Running `tsc --noEmit` against the root tsconfig produced ~175 errors across many files, most of which are pre-existing JSX config issues in the root tsconfig (not covered by the project-specific tsconfigs). I had to determine that the relevant errors were only the 2 that fail `tsc --noEmit -p tsconfig.renderer.json`, since that's what the typecheck test actually checks.
- **What would have helped:** Including the error output or the command used to reproduce (e.g., `npx tsc --noEmit -p tsconfig.renderer.json`) would have made triage instant instead of requiring investigation across all tsconfig variants.
