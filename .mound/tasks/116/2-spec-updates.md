# Spec Updates

No spec updates required. This is a bug fix to the scroll-follow logic in `GhostTextPlugin.tsx`. The change is purely behavioural — the scroll should only trigger when content actually overflows the visible area, not unconditionally when the user was "near the bottom" (which is always true when content fits within the container).
