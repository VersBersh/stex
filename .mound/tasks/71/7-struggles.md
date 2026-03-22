# Struggles

## 1. Incorrect separator in task description

- **Category**: description-quality
- **What happened**: The task description said Lexical inserts `\n` between paragraphs, but the actual behavior is `\n\n` (`DOUBLE_LINE_BREAK`). Had to verify by reading Lexical's source in `node_modules` before writing tests.
- **What would have helped**: The task description could have verified the exact separator character, or flagged it as uncertain. The plan review correctly caught this as a risk.
