# Implementation Notes

## Files Modified

| File | Changes |
|------|---------|
| `package.json` | Added `build:dist` script with `--mode production` flags; updated `dist` to use `build:dist` |

## Bundle Size Comparison

| Bundle | Development | Production | Reduction |
|--------|------------|------------|-----------|
| main/index.js | 79.2 KiB | 30.6 KiB | 61% |
| preload/index.js | 10.5 KiB | 4.82 KiB | 54% |
| preload/settings-preload.js | 6.29 KiB | 2.34 KiB | 63% |
| overlay/bundle.js | 1.88 MiB | 291 KiB | 85% |
| settings/bundle.js | 1.22 MiB | 156 KiB | 87% |

## Deviations from Plan

Changed approach after code review: instead of modifying webpack configs to read `NODE_ENV`, used webpack's `--mode production` CLI flag in a new `build:dist` script. This avoids ambient env var coupling and keeps webpack configs unchanged. The CLI `--mode` flag overrides the config's `mode` property.

## New Tasks or Follow-Up Work

None discovered.
