# Struggles

## 1. sessionLifecycleController needed updating
- **Category:** missing-context
- **What happened:** The conflict in OverlayContext.tsx was caused by T14 extracting the onSessionStart/clearEditor logic into a `createSessionLifecycleController`. T16's commit added the same logic inline plus changed the `onSessionStart` callback signature to pass `onShow` directly. Resolving the conflict required updating the controller and its tests to use the new signature instead of fetching settings via IPC.
- **What would have helped:** The task description mentioning that T14's controller refactor would need signature updates when T16's `onShow` parameter changes landed.
