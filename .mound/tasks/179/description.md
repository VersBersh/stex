# Fix TypeScript error on LexicalNode that breaks npm run start

## Summary

Running `npm run start` fails with a TypeScript compilation error related to `LexicalNode`. This blocks local development. The root cause needs to be identified and fixed so the app compiles and starts successfully.

## Acceptance criteria

- `npm run start` completes without TypeScript errors related to `LexicalNode`
- No regressions introduced in Lexical editor functionality
- If the fix involves updating types or dependencies, ensure compatibility with the rest of the codebase

## References

- Feedback: `.mound/feedback/20260327-143409-337-305d.md`
