# Promo video (source)

The AgentState promo (~42s, 1920×1080), authored as a [HyperFrames](https://hyperframes.heygen.com) composition — HTML/CSS/GSAP rendered deterministically to MP4, with voiceover and an original ambient score. The composition is the source of truth; the rendered file is published as a release asset.

▶ **Watch:** https://github.com/xl-1995/agentstate/releases/download/v0.0.1/agentstate-promo.mp4

The cut leads with the thesis — **trustworthy, not smarter** — and treats the refund only as a one-shot example.

## Re-render

Requires Node 22+ and FFmpeg on your PATH.

```bash
cd media/promo
npx hyperframes render --quality high --fps 30 -o renders/agentstate-promo.mp4
```

Preview live with `npx hyperframes preview`; validate with `npx hyperframes lint && npx hyperframes validate`.

## What's here

- `index.html` — the whole video: five scenes (hook → "it's not intelligence, it's trust" → proposes/decides/event + a flash example → four primitives → CTA), driven by one paused GSAP timeline the renderer seeks frame by frame, plus six timed `<audio>` tracks.
- `assets/fonts/` — self-hosted Inter + JetBrains Mono `.woff2` (no external font requests → deterministic, offline-safe renders).
- `assets/vo/vo1–vo5.wav` — narration, generated locally with HyperFrames' Kokoro TTS (`am_michael`).
- `assets/music/bed.wav` — an original, royalty-free ambient pad synthesized with FFmpeg.

## How the audio was generated

Voiceover (local Kokoro TTS — needs `pip install kokoro-onnx soundfile`):

```bash
npx hyperframes tts "Agents have memory. They don't have state." -v am_michael -o assets/vo/vo1.wav
# …one call per line; see the <audio> elements in index.html for the scripts.
```

Music bed (a warm Cmaj7 pad, slow tremolo, gentle space — 100% original, no licensing):

```bash
ffmpeg -y -f lavfi -i "aevalsrc=exprs='0.16*sin(2*PI*65.41*t)+0.20*sin(2*PI*130.81*t)+0.14*sin(2*PI*196.00*t)+0.11*sin(2*PI*329.63*t)+0.08*sin(2*PI*493.88*t)':duration=42:sample_rate=44100" \
  -af "tremolo=f=0.1:d=0.5,lowpass=f=2600,aecho=0.8:0.4:60:0.22,afade=t=in:st=0:d=2.5,afade=t=out:st=38.5:d=3.5,volume=0.55" \
  assets/music/bed.wav
```
