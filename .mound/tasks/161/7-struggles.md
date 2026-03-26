# Struggles

- **Category**: tooling
- **What happened**: The codex plan review process was slow due to PowerShell shell initialization issues (fnm symlink errors, commands timing out at 10 seconds). The codex tool struggled with the Windows environment.
- **What would have helped**: A faster shell environment without fnm initialization overhead, or codex using bash directly instead of PowerShell.
