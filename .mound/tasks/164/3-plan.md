# Plan

## Goal

Update the `audioInputDevice` comment in `spec/models.md` to reflect the current getUserMedia-based device selection model.

## Steps

1. **Edit `spec/models.md` line 116** — Change the comment from:
   ```
   audioInputDevice: string | null;  // PortAudio device name, null = system default
   ```
   to:
   ```
   audioInputDevice: string | null;  // MediaDeviceInfo.label from getUserMedia, null = system default
   ```

## Risks / Open Questions

None — this is a single-line comment change with a clear source of truth in the implementation.
