# Airport Announcement Voice Builder

A hands-on, browser-based teaching tool for learning how **limited-domain speech synthesis** works. Students record a set of airport announcement phrases, build a personal voice database, and then type new announcements that are synthesized in their own voice.

## What it does

This tool guides students through the full limited-domain speech synthesis pipeline:

1. **The Corpus** – Students learn what phrases need to be recorded and *why*, inspired by the [FestVox limited-domain TTS approach](http://festvox.org/festvox-1.2/festvox_10.html).
2. **Recording** – Students record each phrase (42 total, covering 8 categories: opening phrases, flight numbers, destinations, flight status, gate numbers, delay durations, passenger instructions, closing phrases) using their browser microphone.
3. **Voice Database** – A visual overview of the recorded unit inventory, with explanations of what a professional voice database looks like.
4. **Synthesis** – Students type any airport announcement. The system uses a greedy longest-match unit selection algorithm to pick recorded phrases, concatenates their audio, and plays it back. A visualisation shows which units were selected (or skipped).

## How to use

Simply open `index.html` in a modern browser, or host the repository on GitHub Pages. No build step, no server, no dependencies — just HTML, CSS, and vanilla JavaScript.

```
git clone <this repo>
open index.html
```

Or visit the live GitHub Pages version (see repository settings).

## Technical details

| File | Purpose |
|------|---------|
| `index.html` | 5-step single-page application shell |
| `css/styles.css` | WCAG 2.1 AA compliant styles, dark-mode aware |
| `js/corpus.js` | Airport announcement unit definitions (42 units, 8 categories) |
| `js/storage.js` | IndexedDB wrapper for persisting audio recordings |
| `js/recorder.js` | MediaRecorder API wrapper for voice capture |
| `js/synthesizer.js` | Unit selection algorithm + Web Audio API concatenation |
| `js/app.js` | Main app controller (step navigation, recording UI, synthesis UI) |

### Synthesis algorithm

1. **Text normalisation** — lower-case, expand numbers ("101" → "one zero one", "gate 5" → "gate five")
2. **Greedy longest-match** — scan from left, always prefer the longest matching recorded unit
3. **Audio concatenation** — load blobs from IndexedDB, decode with Web Audio API, concatenate with 80 ms silence gaps
4. **Playback** via Web Audio API

### Accessibility

- WCAG 2.1 AA compliant
- Skip navigation link
- Semantic HTML5 elements and ARIA landmarks
- Visible focus indicators on all interactive elements
- `aria-live` regions for status updates
- All colours meet 4.5:1 contrast ratio minimum
- Keyboard accessible throughout
- `prefers-reduced-motion` and `prefers-color-scheme` media queries

### Browser compatibility

Chrome, Firefox, Edge, and Safari 14+. Requires `MediaRecorder`, `IndexedDB`, and `Web Audio API`.

### Privacy

All recordings are stored in the browser's local IndexedDB storage. Nothing is uploaded to any server.
