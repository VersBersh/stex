# Mask API key in settings and verify secure storage

## Summary
Once a user has entered their API key in settings, it should not be displayed in plain text. The key should be masked (e.g., showing only the last 4 characters). Additionally, verify that the API key is being cached/stored securely (e.g., not in plain text in a config file or localStorage without encryption).

## Acceptance criteria
- After an API key is saved, the settings UI masks the key (e.g., displays `••••••••abcd` showing only last 4 characters)
- Users can still replace/update the key by entering a new one
- Audit how the API key is currently stored and document whether it is secure
- If the key is stored insecurely (e.g., plain text in localStorage or an unencrypted config file), implement secure storage or document the risk and propose a solution

## References
- Feedback: `.mound/feedback/20260323-121442-061-5501.md` (item 2)
