# Discovered Tasks

## 1. AUDIO: Sound event logging for VAD characterization
- **Description**: Log sound events as `{ peak_dB, duration_ms, timestamp }` to help characterize keystrokes vs. speech patterns. This was a stretch goal in the original task.
- **Why discovered**: Explicitly listed in the task description as a stretch goal, deferred to keep this task focused on core acceptance criteria.

## 2. SETTINGS: "Test microphone" feature for settings window
- **Description**: Add a "Test Microphone" button to the settings page that activates the mic and shows a live volume meter, so users can verify their audio setup and calibrate the silence threshold.
- **Why discovered**: The settings page shows a static threshold scale but no live audio. During implementation it became clear that calibrating the threshold without hearing live levels is suboptimal.

## 3. PERF: IPC throttling for audio level messages
- **Description**: Throttle `audio:level` IPC messages to ~10Hz instead of sending on every audio chunk (~10-20Hz). Would reduce IPC overhead on fast chunk rates.
- **Why discovered**: Noted as a risk in planning. Current chunk rate is manageable but could be an issue if chunk sizes decrease.

## 4. TEST: Split settings.test.ts by concern
- **Description**: Split `src/main/settings.test.ts` (416 lines) into separate test files by concern: defaults, store behavior, IPC handlers, encryption.
- **Why discovered**: Flagged in code design review as exceeding the 300-line guideline. Pre-existing issue, but this task added to it.
