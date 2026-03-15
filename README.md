# Airport Announcement Voice Builder

A hands-on, browser-based teaching tool for learning how **limited-domain speech synthesis** works. Students record 15 complete airport announcement sentences, and the system automatically extracts phrase-level units from those recordings. Students can then type new announcements that are synthesized in their own voice.

## What it does

This tool guides students through the full limited-domain speech synthesis pipeline:

1. **The Corpus** – Students learn what sentences need to be recorded and *why*, inspired by the [FestVox limited-domain TTS approach](http://festvox.org/festvox-1.2/festvox_10.html).
2. **Recording** – Students record 15 complete, natural-sounding airport announcement sentences using their browser microphone. Recording full sentences (rather than isolated fragments) preserves natural speech prosody.
3. **Voice Database** – A visual overview of the recorded sentence inventory, with explanations of what a professional voice database looks like.
4. **Synthesis** – Students type any airport announcement. The system uses a greedy longest-match unit selection algorithm to pick phrase units, extracts the corresponding audio slices from the full-sentence recordings using Voice Activity Detection (VAD), concatenates them, and plays back the result in the student's own voice.

## How to use

Simply open `index.html` in a modern browser, or host the repository on GitHub Pages. No build step, no server, no dependencies — just HTML, CSS, and vanilla JavaScript.

```
git clone <this repo>
open index.html
```

### Deploying to GitHub Pages

The repository includes a GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) that automatically deploys the site on every push to `main`.

To enable it:

1. Go to **Settings → Pages** in your repository.
2. Under *Build and deployment*, set **Source** to **GitHub Actions**.
3. Push to `main` (or use *Actions → Deploy to GitHub Pages → Run workflow*).

The live site will be available at `https://<owner>.github.io/<repo>/`.

## Technical details

| File | Purpose |
|------|---------|
| `index.html` | 5-step single-page application shell |
| `css/styles.css` | WCAG 2.1 AA compliant styles, dark-mode aware |
| `js/corpus.js` | 15 full airport announcement sentences with phrase-unit segment definitions |
| `js/storage.js` | IndexedDB wrapper for persisting audio recordings |
| `js/recorder.js` | MediaRecorder API wrapper for voice capture |
| `js/segmenter.js` | VAD-based audio segmentation with proportional fallback |
| `js/synthesizer.js` | Unit selection algorithm + Web Audio API concatenation |
| `js/app.js` | Main app controller (step navigation, recording UI, synthesis UI) |
| `.github/workflows/deploy-pages.yml` | GitHub Actions workflow: deploys site to GitHub Pages on push to `main` |

### Synthesis algorithm

1. **Text normalisation** — lower-case, expand numbers ("101" → "one zero one", "gate 5" → "gate five")
2. **Greedy longest-match** — scan from left, always prefer the longest matching phrase unit that has a recording
3. **Segment extraction** — for each selected unit, load the sentence recording that contains it and extract the phrase slice using the Segmenter (VAD or proportional fallback)
4. **Audio concatenation** — join extracted slices with `UNIT_GAP_SECONDS` silence gaps (default 80 ms)
5. **Playback** via Web Audio API

### How segment extraction works

After a sentence is recorded, the Segmenter runs Voice Activity Detection (VAD): it computes RMS energy in 20 ms windows and finds silence gaps longer than 80 ms. Each gap becomes a phrase boundary. If the number of detected boundaries matches the expected number of phrase units, those boundaries are used; otherwise the audio is split proportionally by character count. This approximates what professional tools (Festvox, Festival, Montreal Forced Aligner) achieve via phoneme-level forced alignment on a server.

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
