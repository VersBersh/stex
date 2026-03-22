# Struggles

1. **Category:** orientation
   **What happened:** The Soniox server closes the WebSocket with code 1000 after processing non-speech audio (sine wave) without sending a `finished: true` response. The initial test implementation treated all disconnects as errors, causing the test to fail even though the round-trip was successful.
   **What would have helped:** Documentation of the Soniox server's close behavior for different audio inputs, or a note in the task description that non-speech audio may not produce a `finished` response.
