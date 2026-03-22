# T20 Spec Updates

No spec updates required.

The `AppSettings` interface in `spec/models.md` defines `sonioxApiKey: string` — this type is unchanged. The env var fallback is an implementation detail of how the default value is resolved, not a change to the data model or architecture contract. The spec already states that the Settings Store handles "API key management", which encompasses this fallback behavior.
