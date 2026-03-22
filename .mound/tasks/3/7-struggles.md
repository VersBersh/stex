# Struggles

1. **Category:** tooling
   **What happened:** `vi.mock` factory functions are hoisted above variable declarations, so the `mockStore` Map was not accessible inside the mock factory, causing a `ReferenceError`. Required using `vi.hoisted()` to pre-declare shared mock state.
   **What would have helped:** A note in the project's test conventions about using `vi.hoisted()` for shared mock state, or an example test that demonstrates the pattern.

2. **Category:** tooling
   **What happened:** `electron-store` v9+ is ESM-only, which is incompatible with the project's CommonJS setup. Required pinning to v8.2.0. This was identified early in planning but still required manual version investigation.
   **What would have helped:** A project-level policy or CLAUDE.md note about CJS-only dependencies and the module format constraint.
