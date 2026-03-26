# Discovered Tasks

1. **SPEC: Update decisions.md to reflect getUserMedia audio architecture**
   - `spec/decisions.md` Decision #5 still references "Native Audio Capture in Main Process" with naudiodon/PortAudio
   - Should be updated to reflect the renderer-side getUserMedia + AudioWorklet architecture from task 142
   - Discovered: noted during verification that spec files still reference the old architecture

2. **SPEC: Update models.md audioInputDevice type from PortAudio to current architecture**
   - `spec/models.md` still types `audioInputDevice` as "PortAudio device name"
   - Should be updated to reflect the current getUserMedia-based device selection
   - Discovered: noted during verification that spec files still reference the old architecture
