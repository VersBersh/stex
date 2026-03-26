# AUDIO: Add Electron permission handler for mic access in settings window

## Summary
The settings window's device enumeration depends on `navigator.mediaDevices.enumerateDevices()` returning device labels, which requires prior microphone permission. Currently this relies on a temporary `getUserMedia()` call as a bootstrap mechanism. This is fragile, especially on fresh installs where no prior permission grant exists.

A cleaner approach would be to use Electron's `session.setPermissionRequestHandler` or `session.setDevicePermissionHandler` to explicitly manage microphone permissions, ensuring device labels are always available when the settings window enumerates audio devices.

## Acceptance criteria
- Microphone permission is handled via Electron's session permission API (e.g., `setPermissionRequestHandler` or `setDevicePermissionHandler`)
- `enumerateDevices()` in the settings window reliably returns device labels on fresh installs without requiring a temporary `getUserMedia()` bootstrap
- Existing audio capture in the overlay window continues to work correctly
- Permission denial is handled gracefully with a user-visible message

## References
- Task 142: Replace naudiodon/PortAudio audio capture with Chromium getUserMedia
- Electron docs: `session.setPermissionRequestHandler`, `session.setDevicePermissionHandler`
- Settings window device enumeration code
