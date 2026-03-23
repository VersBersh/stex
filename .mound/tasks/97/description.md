# Add dropdown for selecting audio input devices

## Summary
Add a dropdown/selector UI element that allows users to choose which audio input device (microphone) to use for transcription. Currently there is no way for users to select a specific input device.

## Acceptance criteria
- A dropdown or select element is available in the UI (likely in settings or the transcription controls) listing all available audio input devices
- The selected device is used when starting a transcription session
- The device list refreshes if devices are added/removed
- The selected device preference persists across sessions

## References
- Feedback: `.mound/feedback/20260323-121442-061-5501.md` (item 1)
