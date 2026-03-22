# Spec Updates

No spec updates required.

The spec `spec/features/system-tray.md` already covers first-run experience (section "First-Run Experience"), microphone permission (section "Microphone Permission"), and hotkey registration failure (section "Global Hotkey > Registration failure"). The task implements what the spec already describes. No new spec content is needed.

The only minor extension is adding `'no-api-key'` to the `ErrorInfo.type` union in `src/shared/types.ts`, which is an implementation detail not governed by the feature spec.
