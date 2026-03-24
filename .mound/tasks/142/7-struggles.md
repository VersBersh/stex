# Struggles

## 1. Error normalization gap between browser and main process
- **Category:** spec-clarity
- **What happened:** The plan described a `normalizeAudioError()` function but I initially forgot to actually call it from `startAudioCapture()`. The error classification in main process depends on specific message substrings ("access denied", "device not found") that come from PortAudio. Browser DOMExceptions have different error names/messages. The code review caught that the normalization function existed but was dead code.
- **What would have helped:** The plan could have been more explicit that the normalization must happen at the throw/catch boundary inside `startAudioCapture()`, not just as a utility function. A test for the normalization path would have caught this earlier.

## 2. Device fallback vs error behavior
- **Category:** description-quality
- **What happened:** The task description says "Device selection still works" but doesn't specify what should happen when a saved device name doesn't match any browser-enumerated device. I initially implemented a silent fallback to default, which both reviews flagged as a regression from the original behavior (which threw an error).
- **What would have helped:** The task description could have explicitly stated: "When the configured device is not found, report an error (same as current behavior) rather than falling back to default."

## 3. AudioWorklet tail buffer flush
- **Category:** missing-context
- **What happened:** The design review flagged that the worklet's batching (1600 samples) would lose up to ~100ms of trailing audio on stop. This is a real concern for transcription — the last word could be clipped. I added a flush message protocol to the worklet processor.
- **What would have helped:** This is a known trade-off in AudioWorklet designs. A note in the task description about buffer flushing requirements would have preempted this.
