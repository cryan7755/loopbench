# Loopbench

A browser-based EDM and trance song generator. Press **New song** and it writes and plays a complete track: intro, verses, breakdowns, builds, drops with a key change, and an outro, in any of 15 genres, with synths, sampled instruments and sung vocals. Songs can be exported as WAV audio or as multitrack MIDI for finishing in a DAW.

Everything runs in the browser. The built app is a single self-contained HTML file with no server and no external dependencies.

## Features

- **20 genres:** trance, big room, progressive house, future bass, melodic dubstep, drum & bass, techno, tech house, deep house, psytrance, hardstyle, synthwave, UK garage, festival trap, eurodance, plus band genres: rock, alt rock, metal, pop and dance pop
- **Band genres** use a recorded electric guitar through a simulated amp and cabinet (clean, crunch, distortion, palm-muted chugs, double-tracked left and right), a bass guitar part, and a recorded acoustic drum kit; sections become intro, verse, pre-chorus, chorus and bridge
- **Full song forms:** classic, cold open, extended mix, fake-out drop, radio edit, with section lengths chosen per song from its tempo and phrase length, so no two songs share the same structure
- **Composed, not just randomised:** each section has its own progression with a harmonic job (the verse settles, the pre-chorus ends on a dominant that resolves into the chorus, the bridge contrasts), built from harmonic function and coloured per genre with borrowed chords, secondary dominants, the harmonic-minor V and bass-smoothing inversions, then voice-led so chords glide; hooks and vocal lines are written as sentences or question-and-answer periods, generated dozens of times and ranked by rules from music-cognition research (chord tones on strong beats, resolved leaps, a single well-placed peak, a firm cadence, a middle amount of predictability)
- **One motif through the song:** the hook's opening figure is the song's motif; the chorus vocal sings and sequences it, the verse fragments and inverts it lower down and ends open, the pre-chorus climbs by sequencing it upward, and the chorus holds the song's highest sung note; vocals lean on strong beats with appoggiaturas that resolve by step
- **Melodic bass lines:** the bass steps into chord changes with approach notes and chooses octaves that move against the melody, avoiding parallel octaves and fifths (genres built on a held bass keep it)
- **A song critic:** every song can be scored out of 100 across six areas (the Song report button, or `npm run critic` for a report across genres)
- **A planned energy arc:** each bar's intensity is measured and its texture (hi-hats, shaker, open hats, counter melody, filter, guitar level) shaped toward a curve: intro rising, verses moderate, builds climbing, breakdowns dipping, the final drop as the peak, the outro fading
- **Arranged as an ensemble:** one foreground melody at a time (the lead answers in the singer's gaps; in EDM drops the voice doubles the hook), supporting lines kept above the melody and away from its new notes, and no semitone clashes between lines
- **Per-song variety:** sound design, chord language (7ths, add9, sus), melody style, build recipe, drum kit, delay timing and trance gates all vary per song
- **Sound palettes:** hybrid, orchestral (no synths) or all synth; recorded string sections, solo violin, cellos, contrabass, harp, grand piano, choir and orchestral percussion; recorded sung vocals
- **Mix and master:** drum bus with parallel compression and saturation, key-tuned kicks, drum accents and groove, stereo widening, master EQ, soft clipping, glue compression and limiting
- **Your own samples:** drop in kicks, claps, hats, lead/bass/pad notes or a vocal chop
- **Edit generated songs:** a piano roll for the lead, vocal, bass and drums of any section, 4 bars at a time; edits are saved with the song, shown in orange, undoable, and included in playback, WAV and MIDI exports and favorites
- **Song codes:** every song is reproducible from a short code like `trance-LGKB6R`; reroll just the hook, chords, bass, vocal, groove, sounds or structure
- **Export:** WAV (rendered offline, normalised) and MIDI (one track per part, with section markers)
- **Smooth playback:** bars are pre-rendered on background audio threads, so older CPUs play without dropouts

## Quick start

Requires Node.js 20 or newer (22 recommended).

```sh
npm ci           # installs the audio library used by the tests
npm run build    # writes dist/loopbench.html
```

Open `dist/loopbench.html` in Chrome or Edge. While working on the code, `npm run watch` rebuilds on every save; refresh the browser to see changes.

```sh
npm test         # generation, composition, harmony, arrangement, energy, critic, exports and audio (~2 min)
npm run critic   # score generated songs in every genre (add a number for songs per genre, or genre names)
```

## How the code is organised

The app is plain JavaScript with no framework. `scripts/build.mjs` joins the files in `src/` in numeric order and inlines the audio from `assets/` into one HTML page. The source files are classic scripts that share one global scope, just as when the app was a single file, so a function in one file can call a function in another directly. The numeric prefix is the load order.

| File | What it does |
|---|---|
| `src/index.template.html` | Page markup and styles |
| `src/01-core-state.js` | Constants, grid patterns, saved settings |
| `src/02-audio-engine.js` | Audio graph (reverb, delay, chorus, sidechain bus, filters) and drum voices |
| `src/03-patches.js` | Synth and sampled-instrument patch presets, sample loading |
| `src/04-voices.js` | Synth voice engine, sampler, your sample slots, sound-palette routing |
| `src/05-vocals-and-fx.js` | Sampled and synthesized vocals, risers, downlifters, impacts |
| `src/06-song-generator.js` | Seeds and song codes, genres, scales and chords, melodies, sound DNA |
| `src/07-arrangement.js` | Song forms and section builders (`generateBar`) |
| `src/08-export.js` | WAV and MIDI export, downloads |
| `src/09-bar-patterns.js` | Intro, verse, build and drop bar patterns |
| `src/10-step-playback.js` | Plays one step of a bar (every instrument and effect) |
| `src/11-playback-engine.js` | Live scheduler, background pre-rendering, start and stop |
| `src/12-ui.js`, `src/13-controls.js` | Interface and controls |
| `src/14-harmony.js` | Functional chord progressions and voice-led chord voicings |
| `src/15-composer.js` | Melody writing: phrase shapes, generate-and-rank, the melody critic |
| `src/16-band.js` | Band genres: guitar amp simulation, guitar and bass parts, live drum arrangement |
| `src/17-editor.js` | Song editor: piano roll, per-bar edits applied on top of the generated song, undo |
| `src/18-ensemble.js` | Ensemble arranger: one foreground melody, separate registers, no semitone rubs; plus the audit used by the tests |
| `src/19-energy.js` | Energy arc: measures each bar's intensity and shapes texture toward a target curve per section |
| `src/20-bassline.js` | Bass lines and counterpoint: approach notes into chord changes, contrary motion against the melody |
| `src/21-critic.js` | The critic: scores a whole song for melody, harmony, ensemble, counterpoint, energy and structure |
| `assets/samples/<instrument>/<midi-note>.mp3` | Instrument samples |
| `assets/vocals/<bank>/<midi-note>.wav` | Vocal samples; loop points in `loops.json` |
| `tests/` | Test suite (`node --test`) |

The split into files follows the original single-file layout, so a few files hold more than their name suggests. Moving code between files is safe: the build joins them into one script, so function declarations are visible everywhere. Only top-level `const` and `let` values need to stay defined before the code that uses them at load time.

## Publishing

Pushing to `main` runs `.github/workflows/deploy.yml`: tests, build, then deploy to GitHub Pages. One-time setup: in the repository go to **Settings → Pages** and set **Source** to **GitHub Actions**. The app is then served at `https://<your-username>.github.io/loopbench/`.

## Licences

The code is MIT licensed (see `LICENSE`). The audio samples come from third parties under their own licences; see [`LICENSES/`](LICENSES/README.md).
