# stex — Live Speech-to-Text with Inline Correction

## Overview

stex is a lightweight Windows desktop application for real-time speech-to-text transcription with inline editing. It runs in the system tray and appears instantly via a global hotkey, letting users dictate text while correcting transcription errors on the fly — without breaking their flow.

## Problem

Existing speech-to-text tools treat transcription as a one-way pipeline: you speak, you get text, you fix it after the fact. This creates two separate phases (dictation, then editing) which is slow and disruptive — especially when you can *see* an error happening in real time but can't do anything about it until the transcription is complete.

## Solution

stex merges dictation and editing into a single, continuous flow:

1. Press a hotkey — a compact overlay window appears instantly
2. Start speaking — text appears in real time as you talk
3. Notice an error — click or keyboard-navigate to it, type a correction
4. Keep speaking — new transcription always appends at the end of the document

The key insight is that the editor treats finalized transcription and user edits as equal citizens. You're always working in a live document, not watching a read-only transcript.

## Prerequisites

### Windows: C++ Build Tools

The `naudiodon` dependency requires native compilation. You need Visual Studio (2022 or newer) with the "Desktop development with C++" workload installed. If you don't have it, you can install just the build tools:

```
winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive"
```

### Setup

After installing prerequisites:

```bash
npm install
```

Then rebuild native modules against Electron's Node headers (required because Electron uses a different Node.js ABI than your system Node):

```bash
npx node-gyp rebuild --target=$(node -e "console.log(require('./node_modules/electron/package.json').version)") --arch=x64 --dist-url=https://electronjs.org/headers --directory=node_modules/naudiodon
npx node-gyp rebuild --target=$(node -e "console.log(require('./node_modules/electron/package.json').version)") --arch=x64 --dist-url=https://electronjs.org/headers --directory=node_modules/segfault-handler
```

## Target User

Anyone who dictates text frequently — writers, developers drafting docs, professionals composing emails — and wants a faster feedback loop than traditional dictate-then-edit workflows.

## Core Value Proposition

- **Zero-friction activation** — system tray app, global hotkey, window appears in milliseconds
- **Real-time transcription** — words appear as you speak via Soniox streaming API
- **Inline correction** — edit errors mid-stream without stopping dictation
- **Minimal footprint** — small overlay window, not a full application takeover
