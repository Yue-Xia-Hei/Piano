# AutoPiano `/3d` local recreation

- Source reference: `https://www.autopiano.cn/3d`
- Local route: `/3d` (the Vite SPA also serves `/`).
- Main implementation: `src/main.js`; page styles: `src/style.css`.

The page is a locally editable Three.js reconstruction; the remote production model and its CDN resources are not bundled. The recreated black grand piano has a permanently open lid, a fitted 88-key keyboard, visible soundboard/strings, three connected legs and casters, and a braced pedal lyre with three separate treadles. Warm paper-toned studio lighting is fixed on at all times. The old brand block, left-side controls, footer credits, and the `AutoPiano` body lettering are not part of this version.

A high-resolution practice score is rendered onto the music rest. It shows one enlarged 4/4 measure at a time with treble and bass staff notation, measure number, note names, and the matching key shortcut. The public-domain `Ode to Joy` melody is arranged as eight measures; the highlighted note follows practice progress. Correct keyboard or mouse-played notes advance the score, incorrect notes give feedback, and the restart button resets the exercise. Imported MIDI files preserve their timing, tracks, tempo, meter, and chords. Notes are synthesized with Web Audio rather than acoustic piano samples.

The `导入音频` control accepts common local audio formats such as MP3, WAV, OGG, FLAC, and M4A. Audio is decoded and transcribed in the browser with the bundled Spotify Basic Pitch TensorFlow.js model; the resulting note events feed the same score and auto-play pipeline as MIDI. The UI limits one transcription to 25 MB and 2 minutes to keep browser work predictable. Audio-to-note conversion is an estimate: a clean single-instrument melody is the most reliable input, while dense accompaniment, vocals, reverb, and noise may need manual correction.

All 88 keys carry shortcut labels. The lower range uses the 44 displayed physical keyboard codes; the upper range reuses them with Shift. Drag/pointer/touch gestures orbit, wheel/pinch zoom, and the top-right buttons expose scene settings, an alternate camera, and fullscreen.

## Run and deploy

```sh
npm install
npm run dev
npm run build
```

The production output is `dist/`; deploy with Vercel's Vite/static defaults. The local audio model is copied to `public/models/basic-pitch/` so Vercel serves it as a static asset. No original piano model or source-site audio assets are required.

## Known scope and limits

This is a procedural visual model rather than a physically accurate CAD piano or the source site's original mesh. Geometry, reflections, and acoustic mechanics remain illustrative. The current lesson is `Ode to Joy`, not a transcription of `La La Land`; use a licensed/authorized score or supplied note data before adding copyrighted arrangements. Audio transcription is intentionally presented as an assistive estimate rather than a guarantee of an exact score.
