# SETTINGS: Add "Test Microphone" button with live volume meter to settings window

## Summary
Add a "Test Microphone" button to the settings page that activates the mic and shows a live volume meter, so users can verify their audio setup and calibrate the silence threshold. Currently the settings page shows a static threshold scale but no live audio feedback, making it difficult for users to calibrate the threshold effectively.

## Acceptance criteria
- A "Test Microphone" button is present on the settings page (audio/device section).
- Clicking the button activates the selected audio input device and displays a live volume meter.
- The live meter updates in real-time so the user can see their current audio level relative to the silence threshold.
- The mic is deactivated when the user stops testing (e.g., clicks a stop button or leaves the settings page).
- Works with the currently selected audio input device from the device dropdown.

## References
- Task 123: Add visual volume dB meter with configurable silence threshold
- Task 97: Add dropdown for selecting audio input devices
- Settings window UI code
