# Discovered Tasks

1. **DOCS: Remove naudiodon/node-gyp build instructions from README**
   - Description: The README still contains instructions for building naudiodon with node-gyp and Visual Studio C++ build tools. These are no longer needed since audio capture moved to getUserMedia.
   - Why discovered: Found stale references to naudiodon in README.md during the review phase.

2. **SPEC: Update decisions.md to reflect naudiodon→getUserMedia migration**
   - Description: `spec/decisions.md` (D4) chose naudiodon over Web Audio API and included a fallback plan to switch to getUserMedia if naudiodon proved unreliable. That fallback has now been exercised. The decision should be updated to reflect the outcome.
   - Why discovered: Found the decision entry while checking for naudiodon references across the codebase.

3. **AUDIO: Add Electron permission handler for mic access in settings window**
   - Description: The settings window's device enumeration depends on `navigator.mediaDevices.enumerateDevices()` returning device labels, which requires prior mic permission. Currently relies on a temporary `getUserMedia()` call as a bootstrap. Consider adding `session.setPermissionRequestHandler` or `session.setDevicePermissionHandler` for a cleaner permission model.
   - Why discovered: Both plan review and design review flagged the permission bootstrap as fragile for fresh installs.
