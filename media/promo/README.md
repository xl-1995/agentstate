# Promo video (source)

The 36-second AgentState promo, authored as a [HyperFrames](https://hyperframes.heygen.com) composition — HTML/CSS/GSAP rendered deterministically to MP4. The composition is the source of truth; the rendered file is published as a release asset.

▶ **Watch:** https://github.com/xl-1995/agentstate/releases/download/v0.0.1/agentstate-promo.mp4

## Re-render it

Requires Node 22+ and FFmpeg on your PATH.

```bash
cd media/promo
npx hyperframes render --quality high --fps 30
# → renders/agentstate-video_<timestamp>.mp4   (1920×1080, 36s)
```

Preview live in the browser with `npx hyperframes preview`. Validate with `npx hyperframes lint && npx hyperframes validate`.

## What's here

- `index.html` — the whole video: five scenes (hook → the double-refund problem → the governed fix → four primitives → CTA), animated with a single paused GSAP timeline that the renderer seeks frame by frame.
- `assets/fonts/` — self-hosted Inter + JetBrains Mono `.woff2` (no external font requests, so renders are deterministic and offline-safe).
