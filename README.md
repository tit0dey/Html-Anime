# HTML-Anime Studio (v1.0.0)

**100% Free & Unlimited · Zero API Keys · Direct Idea/Script to `.MP4` Anime & Motion Film Studio (Web + Android APK)**

Inspired by [`blixvip/html-anime`](https://github.com/blixvip/html-anime), **HTML-Anime Studio** eliminates the need to copy-paste shot sheets into external coding agents (Claude Code / Codex) or run desktop CLI capture tools (`npx hyperframes`). Everything happens **inside the app itself** — from autonomous 24fps shot-sheet direction to live cel-shaded Canvas2D preview, procedural cinema soundtrack synthesis, and hardware-accelerated H.264 + AAC `.mp4` rendering.

## Core Capabilities

- **Topic, Short Idea, or Full Story Script Input**: Supports any length and any language (English, Bangla, Banglish, Hindi, Japanese, etc.).
- **Landscape (`16:9`), Vertical (`9:16`), & Square (`1:1`)**: True aspect-aware anime framing (`1280×720` / `720×1280` 720p Fast HD or `1920×1080` / `1080×1920` 1080p Full HD).
- **Custom Duration (`Minutes` + `Seconds`)**: Choose any custom runtime from `4 seconds` up to `10 minutes` (`600s`) — frame-accurately partitioned at `24 FPS`.
- **8 Closed 10-Hex Anime Color Scripts**: `Indigo Moon`, `Vermilion Eclipse`, `Paper Noon`, `Lantern Festival`, `Neo-Tokyo Cyber`, `Twilight Comet`, `Sakura Dusk`, and `Emerald Shrine`.
- **Authentic `html-anime` Cel & Timing Craft**:
  - Character acting and cloth follow-through animated on **twos** (`12fps` holds inside `24fps`).
  - Rain streaks, sakura petals, embers, snow, and sakuga impact sparks animated on **ones** (`24fps`).
  - **5-Beat Sakuga Climax** (anticipation coil, high-speed smear silhouette + speed lines, stark 2-frame inverted impact flash, sweeping crescent blade slash, and 12-frame landed hold).
  - Full-frame **Color-Dip Cuts** and 8-frame closing fade to `ink`.
- **Streaming Zero-Lag On-Device `.MP4` Renderer**:
  - Encodes frames directly into H.264 (`VideoEncoder`) + procedural cinema pad/rain/sakuga audio into AAC (`AudioEncoder`) via `mp4-muxer` with **0 MB uncompressed frame buffering** and hardware backpressure guards so phones stay cool and fast.
- **Native Signed Android APK (`apk/HTML-Anime-Studio.apk`)**:
  - Signed with V1 + V2 + V3 Android cryptographic signatures, 4-byte aligned, dark cinema system bars, background 0%-CPU lifecycle guard, and direct saving to `Downloads/HTMLAnimeStudio/`.

## Quick Start

```bash
npm install
npm run build
npm start
```

To rebuild the standalone signed Android `.apk`:

```bash
npm run build:apk
```
