# DOCS: Remove naudiodon/node-gyp build instructions from README

## Summary
The README still contains instructions for building naudiodon with node-gyp and Visual Studio C++ build tools. These are no longer needed since audio capture moved from naudiodon/PortAudio to renderer-side `getUserMedia` + `AudioWorklet` (completed in task 142). The stale build instructions should be removed to avoid confusing new contributors.

## Acceptance criteria
- All references to naudiodon, node-gyp, and Visual Studio C++ build tools are removed from README.md
- Any audio-related setup instructions accurately reflect the current getUserMedia-based architecture (no native dependencies required)
- README build steps still work end-to-end after changes

## References
- Task 142: Replace naudiodon/PortAudio audio capture with Chromium getUserMedia
- `README.md` — contains the stale build instructions
