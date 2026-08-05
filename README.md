# Fretboard Atlas — Angular version

Same app as the HTML/React one: scale + root + starting-string pickers, movable
pattern selector (7 patterns for heptatonic scales, 5 for pentatonic), "show
all patterns", "repeat this pattern up the neck", full-neck view, and a
Web-Audio-based metronome with tap tempo.

## Setup

```bash
npm install
npm start
```

Then open the local dev server URL Angular prints (usually `http://localhost:4200`).

## Project structure

```
src/
  app/
    app.component.ts   — all components live here (AppComponent, FretboardSvgComponent,
                          FullNeckSvgComponent, MetronomeComponent)
  assets/
    scale-data.json     — precomputed scale pattern data (same data as the React version)
  index.html
  main.ts
  styles.css
angular.json
package.json
tsconfig.json
tsconfig.app.json
```

## Notes

- This was written against Angular 17 standalone components (no NgModules needed).
- The scale pattern data (`scale-data.json`) is generated ahead of time by a Python
  script, not computed client-side — this keeps the Angular component logic simple
  and fast, same approach as the HTML/React version.
- I was not able to run a full `ng build`/`npm install` in this sandboxed environment
  to verify compilation end-to-end, so there's a small chance of a typo surfacing on
  your first `npm start`. If you hit a compile error, paste it back to me and I'll
  patch it immediately — the code was written carefully and structurally checked
  (balanced braces/parens), but wasn't run through the real Angular compiler here.
- To deploy: `ng build` produces static files in `dist/fretboard-atlas` that you can
  host anywhere static files work (Netlify, Vercel, GitHub Pages, etc.).
