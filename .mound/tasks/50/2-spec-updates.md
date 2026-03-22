# T50: Spec Updates

No spec updates required.

The UI spec (`spec/ui.md`) already says "Support light and dark mode" and "Follow system theme by default". Setting `BrowserWindow.backgroundColor` is an implementation detail of these existing requirements — it prevents the white flash that the current implementation has. No new spec language is needed.
