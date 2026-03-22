# Struggles

- **Category:** description-quality
- **What happened:** The task described a problem (hard-coded 600x300 in `createOverlayWindow()`) that was already fixed by T4 (Window Manager). The discovered task was created during T3's review, but T4 implemented the fix as part of its scope. The task was created without checking whether T4 had already addressed it.
- **What would have helped:** When creating tasks from discovered-tasks lists, cross-check whether subsequent tasks in the dependency chain already addressed the issue. A "pre-flight" check on task creation that verifies the described problem still exists in the codebase would prevent unnecessary work.
