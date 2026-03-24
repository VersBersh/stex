# Spec Updates

## Spec changes required

### 1. `spec/architecture.md` — Add `audio:level` IPC channel to IPC Messages table

**What**: Add new row: `Main -> Renderer | audio:level | number | Current audio input level in dB (smoothed)`

**Why**: The volume level is forwarded from main process to overlay renderer on each audio chunk. Payload is a bare `number` (consistent with `session:status` using a single primitive).

### 2. `spec/architecture.md` — Add `silenceThresholdDb` to Settings Store description

**What**: Note that `AppSettings` includes `silenceThresholdDb: number` for the configurable silence threshold used by future VAD.

**Why**: New user preference persisted via electron-store, consumed by the settings UI and accessible to other modules.

### 3. `spec/ui.md` — Add Volume Meter to Status Bar section

**What**: Add a "Volume Meter" subsection to the Status Bar section:
- Small horizontal bar between mic icon and status text, visible during `recording` state
- Width proportional to dB level (maps [-60, 0] to [0%, 100%])
- Color coded: dim below -40dB, green above -20dB

**Why**: New visual element in the overlay UI providing mic feedback.

### 4. `spec/ui.md` — Add Settings Window section for silence threshold

**What**: Add a section describing the settings UI for the silence threshold:
- Located in General settings page
- Range slider for threshold dB value (-60 to -10)
- Visual dB scale bar with threshold marker showing the threshold position
- Hint text explaining the threshold's purpose for VAD

**Why**: Core acceptance criterion — the settings page shows the threshold control with visual representation. The settings window does not have live audio, so the dB meter bar is a static scale showing the threshold position rather than a live meter.

## New spec content

No new spec files needed.
