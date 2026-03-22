# Plan

## Goal

Add an `exclude` pattern to `tsconfig.main.json` so that `*.test.ts` and `*.spec.ts` files are not compiled during webpack builds.

## Steps

1. **Edit `tsconfig.main.json`** — Add an `"exclude"` array with `"**/*.test.ts"` and `"**/*.spec.ts"` patterns. Place it after the `"include"` array. The result:
   ```json
   {
     "extends": "./tsconfig.json",
     "compilerOptions": {
       "outDir": "dist/main",
       "types": ["node"]
     },
     "include": ["src/main/**/*", "src/shared/**/*"],
     "exclude": ["**/*.test.ts", "**/*.spec.ts"]
   }
   ```

2. **Verify** — Run `npm run build` to confirm the build succeeds without compiling test files. Run `npm test` to confirm tests still pass.

## Risks / Open Questions

- None. This is a minimal, well-understood tsconfig change. The `exclude` property is standard and takes precedence over `include` for matching files. Vitest does not depend on tsconfig include/exclude for test discovery.
