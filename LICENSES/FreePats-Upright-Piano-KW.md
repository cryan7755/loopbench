# Upgraded recorded piano

Release builds download the FreePats **Upright Piano KW** Kawai upright piano recordings:
https://github.com/freepats/upright-piano-KW

The recorded piano is released under **CC0 1.0** (the upstream repository
contains the source recordings, original SFZ mapping and license). Loopbench
transcodes the two velocity layers to MP3 for playback and embeds them in
the downloadable HTML artifact. The resulting HTML remains a single file.
The download/encoding step runs in GitHub Actions using FFmpeg on the Ubuntu
runner. The original bundled piano is retained as a local build fallback.

Source: FreePats Upright Piano KW, 2022-02-21.
Original repository: https://github.com/freepats/upright-piano-KW

Build: `node scripts/install-piano.mjs && npm run build`

Note: Audio recordings remain separate from source control and are installed
during the build. License/source credit is kept here so the build and
redistribution origin can be audited.
