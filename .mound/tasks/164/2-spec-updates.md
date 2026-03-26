# Spec Updates

## Spec changes required

### `spec/models.md` — AppSettings.audioInputDevice comment

- **What**: Change the inline comment on `audioInputDevice` from `// PortAudio device name, null = system default` to reflect the getUserMedia device label model.
- **Why**: Task 142 replaced PortAudio with getUserMedia. The field now stores a `MediaDeviceInfo.label` from the Web MediaDevices API, not a PortAudio device name.

No other PortAudio references exist in `spec/models.md`. No new spec content needed.
