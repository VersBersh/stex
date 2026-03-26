# Struggles

- **Category:** tooling
- **What happened:** The `MockSonioxClient` test helper uses a delegation pattern where instance methods forward to a shared `mockSonioxInstance` object. This makes it difficult to reliably track call ordering between `mockRingBufferInstance.push` and `mockSonioxInstance.sendAudio` using `mockImplementation`, because the mock call tracking goes through different indirection layers. The `vi.fn()` constructor mock for `AudioRingBuffer` also required using a regular function (not arrow) to work with `new`.
- **What would have helped:** A note in the test file or context doc explaining how the MockSonioxClient delegation works and its limitations for cross-mock ordering assertions.
