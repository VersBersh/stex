# Spec Updates

No spec updates required.

This task adds an Electron-level permission handler — a runtime configuration change in the main process. It does not alter any public API contracts, IPC channel definitions, or architectural boundaries. The `SettingsAPI.getAudioDevices` return type changes from `Promise<string[]>` to `Promise<AudioDeviceResult>`, but this is an internal preload bridge type, not a cross-subsystem contract.
